import { 
    Inbox, FileText, ShieldAlert, Lock, AlertTriangle, CheckCircle2, XCircle
} from "lucide-react"

export type OpStatus = 'ingresado' | 'precarga' | 'medicas' | 'legajo' | 'demoras' | 'cumplidas' | 'rechazado'
export type OpType = 'alta' | 'pass'
export type OpOrigin = 'Google Ads' | 'Meta Ads' | 'Llamador' | 'Referido' | 'Referido Personal'

// --- CORRECCIÓN CLAVE: Agregamos TODOS los estados en el orden que querés verlos ---
export const FLOW_STATES: OpStatus[] = [
    'ingresado', 
    'precarga', 
    'medicas', 
    'legajo', 
    'demoras', 
    'cumplidas', 
    'rechazado'
]

// El resto del archivo data.ts sigue igual, no hace falta que borres lo demás si ya lo tenés bien.
// Pero asegurate de que SUB_STATES tenga todas las claves.

export const SUB_STATES: Record<OpStatus, string[]> = {
    ingresado: ['Pendiente de revisión'],
    precarga: ['Docu pendiente'],
    medicas: ['Auditoria', 'Análisis', 'Ampliación'],
    legajo: ['Firma', 'Pago', 'Derivación', 'Completo'],
    demoras: ['Documentación faltante', 'Problema Afiliación', 'Otras'],
    rechazado: ['Baja', 'Desiste', 'Documentación faltante', 'No deriva aportes', 'Patologia roja', 'Otras'],
    cumplidas: ['Finalizado']
}

// ... (El resto de tus exports de PLANES_POR_EMPRESA, tipos, etc. dejálos como están)
export const PLANES_POR_EMPRESA: Record<string, string[]> = {
    "Prevención Salud": ["A1", "A1 CP", "A2 CP", "A2", "A4", "A5"],
    "DoctoRed": ["500", "1000", "2000", "3000"],
    "Avalian": ["AS100", "AS200 SC", "AS200", "AS204", "AS300", "AS500"],
    "AMPF Salud": ["Plan Superior"],
    "Swiss Medical": ["SMG20", "SMG30", "SMG40", "SMG50", "SMG60", "SMG70"],
    "Galeno": ["Plan 200", "Plan 220", "Plan 300", "Plan 330", "Plan 400", "Plan 440", "Plan 550"],
    "Otra": ["Básico", "Intermedio", "Premium"]
}

export type ChatMsg = { user: string; text: string; time: string; isMe: boolean; file?: { name: string, type: string, url: string } }
export type AuditLog = { date: string; user: string; action: string }
export type AdminNote = { id: string; text: string; date: string; user: string }
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
    adminNotes: AdminNote[] 
    reminders: Reminder[]
    urgent: boolean
    obs?: string
}

export const getPrepagaStyles = (p?: string) => {
    switch (p) {
        case "Prevención Salud": return "border-l-pink-500"
        case "DoctoRed": return "border-l-violet-500"
        case "Avalian": return "border-l-green-500"
        case "Swiss Medical": return "border-l-red-500"
        case "Galeno": return "border-l-blue-500"
        case "AMPF Salud": return "border-l-sky-500"
        default: return "border-l-slate-400"
    }
}

export const getStatusColor = (status: OpStatus) => {
    switch(status) {
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
    
    if (danger.includes(sub)) return "bg-red-50 text-red-700 border-red-200 font-bold"
    if (warning.includes(sub)) return "bg-amber-50 text-amber-700 border-amber-200 font-bold"
    if (success.includes(sub)) return "bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
    
    return "bg-blue-50 text-blue-700 border-blue-200" 
}

export const MOCK_OPS: Operation[] = [
    { 
        id: "OP-101", type: 'alta', origin: 'Google Ads', clientName: "Mariana Rodriguez", dni: "32.123.456", cuit: "27-32123456-4",
        dob: "15/05/1990", email: "mariana.r@gmail.com", phone: "1133334444", domicilio: "Av. Santa Fe 1234",
        localidad: "CABA", provincia: "Buenos Aires", cp: "1425",
        plan: "A4", prepaga: "Prevención Salud", price: 45000, capitas: 1, seller: "Maca", entryDate: "2025-12-01", daysInStatus: 1,
        tipoGrupo: 'individual', origenAportes: 'obligatorio', condicionLaboral: 'empleado',
        status: 'ingresado', subState: 'Pendiente de revisión', operator: null, lastUpdate: "10 min", filesCount: 2, chat: [], history: [], 
        adminNotes: [], reminders: [], urgent: true 
    },
    { 
        id: "OP-102", type: 'pass', origin: 'Referido', clientName: "Esteban Quito", dni: "28.999.000",
        dob: "20/02/1985", email: "esteban@mail.com", phone: "1155556666", domicilio: "Calle Falsa 123", localidad: "Lanús", provincia: "GBA", cp: "1824",
        plan: "1000", prepaga: "DoctoRed", price: 25000, capitas: 4, seller: "Gonza", entryDate: "2025-12-10", daysInStatus: 3,
        status: 'precarga', subState: 'Docu pendiente', operator: "Lucho", lastUpdate: "45 min", filesCount: 4, chat: [], history: [], adminNotes: [], reminders: [{ id: '1', date: '2025-12-26', time: '15:00', note: 'Llamar para pedir DNI', type: 'call', done: false, assignee: 'Lucho' }], urgent: false 
    },
    { 
        id: "OP-103", type: 'alta', origin: 'Meta Ads', clientName: "Julieta Venegas", dni: "25.111.222",
        dob: "10/10/1980", email: "juli@mail.com", phone: "1144445555", domicilio: "Limon 123", localidad: "CABA", provincia: "Buenos Aires", cp: "1400",
        plan: "SMG20", prepaga: "Swiss Medical", price: 60000, capitas: 2, seller: "Maca", entryDate: "2025-12-01", finishedDate: "2025-12-05", daysInStatus: 0,
        status: 'cumplidas', subState: 'Finalizado', operator: "Lucho", lastUpdate: "5 dias", filesCount: 5, chat: [], history: [], adminNotes: [], reminders: [], urgent: false 
    },
    { 
        id: "OP-104", type: 'pass', origin: 'Llamador', clientName: "Pedro Aznar", dni: "14.222.333",
        dob: "05/05/1975", email: "pedro@mail.com", phone: "1199998888", domicilio: "Roca 500", localidad: "Rosario", provincia: "Santa Fe", cp: "2000",
        plan: "AS300", prepaga: "Avalian", price: 35000, capitas: 1, seller: "Gonza", entryDate: "2025-12-15", daysInStatus: 2,
        status: 'rechazado', subState: 'Baja', operator: "Iara", lastUpdate: "2 dias", filesCount: 1, chat: [], history: [], adminNotes: [], reminders: [], urgent: false 
    },
    { 
        id: "OP-105", type: 'alta', origin: 'Meta Ads', clientName: "Carlos Gardel", dni: "5.555.555",
        dob: "11/12/1890", email: "carlos@mail.com", phone: "1100000000", domicilio: "Abasto", localidad: "CABA", provincia: "Buenos Aires", cp: "1000",
        plan: "210", prepaga: "Osde", price: 80000, capitas: 1, seller: "Maca", entryDate: "2025-12-20", finishedDate: "2025-12-22", daysInStatus: 0,
        status: 'cumplidas', subState: 'Finalizado', operator: "Maca", lastUpdate: "1 dia", filesCount: 3, chat: [], history: [], adminNotes: [], reminders: [], urgent: false 
    }
]