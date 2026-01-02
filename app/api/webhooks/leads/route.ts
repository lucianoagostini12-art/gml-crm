import { createClient } from "@/lib/supabase"
import { NextResponse } from "next/server"

// Esta función escucha los datos que llegan (POST)
export async function POST(request: Request) {
    // 1. Conectamos a Supabase (usando las variables de entorno del servidor)
    const supabase = createClient()
    
    try {
        // 2. Leemos los datos que llegan
        const body = await request.json()
        
        console.log("📥 Dato Recibido:", body) // Esto te sirve para ver en los logs qué llega

        // 3. Normalizamos los datos (Porque Google manda 'name', Wati manda 'fullName', etc.)
        // Intentamos adivinar los campos comunes.
        const leadData = {
            name: body.name || body.full_name || body.nombre || "Desconocido Web",
            phone: body.phone || body.phone_number || body.telefono || body.celular,
            email: body.email || body.correo,
            source: body.source || body.origen || "Web/Externo", 
            notes: body.notes || body.mensaje || body.comentarios || "",
            status: 'nuevo', // Siempre entra como nuevo
            created_at: new Date().toISOString(),
            last_update: new Date().toISOString()
        }

        // Validación mínima: Si no hay teléfono ni mail, es basura.
        if (!leadData.phone && !leadData.email) {
            return NextResponse.json({ error: "Datos insuficientes (falta contacto)" }, { status: 400 })
        }

        // 4. Guardamos en Supabase
        const { data, error } = await supabase
            .from('leads')
            .insert(leadData)
            .select()

        if (error) {
            console.error("❌ Error Supabase:", error)
            return NextResponse.json({ error: error.message }, { status: 500 })
        }

        // 5. Éxito
        return NextResponse.json({ success: true, id: data[0].id }, { status: 200 })

    } catch (e: any) {
        console.error("❌ Error General:", e)
        return NextResponse.json({ error: "Error procesando solicitud" }, { status: 400 })
    }
}

// Esto es para probar si la URL funciona entrando desde el navegador
export async function GET() {
    return NextResponse.json({ 
        status: "Online 🟢", 
        message: "El endpoint de Leads está listo para recibir POSTs." 
    })
}