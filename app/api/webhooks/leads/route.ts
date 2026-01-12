import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD
const API_SECRET = "gml_crm_secret_key_2024"

// Helper simple (queda por compatibilidad)
const cleanText = (t: string) => t?.toLowerCase().trim() || ""

// ✅ NUEVO: normalizador fuerte (saca tildes, signos, emojis, espacios raros)
const normalizeText = (input: any) => {
  return String(input || "")
    .toLowerCase()
    .trim()
    .normalize("NFD") // separa acentos
    .replace(/[\u0300-\u036f]/g, "") // borra acentos
    .replace(/[\r\n\t]+/g, " ")
    // deja letras/números/espacios (afuera emojis y signos)
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ✅ NUEVO: matcher universal por matchType
const matchRule = (inputRaw: any, rule: any) => {
  const input = normalizeText(inputRaw)
  const trigger = normalizeText(rule?.trigger)
  const type = rule?.matchType || "contains"

  if (!trigger) return false

  if (type === "exact") return input === trigger
  if (type === "starts_with") return input.startsWith(trigger)
  // default contains
  return input.includes(trigger)
}

// ✅ NUEVO: normaliza a "canon" 10 dígitos (AR) para dedupe
const normalizePhoneCanon = (raw: any) => {
  const d = String(raw || "").replace(/\D+/g, "")
  if (!d) return null

  // WhatsApp AR: 549 + 10 dígitos
  if (d.startsWith("549") && d.length >= 13) return d.substring(3, 13)

  // AR con país: 54 + 10 dígitos
  if (d.startsWith("54") && d.length >= 12) return d.substring(2, 12)

  // 9 + 10 dígitos
  if (d.startsWith("9") && d.length === 11) return d.substring(1)

  // Ya canon
  if (d.length === 10) return d

  // fallback: últimos 10
  return d.length > 10 ? d.slice(-10) : d
}

export async function POST(request: Request) {
  const supabase = createClient()

  try {
    // 1) VERIFICACIÓN DE SEGURIDAD
    const url = new URL(request.url)
    const apiKey = url.searchParams.get("key")

    if (apiKey !== API_SECRET) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 401 })
    }

    // 2) LEER DATOS Y EVITAR ERRORES DE TEST DE WATI
    const body = await request.json()

    console.log(
      "📥 Webhook Entrante:",
      JSON.stringify({
        waId: body.waId,
        text: body.text,
        referral: body.referral,
        sourceId: body.sourceId,
        sourceUrl: body.sourceUrl,
        interactiveTitle: body.interactiveButtonReply?.title,
        listTitle: body.listReply?.title,
      })
    )

    if (body.waId === "senderPhone" || body.info === "test_notification") {
      return NextResponse.json({ message: "Test WATI recibido OK" }, { status: 200 })
    }

    // 3) RECUPERAR EL MENSAJE REAL (como texto “humano”)
    let finalMessage = body.text || ""
    if (body.interactiveButtonReply?.title) finalMessage = `[Botón]: ${body.interactiveButtonReply.title}`
    else if (body.listReply?.title) finalMessage = `[Lista]: ${body.listReply.title}`

    // ✅ candidatos para “primer mensaje”
    const textCandidates = [
      body.text || "",
      body.interactiveButtonReply?.title || "",
      body.listReply?.title || "",
      finalMessage || "",
    ].filter(Boolean)

    // 4) DATOS BÁSICOS DEL CLIENTE
    let phone = ""
    let name = "Desconocido"

    if (body.waId) {
      phone = String(body.waId).replace(/\D/g, "")
      name = body.senderName || "Cliente WhatsApp"
    } else {
      phone = (body.phone || body.telefono || "").replace(/\D/g, "")
      name = body.name || body.nombre || "Cliente Web"
      finalMessage = body.message || body.mensaje || finalMessage || "Consulta Web"
    }

    if (!phone) return NextResponse.json({ message: "Ignored: No valid phone" }, { status: 200 })

    // ✅ ACÁ estaba el bug: phoneCanon no existía
    const phoneCanon = normalizePhoneCanon(phone)

    // =====================================================================
    // 5) 🧠 MOTOR DE REGLAS DINÁMICO (Híbrido)
    // =====================================================================

    let detectedSource = body.source || "WATI / Bot"
    let detectedPrepaga: string | null = null

    // A) Obtener reglas desde system_config
    const { data: configData } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "message_source_rules")
      .single()

    const rules = configData?.value || []

    // ✅ copia defensiva para no mutar el array original
    const sortedRules = Array.isArray(rules)
      ? [...rules].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
      : []

    let matchedRule: any = null

    // B) Estrategia 1: Referral/SourceId (Meta)
    const metaReferralRaw = body.referral || body.sourceId || ""

    if (String(metaReferralRaw || "").trim()) {
      // respeta matchType
      matchedRule = sortedRules.find((r: any) => matchRule(metaReferralRaw, r)) || null

      if (!matchedRule) {
        detectedSource = `Meta Ads (${String(metaReferralRaw).trim()})`
      }
    }

    // C) Estrategia 2: Texto (primer mensaje real)
    if (!matchedRule) {
      for (const rule of sortedRules) {
        let isMatch = false
        for (const candidate of textCandidates) {
          if (matchRule(candidate, rule)) {
            isMatch = true
            break
          }
        }
        if (isMatch) {
          matchedRule = rule
          break
        }
      }
    }

    // D) Aplicar resultado
    if (matchedRule?.source) {
      detectedSource = matchedRule.source
    }

    // E) Deducción inversa prepaga
    const sourceLower = cleanText(detectedSource)
    if (sourceLower.includes("doctored") || sourceLower.includes("docto red")) detectedPrepaga = "DoctoRed"
    else if (sourceLower.includes("prevencion") || sourceLower.includes("prevención")) detectedPrepaga = "Prevencion"
    else if (sourceLower.includes("sancor")) detectedPrepaga = "Sancor"
    else if (sourceLower.includes("galeno")) detectedPrepaga = "Galeno"
    else if (sourceLower.includes("swiss")) detectedPrepaga = "Swiss Medical"
    else if (sourceLower.includes("osde")) detectedPrepaga = "Osde"
    else if (sourceLower.includes("avalian")) detectedPrepaga = "Avalian"
    else if (sourceLower.includes("ampf")) detectedPrepaga = "AMPF"

    // =====================================================================
    // 6) GESTIÓN DE LEADS (Insertar o Actualizar)
    // =====================================================================

    // Buscar por phone_canon cuando exista; fallback a phone
    let existingLead: any = null

    if (phoneCanon) {
      const { data } = await supabase
        .from("leads")
        .select("id, chat, name, notes, prepaga, source, phone_canon")
        .eq("phone_canon", phoneCanon)
        .maybeSingle()
      existingLead = data
    } else {
      const { data } = await supabase
        .from("leads")
        .select("id, chat, name, notes, prepaga, source, phone_canon")
        .eq("phone", phone)
        .maybeSingle()
      existingLead = data
    }

    const now = new Date().toISOString()
    const timeString = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })

    // CASO A: YA EXISTE -> ACTUALIZAR
    if (existingLead) {
      let currentChat = existingLead.chat
      if (typeof currentChat === "string") {
        try { currentChat = JSON.parse(currentChat) } catch { currentChat = [] }
      }
      if (!Array.isArray(currentChat)) currentChat = []

      const newChatMsg = {
        user: "Cliente",
        text: finalMessage,
        time: timeString,
        isMe: false,
      }

      const updates: any = {
        chat: [...currentChat, newChatMsg],
        last_update: now,
      }

      // ✅ completar canon si faltaba
      if (!existingLead.phone_canon && phoneCanon) updates.phone_canon = phoneCanon

      // completar prepaga si faltaba
      if (!existingLead.prepaga && detectedPrepaga) updates.prepaga = detectedPrepaga

      // actualizar source solo si era genérico
      if ((!existingLead.source || existingLead.source === "WATI / Bot") && detectedSource !== "WATI / Bot") {
        updates.source = detectedSource
      }

      await supabase.from("leads").update(updates).eq("id", existingLead.id)
      return NextResponse.json({ success: true, action: "updated", source: detectedSource }, { status: 200 })
    }

    // CASO B: NUEVO LEAD -> CREAR
    const newLeadData: any = {
      name,
      phone,
      phone_canon: phoneCanon, // ✅ CLAVE
      source: detectedSource,
      status: "nuevo",
      agent_name: null,
      chat: [{ user: "Cliente", text: finalMessage, time: timeString, isMe: false }],
      notes: `Ingreso automático. Mensaje: "${finalMessage}"`,
      prepaga: detectedPrepaga,
      created_at: now,
      last_update: now,
    }

    const { error } = await supabase.from("leads").insert(newLeadData)

    if (error) {
      console.error("Error DB:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, action: "created", source: detectedSource }, { status: 200 })
  } catch (e: any) {
    console.error("❌ Error Fatal:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "Online 🟢" })
}
