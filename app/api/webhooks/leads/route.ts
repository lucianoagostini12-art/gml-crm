import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// 🔐 TU CONTRASEÑA DE SEGURIDAD
const API_SECRET = "gml_crm_secret_key_2024" 

// Helper para limpiar texto
const cleanText = (t: string) => t?.toLowerCase().trim() || ""

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
        
        // Logs para depuración (puedes quitarlos luego)
        console.log("📥 Webhook Entrante:", JSON.stringify({
            waId: body.waId,
            text: body.text,
            referral: body.referral,
            sourceUrl: body.sourceUrl
        }))

        if (body.waId === 'senderPhone' || body.info === 'test_notification') {
             return NextResponse.json({ message: "Test WATI recibido OK" }, { status: 200 })
        }

        // 3. RECUPERAR EL MENSAJE REAL
        let finalMessage = body.text || ""
        if (body.interactiveButtonReply?.title) finalMessage = `[Botón]: ${body.interactiveButtonReply.title}`
        else if (body.listReply?.title) finalMessage = `[Lista]: ${body.listReply.title}`

        // 4. DATOS BÁSICOS DEL CLIENTE
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

        // =====================================================================
        // 5. 🧠 EL CEREBRO: MOTOR DE REGLAS DINÁMICO (Híbrido)
        // =====================================================================
        
        let detectedSource = body.source || "WATI / Bot" 
        let detectedPrepaga = null

        // A. Obtener Reglas desde la DB (system_config)
        const { data: configData } = await supabase
            .from('system_config')
            .select('value')
            .eq('key', 'message_source_rules')
            .single()
        
        const rules = configData?.value || []
        
        // Ordenar reglas por prioridad (mayor número = mayor prioridad)
        const sortedRules = Array.isArray(rules) 
            ? rules.sort((a: any, b: any) => (b.priority || 0) - (a.priority || 0))
            : []

        let matchedRule = null

        // B. ESTRATEGIA 1: REFERRAL DE META (Código de Anuncio)
        // WATI suele mandar esto en body.referral o body.sourceId
        const metaReferral = cleanText(body.referral || body.sourceId || "")
        
        if (metaReferral) {
            // Buscamos si existe una regla específica para este código de anuncio
            matchedRule = sortedRules.find((r: any) => cleanText(r.trigger) === metaReferral)
            
            // Si encontramos regla, perfecto. Si no, al menos sabemos que es Meta Ads.
            if (!matchedRule) {
                detectedSource = `Meta Ads (${metaReferral})`
            }
        }

        // C. ESTRATEGIA 2: ANÁLISIS DE TEXTO (Si no se resolvió por Referral)
        if (!matchedRule) {
            const msgLower = cleanText(finalMessage)

            for (const rule of sortedRules) {
                const trigger = cleanText(rule.trigger)
                const type = rule.matchType || 'contains'

                if (!trigger) continue

                let isMatch = false
                if (type === 'exact' && msgLower === trigger) isMatch = true
                else if (type === 'starts_with' && msgLower.startsWith(trigger)) isMatch = true
                else if (type === 'contains' && msgLower.includes(trigger)) isMatch = true

                if (isMatch) {
                    matchedRule = rule
                    break // Cortamos al encontrar la primera coincidencia por prioridad
                }
            }
        }

        // D. APLICAR RESULTADO
        if (matchedRule) {
            detectedSource = matchedRule.source
        }

        // E. INTELIGENCIA DE PREPAGA (Deducción inversa)
        // Si el Origen detectado contiene el nombre de una prepaga, la asignamos.
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

        // 6. GESTIÓN DE LEADS (Insertar o Actualizar)
        const { data: existingLead } = await supabase
            .from('leads')
            .select('id, chat, name, notes, prepaga, source')
            .eq('phone', phone)
            .maybeSingle()

        const now = new Date().toISOString()
        const timeString = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

        // CASO A: YA EXISTE -> ACTUALIZAR
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
            
            const updates: any = { 
                chat: [...currentChat, newChatMsg],
                last_update: now
            }

            // Solo completamos datos si faltaban o si el origen anterior era genérico
            if (!existingLead.prepaga && detectedPrepaga) updates.prepaga = detectedPrepaga
            if ((!existingLead.source || existingLead.source === "WATI / Bot") && detectedSource !== "WATI / Bot") {
                updates.source = detectedSource
            }

            await supabase.from('leads').update(updates).eq('id', existingLead.id)
            return NextResponse.json({ success: true, action: "updated", source: detectedSource }, { status: 200 })
        } 
        
        // CASO B: NUEVO LEAD -> CREAR
        else {
            const newLeadData = {
                name: name,
                phone: phone,
                source: detectedSource, 
                status: 'nuevo',
                agent_name: null,
                chat: [{ user: "Cliente", text: finalMessage, time: timeString, isMe: false }],
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

            return NextResponse.json({ success: true, action: "created", source: detectedSource }, { status: 200 })
        }

    } catch (e: any) {
        console.error("❌ Error Fatal:", e)
        return NextResponse.json({ error: e.message }, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ status: "Online 🟢" })
}