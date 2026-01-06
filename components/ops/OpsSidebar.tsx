"use client"
import { useState } from "react"
import { LayoutGrid, Inbox, UserCheck, CalendarDays, BarChart3, LogOut, PanelLeftClose, FileText, ShieldAlert, Lock, AlertTriangle, CheckCircle2, XCircle, MessageSquare, Database, Settings, Megaphone, ChevronDown, ChevronRight, DollarSign, HeartHandshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

export function OpsSidebar({ open, setOpen, viewMode, setViewMode, role, currentStage, setStage, currentUser, permissions, onLogout }: any) {
    
    const [sections, setSections] = useState({
        general: true, // 1. Operativa (Arriba)
        stages: true,  // 2. Filtros
        admin: true,   // 3. Gestión
        tools: true    // 4. Recursos
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
            title={!open ? label : undefined}
        >
            <div className="mr-3 shrink-0">{icon}</div>
            {open && <span className="flex-1 text-left truncate">{label}</span>}
        </button>
    )

    const SectionHeader = ({ label, sectionKey }: { label: string, sectionKey: keyof typeof sections }) => {
        if (!open) return <div className="border-t border-slate-800 my-2 mx-2"></div>
        return (
            <div 
                className="flex items-center justify-between px-3 py-2 cursor-pointer text-[10px] font-black text-slate-500 uppercase tracking-widest hover:text-slate-300 transition-colors mt-2"
                onClick={() => toggleSection(sectionKey)}
            >
                {label}
                {sections[sectionKey] ? <ChevronDown size={12}/> : <ChevronRight size={12}/>}
            </div>
        )
    }

    const canSeeMetrics = role === 'admin_god' || permissions?.accessMetrics;
    const canSeeBilling = role === 'admin_god' || permissions?.accessBilling;
    const canSeePostSale = role === 'admin_god' || permissions?.accessPostSale;
    const canEditSettings = role === 'admin_god' || permissions?.editSettings;

    return (
        <aside className={`${open ? 'w-[240px]' : 'w-[70px]'} transition-all duration-300 bg-[#0F172A] text-white flex flex-col shrink-0 z-50 shadow-2xl border-r border-slate-800 h-screen sticky top-0`}>
            {/* HEADER MEJORADO */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                {open ? (
                    <span className="font-black text-xl tracking-tighter text-white flex items-center gap-1">
                        GML <span className="text-blue-500">ADMIN</span>
                    </span>
                ) : (
                    <span className="font-black text-xl text-blue-500">G</span>
                )}
                <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="text-slate-400 hover:text-white h-8 w-8 ml-auto hover:bg-slate-800">
                    <PanelLeftClose size={18}/>
                </Button>
            </div>
            
            <nav className="p-3 space-y-1 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                
                {/* 1. SECCION: OPERATIVA (PRINCIPAL) */}
                <SectionHeader label="Operativa" sectionKey="general" />
                
                {(open ? sections.general : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                        <SidebarBtn active={viewMode === 'dashboard'} onClick={() => {setViewMode('dashboard'); setStage(null)}} icon={<LayoutGrid size={20}/>} label="Tablero Principal" />
                        <SidebarBtn active={viewMode === 'kanban'} onClick={() => {setViewMode('kanban'); setStage(null)}} icon={<LayoutGrid size={20} className="rotate-90"/>} label="Vista Global" />
                        <SidebarBtn active={viewMode === 'pool'} onClick={() => {setViewMode('pool'); setStage(null)}} icon={<Inbox size={20}/>} label="Mesa de Entradas" />
                        <SidebarBtn active={viewMode === 'mine'} onClick={() => {setViewMode('mine'); setStage(null)}} icon={<UserCheck size={20}/>} label="Mis Casos" />
                        <SidebarBtn active={viewMode === 'agenda'} onClick={() => {setViewMode('agenda'); setStage(null)}} icon={<CalendarDays size={20}/>} label="Agenda" />
                    </div>
                )}

                {/* 2. SECCION: FILTROS POR ETAPA */}
                <SectionHeader label="Filtros Etapa" sectionKey="stages" />

                {(open ? sections.stages : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                        <SidebarBtn active={currentStage === 'ingresado' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('ingresado')}} icon={<Inbox size={16} className="text-slate-500"/>} label="Ingresado" isSubItem />
                        <SidebarBtn active={currentStage === 'precarga' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('precarga')}} icon={<FileText size={16} className="text-blue-500"/>} label="Precarga" isSubItem />
                        <SidebarBtn active={currentStage === 'medicas' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('medicas')}} icon={<ShieldAlert size={16} className="text-purple-500"/>} label="Aud. Médica" isSubItem />
                        <SidebarBtn active={currentStage === 'legajo' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('legajo')}} icon={<Lock size={16} className="text-yellow-500"/>} label="Legajo" isSubItem />
                        <SidebarBtn active={currentStage === 'demoras' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('demoras')}} icon={<AlertTriangle size={16} className="text-amber-500"/>} label="Demoras" isSubItem />
                        
                        <div className="my-2 border-t border-slate-800/50 mx-4"></div>
                        
                        <SidebarBtn active={currentStage === 'cumplidas' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('cumplidas')}} icon={<CheckCircle2 size={16} className="text-emerald-500"/>} label="Aprobadas" isSubItem />
                        <SidebarBtn active={currentStage === 'rechazado' && viewMode === 'stage_list'} onClick={() => {setViewMode('stage_list'); setStage('rechazado')}} icon={<XCircle size={16} className="text-red-500"/>} label="Rechazadas" isSubItem />
                    </div>
                )}

                {/* 3. SECCION: GESTIÓN (FACTURACIÓN Y POST-VENTA) */}
                {(canSeePostSale || canSeeBilling || canSeeMetrics) && (
                    <>
                        <SectionHeader label="Gestión" sectionKey="admin" />
                        {(open ? sections.admin : true) && (
                            <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                                {canSeePostSale && (
                                    <SidebarBtn active={viewMode === 'post_sale'} onClick={() => {setViewMode('post_sale'); setStage(null)}} icon={<HeartHandshake size={20} className="text-pink-500"/>} label="Post-Venta" />
                                )}
                                {canSeeBilling && (
                                    <SidebarBtn active={viewMode === 'billing'} onClick={() => {setViewMode('billing'); setStage(null)}} icon={<DollarSign size={20} className="text-green-500"/>} label="Facturación" />
                                )}
                                {canSeeMetrics && (
                                    <SidebarBtn active={viewMode === 'metrics'} onClick={() => {setViewMode('metrics'); setStage(null)}} icon={<BarChart3 size={20} className="text-yellow-500"/>} label="Métricas" />
                                )}
                            </div>
                        )}
                    </>
                )}

                {/* 4. SECCION: RECURSOS */}
                <SectionHeader label="Recursos" sectionKey="tools" />

                {(open ? sections.tools : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1 duration-200">
                        <SidebarBtn active={viewMode === 'announcements'} onClick={() => {setViewMode('announcements'); setStage(null)}} icon={<Megaphone size={20} className="text-purple-500"/>} label="Novedades" />
                        <SidebarBtn active={viewMode === 'chat'} onClick={() => {setViewMode('chat'); setStage(null)}} icon={<MessageSquare size={20} className="text-blue-400"/>} label="Chat Interno" />
                        <SidebarBtn active={viewMode === 'database'} onClick={() => {setViewMode('database'); setStage(null)}} icon={<Database size={20} className="text-indigo-400"/>} label="Base de Datos" />
                    </div>
                )}

                {/* FOOTER */}
                <div className="mt-auto pt-4 pb-2 border-t border-slate-800 space-y-2">
                    
                    {/* USUARIO MEJORADO CON ANILLO Y FONDO */}
                    <div className={`flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-800/50 border border-slate-800 mx-1 transition-all ${open ? 'justify-start' : 'justify-center'}`}>
                        <Avatar className="h-9 w-9 ring-2 ring-blue-500/30">
                            <AvatarImage src={currentUser?.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser?.name || 'User'}`} className="object-cover" />
                            <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">{currentUser?.name?.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {open && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-black text-white truncate">{currentUser?.name || "Administrador"}</span>
                                <span className="text-[10px] text-blue-400 truncate font-bold uppercase">{role?.replace('_', ' ')}</span>
                            </div>
                        )}
                    </div>

                    {canEditSettings && (
                        <SidebarBtn active={viewMode === 'settings'} onClick={() => {setViewMode('settings'); setStage(null)}} icon={<Settings size={18} className="text-slate-400"/>} label="Configuración" />
                    )}
                    
                    <SidebarBtn onClick={onLogout} icon={<LogOut size={18} className="text-red-400"/>} label="Cerrar Sesión" />
                </div>
            </nav>
        </aside>
    )
}