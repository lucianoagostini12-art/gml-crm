export type OpStatus = 'ingresado' | 'precarga' | 'medicas' | 'legajo' | 'demoras' | 'cumplidas' | 'rechazado'
export type OpType = 'alta' | 'pass'
export type PrepagaType = 'Sancor' | 'Galeno' | 'Swiss Medical' | 'Osde' | 'Prevencion' | 'Avalian' | 'Otra'

export type ChatMsg = { user: string; text: string; time: string; isMe: boolean; file?: { name: string, type: string, url: string } }
export type AuditLog = { date: string; user: string; action: string }
export type AdminNote = { text: string; date: string; user: string }

export type Operation = {
    id: string
    type: OpType
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
    plan?: string
    prepaga?: PrepagaType
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
    obs?: string 
    status: OpStatus
    subState?: string
    operator: string | null 
    lastUpdate: string
    filesCount: number
    chat: ChatMsg[]
    history: AuditLog[]
    adminNotes: AdminNote[]
    urgent: boolean
}