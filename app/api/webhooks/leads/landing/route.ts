import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase'

function corsHeaders() {
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
}

export async function OPTIONS() {
    return NextResponse.json({}, { headers: corsHeaders() })
}

export async function POST(req: Request) {
    const supabase = createClient()
    
    try {
        const body = await req.json()
        // Valores por defecto para que no explote si falta algo
        const nombre = body.nombre || 'Sin Nombre'
        const telefono = body.telefono ? String(body.telefono).replace(/\D/g, '') : ''
        const cp = body.cp || ''
        const provincia = body.provincia || ''
        const ref = body.ref || ''
        const landing_url = body.landing_url || ''

        let finalTag = "Formulario - DoctoRed"

        // Lógica de etiqueta manual (sin comandos raros)
        if (ref) {
            // Traemos la config como array simple
            const { data: config } = await supabase
                .from('system_config')
                .select('value')
                .eq('key', 'message_source_rules')
                .limit(1) // Traemos solo 1, modo clásico
            
            // Verificamos si existe data
            if (config && config.length > 0) {
                const rules = config[0].value || []
                const match = rules.find((r: any) => {
                    if (r.matchType === 'exact') return r.trigger === ref
                    return ref.includes(r.trigger)
                })
                if (match) finalTag = match.source
                else finalTag = `Meta Ads (${ref})`
            } else {
                finalTag = `Meta Ads (${ref})`
            }
        }

        const { error } = await supabase.from('leads').insert({
            name: nombre,
            phone: telefono,
            city: provincia,
            address: cp ? `CP: ${cp}` : '',
            source: finalTag,
            status: 'ingresado',
            notes: `Landing URL: ${landing_url}`
        })

        if (error) {
            console.error("Error insertando en Supabase:", error)
            // Respondemos 200 igual para no romper el frontend, pero logueamos el error
            return NextResponse.json({ success: false, error: error.message }, { headers: corsHeaders() })
        }

        return NextResponse.json({ success: true }, { headers: corsHeaders() })

    } catch (error: any) {
        console.error("Error general webhook:", error)
        return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders() })
    }
}