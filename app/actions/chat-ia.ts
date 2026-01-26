"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"

/* ======================
   CONFIG
====================== */
const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) console.error("❌ ERROR CRÍTICO: No se encontró la GEMINI_API_KEY.")

const genAI = new GoogleGenerativeAI(apiKey || "")
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

/**
 * Throttle humano: espera si llegan requests muy seguidas,
 * pero NUNCA corta la respuesta.
 */
const MIN_GAP_MS = 1200
let lastCallAt = 0

/* ======================
   TIME CONTEXT
====================== */
function getTimeContext() {
  const now = new Date()
  const options = {
    timeZone: "America/Argentina/Buenos_Aires",
    hour12: false,
    weekday: "long",
    hour: "numeric",
    minute: "numeric",
  }
  const formatter = new Intl.DateTimeFormat("es-AR", options as any)
  const parts = formatter.formatToParts(now)

  const day = (parts.find((p) => p.type === "weekday")?.value || "").toLowerCase()
  const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10)
  const minutes = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10)

  const isWeekend = day.includes("sábado") || day.includes("domingo")
  const isAfterStart = hour > 9 || (hour === 9 && minutes >= 30)
  const isBeforeEnd = hour < 14 || (hour === 14 && minutes <= 30)
  const isWorkHours = !isWeekend && isAfterStart && isBeforeEnd

  return { hour, minutes, isWorkHours }
}

/* ======================
   HELPERS
====================== */
function normalize(s: string) {
  return String(s || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim()
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

  const wantsPrice =
    /\bprecio\b|\bcu[aá]nto sale\b|\bvalor\b|\bcotiz/i.test(t) || /\$\s*\d/.test(t)

  const hotIntent =
    /\bquiero (contratar|darme de alta|afiliarme)\b|\bdame de alta\b|\bllamame ya\b|\burgente\b|\bhoy\b/i.test(t)

  const longOrAudio = /\baudio\b|\bnota de voz\b/i.test(t) || t.length > 450

  const medicalOrTurno =
    /\bturno(s)?\b|\bm[eé]dic(o|a)\b|\bguardia\b|\bcl[ií]nic(a|o)\b|\btraumat[oó]log(o|a)\b|\bcardi[oó]log(o|a)\b|\bdermat[oó]log(o|a)\b|\bpediatr(a|o)\b|\bdolor\b|\bs[ií]ntoma(s)?\b|\breceta\b/i.test(
      t
    )

  const healthIntent =
    /\b(prepaga|obra social|cobertura|plan(es)?|salud|cartilla|afiliar|alta|aportes|monotributo|recibo)\b/i.test(t)

  const offTopic = !healthIntent && !wantsPrice && !hotIntent && !medicalOrTurno

  const nameMention =
    /\b(me llamo|soy)\s+([a-záéíóúñ]{2,})(\s+[a-záéíóúñ]{2,})?/i.test(allText || "")

  return {
    age,
    is60plus,
    wantsPrice,
    hotIntent,
    longOrAudio,
    medicalOrTurno,
    offTopic,
    nameMention,
  }
}

/* ======================
   GUARDRAILS
====================== */
function applyGuardrails(raw: string) {
  let t = normalize(raw)

  const forbiddenMedical =
    /\bpreexistenc|enfermedad|diagn[oó]stic|patolog|c[aá]ncer|diabet|hipertens|vih|embaraz|medicaci[oó]n|tratamiento|operaci[oó]n\b/i.test(
      t
    )

  const forbiddenRecommend =
    /\bte conviene\b|\brecomiendo\b|\bla mejor\b|\bmejor que\b|\bpeor que\b/i.test(t)

  const forbiddenPrice = /\$\s*\d|(\b\d{2,3}\.\d{3}\b)|(\b\d{2,3},\d{3}\b)/.test(t)

  if (forbiddenMedical || forbiddenRecommend) {
    t =
      "Eso lo ve directamente la asesora para orientarte bien según tu situación 🙂\n" +
      "Yo te ayudo a dejarte con la indicada."
  }

  if (forbiddenPrice) {
    t = "El valor depende de edad y zona 🙂 ¿Qué edad tenés?"
  }

  const q = (t.match(/\?/g) || []).length
  if (q > 1) {
    const i = t.indexOf("?")
    if (i >= 0) t = t.slice(0, i + 1).trim()
  }

  const lines = t.split("\n").map((x) => x.trim()).filter(Boolean)
  if (lines.length > 2) t = lines.slice(0, 2).join("\n")

  return t
}

/* ======================
   HISTORY (sin isMe)
====================== */
function buildHistoryNoIsMe(chatHistory: any[]) {
  const msgs = (chatHistory || [])
    .map((m: any) => normalize(String(m?.text || "")))
    .filter(Boolean)

  if (msgs.length === 0) return { lastUserText: "", history: [] as any[] }

  const lastUserText = msgs[msgs.length - 1]
  const before = msgs.slice(0, -1)

  let nextRole: "model" | "user" = "model"
  const history: { role: string; parts: { text: string }[] }[] = []

  for (const text of before) {
    const prev = history[history.length - 1]
    if (prev && prev.role === nextRole) prev.parts[0].text += " | " + text
    else history.push({ role: nextRole, parts: [{ text }] })
    nextRole = nextRole === "model" ? "user" : "model"
  }

  return { lastUserText, history }
}

/* ======================
   RETRY + DELAY
====================== */
async function humanDelay(text: string) {
  const base = 350 + Math.random() * 250
  const perChar = Math.min((text?.length || 0) * 12, 1200)
  const delay = Math.min(base + perChar, 1800)
  await new Promise((r) => setTimeout(r, delay))
}

function isRateLimitError(e: any) {
  const msg = String(e?.message || "").toLowerCase()
  return e?.status === 429 || msg.includes("429") || msg.includes("too many")
}

async function sendWithRetry(chat: any, text: string) {
  const maxRetries = 3
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chat.sendMessage(text)
    } catch (e: any) {
      if (!isRateLimitError(e) || attempt === maxRetries) throw e
      const wait = Math.min(700 * Math.pow(2, attempt) + Math.random() * 300, 3000)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
}

/* ======================
   MAIN
====================== */
export async function generateAIResponse(chatHistory: any[]) {
  try {
    // 🔑 THROTTLE CORRECTO: esperar, NO responder
    const now = Date.now()
    const diff = now - lastCallAt
    if (diff < MIN_GAP_MS) {
      await new Promise((r) => setTimeout(r, MIN_GAP_MS - diff))
    }
    lastCallAt = Date.now()

    const { hour, minutes, isWorkHours } = getTimeContext()

    const allText = (chatHistory || []).map((m: any) => String(m?.text || "")).join("\n")
    const signals = extractSignals(allText)

    const styleHint = [
      "Usá validación corta + 1 pregunta.",
      "Usá dato camuflado (zona/para quién).",
      "Usá mini-resumen y después 1 pregunta.",
    ][Math.floor(Math.random() * 3)]

    const systemInstruction = `
[[QUIÉN SOS]]
Sos Sofía, de GML Salud.
Profesional, cálida y humana. Tono femenino sutil.

[[CÓMO HABLÁS]]
- Mensajes cortos.
- 1 pregunta por mensaje.
- Emojis suaves 🙂✨📍🩺📲🙌 (máx 1).
- Evitá sonar a cuestionario.

[[TURNOS / MÉDICOS]]
Si piden médico o turno:
"Entiendo 🙂 No somos médicos ni gestionamos turnos; ayudamos a ingresar a una cobertura. ¿Te interesa ver opciones de cobertura médica?"

[[CIERRE]]
ONLINE: "En breve una asesora te llama o escribe 🙂"
GUARDIA: "Te dejo registrado/a y a primera hora hábil te contactan 🙂"

Hora: ${hour}:${String(minutes).padStart(2, "0")} | Estado: ${isWorkHours ? "ONLINE" : "GUARDIA"}
Señales: ${JSON.stringify(signals)}
Variación: ${styleHint}
`

    const { lastUserText, history } = buildHistoryNoIsMe(chatHistory)
    if (!lastUserText) return { success: false, text: "No hay mensajes." }

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: `SYSTEM_INSTRUCTION:\n${systemInstruction}` }] },
        { role: "model", parts: [{ text: "Entendido. Respondo como Sofía." }] },
        ...history,
      ],
    })

    const result = await sendWithRetry(chat, lastUserText)
    const raw = result.response.text()
    const response = applyGuardrails(raw)

    await humanDelay(response)

    return { success: true, text: response }
  } catch (error: any) {
    console.error("❌ Error IA:", error)
    return { success: false, text: "Te leo 🙂 Dame un segundito." }
  }
}
