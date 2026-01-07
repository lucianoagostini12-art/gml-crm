import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    // ⚠️ IMPORTANTE: Necesitas esta clave en tu archivo .env.local
    // Si no la tienes, búscala en Supabase > Project Settings > API > service_role secret
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!serviceRoleKey) {
      return NextResponse.json({ error: "Falta la Service Role Key" }, { status: 500 })
    }

    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const body = await request.json()
    const { email, password, full_name, role, work_hours } = body

    // 1. Crear usuario en Auth con Email Confirmado (¡El secreto del sobrecito!)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 👈 ESTO PONE EL SOBRECITO AUTOMÁTICAMENTE
      user_metadata: { full_name }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error("No se pudo crear el usuario")

    const userId = authData.user.id

    // 2. Crear el perfil público
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

    return NextResponse.json({ id: userId, message: "Usuario creado y confirmado OK" })

  } catch (error: any) {
    console.error('Error creando usuario:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}