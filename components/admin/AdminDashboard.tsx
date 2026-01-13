"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import {
  LayoutDashboard,
  Users,
  Layers,
  BarChart4,
  LogOut,
  Database,
  Sliders,
  Activity,
  ShieldAlert,
  Calculator,
  CalendarDays,
  Banknote,
  BookOpen,
  UserPlus,
  X,
  Sparkles,
  RefreshCw,
  LifeBuoy,
  Megaphone,
  Bell,
  PanelLeftClose,
  ChevronDown,
  ChevronRight,
  Menu,
  Calendar,
  Trophy,
  MessageCircle,
  FileText
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// --- IMPORTAR UTILIDAD DE NOTIFICACIONES ---
import { sendNativeNotification, requestNotificationPermission } from "@/utils/notifications"

// IMPORTAMOS TUS COMPONENTES
import { AdminLeadFactory } from "@/components/admin/AdminLeadFactory"
import { AdminMetrics } from "@/components/admin/AdminMetrics"
import { AdminTeam } from "@/components/admin/AdminTeam"
import { AdminLogs } from "@/components/admin/AdminLogs"
import { AdminConteo } from "@/components/admin/AdminConteo"
import { AdminPipelineHealth } from "@/components/admin/AdminPipelineHealth"
import { AdminAgendas } from "@/components/admin/AdminAgendas"
import { AdminAnnouncements } from "@/components/admin/AdminAnnouncements"
import { AdminDatabase } from "@/components/admin/AdminDatabase"
import { AdminConfig } from "@/components/admin/AdminConfig"
import { AdminCommissions } from "@/components/admin/AdminCommissions"
import { AdminResources } from "@/components/admin/AdminResources"
import { AdminSetterManager } from "@/components/admin/AdminSetterManager"
import { AdminRanking } from "@/components/admin/AdminRanking"

// --- FORMATO DE HORA CORREGIDO (ARGENTINA) ---
const formatTime = (dateString: string) => {
    if (!dateString) return "--:--"
    const date = new Date(dateString)
    return date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
}

// --- COMPONENTE DE VISIÓN GLOBAL CON FILTRO DE MES ---
function AdminOverview() {
  const supabase = createClient()
  const [stats, setStats] = useState({ entered: 0, completed: 0, compliance: 0 })
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  
  // Estado para el filtro de mes (YYYY-MM o 'all')
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().toISOString().slice(0, 7))

  const fetchDashboardData = async () => {
    setLoading(true)
    const { data: leads } = await supabase.from("leads").select("*").order("last_update", { ascending: false })

    if (leads) {
      // ✅ APLICAR FILTRO DE MES
      let filteredLeads = leads
      if (selectedMonth !== 'all') {
          filteredLeads = leads.filter((l: any) => l.created_at?.startsWith(selectedMonth))
      }

      const entered = filteredLeads.filter((l: any) => !["nuevo", "contactado", "perdido"].includes(l.status?.toLowerCase())).length
      const completed = filteredLeads.filter((l: any) => l.status?.toLowerCase() === "cumplidas").length
      const rate = entered > 0 ? Math.round((completed / entered) * 100) : 0
      setStats({ entered, completed, compliance: rate })

      // Actividad reciente (siempre mostramos la última actividad global para ver que el sistema vive)
      const recent = leads.slice(0, 15).map((l: any) => ({
        time: formatTime(l.last_update), // ✅ HORA CORREGIDA
        agent: l.agent_name || l.operator || "Sistema",
        action: `${l.status?.toUpperCase()} - ${l.name}`,
        type: l.status?.toLowerCase() === "cumplidas" ? "good" : l.status?.toLowerCase() === "perdido" ? "bad" : "neutral",
      }))
      setActivities(recent)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchDashboardData()
    const channel = supabase
      .channel("admin_live_updates")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchDashboardData())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedMonth])

  // Generar opciones de meses (últimos 12)
  const getMonthOptions = () => {
      const options = []
      const today = new Date()
      for (let i = 0; i < 12; i++) {
          const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
          const value = d.toISOString().slice(0, 7)
          const label = d.toLocaleString('es-ES', { month: 'long', year: 'numeric' })
          options.push({ value, label: label.charAt(0).toUpperCase() + label.slice(1) })
      }
      return options
  }

  return (
    <div className="p-8 space-y-8 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          Torre de Control 📡 {loading && <RefreshCw className="animate-spin h-5 w-5 text-slate-400" />}
        </h2>
        
        {/* ✅ FILTRO DE MES */}
        <div className="flex items-center gap-2">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[180px] h-9 bg-white border-slate-300 text-slate-700 font-bold">
                    <Calendar className="mr-2 h-4 w-4 text-slate-500"/>
                    <SelectValue placeholder="Periodo" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Todo el Historial</SelectItem>
                    {getMonthOptions().map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 shrink-0">
        <Card className="border-l-4 border-l-blue-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 font-bold uppercase">Ventas Ingresadas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black">{stats.entered}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-green-500 shadow-sm bg-green-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-green-700 font-bold uppercase">Ventas Cumplidas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-green-700">{stats.completed}</div>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-purple-500 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-slate-500 font-bold uppercase">Tasa de Cumplimiento</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-black text-purple-600">{stats.compliance}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex-1 min-h-0 flex flex-col">
        <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
          <Activity className="h-5 w-5 text-red-500 animate-pulse" /> Actividad en Vivo
        </h3>
        <Card className="flex-1 bg-slate-900 border-slate-800 text-slate-300 overflow-hidden flex flex-col shadow-2xl">
          <ScrollArea className="flex-1 p-4">
            <div className="space-y-4">
              {activities.map((act, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <span className="text-xs font-mono text-slate-500 mt-1">{act.time}</span>
                  <div className="flex-1 text-sm">
                    <span className={`font-bold ${act.agent?.toLowerCase().includes("admin") ? "text-yellow-400" : "text-blue-400"}`}>
                      {act.agent}
                    </span>
                    :
                    <span
                      className={
                        act.type === "good"
                          ? "text-green-400 font-bold ml-2"
                          : act.type === "bad"
                          ? "text-red-400 ml-2"
                          : "text-slate-300 ml-2"
                      }
                    >
                      {act.action}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        </Card>
      </div>
    </div>
  )
}

// --- SIDEBAR UNIFICADO ---
function AdminSidebar({ open, setOpen, view, setView, userData, onLogout, notifications, markAllRead, isBellOpen, setIsBellOpen, handleNotificationClick }: any) {
    const [sections, setSections] = useState({
        gestion: true,
        equipo: true,
        sistema: true,
        comunicacion: true
    })

    const toggleSection = (key: keyof typeof sections) => {
        setSections(prev => ({ ...prev, [key]: !prev[key] }))
    }

    // Componente Botón Sidebar
    const SidebarBtn = ({ active, onClick, icon, label, isSubItem = false, colorClass = "text-slate-400" }: any) => (
        <button 
            onClick={onClick} 
            className={`w-full flex items-center ${open ? 'justify-start px-3' : 'justify-center'} py-2 rounded-md text-xs font-medium transition-all duration-200 
            ${active ? 'bg-blue-600 text-white shadow-md' : `${colorClass} hover:bg-slate-800 hover:text-white`}
            ${isSubItem && open ? 'pl-6' : ''}`}
            title={!open ? label : undefined}
        >
            <div className={`mr-3 shrink-0 ${active ? 'text-white' : ''}`}>{icon}</div>
            {open && <span className="flex-1 text-left truncate">{label}</span>}
        </button>
    )

    // Componente Header Sección
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

    return (
        <aside className={`${open ? 'w-[240px]' : 'w-[70px]'} transition-all duration-300 bg-[#0F172A] text-white flex flex-col shrink-0 z-50 shadow-2xl border-r border-slate-800 h-screen sticky top-0`}>
            {/* HEADER */}
            <div className="h-16 flex items-center justify-between px-4 border-b border-slate-800 shrink-0">
                {open ? (
                    <span className="font-black text-xl tracking-tighter text-white flex items-center gap-1">
                        GML <span className="text-blue-500">SUPERVISIÓN</span>
                    </span>
                ) : (
                    <span className="font-black text-xl text-blue-500">G</span>
                )}
                <Button variant="ghost" size="icon" onClick={() => setOpen(!open)} className="text-slate-400 hover:text-white h-8 w-8 ml-auto hover:bg-slate-800">
                    <PanelLeftClose size={18}/>
                </Button>
            </div>

            {/* NAV SCROLLABLE */}
            <nav className="p-3 space-y-1 flex-1 flex flex-col overflow-y-auto custom-scrollbar">
                
                {/* 1. GESTIÓN OPERATIVA */}
                <SectionHeader label="Gestión" sectionKey="gestion" />
                {(open ? sections.gestion : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1">
                        <SidebarBtn active={view === 'overview'} onClick={() => setView('overview')} icon={<LayoutDashboard size={20}/>} label="Visión Global" />
                        <SidebarBtn active={view === 'conteo'} onClick={() => setView('conteo')} icon={<Calculator size={20} className="text-indigo-400"/>} label="Conteo Vivo" />
                        <SidebarBtn active={view === 'leads'} onClick={() => setView('leads')} icon={<Layers size={20} className="text-orange-400"/>} label="Leads" />
                        <SidebarBtn active={view === 'setter'} onClick={() => setView('setter')} icon={<UserPlus size={20} className="text-pink-400"/>} label="Setter" />
                        <SidebarBtn active={view === 'agendas'} onClick={() => setView('agendas')} icon={<CalendarDays size={20} className="text-blue-500"/>} label="Agendas" />
                    </div>
                )}

                {/* 2. EQUIPO Y FINANZAS */}
                <SectionHeader label="Equipo & Finanzas" sectionKey="equipo" />
                {(open ? sections.equipo : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1">
                        <SidebarBtn active={view === 'team'} onClick={() => setView('team')} icon={<Users size={20} className="text-blue-400"/>} label="Equipo" />
                        <SidebarBtn active={view === 'metrics'} onClick={() => setView('metrics')} icon={<BarChart4 size={20} className="text-purple-400"/>} label="Analítica" />
                        {/* ✅ BOTÓN DE RANKING */}
                        <SidebarBtn active={view === 'ranking'} onClick={() => setView('ranking')} icon={<Trophy size={20} className="text-yellow-500"/>} label="Ranking" />
                        <SidebarBtn active={view === 'commissions'} onClick={() => setView('commissions')} icon={<Banknote size={20} className="text-green-400"/>} label="Liquidación" />
                    </div>
                )}

                {/* 3. COMUNICACIÓN */}
                <SectionHeader label="Comunicación" sectionKey="comunicacion" />
                {(open ? sections.comunicacion : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1">
                        <SidebarBtn active={view === 'announcements'} onClick={() => setView('announcements')} icon={<Megaphone size={20} className="text-pink-500"/>} label="Comunicados" />
                        <SidebarBtn active={view === 'resources'} onClick={() => setView('resources')} icon={<BookOpen size={20} className="text-yellow-400"/>} label="Recursos" />
                    </div>
                )}

                {/* 4. SISTEMA */}
                <SectionHeader label="Sistema" sectionKey="sistema" />
                {(open ? sections.sistema : true) && (
                    <div className="space-y-1 animate-in slide-in-from-top-1">
                        <SidebarBtn active={view === 'health'} onClick={() => setView('health')} icon={<LifeBuoy size={20} className="text-emerald-400"/>} label="Salud del Tubo" />
                        <SidebarBtn active={view === 'logs'} onClick={() => setView('logs')} icon={<ShieldAlert size={20} className="text-red-400"/>} label="Auditoría" />
                        <SidebarBtn active={view === 'database'} onClick={() => setView('database')} icon={<Database size={20} className="text-slate-400"/>} label="Base de Datos" />
                        <SidebarBtn active={view === 'config'} onClick={() => setView('config')} icon={<Sliders size={20} className="text-slate-400"/>} label="Configuración" />
                    </div>
                )}

                {/* FOOTER */}
                <div className="mt-auto pt-4 pb-2 border-t border-slate-800 space-y-2">
                    {/* NOTIFICACIONES */}
                    <Popover open={isBellOpen} onOpenChange={setIsBellOpen}>
                        <PopoverTrigger asChild>
                            <button className={`w-full flex items-center ${open ? 'justify-start px-3' : 'justify-center'} py-2 rounded-md text-xs font-medium transition-all duration-200 text-slate-400 hover:bg-slate-800 hover:text-white relative`}>
                                <div className="mr-3 shrink-0 relative">
                                    <Bell size={18} />
                                    {notifications.length > 0 && <span className="absolute -top-1 -right-1 h-2.5 w-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse"></span>}
                                </div>
                                {open && <span className="flex-1 text-left">Notificaciones</span>}
                            </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80 p-0 bg-white text-slate-900 shadow-xl border-0 ml-4" side="right" align="end">
                            <div className="p-3 border-b flex justify-between items-center bg-slate-50">
                                <span className="text-xs font-bold text-slate-600">Novedades</span>
                                {notifications.length > 0 && <Button variant="ghost" size="sm" className="h-6 text-[10px] text-blue-600" onClick={markAllRead}>Limpiar</Button>}
                            </div>
                            <div className="max-h-[300px] overflow-y-auto">
                                {notifications.length === 0 ? <div className="p-4 text-center text-xs text-slate-400">Sin novedades.</div> : 
                                    notifications.map((n: any) => (
                                        <div key={n.id} onClick={() => handleNotificationClick(n)} className="p-3 border-b hover:bg-slate-50 transition-colors last:border-0 cursor-pointer">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 h-2 w-2 rounded-full bg-blue-500 shrink-0"></div>
                                                <div>
                                                    <h5 className="text-xs font-bold text-slate-800">{n.title}</h5>
                                                    <p className="text-[10px] text-slate-500 mt-0.5">{n.body}</p>
                                                    <span className="text-[9px] text-slate-400 mt-1 block">{formatTime(n.created_at)}</span> {/* ✅ HORA CORREGIDA */}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                }
                            </div>
                        </PopoverContent>
                    </Popover>

                    {/* PERFIL DE USUARIO */}
                    <div className={`flex items-center gap-3 px-2 py-2 rounded-xl bg-slate-800/50 border border-slate-800 mx-1 transition-all ${open ? 'justify-start' : 'justify-center'}`}>
                        <Avatar className="h-9 w-9 ring-2 ring-blue-500/30">
                            <AvatarImage src={userData.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`} className="object-cover" />
                            <AvatarFallback className="bg-blue-600 text-white font-bold text-xs">{userData.name.substring(0,2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        {open && (
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-xs font-black text-white truncate">{userData.name}</span>
                                <span className="text-[10px] text-blue-400 truncate font-bold uppercase">{userData.role?.replace('_', ' ')}</span>
                            </div>
                        )}
                    </div>
                    <SidebarBtn onClick={onLogout} icon={<LogOut size={18} className="text-red-400"/>} label="Cerrar Sesión" />
                </div>
            </nav>
        </aside>
    )
}

// --- DASHBOARD PRINCIPAL (COMPLETAMENTE INTEGRADO) ---
export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const supabase = createClient()
  
  // ✅ 1. INICIALIZACIÓN INTELIGENTE (Lee la URL al cargar)
  const [view, setView] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get('tab')
      if (tab) return tab
    }
    return "overview"
  })

  const [sidebarOpen, setSidebarOpen] = useState(true) 
  const [incomingAlert, setIncomingAlert] = useState<any>(null)
  
  // ESTADO USUARIO
  const [userData, setUserData] = useState<{ name: string; email: string; avatar?: string; role?: string }>({
    name: "Cargando...", email: "", avatar: undefined, role: "Admin"
  })

  // ESTADO NOTIFICACIONES
  const [notifications, setNotifications] = useState<any[]>([])
  const [isBellOpen, setIsBellOpen] = useState(false)

  // ✅ 2. EFECTO DE PERSISTENCIA (Actualiza la URL al cambiar de vista)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (view === 'overview') {
        params.delete('tab')
      } else {
        params.set('tab', view)
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState(null, '', newUrl)
    }
  }, [view])

  const handleSafeLogout = async () => {
    await supabase.auth.signOut()
    onLogout()
  }

  const markAllRead = async () => {
    const ids = notifications.map(n => n.id)
    setNotifications([]) 
    if (ids.length > 0) {
        // ✅ CORREGIDO: Eliminado el .catch() que rompía el build
        await supabase.from('notifications').update({ read: true }).in('id', ids)
    }
  }

  // ✅ CLICK EN NOTIFICACIÓN DE LA CAMPANITA
  const handleNotificationClick = async (n: any) => {
      // 1. Navegación inteligente
      if (n.title?.includes("Lead Ingresado") || n.body?.includes("Nuevo dato")) {
          setView('leads')
      } else if (n.title?.includes("Cotización")) {
          setView('conteo') 
      } else {
          setView('team') 
      }
      
      setIsBellOpen(false) 

      // 2. Marcar como leído
      if (!n.read) {
          const newNotifs = notifications.filter(item => item.id !== n.id)
          setNotifications(newNotifs)
          // Si es temporal (lead/quote), no hace falta actualizar DB porque no existe
          if (!n.id.toString().startsWith('temp-')) {
              // ✅ CORREGIDO: Eliminado el .catch() que rompía el build
              await supabase.from('notifications').update({ read: true }).eq('id', n.id)
          }
      }
  }

  // ✅ CLICK EN TOAST FLOTANTE
  const handleAlertClick = () => {
      if (!incomingAlert) return
      
      if (incomingAlert.type === 'lead') setView('leads')
      if (incomingAlert.type === 'quote') setView('conteo') 
      if (incomingAlert.type === 'msg') setView('team')

      setIncomingAlert(null)
  }

  useEffect(() => {
    requestNotificationPermission();

    const initUserData = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('full_name, avatar_url, role').eq('id', user.id).single()
        
        const userName = profile?.full_name || user.email?.split("@")[0] || "Admin";

        setUserData({
          name: userName,
          email: user.email || "",
          avatar: profile?.avatar_url, 
          role: profile?.role || "Admin God"
        })

        // ✅ FILTRO QUIRÚRGICO INICIAL: Solo 'Administración' O 'Mi Nombre'
        const { data: notifs } = await supabase
            .from('notifications')
            .select('*')
            .eq('read', false)
            .or(`user_name.eq.Administración,user_name.eq.${userName}`) 
            .order('created_at', { ascending: false })
            .limit(20)

        if(notifs) setNotifications(notifs)

        const profileChannel = supabase.channel("admin_profile_changes")
          .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
            (payload) => {
              const newProfile = payload.new as any
              setUserData((prev) => ({ ...prev, name: newProfile.full_name || prev.name, avatar: newProfile.avatar_url || prev.avatar }))
            }
          ).subscribe()
        return () => { supabase.removeChannel(profileChannel) }
      }
    }
    initUserData()

    const globalChannel = supabase.channel("god_mode_global_filtered")
      
      // 1. DATO INGRESADO
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const newLead = payload.new as any
        
        if (newLead.status === 'nuevo' && (!newLead.agent_name || newLead.agent_name === 'Sin Asignar')) {
            // A. Alertar
            setIncomingAlert({
              type: "lead",
              title: "¡DATO INGRESADO!",
              icon: <Sparkles className="h-3 w-3" />,
              color: "text-emerald-400 border-l-emerald-500",
              name: newLead.name || "Nuevo Prospecto",
              info: newLead.source || "MetaAds",
              time: formatTime(new Date().toISOString()),
            })
            sendNativeNotification("¡Lead Ingresado!", `Nuevo dato desde ${newLead.source || "Web"}: ${newLead.name}`, true);

            // B. ✅ AGREGAR A CAMPANITA (Localmente)
            const notifItem = {
                id: `temp-lead-${newLead.id}`,
                title: "¡Lead Ingresado!",
                body: `Nuevo dato desde ${newLead.source || "Web"}: ${newLead.name}`,
                created_at: new Date().toISOString(),
                read: false,
                user_name: 'Administración' 
            }
            setNotifications(prev => [notifItem, ...prev])
        }
      })

      // 2. COTIZACIÓN REALIZADA
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "leads" }, (payload) => {
          const newData = payload.new as any
          const oldData = payload.old as any

          if (newData.status === 'cotizacion' && oldData.status !== 'cotizacion') {
              // A. Alertar
              setIncomingAlert({
                  type: "quote",
                  title: "¡COTIZACIÓN!",
                  icon: <FileText className="h-3 w-3" />,
                  color: "text-yellow-400 border-l-yellow-500",
                  name: newData.name,
                  info: `Vendedor: ${newData.agent_name}`,
                  time: formatTime(new Date().toISOString())
              })
              sendNativeNotification("Cotización Nueva", `${newData.agent_name} cotizó a ${newData.name}`, true);

              // B. ✅ AGREGAR A CAMPANITA (Localmente)
              const notifItem = {
                id: `temp-quote-${newData.id}`,
                title: "¡Cotización Realizada!",
                body: `${newData.agent_name} cotizó a ${newData.name}`,
                created_at: new Date().toISOString(),
                read: false,
                user_name: 'Administración' 
              }
              setNotifications(prev => [notifItem, ...prev])
          }
      })

      // 3. MENSAJES INTERNOS (SOLO ADMIN)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications' }, (payload) => {
           const notif = payload.new as any;
           // Filtro estricto
           if (notif.user_name === 'Administración' || notif.user_name === userData.name) {
               setNotifications(prev => [notif, ...prev])
               
               setIncomingAlert({
                   type: "msg",
                   title: "MENSAJE INTERNO",
                   icon: <MessageCircle className="h-3 w-3" />,
                   color: "text-blue-400 border-l-blue-500",
                   name: notif.title,
                   info: notif.body,
                   time: formatTime(notif.created_at || new Date().toISOString())
               })

               sendNativeNotification("Mensaje Interno", notif.title, true);
           }
      })
      .subscribe()

    return () => { supabase.removeChannel(globalChannel) }
  }, [userData.name])

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      
      {/* ALERTA FLOTANTE UNIFICADA */}
      {incomingAlert && (
        <div className="fixed z-[9999] bottom-6 right-6 animate-in slide-in-from-right-full cursor-pointer" onClick={handleAlertClick}>
          <div className={`bg-slate-900 text-white rounded-xl shadow-2xl border-l-4 p-4 w-80 hover:bg-slate-800 transition-colors ${incomingAlert.color}`}>
            <div className="flex justify-between items-center mb-2">
              <h4 className={`font-black text-xs tracking-widest uppercase flex items-center gap-2 ${incomingAlert.color.split(' ')[0]}`}>
                {incomingAlert.icon} {incomingAlert.title}
              </h4>
              <button className="text-slate-500 hover:text-white" onClick={(e) => {e.stopPropagation(); setIncomingAlert(null)}}><X className="h-4 w-4"/></button>
            </div>
            <p className="font-bold text-lg truncate">{incomingAlert.name}</p>
            <div className="flex justify-between items-center mt-2">
                <span className="text-xs text-slate-400 truncate max-w-[180px]">{incomingAlert.info}</span>
                <span className="text-xs font-mono text-slate-500">{incomingAlert.time}</span>
            </div>
          </div>
        </div>
      )}

      <AdminSidebar 
        open={sidebarOpen} 
        setOpen={setSidebarOpen} 
        view={view} 
        setView={setView} 
        userData={userData}
        onLogout={handleSafeLogout}
        notifications={notifications}
        markAllRead={markAllRead}
        isBellOpen={isBellOpen}
        setIsBellOpen={setIsBellOpen}
        handleNotificationClick={handleNotificationClick}
      />

      <main className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
        <ScrollArea className="h-full w-full">
          {view === "overview" && <AdminOverview />}
          {view === "conteo" && <AdminConteo />}
          {view === "leads" && <AdminLeadFactory />}
          {view === "metrics" && <AdminMetrics />}
          {view === "ranking" && <AdminRanking />}
          {view === "team" && <AdminTeam />}
          {view === "logs" && <AdminLogs />}
          {view === "agendas" && <AdminAgendas />}
          {view === "database" && <AdminDatabase />}
          {view === "config" && <AdminConfig />}
          {view === "commissions" && <AdminCommissions />}
          {view === "resources" && <AdminResources />}
          {view === "setter" && <AdminSetterManager />}
          {view === "health" && <AdminPipelineHealth />}
          {view === "announcements" && <AdminAnnouncements />}
        </ScrollArea>
      </main>
    </div>
  )
}