// components/ops/data.ts

export type OpStatus = 'ingresado' | 'precarga' | 'medicas' | 'legajo' | 'demoras' | 'cumplidas' | 'rechazado'
export type OpType = 'alta' | 'pass'
export type OpOrigin = 'Google Ads' | 'Meta Ads' | 'Llamador' | 'Referido' | 'Referido Personal'

// Orden fijo del flujo (Esto sí conviene dejarlo fijo para mantener el orden visual)
export const FLOW_STATES: OpStatus[] = [
    'ingresado',
    'precarga',
    'medicas',
    'legajo',
    'demoras',
    'cumplidas',
    'rechazado'
]

// TIPOS DE DATOS
export type ChatMsg = { user: string; text: string; time: string; isMe: boolean; file?: { name: string, type: string, url: string } }
export type AuditLog = { date: string; user: string; action: string }
export type AdminNote = { id: string; text: string; date: string; user: string } // Corrección: 'action' a veces se usa como texto
export type Reminder = { id: string; date: string; time: string; note: string; type: 'task' | 'call' | 'meeting' | 'whatsapp'; done: boolean; assignee?: string }

export type Operation = {
    id: string
    type: OpType
    origin: OpOrigin
    clientName: string
    dni: string
    cuit?: string
    dob: string
    email?: string
    phone: string
    domicilio?: string
    localidad?: string
    provincia?: string
    cp?: string
    seller: string
    entryDate: string
    finishedDate?: string
    daysInStatus: number
    plan?: string
    prepaga?: string
    price?: number
    capitas?: number
    tipoGrupo?: string
    conyuge?: { nombre: string, dni: string }
    hijos?: { nombre: string, dni: string }[]
    origenAportes?: string
    condicionLaboral?: string
    cuitEmpleador?: string
    claveFiscal?: string
    metodoPago?: string
    banco?: string
    cbu_tarjeta?: string
    status: OpStatus
    subState?: string
    operator: string | null
    lastUpdate: string
    filesCount: number
    chat: ChatMsg[]
    history: AuditLog[]
    adminNotes: any[]
    reminders: Reminder[]
    urgent: boolean
    obs?: string

    // Facturación
    fullPrice?: string
    aportes?: string
    descuento?: string
    billing_approved?: boolean
    billing_period?: string
    billing_price_override?: number
    billing_portfolio_override?: number

    // Datos extendidos Modal
    address_street?: string
    address_city?: string
    address_zip?: string
    affiliation_type?: string
}

// HELPERS VISUALES (Estilos)
export const getPrepagaStyles = (p?: string) => {
    const safeP = p || ""
    if (safeP.includes("Prevención")) return "border-l-pink-500"
    if (safeP.includes("DoctoRed")) return "border-l-violet-500"
    if (safeP.includes("Avalian")) return "border-l-green-500"
    if (safeP.includes("Swiss")) return "border-l-red-500"
    if (safeP.includes("Galeno")) return "border-l-blue-500"
    if (safeP.includes("AMPF")) return "border-l-sky-500"
    return "border-l-slate-400"
}

export const getStatusColor = (status?: string | null) => {
    if (!status) return 'bg-slate-500 text-white'
    switch (status) {
        case 'ingresado': return 'bg-slate-800 text-white border-slate-900'
        case 'precarga': return 'bg-blue-600 text-white border-blue-700'
        case 'medicas': return 'bg-purple-600 text-white border-purple-700'
        case 'legajo': return 'bg-yellow-500 text-white border-yellow-600'
        case 'cumplidas': return 'bg-emerald-600 text-white border-emerald-700'
        case 'rechazado': return 'bg-red-600 text-white border-red-700'
        case 'demoras': return 'bg-amber-600 text-white border-amber-700'
        default: return 'bg-slate-500 text-white'
    }
}

export const getSubStateStyle = (sub?: string) => {
    if (!sub) return "bg-white text-slate-700 border-slate-300"
    const danger = ['Documentación faltante', 'Problema Afiliación', 'Baja', 'Desiste', 'No deriva aportes', 'Patologia roja', 'Error página']
    const warning = ['Docu pendiente', 'Auditoria', 'Análisis', 'Ampliación']
    const success = ['Aprobado', 'Completo', 'Finalizado', 'Enviado a Facturación']

    if (danger.some(d => sub.includes(d))) return "bg-red-50 text-red-700 border-red-200 font-bold"
    if (warning.some(w => sub.includes(w))) return "bg-amber-50 text-amber-700 border-amber-200 font-bold"
    if (success.some(s => sub.includes(s))) return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"

    return "bg-blue-50 text-blue-700 border-blue-200"
}

// YA NO EXPORTAMOS PLANES NI MOCK OPS DESDE ACÁ
// Se deben cargar dinámicamente en los componentes