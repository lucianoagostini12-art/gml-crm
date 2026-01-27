"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"

type AIResult =
  | { success: true; text: string }
  | { success: false; text: string; silent?: boolean }

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error("❌ ERROR CRÍTICO: No se encontró la GEMINI_API_KEY.")
}

const genAI = new GoogleGenerativeAI(apiKey || "")

// ✅ Modelo estable (evita 404 NotFound)
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

function normalize(s: string) {
  return String(s || "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim()
}

function getTimeContext() {
  const now = new Date()
  const options = {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
  }
  const parts = new Intl.DateTimeFormat("es-AR", options as any).formatToParts(now)

  const day = (parts.find((p) => p.type === "weekday")?.value || "").toLowerCase()
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10)
  const minutes = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10)

  const isWeekend = day.includes("sábado") || day.includes("domingo")
  const isAfterStart = hour > 9 || (hour === 9 && minutes >= 30)
  const isBeforeEnd = hour < 14 || (hour === 14 && minutes <= 30)
  const isWorkHours = !isWeekend && isAfterStart && isBeforeEnd

  return { day, hour, minutes, isWorkHours, isWeekend }
}

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)]
}

function pad2(n: number) {
  return String(n).padStart(2, "0")
}

function nextBusinessDayLabel(day: string) {
  // day viene en es-AR: lunes/martes/miércoles/jueves/viernes/sábado/domingo
  if (day.includes("viernes")) return "el lunes a primera hora"
  if (day.includes("sábado")) return "el lunes a primera hora"
  if (day.includes("domingo")) return "el lunes a primera hora"
  return "mañana a primera hora"
}

function extractName(allText: string) {
  const t = String(allText || "").trim()

  // "me llamo Juan" / "soy Juan" / "soy Juan Pérez"
  const m =
    t.match(/\bme llamo\s+([a-záéíóúñ]{2,})(?:\s+[a-záéíóúñ]{2,})?\b/i) ||
    t.match(/\bsoy\s+([a-záéíóúñ]{2,})(?:\s+[a-záéíóúñ]{2,})?\b/i) ||
    t.match(/\bmi nombre es\s+([a-záéíóúñ]{2,})(?:\s+[a-záéíóúñ]{2,})?\b/i)

  if (!m?.[1]) return null

  const first = m[1]
  // Capitalizar primera letra
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase()
}

function extractSignals(allText: string) {
  const t = (allText || "").toLowerCase()

  let age: number | null = null
  const m =
    t.match(/\btengo\s+(\d{1,3})\b/) ||
    t.match(/\b(\d{1,3})\s*años\b/) ||
    t.match(/\bedad\s*[:=]?\s*(\d{1,3})\b/)
  if (m?.[1]) {
    const n = parseInt(m[1], 10)
    if (!Number.isNaN(n) && n >= 0 && n <= 120) age = n
  }

  const is60plus = typeof age === "number" && age >= 60
  const wantsPrice = /\bprecio\b|\bcu[aá]nto sale\b|\bvalor\b|\bcotiz/i.test(t) || /\$\s*\d/.test(t)
  const hotIntent = /\bquiero (contratar|darme de alta|afiliarme)\b|\bdame de alta\b|\bllamame ya\b|\burgente\b|\bya\b|\bhoy\b/i.test(t)
  const longOrAudio = /\baudio\b|\bnota de voz\b/i.test(t) || t.length > 450

  const medicalOrTurno =
    /\bturno(s)?\b|\bm[eé]dic(o|a)\b|\bguardia\b|\bcl[ií]nic(a|o)\b|\btraumat[oó]log(o|a)\b|\bcardi[oó]log(o|a)\b|\bdermat[oó]log(o|a)\b|\bpediatr(a|o)\b|\bendocrin[oó]log(o|a)\b|\bdolor\b|\bs[ií]ntoma(s)?\b|\breceta\b/i.test(t)

  const urgentSymptom =
    /\bdolor en el pecho\b|\bme duele el pecho\b|\bfalta de aire\b|\bme cuesta respirar\b|\bdesmayo\b|\bme desmaye\b|\bperd[ií] el conocimiento\b|\bpalpitaciones\b/i.test(t)

  const healthIntent =
    /\b(prepaga|cobertura|plan(es)?|salud|cartilla|afiliar|alta|aportes|monotributo|recibo)\b/i.test(t)

  const offTopic = !healthIntent && !wantsPrice && !hotIntent && !medicalOrTurno

  return { age, is60plus, wantsPrice, hotIntent, longOrAudio, medicalOrTurno, urgentSymptom, offTopic }
}

function enforceNoObraSocial(text: string) {
  // Nunca decir "obra social" / "obras sociales"
  return text.replace(/\bobras?\s+social(es)?\b/gi, "cobertura de salud")
}

function enforcePhoneOnly(text: string) {
  let t = text

  // Nunca prometer contacto "por acá"/WhatsApp/escribir
  t = t.replace(/\bwhatsapp\b/gi, "teléfono")
  t = t.replace(/\bpor ac[aá]\b/gi, "por teléfono")
  t = t.replace(/\bte escrib(o|imos|en)\b/gi, "te va a llamar")
  t = t.replace(/\bescribime\b/gi, "dejame tu consulta")
  t = t.replace(/\bmensaje\b/gi, "llamada")

  // Si quedó algo como "te contacto", forzar a llamada
  t = t.replace(/\bte contact(o|amos|an)\b/gi, "te va a llamar")

  return t
}

function limitToOneQuestion(text: string) {
  const qCount = (text.match(/\?/g) || []).length
  if (qCount <= 1) return text
  const i = text.indexOf("?")
  if (i >= 0) return text.slice(0, i + 1).trim()
  return text
}

function limitToTwoLines(text: string) {
  const lines = text
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

  if (lines.length <= 2) return text.trim()
  return lines.slice(0, 2).join("\n").trim()
}

function limitToMaxChars(text: string, maxChars: number) {
  const t = text.trim()
  if (t.length <= maxChars) return t
  // intentar cortar en punto o salto
  const cut = t.lastIndexOf(". ", maxChars)
  if (cut > 50) return (t.slice(0, cut + 1)).trim()
  return t.slice(0, maxChars).trim()
}

function limitToOneEmoji(text: string) {
  const emojiRegex =
    /([\u{1F300}-\u{1F6FF}]|[\u{1F900}-\u{1FAFF}]|[\u2600-\u27BF])/gu

  const matches = text.match(emojiRegex) || []
  if (matches.length <= 1) return text

  let kept = false
  return text.replace(emojiRegex, (m) => {
    if (!kept) {
      kept = true
      return m
    }
    return ""
  })
}

function postProcess(raw: string) {
  let t = normalize(raw)

  t = enforceNoObraSocial(t)
  t = enforcePhoneOnly(t)

  t = limitToOneQuestion(t)
  t = limitToTwoLines(t)
  t = limitToOneEmoji(t)
  t = limitToMaxChars(t, 220)

  return t
}

/**
 * ✅ History correcto usando isMe (no heurísticas).
 * Reglas Gemini:
 * - history debe arrancar con role 'user'
 * - no debe terminar con 'user' si vas a mandar otro 'user' (lo pegamos al lastUserText)
 */
function buildHistoryFromIsMe(chatHistory: any[]) {
  const msgs = (chatHistory || [])
    .map((m: any) => ({
      role: m?.isMe ? ("model" as const) : ("user" as const),
      text: normalize(String(m?.text || "")),
    }))
    .filter((m: any) => m.text)

  if (msgs.length === 0) return { lastUserText: "", history: [] as any[] }

  let lastUserText = msgs[msgs.length - 1].text
  const before = msgs.slice(0, -1)

  const history: { role: "user" | "model"; parts: { text: string }[] }[] = []

  for (const m of before) {
    const prev = history[history.length - 1]
    if (prev && prev.role === m.role) prev.parts[0].text += " | " + m.text
    else history.push({ role: m.role, parts: [{ text: m.text }] })
  }

  // Gemini: history debe empezar con user
  while (history.length > 0 && history[0].role === "model") history.shift()

  // Evitar user,user al enviar lastUserText
  if (history.length > 0 && history[history.length - 1].role === "user") {
    const dangling = history.pop()!.parts[0].text
    lastUserText = dangling + " | " + lastUserText
  }

  return { lastUserText, history }
}

function isRateLimitError(e: any) {
  const msg = String(e?.message || "").toLowerCase()
  const status = e?.status
  const statusText = String(e?.statusText || "").toLowerCase()
  const details = JSON.stringify(e?.errorDetails || e?.details || e?.cause || {}).toLowerCase()

  return (
    status === 429 ||
    msg.includes("429") ||
    msg.includes("too many") ||
    msg.includes("rate limit") ||
    msg.includes("quota") ||
    msg.includes("resource exhausted") ||
    statusText.includes("too many") ||
    details.includes("quota") ||
    details.includes("resource_exhausted") ||
    details.includes("too many")
  )
}

async function sendWithRetry(chat: any, text: string) {
  const maxRetries = 4
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chat.sendMessage(text)
    } catch (e: any) {
      if (!isRateLimitError(e) || attempt === maxRetries) throw e
      const wait = Math.min(900 * Math.pow(2, attempt) + Math.random() * 400, 6500)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  return await chat.sendMessage(text)
}

/**
 * Paquetes de cierres premium (se usan como referencia en prompt y para fallback)
 */
function buildClosureContext(name: string | null) {
  const n = name ? `, ${name}` : ""
  return {
    online: [
      `Perfecto${n}. En breve una asesora te va a llamar.`,
      `Listo${n}. Una asesora te va a llamar en breve.`,
      `Genial${n}. En un ratito una asesora te llama para seguir.`,
    ],
    weekendOrOff: (fallbackLabel: string) => [
      `Gracias${n} 🙂 derivo tu consulta para ver si hay alguna asesora disponible para llamarte. Si no, ${fallbackLabel}.`,
      `Perfecto${n} ✨ dejo tu consulta registrada. Si hay una asesora disponible, te llama; si no, ${fallbackLabel}.`,
      `Dale${n} 🙂 lo dejo derivado. Si alguien está disponible te llaman; caso contrario, ${fallbackLabel}.`,
    ],
    evasive: [
      `No hay problema${n} 🙂 con lo que tenemos, una asesora te puede orientar mejor por teléfono.`,
      `Perfecto${n} ✨ así lo ve una asesora por llamada y te orienta bien.`,
      `Dale${n} 🙂 mejor que lo vea una asesora por teléfono.`,
    ],
  }
}

export async function generateAIResponse(chatHistory: any[]): Promise<AIResult> {
  try {
    const { day, hour, minutes, isWorkHours, isWeekend } = getTimeContext()
    const allText = (chatHistory || []).map((m: any) => String(m?.text || "")).join("\n")
    const signals = extractSignals(allText)
    const name = extractName(allText)

    const { lastUserText, history } = buildHistoryFromIsMe(chatHistory)
    if (!lastUserText) return { success: false, text: "No hay mensajes." }

    const closures = buildClosureContext(name)

    // Contexto de guardia premium (sin promesas)
    const fallbackLabel =
      isWeekend ? "el lunes a primera hora te llaman" : nextBusinessDayLabel(day)

    const availability =
      isWorkHours ? "ONLINE" : isWeekend ? "FINDE/GUARDIA" : "FUERA DE HORARIO"

    const systemInstruction = `
[[SOFÍA — GML SALUD (PREMIUM)]]
Sos Sofía, asesora digital de GML Salud.
Voz: femenina sutil, cálida, segura, con VOSEO (vos/tenés/decime).
No sos vendedora; preparás al cliente y derivás a una asesora humana para cerrar.

[[ESTILO]]
- WhatsApp real, premium (conciso).
- Máx 2 renglones.
- Máx 1 pregunta.
- Emojis: SELECTIVOS (no siempre). Cuando uses: 1 solo emoji suave.
  Set permitido: 🙂 ✨ 🫶 📍 ✅ 🙌
- Evitá explicaciones largas. 1 frase + 1 pregunta.

[[PROHIBICIONES (DURAS)]]
- NUNCA digas "obra social" (decí "prepaga" o "cobertura de salud").
- NUNCA digas "te escribimos / te escriben / por acá / WhatsApp".
  SIEMPRE derivá a LLAMADA: "una asesora te va a llamar / te contactan por teléfono".
- No hablar de preexistencias, diagnósticos, tratamientos ni recetas.
- No recomendar ni comparar prepagas.
- No inventar precios.

[[OBJETIVO (máx 4 datos)]]
Edad · Localidad · Situación laboral (aportes/voluntario) · Grupo (solo/familia).
Si el cliente es evasivo o no quiere pasar datos: DERIVÁ IGUAL por llamada (sin presionar).

[[REGLAS BLINDADAS]]
1) +60: jamás digas límites/rechazos. Usá “Línea Exclusiva con convenios especiales” y pedí localidad.
2) Precios: "Depende de edad y zona" y pedí edad.
3) Audios: "Perdón 🫶 ahora estoy sin audio. ¿Me lo escribís cortito?"
4) Turnos/médicos: "Te entiendo 🙂 no somos médicos ni damos turnos. En GML ayudamos a ingresar a una cobertura de salud. ¿Te interesa eso?"
5) Síntomas urgentes (pecho/falta de aire/desmayo): "Si es urgente, consultá guardia/emergencias." Luego reencuadrá a cobertura.

[[NOMBRE]]
Si detectás el nombre del cliente, usalo para humanizar (sin repetirlo en cada mensaje). Preferir en validaciones/cierres.

[[CIERRES PREMIUM (VARIAR, NO REPETIR)]]
- ONLINE (L–V 9:30–14:30): elegí una de estas:
  ${closures.online.map((s) => `- ${s}`).join("\n  ")}
- FUERA DE HORARIO / FINDE: elegí una de estas (sin prometer hora exacta):
  ${closures.weekendOrOff(fallbackLabel).map((s) => `- ${s}`).join("\n  ")}
- EVASIVO (no pasa datos): elegí una de estas:
  ${closures.evasive.map((s) => `- ${s}`).join("\n  ")}

[[VARIACIÓN HUMANA (PAQUETES)]]
Usá estas variantes para no sonar igual (elegí 1 según caso):
- Validación corta: "Perfecto." / "Genial, gracias." / "Buenísimo." / "Listo."
- Pedir edad: "¿Qué edad tenés?" / "¿Me decís tu edad?" / "¿Qué edad tenés así lo cotizo bien?"
- Pedir localidad: "¿De qué localidad sos?" / "¿En qué localidad estás?" / "Para verlo por zona, ¿de dónde sos?"
- Pedir grupo: "¿Es para vos o para familia?" / "¿Cobertura para vos sola/o o familia?"
- Pedir laboral: "¿Tenés aportes (sueldo/monotributo) o sería voluntario?"

[[CONTEXTO OPERATIVO]]
Día: ${day} | Hora: ${hour}:${pad2(minutes)} | Estado: ${availability}
Señales internas: ${JSON.stringify(signals)}

[[REGLA FINAL]]
Si ya tenés lo mínimo (o el cliente está evasivo): cerrá con DERIVACIÓN A LLAMADA usando los cierres premium. No sigas preguntando.
`

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: `SYSTEM_INSTRUCTION:\n${systemInstruction}` }] },
        { role: "model", parts: [{ text: "Entendido. Soy Sofía (premium): breve, cálida, con voseo y derivando por llamada." }] },
        ...history,
      ],
    })

    const result = await sendWithRetry(chat, lastUserText)
    const raw = result.response.text()
    const response = postProcess(raw)

    return { success: true, text: response }
  } catch (error: any) {
    if (isRateLimitError(error)) return { success: false, text: "", silent: true }

    console.error("❌ Error IA:", {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      errorDetails: error?.errorDetails,
      details: error?.details,
      cause: error?.cause,
    })

    // Fallback humano premium (sin sonar a error técnico)
    return { success: false, text: "Perdón 🙂 ¿Tu consulta es por cobertura de salud?" }
  }
}
