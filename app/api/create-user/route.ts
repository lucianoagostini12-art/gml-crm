import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Función helper para obtener el cliente admin solo cuando se necesita
const getSupabaseAdmin = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Faltan las variables de entorno de Supabase en el servidor.")
  }

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
    const supabaseAdmin = getSupabaseAdmin() // Inicializamos aquí, no afuera
    const body = await request.json()
    const { email, password, full_name, role, work_hours } = body

    // 1. Crear usuario en Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name }
    })

    if (authError) throw authError
    if (!authData.user) throw new Error("No se pudo crear el usuario")

    // 2. Crear Perfil
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
    const supabaseAdmin = getSupabaseAdmin() // Inicializamos aquí
    const body = await request.json()
    const { id, password, full_name, role, work_hours } = body

    // 1. Actualizar pass si existe
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