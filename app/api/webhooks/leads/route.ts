import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD
const API_SECRET = "gml_crm_secret_key_2024"

// 🔧 VERSION TAG (para verificar deploy en logs)
const ROUTE_VERSION = "webhooks/leads route v_emoji_fallback_2026-01-16_02"

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

// 🔧 detectar emoji / non-ascii en trigger
const hasNonAscii = (s: any) => /[^\x00-\x7F]/.test(String(s || ""))

// 🔧 matcher: si trigger tiene emoji => match crudo; si no => match normalizado
const matchRule = (inputRaw: any, rule: any) => {
  const rawInput = String(inputRaw || "")
  const rawTrigger = String(rule?.trigger || "")
  const type = rule?.matchType || "contains"
  if (!rawTrigger.trim()) return false

  if (hasNonAscii(rawTrigger)) {
    const input = rawInput.trim()
    const trigger = rawTrigger.trim()
    if (type === "exact") return input === trigger
    if (type === "starts_with") return input.startsWith(trigger)
    return input.includes(trigger)
  }

  const input = normalizeText(rawInput)
  const trigger = normalizeText(rawTrigger)
  if (!trigger) return false
  if (type === "exact") return input === trigger
  if (type === "starts_with") return input.startsWith(trigger)
  return input.includes(trigger)
}

// ✅ normaliza a "canon" 10 dígitos (AR) para dedupe
const normalizePhoneCanon = (raw: any) => {
  const d = String(raw || "").replace(/\D+/g, "")
  if (!d) return null
  if (d.startsWith("549") && d.length >= 13) return d.substring(3, 13)
  if (d.startsWith("54") && d.length >= 12) return d.substring(2, 12)
  if (d.startsWith("9") && d.length === 11) return d.substring(1)
  if (d.length === 10) return d
  return d.length > 10 ? d.slice(-10) : d
}

// ✅ helper: detectar prepaga (badge)
const detectPrepagaFromAny = (...inputs: any[]): string | null => {
  const joined = inputs
    .filter(Boolean)
    .map((v) => String(v).toLowerCase())
    .join(" | ")

  if (joined.includes("doctored") || joined.includes("docto red")) return "DoctoRed"
  if (joined.includes("prevencion")) return "Prevención"
  if (joined.includes("sancor")) return "Sancor"
  if (joined.includes("galeno")) return "Galeno"
  if (joined.includes("swiss")) return "Swiss Medical"
  if (joined.includes("osde")) return "Osde"
  if (joined.includes("avalian")) return "Avalian"
  if (joined.includes("ampf")) return "AMPF"
  return null
}

// ✅ helper: log de eventos sin romper webhook si falla
async function safeLeadEvent(
  supabase: any,
  evt: {
    lead_id?: string | null
    phone_canon?: string | null
    source: string
    event_type: string
    actor_name?: string | null
    summary?: string | null
    payload?: any
  }
) {
  try {
    const { error } = await supabase.from("lead_events").insert({
      lead_id: evt.lead_id ?? null,
      phone_canon: evt.phone_canon ?? null,
      source: evt.source,
      event_type: evt.event_type,
      actor_name: evt.actor_name ?? null,
      summary: evt.summary ?? null,
      payload: evt.payload ?? null,
    })
    if (error) console.error("❌ lead_events insert error:", error)
  } catch (e: any) {
    console.error("❌ lead_events insert fatal:", e?.message || e)
  }
}

// ============================================================================
// 🟦 FORM HANDLER (Landing) — para cuando el formulario pega a /api/webhooks/leads
// ============================================================================
async function handleLandingPayload(supabase: any, body: any) {
  const onlyDigits = (v: any) => String(v || "").replace(/\D+/g, "")

  const nombre = (body.nombre || body.name || "Sin Nombre").toString().trim()
  const telefono = onlyDigits(body.telefono || body.phone)
  const phoneCanon = normalizePhoneCanon(telefono)
  const cp = (body.cp || body.zip || "").toString().trim()
  const provincia = (body.provincia || body.province || "").toString().trim()
  const landing_url = (body.landing_url || "").toString().trim()
  const ref = (body.ref || "").toString().trim()
  const sourceFromLanding = (body.source || "").toString().trim()

  if (!telefono) {
    return NextResponse.json({ success: false, error: "No phone" }, { status: 200 })
  }

  await safeLeadEvent(supabase, {
    lead_id: null,
    phone_canon: phoneCanon,
    source: "landing",
    event_type: "form_submit",
    actor_name: "Cliente",
    summary: `Formulario: ${nombre} (${telefono})`,
    payload: body,
  })

  let finalTag = sourceFromLanding || "Formulario - DoctoRed"

  if (ref) {
    const { data: config } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "message_source_rules")
      .limit(1)

    if (config && config.length > 0) {
      const rules = (config[0] as any).value || []
      const match = rules.find((r: any) => {
        if (r.matchType === "exact") return r.trigger === ref
        return String(ref).includes(r.trigger)
      })
      if (match) finalTag = match.source
      else finalTag = `Meta Ads (${ref})`
    } else {
      finalTag = `Meta Ads (${ref})`
    }
  }

  const detectedPrepaga =
    (body.prepaga || body.prepaga_name || body.interest || body.plan || "").toString().trim() ||
    detectPrepagaFromAny(finalTag, sourceFromLanding, landing_url, ref)

  const now = new Date().toISOString()

  const baseFind = supabase.from("leads").select("id, source, notes, phone_canon, prepaga")
  const { data: existingLead } = phoneCanon
    ? await baseFind.eq("phone_canon", phoneCanon).maybeSingle()
    : await baseFind.eq("phone", telefono).maybeSingle()

  const extraNotesParts: string[] = []
  if (landing_url) extraNotesParts.push(`Landing URL: ${landing_url}`)
  if (cp) extraNotesParts.push(`CP: ${cp}`)
  if (provincia) extraNotesParts.push(`Provincia: ${provincia}`)
  const extraNotes = extraNotesParts.join(" | ")

  if (existingLead?.id) {
    const updates: any = { last_update: now }
    if (!existingLead.phone_canon && phoneCanon) updates.phone_canon = phoneCanon
    if (!existingLead.prepaga && detectedPrepaga) updates.prepaga = detectedPrepaga
    if (provincia) updates.province = provincia
    if (cp) updates.zip = cp
    if (extraNotes) {
      const prev = (existingLead.notes || "").toString()
      updates.notes = prev ? `${prev}\n${extraNotes}` : extraNotes
    }
    if (!existingLead.source || existingLead.source === "WATI / Bot") {
      updates.source = finalTag
    }

    const { error: updErr } = await supabase.from("leads").update(updates).eq("id", existingLead.id)
    if (updErr) return NextResponse.json({ success: false, error: updErr.message }, { status: 200 })

    return NextResponse.json({ success: true, action: "updated", kind: "landing" }, { status: 200 })
  }

  const { error: insErr } = await supabase.from("leads").insert({
    name: nombre,
    phone: telefono,
    phone_canon: phoneCanon,
    source: finalTag,
    status: "nuevo",
    notes: extraNotes || null,
    province: provincia || null,
    zip: cp || null,
    created_at: now,
    last_update: now,
    agent_name: null,
    prepaga: detectedPrepaga || null,
    assigned_to: null,
  })

  if (insErr) return NextResponse.json({ success: false, error: insErr.message }, { status: 200 })

  return NextResponse.json({ success: true, action: "created", kind: "landing" }, { status: 200 })
}

export async function POST(request: Request) {
  const supabase = createClient()

  try {
    const url = new URL(request.url)
    const apiKey = url.searchParams.get("key")
    if (apiKey !== API_SECRET) {
      return NextResponse.json({ error: "Acceso denegado" }, { status: 401 })
    }

    const body = await request.json()

    // ✅ Landing (no trae waId)
    if (!body?.waId) return await handleLandingPayload(supabase, body)

    // ✅ Test
    if (body.waId === "senderPhone" || body.info === "test_notification") {
      return NextResponse.json({ message: "Test WATI recibido OK" }, { status: 200 })
    }

    // ✅ MENSAJE REAL
    let finalMessage = body.text || ""
    if (body.interactiveButtonReply?.title) finalMessage = `[Botón]: ${body.interactiveButtonReply.title}`
    else if (body.listReply?.title) finalMessage = `[Lista]: ${body.listReply.title}`

    const textCandidates = [
      body.text || "",
      body.message || "",
      body.interactiveButtonReply?.title || "",
      body.listReply?.title || "",
      finalMessage || "",
    ].filter(Boolean)

    // 🔧 Texto combinado (crudo y normalizado) para diagnóstico + fallback
    const rawCombined = textCandidates.join(" | ")
    const normCombined = normalizeText(rawCombined)

    // ✅ DATOS CLIENTE
    let phone = ""
    let name = "Desconocido"
    if (body.waId) {
      phone = String(body.waId).replace(/\D/g, "")
      name = body.senderName || "Cliente WhatsApp"
    }

    if (!phone) return NextResponse.json({ message: "Ignored: No valid phone" }, { status: 200 })
    const phoneCanon = normalizePhoneCanon(phone)

    // 🔧 Log clave para verificar deploy + texto recibido
    console.log(
      "🧾 ROUTE_VERSION:",
      ROUTE_VERSION,
      JSON.stringify({ phoneCanon, raw: rawCombined.slice(0, 140), norm: normCombined.slice(0, 140) })
    )

    await safeLeadEvent(supabase, {
      lead_id: null,
      phone_canon: phoneCanon,
      source: "wati",
      event_type: "wati_inbound",
      actor_name: "Cliente",
      summary: rawCombined.slice(0, 160),
      payload: body,
    })

    // =====================================================================
    // 🧠 MOTOR DE REGLAS (WATI)
    // =====================================================================

    let detectedSource = body.source || "WATI / Bot"

    const { data: configData } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "message_source_rules")
      .maybeSingle()

    let rules: any[] = []
    const rawVal: any = configData?.value
    if (Array.isArray(rawVal)) rules = rawVal
    else if (typeof rawVal === "string") {
      try {
        const parsed = JSON.parse(rawVal)
        if (Array.isArray(parsed)) rules = parsed
        else if (parsed?.rules && Array.isArray(parsed.rules)) rules = parsed.rules
      } catch {}
    } else if (rawVal?.rules && Array.isArray(rawVal.rules)) {
      rules = rawVal.rules
    }

    const sortedRules = Array.isArray(rules)
      ? [...rules].sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
      : []

    let matchedRule: any = null

    // 1) Referral/SourceId (si llega)
    const metaReferralRaw = body.referral || body.sourceId || ""
    if (String(metaReferralRaw || "").trim()) {
      matchedRule = sortedRules.find((r: any) => matchRule(metaReferralRaw, r)) || null
      if (!matchedRule) detectedSource = `Meta Ads (${String(metaReferralRaw).trim()})`
    }

    // 2) Texto combinado (una sola pasada) — soporta emojis
    if (!matchedRule && sortedRules.length > 0) {
      matchedRule = sortedRules.find((r: any) => matchRule(rawCombined, r)) || null
    }

    if (matchedRule?.source) detectedSource = matchedRule.source

    // 3) Fallback Google Ads por texto (sin depender de reglas)
    if (!matchedRule) {
      if (normCombined.includes("doctored") || normCombined.includes("docto red")) detectedSource = "Google Ads - DoctoRed"
      else if (normCombined.includes("prevencion")) detectedSource = "Google Ads - Prevención"
    }

    console.log("🏷️ Match:", JSON.stringify({ matched: !!matchedRule, detectedSource }))

    // ✅ Badge/prepaga desde source + texto (robusto)
    const detectedPrepaga =
      detectPrepagaFromAny(detectedSource, normCombined) || null

    // =====================================================================
    // LEADS upsert (por phone_canon)
    // =====================================================================

    const { data: existingLead } = await supabase
      .from("leads")
      .select("id, chat, prepaga, source, phone_canon")
      .eq("phone_canon", phoneCanon)
      .maybeSingle()

    const now = new Date().toISOString()
    const timeString = new Date().toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })

    if (existingLead?.id) {
      let currentChat = existingLead.chat
      if (typeof currentChat === "string") {
        try { currentChat = JSON.parse(currentChat) } catch { currentChat = [] }
      }
      if (!Array.isArray(currentChat)) currentChat = []

      const updates: any = {
        chat: [...currentChat, { user: "Cliente", text: finalMessage, time: timeString, isMe: false }],
        last_update: now,
      }

      if (!existingLead.prepaga && detectedPrepaga) updates.prepaga = detectedPrepaga

      // ✅ PREMIUM: si Matcheó una regla, "subimos" el source aunque venga como Meta Ads (ID)
      // y si el source actual es genérico (vacío / WATI / Meta Ads (123...)) también lo actualizamos.
      const metaIdRe = /^Meta Ads \(\d+\)$/
      const hasMatchedRule = !!matchedRule
      const existingIsGeneric =
        !existingLead.source || existingLead.source === "WATI / Bot" || metaIdRe.test(existingLead.source)

      if (detectedSource && detectedSource !== "WATI / Bot") {
        if (hasMatchedRule || existingIsGeneric) {
          updates.source = detectedSource
        }
      }

      const { error: updErr } = await supabase.from("leads").update(updates).eq("id", existingLead.id)
      if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

      return NextResponse.json({ success: true, action: "updated", source: detectedSource }, { status: 200 })
    }

    const { error: insErr } = await supabase.from("leads").insert({
      name,
      phone,
      phone_canon: phoneCanon,
      source: detectedSource,
      status: "nuevo",
      agent_name: null,
      chat: [{ user: "Cliente", text: finalMessage, time: timeString, isMe: false }],
      notes: `Ingreso automático. Mensaje: "${finalMessage}"`,
      prepaga: detectedPrepaga,
      created_at: now,
      last_update: now,
    })

    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 })

    return NextResponse.json({ success: true, action: "created", source: detectedSource }, { status: 200 })
  } catch (e: any) {
    console.error("❌ Error Fatal:", e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ status: "Online 🟢" })
}
