import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// --- CONFIGURACIÓN SUPABASE ADMIN (CLAVES FIJAS) ---
const getSupabaseAdmin = () => {
  const supabaseUrl = "https://ohucrauziwaaahcujeru.supabase.co"
  
  // ESTA ES LA CLAVE DE ORO (SERVICE ROLE) QUE ME PASASTE:
  const serviceRoleKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9odWNyYXV6aXdhYWFoY3VqZXJ1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTg4ODgwMSwiZXhwIjoyMDgxNDY0ODAxfQ.BF1HJbe-2d2wSL_gDAdp2ZcXxeX1fpGQhi99sOxGSjE"

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// --- CREAR USUARIO (POST) ---
export async function POST(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { email, password, full_name, role, work_hours } = body

    // 1. Crear usuario en Auth (Confirmado y Encriptado OK)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error("No se pudo crear el usuario")

    // 2. Crear Perfil en tabla pública
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: authData.user.id,
        email,
        full_name,
        role,
        work_hours
      })

    if (profileError) throw profileError

    return NextResponse.json({ id: authData.user.id, message: "Usuario creado OK" })

  } catch (error: any) {
    console.error('Error creando usuario:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}

// --- EDITAR USUARIO (PUT) ---
export async function PUT(request: Request) {
  try {
    const supabaseAdmin = getSupabaseAdmin()
    const body = await request.json()
    const { id, password, full_name, role, work_hours } = body

    // 1. Si hay contraseña nueva, la actualizamos
    if (password && password.trim() !== "") {
      const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password
      })
      if (passError) throw passError
    }

    // 2. Actualizar Perfil
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ full_name, role, work_hours })
      .eq('id', id)

    if (profileError) throw profileError

    return NextResponse.json({ message: "Usuario actualizado OK" })

  } catch (error: any) {
    console.error('Error editando usuario:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}