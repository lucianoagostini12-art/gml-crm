import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD
const API_SECRET = "gml_crm_secret_key_2024" 

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
        console.log("📥 Webhook Recibido:", JSON.stringify(body))

        if (body.waId === 'senderPhone' || body.info === 'test_notification') {
             return NextResponse.json({ message: "Test WATI recibido OK" }, { status: 200 })
        }

        // 3. 🧠 INTELIGENCIA: RECUPERAR EL MENSAJE REAL (TEXTO O BOTÓN)
        let finalMessage = body.text || ""
        
        // Si es respuesta de botón interactivo
        if (body.interactiveButtonReply && body.interactiveButtonReply.title) {
            finalMessage = `[Botón]: ${body.interactiveButtonReply.title}`
        } 
        // Si es respuesta de lista
        else if (body.listReply && body.listReply.title) {
            finalMessage = `[Lista]: ${body.listReply.title}`
        }

        // 4. DATOS BÁSICOS
        let phone = ""
        let name = "Desconocido"
        
        // WATI
        if (body.waId) {
            phone = String(body.waId).replace(/\D/g, "")
            name = body.senderName || "Cliente WhatsApp"
        } 
        // WEB
        else {
            phone = (body.phone || body.telefono || "").replace(/\D/g, "")
            name = body.name || body.nombre || "Cliente Web"
            finalMessage = body.message || body.mensaje || finalMessage || "Consulta Web"
        }

        if (!phone) {
            return NextResponse.json({ message: "Ignored: No valid phone" }, { status: 200 })
        }

        // 5. 🕵️ DETECTIVE DE ORIGEN Y PREPAGA
        let detectedSource = body.source || "WATI / Bot" 
        let detectedPrepaga = null

        // A) ¿Viene de Meta Ads (CTWA)?
        if (body.sourceId || body.sourceUrl || body.referral) {
            detectedSource = "Meta Ads"
        }

        // B) Palabras Clave (Google Ads / Botones)
        const msgLower = finalMessage.toLowerCase()

        // --- REGLAS DEFINITIVAS ---
        if (msgLower.includes("doctored")) {
            detectedSource = "Google Ads"
            detectedPrepaga = "DoctoRed"
        } 
        else if (msgLower.includes("prevencion") || msgLower.includes("prevención")) {
            detectedSource = "Google Ads"
            // IMPORTANTE: Lo guardamos como 'Prevencion' para que coincida con tu sistema (ops-types.ts)
            detectedPrepaga = "Prevencion" 
        } 
        else if (msgLower.includes("sancor")) {
            detectedSource = "Google Ads"
            detectedPrepaga = "Sancor"
        } 
        else if (msgLower.includes("galeno")) {
            detectedSource = "Google Ads"
            detectedPrepaga = "Galeno"
        } 
        else if (msgLower.includes("swiss")) {
            detectedSource = "Google Ads"
            detectedPrepaga = "Swiss Medical"
        } 
        else if (msgLower.includes("osde")) {
            detectedSource = "Google Ads"
            detectedPrepaga = "Osde"
        } 
        else if (msgLower.includes("avalian")) {
            detectedSource = "Google Ads"
            detectedPrepaga = "Avalian"
        }


        // 6. BUSCAR SI YA EXISTE (LÓGICA ANTI-DUPLICADOS)
        const { data: existingLead } = await supabase
            .from('leads')
            .select('id, chat, name, notes, prepaga, source')
            .eq('phone', phone)
            .maybeSingle()

        const now = new Date().toISOString()
        const timeString = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

        // CASO A: YA EXISTE -> ACTUALIZAMOS CHAT Y COMPLETAMOS DATOS FALTANTES
        if (existingLead) {
            let currentChat = existingLead.chat
            if (typeof currentChat === 'string') try { currentChat = JSON.parse(currentChat) } catch { currentChat = [] }
            if (!Array.isArray(currentChat)) currentChat = []

            const newChatMsg = {
                user: "Cliente",
                text: finalMessage,
                time: timeString,
                isMe: false
            }
            const updatedChat = [...currentChat, newChatMsg]

            const updates: any = { 
                chat: updatedChat,
                last_update: now
            }

            // Solo completamos si faltaba el dato
            if (!existingLead.prepaga && detectedPrepaga) {
                updates.prepaga = detectedPrepaga
            }
            if ((!existingLead.source || existingLead.source === "WATI / Bot") && detectedSource !== "WATI / Bot") {
                updates.source = detectedSource
            }

            await supabase.from('leads').update(updates).eq('id', existingLead.id)

            return NextResponse.json({ success: true, action: "updated" }, { status: 200 })
        } 
        
        // CASO B: NUEVO LEAD -> CREAMOS CON TODO
        else {
            const initialChat = [{
                user: "Cliente",
                text: finalMessage,
                time: timeString,
                isMe: false
            }]

            const newLeadData = {
                name: name,
                phone: phone,
                source: detectedSource, 
                status: 'nuevo',
                agent_name: null,
                chat: initialChat,
                notes: `Ingreso automático. Mensaje: "${finalMessage}"`,
                prepaga: detectedPrepaga,
                created_at: now,
                last_update: now
            }

            const { error } = await supabase.from('leads').insert(newLeadData)

            if (error) {
                console.error("Error DB:", error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            return NextResponse.json({ success: true, action: "created" }, { status: 200 })
        }

    } catch (e: any) {
        console.error("❌ Error Fatal:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ status: "Online 🟢" })
}