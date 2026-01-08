import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD (API KEY)
// Esto evita que cualquiera mande datos. WATI y tu Web deben usar esta clave.
const API_SECRET = "gml_crm_secret_key_2024" 

export async function POST(request: Request) {
    const supabase = createClient()
    
    try {
        // 1. Verificación de Seguridad
        const url = new URL(request.url)
        const apiKey = url.searchParams.get("key") // Buscamos ?key=... en la URL

        if (apiKey !== API_SECRET) {
            return NextResponse.json({ error: "Acceso denegado (API Key inválida)" }, { status: 401 })
        }

        // 2. Leer datos entrantes
        const body = await request.json()
        console.log("📥 Webhook Recibido:", body)

        // 3. Detectar origen y normalizar datos
        let phone = ""
        let name = "Desconocido"
        let message = ""
        let source = "Web/Externo"
        let isWati = false

        // A) ¿Es WATI? (WATI manda 'waId')
        if (body.waId) {
            isWati = true
            phone = body.waId.replace(/\D/g, "") // Limpiar número
            name = body.senderName || "Cliente WhatsApp"
            message = body.text || "" // El mensaje del cliente
            source = "WATI / Bot"
        } 
        // B) ¿Es Formulario Web? (Standard)
        else {
            phone = (body.phone || body.telefono || "").replace(/\D/g, "")
            name = body.name || body.nombre || "Cliente Web"
            message = body.message || body.mensaje || body.notes || "Consulta Web"
            source = body.source || "Web Principal"
        }

        // Validación mínima
        if (!phone) return NextResponse.json({ error: "Falta teléfono" }, { status: 400 })

        // 4. LÓGICA ANTI-DUPLICADOS (El Cerebro)
        // Buscamos si ya existe el teléfono
        const { data: existingLead } = await supabase
            .from('leads')
            .select('id, chat, name, notes')
            .eq('phone', phone)
            .maybeSingle()

        const now = new Date().toISOString()
        const timeString = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

        // CASO A: EL CLIENTE YA EXISTE -> ACTUALIZAMOS CHAT (El "Paso a Paso")
        if (existingLead) {
            console.log("🔄 Cliente existente encontrado. Actualizando chat...")
            
            // Armamos el nuevo mensajito para el historial
            const newChatMsg = {
                user: "Cliente",
                text: message,
                time: timeString,
                isMe: false // Es el cliente, no nosotros
            }

            // Recuperamos el chat viejo o iniciamos uno vacío
            let currentChat = existingLead.chat
            if (typeof currentChat === 'string') {
                try { currentChat = JSON.parse(currentChat) } catch { currentChat = [] }
            }
            if (!Array.isArray(currentChat)) currentChat = []

            // Agregamos el mensaje nuevo al final
            const updatedChat = [...currentChat, newChatMsg]

            // Guardamos en la base de datos (Chat + Last Update para que suba en el tablero)
            await supabase
                .from('leads')
                .update({ 
                    chat: updatedChat,
                    last_update: now,
                    // Opcional: Si querés que vuelva a "sin leer" podés cambiar algo aquí
                })
                .eq('id', existingLead.id)

            return NextResponse.json({ success: true, action: "updated", id: existingLead.id })
        }

        // CASO B: CLIENTE NUEVO -> CREAMOS FICHA
        else {
            console.log("✨ Nuevo Lead. Creando ficha...")

            // Chat inicial con el primer mensaje
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
                status: 'nuevo', // Entra a la pileta
                agent_name: null, // Sin dueño
                chat: initialChat,
                notes: `Ingreso automático vía ${source}. Primer mensaje: "${message}"`,
                created_at: now,
                last_update: now
            }

            const { data: newLead, error } = await supabase
                .from('leads')
                .insert(newLeadData)
                .select()

            if (error) {
                console.error("Error creando lead:", error)
                return NextResponse.json({ error: error.message }, { status: 500 })
            }

            return NextResponse.json({ success: true, action: "created", id: newLead[0].id })
        }

    } catch (e: any) {
        console.error("❌ Error Fatal:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ status: "Online 🟢" })
}