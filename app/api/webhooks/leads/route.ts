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

export async function POST(request: Request) {
  const supabase = createClient()

  try {
    // 1. VERIFICACIÓN DE SEGURIDAD
    const url = new URL(request.url)
    const apiKey = url.searchParams.get("key")

    if (apiKey !== API_SECRET) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 401 })
    }

    // 2. LEER DATOS Y EVITAR ERRORES DE TEST DE WATI
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

    // 3. RECUPERAR EL MENSAJE REAL (como texto “humano”)
    let finalMessage = body.text || ""
    if (body.interactiveButtonReply?.title) finalMessage = `[Botón]: ${body.interactiveButtonReply.title}`
    else if (body.listReply?.title) finalMessage = `[Lista]: ${body.listReply.title}`

    // ✅ NUEVO: candidatos para “primer mensaje”
    // (esto evita que el prefijo [Botón]/[Lista] o signos rompan el match)
    const textCandidates = [
      body.text || "",
      body.interactiveButtonReply?.title || "",
      body.listReply?.title || "",
      finalMessage || "",
    ].filter(Boolean)

    // 4. DATOS BÁSICOS DEL CLIENTE
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

    // =====================================================================
    // 5. 🧠 MOTOR DE REGLAS DINÁMICO (Híbrido)
    // =====================================================================

    let detectedSource = body.source || "WATI / Bot"
    let detectedPrepaga: string | null = null

    // A. Obtener Reglas desde la DB (system_config)
    const { data: configData } = await supabase.from("system_config").select("value").eq("key", "message_source_rules").single()

    const rules = configData?.value || []

    // Ordenar reglas por prioridad (mayor número = mayor prioridad)
    // ✅ copia defensiva para no mutar el array original
    const sortedRules = Array.isArray(rules)
      ? [...rules].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
      : []

    let matchedRule: any = null

    // B. ESTRATEGIA 1: REFERRAL DE META (Código de Anuncio)
    const metaReferralRaw = body.referral || body.sourceId || ""
    const metaReferralNorm = normalizeText(metaReferralRaw)

    if (metaReferralNorm) {
      // ✅ ANTES: solo exact
      // ✅ AHORA: respeta matchType (exact / starts_with / contains)
      matchedRule = sortedRules.find((r: any) => matchRule(metaReferralRaw, r)) || null

      // Si no hubo match por rules, al menos marcamos Meta Ads (ID)
      if (!matchedRule) {
        // mantenemos el ID “real” sin normalizar para que lo veas en UI
        detectedSource = `Meta Ads (${String(metaReferralRaw).trim()})`
      }
    }

    // C. ESTRATEGIA 2: ANÁLISIS DE TEXTO (primer mensaje real)
    if (!matchedRule) {
      // buscamos por prioridad en cualquiera de los candidatos
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

    // D. APLICAR RESULTADO
    if (matchedRule?.source) {
      detectedSource = matchedRule.source
    }

    // E. INTELIGENCIA DE PREPAGA (Deducción inversa)
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

    // 6. GESTIÓN DE LEADS (Insertar o Actualizar)
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, chat, name, notes, prepaga, source")
      .eq("phone", phone)
      .maybeSingle()

    const now = new Date().toISOString()
    const timeString = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })

    // CASO A: YA EXISTE -> ACTUALIZAR
    if (existingLead) {
      let currentChat = existingLead.chat
      if (typeof currentChat === "string") try { currentChat = JSON.parse(currentChat) } catch { currentChat = [] }
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

      // Solo completamos datos si faltaban o si el origen anterior era genérico
      if (!existingLead.prepaga && detectedPrepaga) updates.prepaga = detectedPrepaga
      if ((!existingLead.source || existingLead.source === "WATI / Bot") && detectedSource !== "WATI / Bot") {
        updates.source = detectedSource
      }

      await supabase.from("leads").update(updates).eq("id", existingLead.id)
      return NextResponse.json({ success: true, action: "updated", source: detectedSource }, { status: 200 })
    }

    // CASO B: NUEVO LEAD -> CREAR
    const newLeadData = {
      name: name,
      phone: phone,
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
