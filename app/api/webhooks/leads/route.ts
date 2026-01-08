import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD (API KEY)
const API_SECRET = "gml_crm_secret_key_2024" 

export async function POST(request: Request) {
    const supabase = createClient()
    
    try {
        // 1. Verificación de Seguridad
        const url = new URL(request.url)
        const apiKey = url.searchParams.get("key") 

        if (apiKey !== API_SECRET) {
            return NextResponse.json({ error: "Acceso denegado" }, { status: 401 })
        }

        // 2. Leer datos entrantes
        const body = await request.json()
        console.log("📥 Webhook Recibido:", body)

        // 🚨 DETECCIÓN DE TEST DE WATI (Para que no de error)
        // WATI manda "senderPhone" cuando apretás el botón de test.
        if (body.waId === 'senderPhone' || body.info === 'test_notification') {
             console.log("🧪 Test de conexión WATI recibido. Respondiendo OK.")
             return NextResponse.json({ message: "Test recibido correctamente" }, { status: 200 })
        }

        // 3. Detectar origen y normalizar datos
        let phone = ""
        let name = "Desconocido"
        let message = ""
        let source = "Web/Externo"

        if (body.waId) {
            // Es WATI Real
            phone = String(body.waId).replace(/\D/g, "") // Solo números
            name = body.senderName || "Cliente WhatsApp"
            message = body.text || "" 
            source = "WATI / Bot"
        } 
        else {
            // Es Web
            phone = (body.phone || body.telefono || "").replace(/\D/g, "")
            name = body.name || body.nombre || "Cliente Web"
            message = body.message || body.mensaje || body.notes || "Consulta Web"
            source = body.source || "Web Principal"
        }

        // ⚠️ CAMBIO CLAVE: Si no hay teléfono, devolvemos 200 (OK) igual.
        // Esto evita que WATI deshabilite el webhook si llega basura.
        if (!phone) {
            console.log("⚠️ Webhook ignorado (Sin teléfono válido).")
            return NextResponse.json({ message: "Ignored: No valid phone" }, { status: 200 })
        }

        // 4. LÓGICA ANTI-DUPLICADOS
        const { data: existingLead } = await supabase
            .from('leads')
            .select('id, chat, name, notes')
            .eq('phone', phone)
            .maybeSingle()

        const now = new Date().toISOString()
        const timeString = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

        if (existingLead) {
            // ACTUALIZAR CHAT EXISTENTE
            const newChatMsg = {
                user: "Cliente",
                text: message,
                time: timeString,
                isMe: false
            }
            
            let currentChat = existingLead.chat
            if (typeof currentChat === 'string') {
                try { currentChat = JSON.parse(currentChat) } catch { currentChat = [] }
            }
            if (!Array.isArray(currentChat)) currentChat = []

            const updatedChat = [...currentChat, newChatMsg]

            await supabase.from('leads').update({ 
                chat: updatedChat,
                last_update: now
            }).eq('id', existingLead.id)

            return NextResponse.json({ success: true, action: "updated" }, { status: 200 })
        } else {
            // CREAR NUEVO LEAD
            const initialChat = [{
                user: "Cliente",
                text: message,
                time: timeString,
                isMe: false
            }]

            const newLeadData = {
                name: name,
                phone: phone,
                source: source,
                status: 'nuevo',
                agent_name: null,
                chat: initialChat,
                notes: `Ingreso automático vía ${source}. Primer mensaje: "${message}"`,
                created_at: now,
                last_update: now
            }

            const { error } = await supabase.from('leads').insert(newLeadData)

            if (error) {
                console.error("Error DB:", error)
                // Si falla la base de datos, ahí sí tiramos error 500 para saberlo.
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