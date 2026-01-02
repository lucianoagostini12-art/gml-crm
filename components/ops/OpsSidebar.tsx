"use client"
import { useState } from "react"
// AGREGADO: HeartHandshake
import { LayoutGrid, Inbox, UserCheck, CalendarDays, BarChart3, LogOut, PanelLeftClose, FileText, ShieldAlert, Lock, AlertTriangle, CheckCircle2, XCircle, MessageSquare, Database, Settings, Megaphone, ChevronDown, ChevronRight, DollarSign, HeartHandshake } from "lucide-react"
import { Button } from "@/components/ui/button"

export function OpsSidebar({ open, setOpen, viewMode, setViewMode, role, currentStage, setStage }: any) {
    
    const [sections, setSections] = useState({
        general: true,
        tools: true,
        stages: true
    })

    const toggleSection = (section: keyof typeof sections) => {
        setSections(prev => ({ ...prev, [section]: !prev[section] }))
    }
    
    const SidebarBtn = ({ active, onClick, icon, label, isSubItem = false }: any) => (
        <button 
            onClick={onClick} 
            className={`w-full flex items-center ${open ? 'justify-start px-3' : 'justify-center'} py-2 rounded-md text-xs font-medium transition-all duration-200 
            ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}
            ${isSubItem && open ? 'pl-6' : ''}`}
        >
            <div className="mr-3">{icon}</div>
            {open && <span className="flex-1 text-left">{label}</span>}
        </button>
    )

    const SectionHeader = ({ label, sectionKey }: { label: string, sectionKey: keyof typeof sections }) => {
        if (!open) return <div className="border-t border-slate-800 my-2 mx-2"></div>
        return (
            <div 
                className="flex items-center justify-between px-3 py-2 cursor-pointer text-[9px] font-bold text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors mt-1"
                onClick={() => toggleSection(sectionKey)}
            >
                {label}
                {sections[sectionKey] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </div>
        )
    }

    return (
        <aside className={`${open ? 'w-[220px]' : 'w-[60px]'} transition-all duration-300 bg-slate-900 text-white flex flex-col shrink-0 z-50 shadow-xl overflow-hidden h-screen sticky top-0`}>
            {/* HEADER */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                {open && <span className="font-black text-lg tracking-tighter text-blue-400">GML OPS</span>}
                <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="text-slate-400 hover:text-white h-8 w-8"><PanelLeftClose size={16}/></Button>
            </div>
            
            <nav className="p-2 space-y-0.5 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                
                {/* --- SECCION: GENERAL --- */}
                <SectionHeader label="General" sectionKey="general" />
                
                {(open ? sections.general : true) && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <SidebarBtn active={viewMode === 'dashboard'} onClick={() => {setViewMode('dashboard'); setStage(null)}} icon={<LayoutGrid size={18}/>} label="Tablero" />
                        <SidebarBtn active={viewMode === 'kanban'} onClick={() => {setViewMode('kanban'); setStage(null)}} icon={<LayoutGrid size={18} className="rotate-90"/>} label="Vista Global" />
                        <SidebarBtn active={viewMode === 'pool'} onClick={() => {setViewMode('pool'); setStage(null)}} icon={<Inbox size={18}/>} label="Mesa Entradas" />
                        <SidebarBtn active={viewMode === 'mine'} onClick={() => {setViewMode('mine'); setStage(null)}} icon={<UserCheck size={18}/>} label="Mis Casos" />
                        <SidebarBtn active={viewMode === 'agenda'} onClick={() => {setViewMode('agenda'); setStage(null)}} icon={<CalendarDays size={18}/>} label="Agendas" />
                        
                        {/* NUEVO BOTON POSVENTA */}
                        <SidebarBtn active={viewMode === 'post_sale'} onClick={() => {setViewMode('post_sale'); setStage(null)}} icon={<HeartHandshake size={18} className="text-pink-400"/>} label="Posventa" />

                        {role === 'admin_god' && (
                            <>
                                <SidebarBtn active={viewMode === 'metrics'} onClick={() => {setViewMode('metrics'); setStage(null)}} icon={<BarChart3 size={18}/>} label="Métricas" />
                                <SidebarBtn active={viewMode === 'billing'} onClick={() => {setViewMode('billing'); setStage(null)}} icon={<DollarSign size={18} className="text-green-500"/>} label="Facturación" />
                            </>
                        )}
                    </div>
                )}

                {/* --- SECCION: HERRAMIENTAS --- */}
                <SectionHeader label="Herramientas" sectionKey="tools" />

                {(open ? sections.tools : true) && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <SidebarBtn active={viewMode === 'announcements'} onClick={() => {setViewMode('announcements'); setStage(null)}} icon={<Megaphone size={18} className="text-pink-500"/>} label="Comunicados" />
                        <SidebarBtn active={viewMode === 'chat'} onClick={() => {setViewMode('chat'); setStage(null)}} icon={<MessageSquare size={18} className="text-blue-400"/>} label="Chat Equipo" />
                        <SidebarBtn active={viewMode === 'database'} onClick={() => {setViewMode('database'); setStage(null)}} icon={<Database size={18} className="text-indigo-400"/>} label="Base de Datos" />
                    </div>
                )}

                {/* --- SECCION: ETAPAS --- */}
                <SectionHeader label="Etapas" sectionKey="stages" />

                {(open ? sections.stages : true) && (
                    <div className="animate-in slide-in-from-top-2 duration-200">
                        <SidebarBtn active={currentStage === 'ingresado' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('ingresado')}} icon={<Inbox size={16} className="text-slate-400"/>} label="Ingresado" />
                        <SidebarBtn active={currentStage === 'precarga' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('precarga')}} icon={<FileText size={16} className="text-blue-400"/>} label="Precarga" />
                        <SidebarBtn active={currentStage === 'medicas' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('medicas')}} icon={<ShieldAlert size={16} className="text-purple-400"/>} label="Médicas" />
                        <SidebarBtn active={currentStage === 'legajo' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('legajo')}} icon={<Lock size={16} className="text-yellow-400"/>} label="Legajo" />
                        <SidebarBtn active={currentStage === 'demoras' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('demoras')}} icon={<AlertTriangle size={16} className="text-amber-500"/>} label="Demoras" />
                        
                        <div className="my-1 border-t border-slate-800/50 mx-2"></div>
                        
                        <SidebarBtn active={currentStage === 'cumplidas' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('cumplidas')}} icon={<CheckCircle2 size={16} className="text-emerald-500"/>} label="Aprobadas" />
                        <SidebarBtn active={currentStage === 'rechazado' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('rechazado')}} icon={<XCircle size={16} className="text-red-500"/>} label="Rechazadas" />
                    </div>
                )}

                {/* FOOTER */}
                <div className="mt-auto border-t border-slate-800 pt-2 pb-2 space-y-1">
                    <SidebarBtn active={viewMode === 'settings'} onClick={() => {setViewMode('settings'); setStage(null)}} icon={<Settings size={18} className="text-slate-400"/>} label="Configuración" />
                    <SidebarBtn onClick={() => window.location.reload()} icon={<LogOut size={18} className="text-red-400"/>} label="Salir" />
                </div>
            </nav>
        </aside>
    )
}