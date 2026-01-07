import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

// Inicializamos el cliente ADMIN con la clave de servicio
// (Asegúrate de tener SUPABASE_SERVICE_ROLE_KEY en tu .env.local)
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

// --- CREAR USUARIO NUEVO ---
export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { email, password, full_name, role, work_hours } = body

    // 1. Crear en Auth (Ya nace confirmado y con contraseña segura)
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
      .insert({
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

// --- ACTUALIZAR USUARIO EXISTENTE ---
export async function PUT(request: Request) {
  try {
    const body = await request.json()
    const { id, email, password, full_name, role, work_hours } = body

    // 1. Si mandaron contraseña, la actualizamos en Auth
    if (password && password.trim() !== "") {
      const { error: passError } = await supabaseAdmin.auth.admin.updateUserById(id, {
        password: password
      })
      if (passError) throw passError
    }

    // 2. Actualizamos el email si cambió (Opcional, puede ser delicado)
    // const { error: emailError } = await supabaseAdmin.auth.admin.updateUserById(id, { email })
    // if (emailError) throw emailError;

    // 3. Actualizamos el perfil público
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        full_name,
        role,
        work_hours
      })
      .eq('id', id)

    if (profileError) throw profileError

    return NextResponse.json({ message: "Usuario actualizado OK" })

  } catch (error: any) {
    console.error('Error actualizando usuario:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}