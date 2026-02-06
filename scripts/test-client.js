// Script temporal para crear cliente de prueba - 6 meses de alta + cumpleaños hoy
require('dotenv').config({ path: '.env.local' })
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error('Faltan variables de entorno SUPABASE')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function createTestClient() {
    const today = new Date()
    const todayStr = today.toISOString().split('T')[0] // Para cumpleaños

    // Fecha alta hace 6 meses
    const sixMonthsAgo = new Date(today)
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const altaStr = sixMonthsAgo.toISOString().split('T')[0]

    // DOB para cumpleaños hoy (cualquier año pero mismo día/mes)
    const birthYear = today.getFullYear() - 35
    const dobStr = `${birthYear}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

    const testClient = {
        name: 'María Test González',
        dni: '30123456',
        cuit: '27-30123456-4',
        phone: '1155556666',
        email: 'maria.test@test.com',
        dob: dobStr,
        status: 'cumplidas',
        billing_approved: true,
        agent_name: 'TestVendedor',
        prepaga: 'Galeno',
        quoted_prepaga: 'Galeno',
        plan: 'Azul 220',
        quoted_plan: 'Azul 220',
        price: 45000,
        quoted_price: 45000,
        province: 'Buenos Aires',
        address_zip: '1425',
        fecha_alta: altaStr,
        financial_status: 'SIN MORA',
        action_status: 'OK',
        notes: '[SISTEMA]: Cliente de prueba creado para verificar funcionalidad de 6 meses y cumpleaños.',
        created_at: new Date().toISOString(),
        last_update: new Date().toISOString()
    }

    console.log('Creando cliente de prueba...')
    console.log(`- Nombre: ${testClient.name}`)
    console.log(`- Cumpleaños: ${testClient.dob} (HOY)`)
    console.log(`- Fecha Alta: ${testClient.fecha_alta} (hace 6 meses)`)

    const { data, error } = await supabase
        .from('leads')
        .insert(testClient)
        .select()

    if (error) {
        console.error('Error:', error.message)
    } else {
        console.log('✅ Cliente de prueba creado exitosamente!')
        console.log('ID:', testClient.id)
    }
}

createTestClient()
