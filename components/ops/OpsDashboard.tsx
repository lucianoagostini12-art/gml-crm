"use client"
import { useState, useEffect } from "react"
import { Inbox, FileText, ShieldAlert, Lock, AlertTriangle, ChevronRight, CheckCircle2, XCircle, ChevronLeft, Calendar } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

function FlowCard({ label, count, color, icon, active, onClick }: any) {
    const colors: any = { 
        slate: "border-slate-400 text-slate-500", 
        blue: "border-blue-500 text-blue-500", 
        purple: "border-purple-500 text-purple-500", 
        yellow: "border-yellow-500 text-yellow-500", 
        indigo: "border-indigo-500 text-indigo-500" 
    }
    
    const iconColorClass = colors[color].split(" ")[1]

    return (
        <Card onClick={onClick} className={`w-40 h-32 border-t-4 ${colors[color].split(" ")[0]} cursor-pointer flex flex-col items-center justify-center gap-1 shrink-0 transition-all ${active ? 'ring-2 ring-slate-900 bg-slate-50 shadow-inner' : 'bg-white shadow-sm hover:shadow-md'}`}>
            <div className={`transform scale-100 opacity-90 -mt-3 mb-1 ${iconColorClass}`}>
                {icon}
            </div>
            <span className="text-4xl font-black text-slate-800 leading-none">{count}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase w-full text-center leading-none tracking-wide mt-1">{label}</span>
        </Card>
    )
}

function BigStatusCard({ label, count, color, icon, onClick, active }: any) {
    return (
        <div onClick={onClick} style={{ backgroundColor: color === 'green' ? '#10b981' : '#ef4444' }} className={`w-48 h-32 rounded-xl flex flex-col items-center justify-center text-white shrink-0 cursor-pointer hover:scale-105 transition-transform p-3 ${active ? 'ring-4 ring-white/50' : ''}`}>
            <div className="mb-2 transform scale-125 opacity-90 -mt-2">{icon}</div>
            <span className="text-5xl font-black tracking-tighter leading-none">{count}</span>
            <span className="text-xs font-bold uppercase opacity-90 mt-2 tracking-widest">{label}</span>
        </div>
    )
}

// Helper simple para obtener mes actual YYYY-MM
const getCurrentMonthISO = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function OpsDashboard({ operations, activeFilter, setActiveFilter }: any) {
    
    // Iniciamos siempre en el mes corriente
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthISO())

    // Efecto para debug: ver qué mes está seleccionado y qué datos llegan
    useEffect(() => {
        // console.log("Dashboard - Mes seleccionado:", selectedMonth)
        // console.log("Dashboard - Operaciones recibidas:", operations.length)
    }, [selectedMonth, operations])

    const handleFilter = (stage: string) => {
        if (activeFilter === stage) setActiveFilter(null)
        else setActiveFilter(stage)
    }

    // Navegación de meses
    const changeMonth = (delta: number) => {
        const [y, m] = selectedMonth.split('-').map(Number)
        // Ojo con el mes 0 en Date (Enero es 0, Diciembre es 11)
        // Aquí restamos 1 para instanciar Date, sumamos delta, y volvemos a sumar 1 para el string
        const date = new Date(y, m - 1 + delta, 1)
        const newMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        setSelectedMonth(newMonth)
    }

    const formatMonth = (isoMonth: string) => {
        // isoMonth viene como "2023-12"
        const [y, m] = isoMonth.split('-').map(Number)
        // Usamos dia 2 para evitar problemas de timezone al inicio del mes
        return new Date(y, m - 1, 2).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    }

    // --- LÓGICA CORE: OBTENER EL MES REAL DE LA OPERACIÓN ---
    const getEffectiveMonth = (o: any) => {
        // 1. Si tiene billing_period (porque la movimos manual), GANADOR ABSOLUTO.
        if (o.billing_period) return o.billing_period

        // 2. Si no, usamos la fecha de creación original.
        // TRUCO: Usamos string slicing en lugar de Date() para evitar errores de timezone (-3hs).
        // Si created_at es "2023-12-01T02:00:00.000Z", el substring(0,7) da "2023-12". Perfecto.
        const dateStr = o.created_at || o.entryDate || ""
        if (dateStr && dateStr.length >= 7) {
            return dateStr.substring(0, 7)
        }
        
        // Fallback por si no hay fechas
        return "1999-01"
    }

    const countStatus = (status: string) => {
        return operations.filter((o: any) => {
            // 1. Coincidencia de estado
            if (o.status?.toLowerCase() !== status) return false

            // 2. Coincidencia de mes (usando la lógica segura)
            const opMonth = getEffectiveMonth(o)
            return opMonth === selectedMonth
        }).length
    }

    return (
        <div className="mb-6 flex flex-col items-center animate-in fade-in slide-in-from-top-4 w-full">
            
            {/* --- CONTROLES DE MES --- */}
            <div className="flex items-center gap-4 bg-white p-2 rounded-xl border border-slate-200 shadow-sm mb-6">
                <Button variant="ghost" size="icon" onClick={() => changeMonth(-1)} className="h-8 w-8 text-slate-500 hover:text-slate-800">
                    <ChevronLeft size={18}/>
                </Button>
                <div className="flex flex-col items-center w-48 select-none">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Tablero Mensual</span>
                    <span className="text-sm font-black text-slate-800 capitalize flex items-center gap-2 mt-1">
                        <Calendar size={14} className="text-slate-400"/> {formatMonth(selectedMonth)}
                    </span>
                </div>
                <Button variant="ghost" size="icon" onClick={() => changeMonth(1)} className="h-8 w-8 text-slate-500 hover:text-slate-800">
                    <ChevronRight size={18}/>
                </Button>
            </div>

            {/* --- FLOW CARDS (Inteligentes por mes) --- */}
            <div className="flex flex-wrap justify-center items-center gap-4 w-full mb-8">
                <FlowCard label="Ingresado" count={countStatus('ingresado')} onClick={() => handleFilter('ingresado')} active={activeFilter==='ingresado'} color="slate" icon={<Inbox className="h-6 w-6"/>}/>
                <ChevronRight className="text-slate-300 h-6 w-6 hidden md:block"/>
                <FlowCard label="Precarga" count={countStatus('precarga')} onClick={() => handleFilter('precarga')} active={activeFilter==='precarga'} color="blue" icon={<FileText className="h-6 w-6"/>}/>
                <ChevronRight className="text-slate-300 h-6 w-6 hidden md:block"/>
                <FlowCard label="Médicas" count={countStatus('medicas')} onClick={() => handleFilter('medicas')} active={activeFilter==='medicas'} color="purple" icon={<ShieldAlert className="h-6 w-6"/>}/>
                <ChevronRight className="text-slate-300 h-6 w-6 hidden md:block"/>
                <FlowCard label="Legajo" count={countStatus('legajo')} onClick={() => handleFilter('legajo')} active={activeFilter==='legajo'} color="yellow" icon={<Lock className="h-6 w-6"/>}/>
                <ChevronRight className="text-slate-300 h-6 w-6 hidden md:block"/>
                <FlowCard label="Demoras" count={countStatus('demoras')} onClick={() => handleFilter('demoras')} active={activeFilter==='demoras'} color="indigo" icon={<AlertTriangle className="h-6 w-6"/>}/>
            </div>
            
            <div className="flex justify-center gap-8 w-full flex-wrap">
                <div onClick={() => handleFilter('cumplidas')} style={{backgroundColor: '#10b981'}} className={`w-48 h-32 rounded-xl flex flex-col items-center justify-center text-white shrink-0 cursor-pointer hover:scale-105 transition-transform p-3 ${activeFilter==='cumplidas' ? 'ring-4 ring-green-200' : ''}`}>
                    <div className="mb-2 transform scale-125 opacity-90 -mt-2"><CheckCircle2 className="h-8 w-8 text-white"/></div>
                    <span className="text-5xl font-black tracking-tighter leading-none">{countStatus('cumplidas')}</span>
                    <span className="text-xs font-bold uppercase opacity-90 mt-2 tracking-widest">Cumplidas</span>
                </div>
                <BigStatusCard label="Rechazados" count={countStatus('rechazado')} color="red" icon={<XCircle className="h-8 w-8 text-white"/>} onClick={() => handleFilter('rechazado')} active={activeFilter==='rechazado'} />
            </div>
        </div>
    )
}