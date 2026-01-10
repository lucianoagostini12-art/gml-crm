import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

// 1. HEADERS CORS (Permisos para que entre el dato desde afuera)
function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*', 
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
}

// 2. MANEJO DE "PRE-FLIGHT" (El navegador pregunta antes de mandar)
export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() })
}

// 3. PROCESAMIENTO
export async function POST(req: Request) {
    const supabase = createClient()
    
    try {
        const body = await req.json()
        // Extraemos los datos con valores por defecto para que no falle
        const { nombre, telefono, cp, provincia, ref, landing_url } = body

        // --- ETIQUETADO SEGURO (Try/Catch interno) ---
        let finalTag = "Formulario - DoctoRed" // Etiqueta por defecto

        if (ref) {
            try {
                // Intentamos buscar reglas, pero usamos maybeSingle para que NO explote si no hay nada
                const { data: config } = await supabase
                    .from('system_config')
                    .select('value')
                    .eq('key', 'message_source_rules')
                    .maybeSingle() 
                
                const rules = config?.value || []
                
                const match = rules.find((r: any) => {
                    if (r.matchType === 'exact') return r.trigger === ref
                    return ref.includes(r.trigger)
                })

                if (match) {
                    finalTag = match.source
                } else {
                    finalTag = `Meta Ads (${ref})`
                }
            } catch (err) {
                console.error("Error calculando etiqueta, usando defecto:", err)
                // Si falla esto, no pasa nada, seguimos con la etiqueta por defecto
            }
        }

        // --- GUARDADO EN SUPABASE ---
        // Limpiamos los datos para asegurar que entren
        const cleanPhone = telefono ? String(telefono).replace(/\D/g, '') : ''
        
        const { error } = await supabase.from('leads').insert({
            name: nombre || 'Sin Nombre',
            phone: cleanPhone,
            city: provincia || '', 
            address: cp ? `CP: ${cp}` : '', 
            source: finalTag, 
            status: 'ingresado', 
            notes: `Landing URL: ${landing_url || 'Directo'} | CP: ${cp || 'S/D'}` 
        })

        if (error) {
            console.error("Error insertando en Supabase:", error)
            return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() })
        }

        return NextResponse.json({ success: true }, { headers: corsHeaders() })

    } catch (error: any) {
        console.error("Error general webhook:", error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() })
    }
}