import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD
const API_SECRET = "gml_crm_secret_key_2024"

// Helper simple (queda por compatibilidad)
const cleanText = (t: string) => t?.toLowerCase().trim() || ""

// ✅ normalizador fuerte (saca tildes, signos, emojis, espacios raros)
const normalizeText = (input: any) => {
  return String(input || "")
    .toLowerCase()
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

// ✅ matcher universal por matchType
const matchRule = (inputRaw: any, rule: any) => {
  const input = normalizeText(inputRaw)
  const trigger = normalizeText(rule?.trigger)
  const type = rule?.matchType || "contains"

  if (!trigger) return false
  if (type === "exact") return input === trigger
  if (type === "starts_with") return input.startsWith(trigger)
  return input.includes(trigger) // contains
}

// ✅ normaliza a "canon" 10 dígitos (AR) para dedupe
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

    // 2) LEER BODY (y evitar test)
    const body = await request.json()

    if (body.waId === "senderPhone" || body.info === "test_notification") {
      return NextResponse.json({ message: "Test WATI recibido OK" }, { status: 200 })
    }

    // 3) MENSAJE REAL
    let finalMessage = body.text || ""
    if (body.interactiveButtonReply?.title) finalMessage = `[Botón]: ${body.interactiveButtonReply.title}`
    else if (body.listReply?.title) finalMessage = `[Lista]: ${body.listReply.title}`

    // candidatos (para que “primer mensaje” matchee aunque venga con formatos)
    const textCandidates = [
      body.text || "",
      body.interactiveButtonReply?.title || "",
      body.listReply?.title || "",
      finalMessage || "",
    ].filter(Boolean)

    // 4) DATOS CLIENTE
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

    const phoneCanon = normalizePhoneCanon(phone)

    // Logs cortos para debug (no te llena el server)
    console.log(
      "📥 WATI:",
      JSON.stringify({
        phone,
        phoneCanon,
        msg: String(finalMessage || "").slice(0, 80),
        referral: body.referral,
        sourceId: body.sourceId,
      })
    )

    // =====================================================================
    // 5) 🧠 MOTOR DE REGLAS
    // =====================================================================

    let detectedSource = body.source || "WATI / Bot"
    let detectedPrepaga: string | null = null

    // A) Obtener reglas desde system_config (robusto)
    const { data: configData, error: configErr } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "message_source_rules")
      .maybeSingle()

    if (configErr) {
      console.error("❌ Error leyendo system_config(message_source_rules):", configErr)
    }

    let rules: any[] = []
    const rawVal: any = configData?.value

    if (Array.isArray(rawVal)) {
      rules = rawVal
    } else if (typeof rawVal === "string") {
      try {
        const parsed = JSON.parse(rawVal)
        if (Array.isArray(parsed)) rules = parsed
        else if (parsed?.rules && Array.isArray(parsed.rules)) rules = parsed.rules
      } catch (e) {
        console.error("❌ No se pudo parsear message_source_rules:", e)
      }
    } else if (rawVal?.rules && Array.isArray(rawVal.rules)) {
      rules = rawVal.rules
    }

    const sortedRules = Array.isArray(rules)
      ? [...rules].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
      : []

    console.log("🧩 Rules cargadas:", sortedRules.length)

    let matchedRule: any = null

    // B) Referral/SourceId (Meta)
    const metaReferralRaw = body.referral || body.sourceId || ""
    if (String(metaReferralRaw || "").trim()) {
      matchedRule = sortedRules.find((r: any) => matchRule(metaReferralRaw, r)) || null
      if (!matchedRule) {
        detectedSource = `Meta Ads (${String(metaReferralRaw).trim()})`
      }
    }

    // C) Texto (primer mensaje)
    if (!matchedRule && sortedRules.length > 0) {
      for (const rule of sortedRules) {
        let ok = false
        for (const candidate of textCandidates) {
          if (matchRule(candidate, rule)) {
            ok = true
            break
          }
        }
        if (ok) {
          matchedRule = rule
          break
        }
      }
    }

    // D) Aplicar rule
    if (matchedRule?.source) detectedSource = matchedRule.source

    console.log("🏷️ Match:", JSON.stringify({ matched: !!matchedRule, detectedSource }))

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
    // 6) LEADS: Buscar + Update/Insert (por phone_canon)
    // =====================================================================

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

    // A) UPDATE
    if (existingLead) {
      let currentChat = existingLead.chat
      if (typeof currentChat === "string") {
        try {
          currentChat = JSON.parse(currentChat)
        } catch {
          currentChat = []
        }
      }
      if (!Array.isArray(currentChat)) currentChat = []

      const newChatMsg = { user: "Cliente", text: finalMessage, time: timeString, isMe: false }

      const updates: any = {
        chat: [...currentChat, newChatMsg],
        last_update: now,
      }

      // completar canon si faltaba
      if (!existingLead.phone_canon && phoneCanon) updates.phone_canon = phoneCanon

      // completar prepaga si faltaba
      if (!existingLead.prepaga && detectedPrepaga) updates.prepaga = detectedPrepaga

      // actualizar source solo si era genérico
      if ((!existingLead.source || existingLead.source === "WATI / Bot") && detectedSource !== "WATI / Bot") {
        updates.source = detectedSource
      }

      const { error: updErr } = await supabase.from("leads").update(updates).eq("id", existingLead.id)
      if (updErr) {
        console.error("❌ Error update lead:", updErr)
        return NextResponse.json({ error: updErr.message }, { status: 500 })
      }

      return NextResponse.json({ success: true, action: "updated", source: detectedSource }, { status: 200 })
    }

    // B) INSERT
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

    const { error: insErr } = await supabase.from("leads").insert(newLeadData)
    if (insErr) {
      console.error("❌ Error insert lead:", insErr)
      return NextResponse.json({ error: insErr.message }, { status: 500 })
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
