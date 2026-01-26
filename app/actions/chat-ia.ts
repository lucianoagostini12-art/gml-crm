"use server"

import { GoogleGenerativeAI } from "@google/generative-ai"

const apiKey = process.env.GEMINI_API_KEY
if (!apiKey) {
  console.error("❌ ERROR CRÍTICO: No se encontró la GEMINI_API_KEY.")
}

const genAI = new GoogleGenerativeAI(apiKey || "")
const model = genAI.getGenerativeModel({ model: "gemini-flash-latest" })

function getTimeContext() {
  const now = new Date()
  const options = { timeZone: "America/Argentina/Buenos_Aires", hour12: false, weekday: 'long', hour: 'numeric', minute: 'numeric' }
  const formatter = new Intl.DateTimeFormat('es-AR', options as any)
  const parts = formatter.formatToParts(now)
  
  const day = parts.find(p => p.type === 'weekday')?.value.toLowerCase() || ""
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || "0")
  const minutes = parseInt(parts.find(p => p.type === 'minute')?.value || "0")

  const isWeekend = day.includes('sábado') || day.includes('domingo')
  const isAfterStart = hour > 9 || (hour === 9 && minutes >= 30)
  const isBeforeEnd = hour < 14 || (hour === 14 && minutes <= 30)
  const isWorkHours = !isWeekend && isAfterStart && isBeforeEnd

  return { day, hour, minutes, isWorkHours, isWeekend }
}

export async function generateAIResponse(chatHistory: any[]) {
  try {
    const { day, hour, minutes, isWorkHours, isWeekend } = getTimeContext()

    // 🧠 SYSTEM PROMPT "SENIOR SALES"
    const systemInstruction = `
    [[ROL Y PERFIL]]
    Sos Sofía, Coordinadora de Ingresos Digitales en GML Salud.
    Tu objetivo no es solo tomar datos, es **PREPARAR AL CLIENTE** (calentarlo) para que la asesora cierre la venta fácil.
    
    TONO: Profesional, seguro, cálido y resolutivo. (Ni robot, ni adolescente).
    ESTILO: Breve. Respuestas de máximo 2 renglones. Directo al punto.
    
    [[CONTEXTO OPERATIVO]]
    Hora: ${hour}:${minutes}. Estado: ${isWorkHours ? "🟢 ONLINE" : "🟡 GUARDIA"}

    [[OBJETIVO TÁCTICO]]
    Conseguir 4 datos para derivar al área correcta:
    1. EDAD.
    2. SITUACIÓN LABORAL.
    3. GRUPO FAMILIAR (O Individual).
    4. LOCALIDAD.

    [[🚨 PROTOCOLOS BLINDADOS (Lógica de Negocio)]]

    1. 👴 EL CASO +60 AÑOS (Línea Exclusiva):
       Si el cliente tiene más de 60 o 65 años:
       ❌ PROHIBIDO decir: "Las prepagas cortan a los 60", "Es difícil", "Suele ser hasta...".
       ❌ PROHIBIDO asumir que es jubilado.
       ✅ RESPUESTA OBLIGATORIA: "Perfecto. Para esa franja de edad trabajamos con una **Línea de Convenios Especiales**. 🌟 Te voy a derivar directo con la especialista de esa área para que te asesore sobre esas opciones puntuales." (Y seguí pidiendo el dato que falte).

    2. 💰 MANEJO DE PRECIOS:
       ❌ NO digas "no se".
       ✅ DECÍ: "Para cotizarte con precisión y no darte un número en el aire, el sistema me pide validar edad y zona. ¿Me confirmás tu edad?"

    3. 🎙️ AUDIOS / MENSAJES LARGOS:
       "Disculpame, estoy desde la PC sin audio en este momento. 🙏 ¿Me lo podrás resumir escrito así lo gestiono ya?"

    4. 🔍 VALIDACIÓN (Warming Up):
       Cuando te dan un dato, validalo positivamente antes de pedir el siguiente.
       - Cliente: "Soy Monotributista."
       - Sofía: "¡Genial, con monotributo tenés muy buenas opciones para derivar aportes! ✅ ¿De qué localidad sos?"
       (Esto hace que el cliente sienta que "califica" y se predisponga mejor).

    [[EJEMPLOS DE DIÁLOGO OPTIMIZADO]]

    *Caso: Inicio*
    Cliente: "Hola precio"
    Sofía: "¡Hola! 👋 Soy Sofía de GML. Para ver qué planes aplican en tu zona y darte el valor real, contame: ¿Buscás cobertura para vos solo o para tu familia?"

    *Caso: +60 (Sin fricción)*
    Cliente: "Tengo 68 años y quiero Prevención."
    Sofía: "Comprendo. Prevención tiene sus normas, pero para tu edad tenemos una **Línea Exclusiva** que funciona excelente. ✨ Te derivo con la especialista en esos convenios. ¿De qué localidad sos?"

    *Caso: Cierre (Horario Laboral)*
    Sofía: "¡Listo! Datos cargados. 🚀 Ya le pasé tu ficha prioritaria a las asesoras que están online. En breve te contactan para finalizar."

    [[REGLA FINAL DE ORO]]
    Si el cliente muestra ansiedad o quiere cerrar YA:
    "¡Excelente decisión! 🙌 No te demoro más. Paso tu contacto urgente a la asesora para darte el alta."
    `

    const rawGoogleHistory = chatHistory.map(msg => ({
      role: msg.isMe ? "model" : "user",
      text: msg.text
    }))

    const mergedHistory: {role: string, parts: {text: string}[]}[] = []
    
    if (rawGoogleHistory.length > 0) {
        let currentMsg = rawGoogleHistory[0]
        for (let i = 1; i < rawGoogleHistory.length; i++) {
            const nextMsg = rawGoogleHistory[i]
            if (nextMsg.role === currentMsg.role) {
                currentMsg.text += " | " + nextMsg.text
            } else {
                if (!(mergedHistory.length === 0 && currentMsg.role === 'model')) {
                     mergedHistory.push({ role: currentMsg.role, parts: [{ text: currentMsg.text }] })
                }
                currentMsg = nextMsg
            }
        }
        var lastMessageText = currentMsg.text
        var lastMessageRole = currentMsg.role
    } else {
        return { success: false, text: "No hay mensajes." }
    }

    if (lastMessageRole === 'model') {
        return { success: false, text: "Error: El último mensaje debe ser tuyo." }
    }

    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: `SYSTEM_INSTRUCTION:\n${systemInstruction}` }] },
        { role: "model", parts: [{ text: "Entendido. Tono Senior, resolutivo y validando al cliente." }] },
        ...mergedHistory
      ],
    })

    const result = await chat.sendMessage(lastMessageText)
    const response = result.response.text()

    return { success: true, text: response }

  } catch (error: any) {
    console.error("❌ Error IA:", error.message)
    return { success: false, text: "Se me cortó internet un segundo 📶. ¿Me repetís?" }
  }
}