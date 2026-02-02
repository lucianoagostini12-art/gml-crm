"use server"

import OpenAI from "openai"
import { createServerClient } from "@/lib/supabase-server"

type AIResult =
  | { success: true; text: string }
  | { success: false; text: string; silent?: boolean }

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) {
  console.error("❌ ERROR CRÍTICO: No se encontró la OPENAI_API_KEY.")
}

const openai = new OpenAI({ apiKey: apiKey || "" })

function normalize(s: string) {
  return String(s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim()
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function nextBusinessDayLabel(dayIndex: number) {
  // 0 Domingo, 1 Lunes ... 6 Sábado
  if (dayIndex === 5) return "el lunes a primera hora"
  if (dayIndex === 6) return "el lunes a primera hora"
  if (dayIndex === 0) return "el lunes a primera hora"
  return "mañana a primera hora"
}

function parseHHMM(s: string) {
  const m = String(s || "").match(/^(\d{1,2}):(\d{2})$/)
  if (!m) return null
  const hh = Math.max(0, Math.min(23, parseInt(m[1], 10)))
  const mm = Math.max(0, Math.min(59, parseInt(m[2], 10)))
  return hh * 60 + mm
}

function isWithinWindow(nowMin: number, startMin: number, endMin: number) {
  // Maneja ventanas que cruzan medianoche (ej 22:00-02:00)
  if (startMin === endMin) return true
  if (startMin < endMin) return nowMin >= startMin && nowMin <= endMin
  return nowMin >= startMin || nowMin <= endMin
}

function getNowParts(tz: string) {
  const now = new Date()
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(now)

  const weekday = (parts.find((p) => p.type === "weekday")?.value || "").toLowerCase()
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10)
  const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10)

  // Map "mon/tue/..." to JS dayIndex (0=Sun)
  const map: Record<string, number> = {
    sun: 0,
    mon: 1,
    tue: 2,
    wed: 3,
    thu: 4,
    fri: 5,
    sat: 6,
  }
  const dayIndex = map[weekday.slice(0, 3)] ?? new Date().getDay()

  return { dayIndex, hour, minute, nowMin: hour * 60 + minute }
}

type SofiaSchedule = {
  office_enabled: boolean
  office_tz: string
  office_days: number[]
  office_start: string
  office_end: string
  is24h: boolean
  off_hours_message: string

  guard_enabled: boolean
  guard_days: number[]
  guard_start: string
  guard_end: string
}

async function getScheduleSettings(): Promise<SofiaSchedule> {
  // Defaults seguros (igual a tu UI)
  const defaults: SofiaSchedule = {
    office_enabled: true,
    office_tz: "America/Argentina/Buenos_Aires",
    office_days: [1, 2, 3, 4, 5],
    office_start: "09:30",
    office_end: "14:30",
    is24h: false,
    off_hours_message: "",

    guard_enabled: false,
    guard_days: [6, 0],
    guard_start: "10:00",
    guard_end: "20:00",
  }

  try {
    const supabase = await createServerClient()
    const { data, error } = await supabase
      .from("ai_settings")
      .select("key,value")
      .in("key", [
        "office_enabled",
        "office_tz",
        "office_days",
        "office_start",
        "office_end",
        "is24h",
        "off_hours_message",
        "guard_enabled",
        "guard_days",
        "guard_start",
        "guard_end",
      ])

    if (error) throw error
    const map: Record<string, any> = {}
    for (const row of data || []) map[String((row as any).key)] = (row as any).value

    const office_days = (() => {
      try {
        const v = JSON.parse(map.office_days || "[]")
        return Array.isArray(v) ? v.map((n: any) => parseInt(n, 10)).filter((n: any) => Number.isFinite(n)) : defaults.office_days
      } catch {
        return defaults.office_days
      }
    })()

    const guard_days = (() => {
      try {
        const v = JSON.parse(map.guard_days || "[]")
        return Array.isArray(v) ? v.map((n: any) => parseInt(n, 10)).filter((n: any) => Number.isFinite(n)) : defaults.guard_days
      } catch {
        return defaults.guard_days
      }
    })()

    const toBool = (x: any, fallback: boolean) => {
      if (typeof x === "boolean") return x
      if (typeof x === "string") {
        const t = x.toLowerCase().trim()
        if (t === "true") return true
        if (t === "false") return false
      }
      return fallback
    }

    return {
      office_enabled: toBool(map.office_enabled, defaults.office_enabled),
      office_tz: typeof map.office_tz === "string" && map.office_tz ? map.office_tz : defaults.office_tz,
      office_days: office_days.length ? office_days : defaults.office_days,
      office_start: typeof map.office_start === "string" && map.office_start ? map.office_start : defaults.office_start,
      office_end: typeof map.office_end === "string" && map.office_end ? map.office_end : defaults.office_end,
      is24h: toBool(map.is24h, defaults.is24h),
      off_hours_message: typeof map.off_hours_message === "string" ? map.off_hours_message : defaults.off_hours_message,

      guard_enabled: toBool(map.guard_enabled, defaults.guard_enabled),
      guard_days: guard_days.length ? guard_days : defaults.guard_days,
      guard_start: typeof map.guard_start === "string" && map.guard_start ? map.guard_start : defaults.guard_start,
      guard_end: typeof map.guard_end === "string" && map.guard_end ? map.guard_end : defaults.guard_end,
    }
  } catch {
    return defaults
  }
}

async function getSofiaPromptBase(): Promise<string> {
  try {
    const supabase = await createServerClient()
    const { data } = await supabase
      .from("ai_settings")
      .select("value")
      .eq("key", "sofia_system_prompt")
      .single()

    const v = String((data as any)?.value || "").trim()
    if (v) return v
  } catch {
    // silent fallback
  }
  return ""
}

function enforceNoObraSocial(text: string) {
  return text.replace(/\bobras?\s+social(es)?\b/gi, "cobertura de salud")
}

function blockTechnicalFailures(text: string) {
  let t = text
  t = t.replace(/se (me )?cort[óo]( la| mi)? (llamada|conversaci[oó]n|conexi[oó]n)/gi, "")
  t = t.replace(/parece que se cort[óo]/gi, "")
  t = t.replace(/disculp[aá],?\s*parece que/gi, "")
  t = t.replace(/llamada anterior/gi, "mensaje anterior")
  t = t.replace(/\n\s*\n\s*\n/g, "\n\n").trim()
  return t
}

function limitToOneQuestion(text: string) {
  const qCount = (text.match(/\?/g) || []).length
  if (qCount <= 1) return text
  const i = text.indexOf("?")
  if (i >= 0) return text.slice(0, i + 1).trim()
  return text
}

function limitToMaxLines(text: string, maxLines: number) {
  const lines = text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

  if (lines.length <= maxLines) return text.trim()
  return lines.slice(0, maxLines).join("\n").trim()
}

function limitToMaxChars(text: string, maxChars: number) {
  const t = text.trim()
  if (t.length <= maxChars) return t
  const window = Math.max(100, maxChars - 60)
  const slice = t.slice(0, maxChars)

  const candidates = [
    slice.lastIndexOf(". "),
    slice.lastIndexOf("! "),
    slice.lastIndexOf("? "),
    slice.lastIndexOf("…"),
    slice.lastIndexOf("\n"),
    slice.lastIndexOf("; "),
  ].filter((i) => i >= window)

  const best = candidates.length ? Math.max(...candidates) : -1
  if (best >= window) return slice.slice(0, best + 1).trim()

  const lastSpace = slice.lastIndexOf(" ")
  if (lastSpace >= window) return slice.slice(0, lastSpace).trim()
  return slice.trim()
}

function limitToMaxEmojis(text: string, maxEmojis: number) {
  const emojiRegex = /([\u{1F300}-\u{1F6FF}]|[\u{1F900}-\u{1FAFF}]|[\u2600-\u27BF])/gu
  const matches = text.match(emojiRegex) || []
  if (matches.length <= maxEmojis) return text

  let kept = 0
  return text.replace(emojiRegex, (m) => {
    if (kept < maxEmojis) {
      kept += 1
      return m
    }
    return ""
  })
}

function postProcess(raw: string) {
  let t = normalize(raw)
  t = enforceNoObraSocial(t)
  t = blockTechnicalFailures(t)
  t = limitToOneQuestion(t)
  t = limitToMaxLines(t, 4)
  t = limitToMaxEmojis(t, 2)
  t = limitToMaxChars(t, 1200)
  return t
}

function buildHistoryFromIsMe(chatHistory: any[]) {
  const recentChat = chatHistory.slice(-20)

  const msgs = recentChat
    .map((m: any) => ({
      role: m?.isMe ? ("assistant" as const) : ("user" as const),
      text: normalize(String(m?.content || m?.text || "")),
    }))
    .filter((m: any) => m.text)

  if (msgs.length === 0) return { lastUserText: "", history: [] as any[] }

  let lastUserText = msgs[msgs.length - 1].text
  const before = msgs.slice(0, -1)

  const history: { role: "user" | "assistant"; content: string }[] = []
  for (const m of before) {
    const prev = history[history.length - 1]
    if (prev && prev.role === m.role) prev.content += " | " + m.text
    else history.push({ role: m.role, content: m.text })
  }

  if (history.length > 0 && history[history.length - 1].role === "user") {
    const dangling = history.pop()!.content
    lastUserText = dangling + " | " + lastUserText
  }

  return { lastUserText, history }
}

function isRateLimitError(e: any) {
  const msg = String(e?.message || "").toLowerCase()
  const status = e?.status
  return status === 429 || msg.includes("rate limit") || msg.includes("quota") || msg.includes("too many")
}

async function sendWithRetryOpenAI<T>(fn: () => Promise<T>) {
  const maxRetries = 4
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (e: any) {
      if (!isRateLimitError(e) || attempt === maxRetries) throw e
      const wait = Math.min(900 * Math.pow(2, attempt) + Math.random() * 400, 6500)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  return await fn()
}

function extractName(chatHistory: any[]) {
  const userMessages = (chatHistory || [])
    .filter((m: any) => m?.role === "user" || m?.isMe === false)
    .map((m: any) => String(m?.content || m?.text || ""))
    .join(" ")

  const patterns = [
    /\b(?:me llamo|soy|mi nombre es)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]{2,})\b/i,
    /\b(?:llámame|decime)\s+([A-ZÁÉÍÓÚÑa-záéíóúñ]{2,})\b/i,
  ]

  for (const pattern of patterns) {
    const match = userMessages.match(pattern)
    if (match?.[1]) {
      const name = match[1]
      return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
    }
  }
  return null
}

export async function generateAIResponse(chatHistory: any[]): Promise<AIResult> {
  try {
    const schedule = await getScheduleSettings()
    const tz = schedule.office_tz || "America/Argentina/Buenos_Aires"
    const { dayIndex, nowMin } = getNowParts(tz)

    const officeStartMin = parseHHMM(schedule.office_start) ?? 570
    const officeEndMin = parseHHMM(schedule.office_end) ?? 870
    const guardStartMin = parseHHMM(schedule.guard_start) ?? 600
    const guardEndMin = parseHHMM(schedule.guard_end) ?? 1200

    const officeNow =
      !!schedule.office_enabled &&
      Array.isArray(schedule.office_days) &&
      schedule.office_days.includes(dayIndex) &&
      isWithinWindow(nowMin, officeStartMin, officeEndMin)

    const guardNow =
      !!schedule.guard_enabled &&
      Array.isArray(schedule.guard_days) &&
      schedule.guard_days.includes(dayIndex) &&
      isWithinWindow(nowMin, guardStartMin, guardEndMin)

    // IA responde siempre si is24h o si es horario de oficina/guardia (si no, igual responde con contención)
    const aiAlways = !!schedule.is24h
    const advisorsAvailableNow = officeNow || guardNow

    const allText = (chatHistory || []).map((m: any) => String(m?.content || m?.text || "")).join("\n")
    const name = extractName(chatHistory)

    const { lastUserText, history } = buildHistoryFromIsMe(chatHistory)
    if (!lastUserText) return { success: false, text: "No hay mensajes." }

    const userMsgCount = (chatHistory || []).filter((m: any) => m?.role === "user" || m?.isMe === false).length
    const isFirstContact = userMsgCount <= 1

    const fallbackLabel = nextBusinessDayLabel(dayIndex)
    const offHoursCopy =
      (schedule.off_hours_message && String(schedule.off_hours_message).trim()) ||
      `Gracias 🙂 dejo tu consulta registrada. Si hay una asesora disponible te contacta; si no, ${fallbackLabel}.`

    const onlineClosers = [
      `Perfecto${name ? `, ${name}` : ""}. En breve una asesora te va a llamar.`,
      `Listo${name ? `, ${name}` : ""}. Una asesora te contacta en el transcurso del día.`,
      `Genial${name ? `, ${name}` : ""}. En un ratito una asesora te llama para seguir.`,
    ]

    const availableNowClosers = guardNow
      ? [
          `Gracias${name ? `, ${name}` : ""} ✨ lo dejo derivado. Si hay una asesora disponible, puede que te contacten hoy.`,
          `Perfecto${name ? `, ${name}` : ""} 🙂 ya lo dejo derivado. Si hay una asesora libre, te contacta en el transcurso del día.`,
        ]
      : onlineClosers

    const baseFromDb = await getSofiaPromptBase()
    const base = baseFromDb || ""

    const systemInstruction = `
${base}

[[CONTEXTO INTERNO (NO MOSTRAR AL CLIENTE)]]
- Zona horaria: ${tz}
- DiaIndex: ${dayIndex}
- Asesoras disponibles ahora: ${advisorsAvailableNow ? "SI" : "NO"}
- Modo IA 24h: ${aiAlways ? "SI" : "NO"}
- Primer contacto: ${isFirstContact ? "SI" : "NO"}
- Nombre detectado: ${name || "Sin detectar"}

[[REGLAS EXTRA (DURAS)]]
- Nunca uses la palabra "guardia" con el cliente.
- Si Asesoras disponibles ahora = SI, no digas "mañana a primera hora".
- Si el cliente ya aceptó que lo contacten (sí/dale/ok), no vuelvas a pedir datos ni a insistir.

[[CIERRES DISPONIBILIDAD]]
Si Asesoras disponibles ahora = SI: elegí 1 cierre de estos (variar):
${availableNowClosers.map((s) => `- ${s}`).join("\n")}

Si Asesoras disponibles ahora = NO: usá un cierre contenedor (sin prometer hora exacta). Podés usar este:
- ${offHoursCopy}
`

    const messages: { role: "system" | "user" | "assistant"; content: string }[] = [
      { role: "system", content: systemInstruction },
      ...history,
      { role: "user", content: normalize(lastUserText) },
    ]

    const completion = await sendWithRetryOpenAI(() =>
      openai.chat.completions.create({
        model: "gpt-4.1-mini",
        temperature: 0.8,
        top_p: 0.9,
        max_tokens: 420,
        messages,
      })
    )

    const raw = completion?.choices?.[0]?.message?.content || ""
    const response = postProcess(raw)
    return { success: true, text: response }
  } catch (error: any) {
    if (isRateLimitError(error)) return { success: false, text: "", silent: true }
    console.error("❌ Error IA:", { message: error?.message, status: error?.status })
    return { success: false, text: "Perdón 🙂 ¿Tu consulta es por cobertura de salud?" }
  }
}
