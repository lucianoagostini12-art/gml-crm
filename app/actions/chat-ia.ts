"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"

type AIResult =
  | { success: true; text: string }
  | { success: false; text: string; silent?: boolean }

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) console.error("❌ ERROR CRÍTICO: No se encontró la GEMINI_API_KEY.")

const genAI = new GoogleGenerativeAI(apiKey || "")
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

/**
 * Anti-spam en server (por si el front manda doble):
 * - NO devolvemos mensajes visibles
 * - si llega muy seguido -> silent (el front ya muestra typing)
 */
const MIN_GAP_MS = 900
let lastCallAt = 0

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

function extractSignals(allText: string) {
  const t = (allText || "").toLowerCase()

  // Edad
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
    /\bquiero (contratar|darme de alta|afiliarme)\b|\bdame de alta\b|\bllamame ya\b|\burgente\b|\bya\b|\bhoy\b/i.test(t)

  const longOrAudio = /\baudio\b|\bnota de voz\b/i.test(t) || t.length > 450

  // Turnos / médicos
  const medicalOrTurno =
    /\bturno(s)?\b|\bm[eé]dic(o|a)\b|\bguardia\b|\bcl[ií]nic(a|o)\b|\btraumat[oó]log(o|a)\b|\bcardi[oó]log(o|a)\b|\bdermat[oó]log(o|a)\b|\bpediatr(a|o)\b|\bendocrin[oó]log(o|a)\b|\bdolor\b|\bs[ií]ntoma(s)?\b|\breceta\b/i.test(
      t
    )

  // Señal “riesgo” (sin diagnosticar, solo para recomendar guardia)
  const urgentSymptom =
    /\bdolor en el pecho\b|\bme duele el pecho\b|\bfalta de aire\b|\bme cuesta respirar\b|\bdesmayo\b|\bme desmaye\b|\bperd[ií] el conocimiento\b|\bpalpitaciones\b/i.test(
      t
    )

  const healthIntent =
    /\b(prepaga|obra social|cobertura|plan(es)?|salud|cartilla|afiliar|alta|aportes|monotributo|recibo)\b/i.test(t)

  const offTopic = !healthIntent && !wantsPrice && !hotIntent && !medicalOrTurno

  // Si ya dijo nombre
  const nameMention =
    /\b(me llamo|soy)\s+([a-záéíóúñ]{2,})(\s+[a-záéíóúñ]{2,})?/i.test(allText || "")

  return { age, is60plus, wantsPrice, hotIntent, longOrAudio, medicalOrTurno, urgentSymptom, offTopic, nameMention }
}

/**
 * Guardrails suaves: no pisa respuestas buenas, pero evita que se vaya a medicina / comparación / precios.
 */
function applyGuardrails(raw: string) {
  let t = normalize(raw)

  const forbiddenMedicalDeep =
    /\bpreexistenc|diagn[oó]stic|patolog|medicaci[oó]n|tratamiento|dosis|receta\b/i.test(t)

  const forbiddenRecommend =
    /\bte conviene\b|\brecomiendo\b|\bla mejor\b|\bmejor que\b|\bpeor que\b/i.test(t)

  const forbiddenPrice = /\$\s*\d|(\b\d{2,3}\.\d{3}\b)|(\b\d{2,3},\d{3}\b)/.test(t)

  if (forbiddenMedicalDeep || forbiddenRecommend) {
    t =
      "Eso lo ve directamente la asesora para orientarte bien según tu caso 🙂\n" +
      "Yo te ayudo a dejarte con la indicada."
  }

  if (forbiddenPrice) {
    t = "El valor depende de edad y zona 🙂 ¿Qué edad tenés?"
  }

  // 1 sola pregunta
  const q = (t.match(/\?/g) || []).length
  if (q > 1) {
    const i = t.indexOf("?")
    if (i >= 0) t = t.slice(0, i + 1).trim()
  }

  // máx 2 renglones
  const lines = t.split("\n").map((x) => x.trim()).filter(Boolean)
  if (lines.length > 2) t = t.slice(0, 2).join("\n")

  return t
}

/**
 * Historial sin isMe:
 * - último mensaje = cliente
 * - alterna roles arrancando por el bot
 */
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

// Delay humano por longitud (opción 2)
async function humanDelay(text: string) {
  const base = 250 + Math.random() * 250
  const perChar = Math.min((text?.length || 0) * 10, 900)
  const delay = Math.min(base + perChar, 1400)
  await new Promise((r) => setTimeout(r, delay))
}

/**
 * Detecta rate limit / quota de Gemini de manera más robusta.
 */
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
  const maxRetries = 5
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await chat.sendMessage(text)
    } catch (e: any) {
      if (!isRateLimitError(e) || attempt === maxRetries) throw e
      const wait = Math.min(900 * Math.pow(2, attempt) + Math.random() * 400, 6500)
      await new Promise((r) => setTimeout(r, wait))
    }
  }
  // fallback (no debería llegar)
  return await chat.sendMessage(text)
}

export async function generateAIResponse(chatHistory: any[]): Promise<AIResult> {
  try {
    // Anti-spam server: si viene demasiado seguido, respondemos SILENT (no visible)
    const now = Date.now()
    const diff = now - lastCallAt
    if (diff < MIN_GAP_MS) {
      return { success: false, text: "", silent: true }
    }
    lastCallAt = now

    const { hour, minutes, isWorkHours } = getTimeContext()

    const allText = (chatHistory || []).map((m: any) => String(m?.text || "")).join("\n")
    const signals = extractSignals(allText)

    const styleHint =
      ["validación corta + pregunta", "pregunta camuflada (zona/para quién)", "mini-resumen + pregunta"][
        Math.floor(Math.random() * 3)
      ]

    const systemInstruction = `
[[SOFÍA — VOZ PREMIUM]]
Sos Sofía, de GML Salud. Profesional, cálida, humana. Tono femenino sutil.
WhatsApp real: corto, claro, sin tecnicismos. 1 emoji suave (variado) por mensaje como máximo.

[[OBJETIVO]]
No vendés por chat. Preparás al cliente y lo dejás listo para que una asesora cierre.
Buscás datos mínimos SIN sonar a formulario.

[[DATOS (máx 4)]]
Edad • Grupo (solo/familia) • Laboral (aportes/voluntario) • Localidad

[[NOMBRE (OPCIÓN B)]]
NO lo pidas al inicio. Después del primer dato útil:
"Perfecto ✨ ¿Con quién tengo el gusto?"
Si el cliente ya dijo su nombre, NO lo repitas.

[[PROHIBICIONES]]
- No hablar de preexistencias / diagnósticos / tratamientos / recetas.
- No recomendar ni comparar prepagas.
- No inventar precios, cartillas o prestadores.
- No hablar de límites de edad ni rechazos.

Si piden recomendación/comparación:
"Te entiendo 🙂 La mejor opción depende de tu perfil. Te paso con una asesora para orientarte bien."

[[TURNOS / MÉDICOS / SÍNTOMAS]]
Si piden turno/médico:
"Entiendo 🙂 No somos médicos ni gestionamos turnos; en GML ayudamos a personas a ingresar a una cobertura de salud. ¿Te interesa ver opciones de cobertura?"
Si el mensaje sugiere urgencia (dolor pecho/falta de aire/desmayo):
"Si es un dolor fuerte o tenés falta de aire, por favor consultá una guardia o llamá a emergencias. Si querés, después te ayudo con la cobertura 🙂"

[[OFF-TOPIC]]
Si no parece consulta de salud/cobertura:
"Creo que puedo estar mezclando temas 🙂 ¿Me confirmás si estás consultando por cobertura de salud (prepaga/obra social) o era otro asunto?"
Si insiste off-topic: cerrá amable, sin pedir datos.

[[RITMO]]
- Caliente (alta ya/urgente): pedí SOLO edad + localidad y cerrá.
- Precio: “depende de edad y zona” → pedí edad.
- +60: “convenios especiales” → pedí localidad y cerrá.
- Genérico: pedí grupo (solo/familia).
- Resistencia: validá y pedí 1 dato mínimo.

[[CIERRE SEGÚN HORARIO]]
ONLINE: "En breve una asesora te llama o te escribe por WhatsApp 🙂"
GUARDIA: "Te dejo registrado/a y a primera hora hábil una asesora te contacta 🙂"

[[CONTEXTO]]
Hora: ${hour}:${String(minutes).padStart(2, "0")} | Estado: ${isWorkHours ? "ONLINE" : "GUARDIA"}
Señales: ${JSON.stringify(signals)}
Estilo sugerido: ${styleHint}
`

    const { lastUserText, history } = buildHistoryNoIsMe(chatHistory)
    if (!lastUserText) return { success: false, text: "No hay mensajes." }

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: `SYSTEM_INSTRUCTION:\n${systemInstruction}` }] },
        { role: "model", parts: [{ text: "Entendido. Respondo como Sofía: breve, cálida y enfocada." }] },
        ...history,
      ],
    })

    const result = await sendWithRetry(chat, lastUserText)
    const raw = result.response.text()
    const response = applyGuardrails(raw)

    await humanDelay(response)
    return { success: true, text: response }
  } catch (error: any) {
    // Si es 429 / quota, mejor SILENT: el front ya muestra typing y evitamos ensuciar el chat
    if (isRateLimitError(error)) {
      return { success: false, text: "", silent: true }
    }
    console.error("❌ Error IA:", error?.message || error)
    return { success: false, text: "Uy, se me trabó un segundo 🙏 ¿Me repetís?" }
  }
}
