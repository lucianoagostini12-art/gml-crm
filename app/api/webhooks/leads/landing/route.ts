import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// 1. CONFIGURACIÓN DE CORS (Para que DonWeb/Landing pueda hablar con tu CRM)
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
}

// 2. MANEJO DE "PRE-FLIGHT" (El navegador pregunta permiso antes de enviar)
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() })
}

// 3. PROCESAMIENTO DEL FORMULARIO
export async function POST(req: Request) {
    const supabase = createClient()
    
    try {
        const body = await req.json()
        const { nombre, telefono, cp, provincia, ref, landing_url } = body

        // --- LÓGICA HÍBRIDA DE ETIQUETADO ---
        // 1. Etiqueta por defecto
        let finalTag = "Formulario - DoctoRed"

        // 2. Si viene un "ref" (ej: ?ref=reelmorsia), buscamos si tiene nombre lindo en AdminConfig
        if (ref) {
            // Traemos las reglas guardadas en tu base de datos
            const { data: config } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'message_source_rules')
                .single()
            
            const rules = config?.value || []
            
            // Buscamos coincidencia
            const match = rules.find((r: any) => {
                if (r.matchType === 'exact') return r.trigger === ref
                return ref.includes(r.trigger) // contains
            })

            if (match) {
                finalTag = match.source // Ej: "Meta Ads - Reel Morsia"
            } else {
                // Si no hay regla configurada pero hay ref, mostramos el código crudo
                finalTag = `Meta Ads (${ref})`
            }
        }

        // --- GUARDADO EN SUPABASE ---
        const { error } = await supabase.from('leads').insert({
            name: nombre,
            phone: telefono,
            city: provincia || '', 
            address: cp ? `CP: ${cp}` : '', 
            source: finalTag, // La etiqueta calculada
            status: 'ingresado', // Estado inicial en el tablero
            notes: `Landing URL: ${landing_url} | CP: ${cp}` // Datos extra en notas
        })

        if (error) throw error

        return NextResponse.json({ success: true }, { headers: corsHeaders() })

    } catch (error: any) {
        console.error("Error webhook landing:", error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() })
    }
}