"use client"
import { Inbox, FileText, ShieldAlert, Lock, AlertTriangle, ChevronRight, CheckCircle2, XCircle } from "lucide-react"
import { Card } from "@/components/ui/card"

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

// ESTA ES LA EXPORTACIÓN QUE FALTA EN TU ARCHIVO ACTUAL
export function OpsDashboard({ operations, activeFilter, setActiveFilter }: any) {
    
    const handleFilter = (stage: string) => {
        if (activeFilter === stage) setActiveFilter(null)
        else setActiveFilter(stage)
    }

    const countStatus = (status: string) => {
        return operations.filter((o: any) => o.status?.toLowerCase() === status).length
    }

    return (
        <div className="mb-6 flex flex-col items-center animate-in fade-in slide-in-from-top-4 w-full">
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