import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // Necesitamos la clave de servicio (Service Role) para crear usuarios sin restricciones
    // Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY en tu archivo .env.local
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await request.json()
    const { email, password, full_name, role, work_hours } = body

    // 1. Crear usuario en el sistema de Autenticación (¡Esto genera el hash perfecto!)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Confirmamos el email automáticamente
      user_metadata: { full_name }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error("No se pudo crear el usuario")

    const userId = authData.user.id

    // 2. Crear el perfil en la tabla pública
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        full_name,
        role,
        work_hours
      })

    if (profileError) throw profileError

    return NextResponse.json({ id: userId, message: "Usuario creado exitosamente" })

  } catch (error: any) {
    console.error('Error creando usuario:', error)
    return NextResponse.json(
      { error: error.message || 'Error interno del servidor' },
      { status: 500 }
    )
  }
}