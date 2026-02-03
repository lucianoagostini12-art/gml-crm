"use client"

import { useState, useEffect, useRef, useMemo } from "react"
import { createBrowserClient } from "@supabase/ssr"

import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import {
  LayoutDashboard,
  Contact,
  CalendarDays,
  BarChart3,
  Megaphone,
  Trophy,
  Settings,
  BookOpen,
  Target,
  Menu,
  Bell,
  PlusCircle,
  AlertTriangle,
  DollarSign,
  LogOut,
  MessageCircle,
  CalendarClock,
  Info,
} from "lucide-react"

// --- TUS VISTAS ---
import { KanbanBoard } from "@/components/crm/KanbanBoard"
import { ContactsView } from "@/components/crm/ContactsView"
import { AgendasView } from "@/components/crm/AgendasView"
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog"
import { LeadDetail } from "@/components/crm/LeadDetail"

import type { Lead as CRMLead } from "@/components/crm/LeadCard"

import { DashboardView } from "@/components/shared/DashboardView"
import { AnnouncementsView } from "@/components/shared/AnnouncementsView"
import { RankingsView } from "@/components/shared/RankingsView"
import { SettingsView } from "@/components/shared/SettingsView"
import { WikiView } from "@/components/shared/WikiView"
import { FocusModeView } from "@/components/shared/FocusModeView"
import { MySalesView } from "@/components/seller/MySalesView"

type AppNotification = {
  id: string
  user_name: string | null
  type: string | null
  title: string | null
  body: string | null
  read: boolean | null
  created_at: string | null

  // ✅ NUEVO: para navegación directa a la venta
  lead_id?: string | null
  target_tab?: string | null
  meta?: any
}

export function SellerManager({
  userName,
  onLogout,
}: {
  userName: string | null
  onLogout: () => void
}) {
  const currentUser = userName || "Vendedora"

  /**
   * ✅ CAMBIO CLAVE:
   * auth-helpers-nextjs ya no exporta createClientComponentClient en tu versión.
   * Usamos el cliente oficial SSR: createBrowserClient (reutiliza sesión del navegador).
   *
   * Requisitos:
   *   npm i @supabase/ssr @supabase/supabase-js
   */
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)

  // ✅ 1. INICIALIZACIÓN INTELIGENTE (Lee la URL al cargar)
  const [currentView, setCurrentView] = useState<
    | "board"
    | "contacts"
    | "agenda"
    | "stats"
    | "announcements"
    | "rankings"
    | "settings"
    | "wiki"
    | "focus"
    | "mysales"
  >(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      const tab = params.get("tab")
      if (tab) return tab as any
    }
    return "board"
  })

  // ✅ 2. EFECTO DE PERSISTENCIA (Actualiza la URL al cambiar de vista)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search)
      if (currentView === "board") {
        params.delete("tab")
      } else {
        params.set("tab", currentView)
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`
      window.history.replaceState(null, "", newUrl)
    }
  }, [currentView])

  const [isCreateOpen, setIsCreateOpen] = useState(false)

  // --- ALERTAS & NOTIFICACIONES ---
  const [expiredTasks, setExpiredTasks] = useState<any[]>([])

  const [unreadNotifications, setUnreadNotifications] = useState<AppNotification[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  const [quoteAlertsCount, setQuoteAlertsCount] = useState(0)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<CRMLead | null>(null)

  // Estado para la foto de perfil real
  const [realAvatarUrl, setRealAvatarUrl] = useState<string | null>(null)

  const lastAutoOpenAtRef = useRef<number>(0)

  // ✅ Para abrir Mis Ventas directo desde campana (chat/files)
  const [openMySalesLeadId, setOpenMySalesLeadId] = useState<string | null>(null)
  const [openMySalesTab, setOpenMySalesTab] = useState<"chat" | "files">("chat")

  // ✅ CONTADOR REAL para "Mis Ventas" (solo notifs relacionadas a ventas = con lead_id)
  const unreadSalesNotifCount = useMemo(() => {
    return unreadNotifications.filter((n) => !!n.lead_id).length
  }, [unreadNotifications])

  // 1) ALERTAS DE AGENDA (Vencidas + Próximas)
  const fetchAgendaAlerts = async () => {
    // Traemos leads activos asignados a mi
    const { data } = await supabase
      .from("leads")
      .select("id, name, scheduled_for")
      .eq("agent_name", currentUser)
      .not("status", "in", '("perdido","vendido")')

    if (!data) return

    const now = new Date()
    const in30Mins = new Date(now.getTime() + 30 * 60000) // Dentro de 30 mins
    let alertsList: any[] = []

    data.forEach((lead: any) => {
      if (lead.scheduled_for) {
        const schedDate = new Date(lead.scheduled_for)
        // Caso 1: Vencida
        if (schedDate < now) {
          alertsList.push({
            type: "vencida",
            title: `Llamada vencida: ${lead.name}`,
            leadId: lead.id,
            time: schedDate,
          })
        }
        // Caso 2: Próxima (en los siguientes 30 min)
        else if (schedDate <= in30Mins) {
          alertsList.push({
            type: "proxima",
            title: `Llamar pronto: ${lead.name}`,
            leadId: lead.id,
            time: schedDate,
          })
        }
      }
    })

    // Ordenamos: primero las urgentes (vencidas), luego las próximas
    alertsList.sort((a, b) => a.time.getTime() - b.time.getTime())
    setExpiredTasks(alertsList)
  }

  // ✅ Limpiar todas las agendas vencidas (poner scheduled_for = null)
  const clearExpiredAgendas = async () => {
    const vencidas = expiredTasks.filter(t => t.type === "vencida")
    if (vencidas.length === 0) return

    const ids = vencidas.map(t => t.leadId)

    // Actualizar en DB
    await supabase
      .from("leads")
      .update({ scheduled_for: null, last_update: new Date().toISOString() })
      .in("id", ids)

    // Actualizar UI (quitar las vencidas)
    setExpiredTasks(prev => prev.filter(t => t.type !== "vencida"))
  }

  useEffect(() => {
    if (!currentUser) return

    let notifChannel: any = null
    let salesChannel: any = null
    let quotesChannel: any = null // Mantenemos el canal de quotes original
    let alive = true

    const init = async () => {
      // A. Notificaciones de DB (TODAS): Para mi O para todos
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .or(`user_name.eq.${currentUser},user_name.is.null`)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50)

      if (!alive) return
      if (!error && data) setUnreadNotifications(data as AppNotification[])

      // B. Chequeos Iniciales
      await fetchAgendaAlerts()

      // C. Foto Real
      const { data: profileData } = await supabase
        .from("profiles")
        .select("avatar_url")
        .eq("full_name", currentUser)
        .maybeSingle()

      if (profileData?.avatar_url) {
        setRealAvatarUrl(profileData.avatar_url)
      }
    }

    // --- FUNCIÓN DE AUTO-APERTURA PROTEGIDA ---
    const openBellSoft = () => {
      // 🛑 PROTECCIÓN: Si hay un modal abierto (LeadDetail), NO abrir el popover encima.
      if (selectedLeadId) return

      const now = Date.now()
      if (now - lastAutoOpenAtRef.current > 2000) {
        lastAutoOpenAtRef.current = now
        setIsNotifOpen(true)
      }
    }

    // --- SUSCRIPCIÓN 1: NOTIFICACIONES (VERDAD ABSOLUTA: DB) ---
    notifChannel = supabase
      .channel(`rt-notifications-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload: any) => {
          const n = payload.new as AppNotification
          // Si es para mi o para todos
          if (n.user_name === currentUser || n.user_name === null) {
            setUnreadNotifications((prev) => [n, ...prev])
            openBellSoft()
          }
        }
      )
      .subscribe()

    // --- SUSCRIPCIÓN 2: LEADS (solo para refrescar agenda/alertas visuales) ---
    salesChannel = supabase
      .channel(`rt-sales-agenda-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `agent_name=eq.${currentUser}` },
        () => {
          fetchAgendaAlerts()
        }
      )
      .subscribe()

    // --- SUSCRIPCIÓN 3: QUOTES (Mantenida del original) ---
    quotesChannel = supabase
      .channel(`rt-quotes-${currentUser}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "quotes" },
        async (payload: any) => {
          const newQuote = payload.new as { id: string; lead_id: string | null }
          if (!newQuote?.lead_id) return
          const { data: lead, error } = await supabase
            .from("leads")
            .select("id, assigned_to, agent_name")
            .eq("id", newQuote.lead_id)
            .maybeSingle()
          if (error || !lead) return
          const belongsToSeller = lead.assigned_to === currentUser || lead.agent_name === currentUser
          if (!belongsToSeller) return
          setQuoteAlertsCount((c) => c + 1)
          // Usamos la misma protección para no abrir si hay modal
          if (!selectedLeadId) setIsAlertsOpen(true)
        }
      )
      .subscribe()

    init()

    return () => {
      alive = false
      if (notifChannel) supabase.removeChannel(notifChannel)
      if (quotesChannel) supabase.removeChannel(quotesChannel)
      if (salesChannel) supabase.removeChannel(salesChannel)
    }
  }, [currentUser, selectedLeadId, supabase])

  // Fix Lead Detail
  useEffect(() => {
    let alive = true
    const fetchLead = async () => {
      if (!selectedLeadId) {
        setSelectedLead(null)
        return
      }
      const { data, error } = await supabase.from("leads").select("*").eq("id", selectedLeadId).maybeSingle()
      if (!alive) return
      if (error || !data) {
        setSelectedLead(null)
        return
      }
      const row: any = data
      const adapted: any = {
        ...row,
        createdAt: row.createdAt ?? row.created_at ?? null,
        lastUpdate: row.lastUpdate ?? row.last_update ?? null,
        agent: row.agent ?? row.agent_name ?? row.assigned_to ?? null,
        calls: row.calls ?? 0,
        intent: row.intent ?? null,
      }
      setSelectedLead(adapted as CRMLead)
    }
    fetchLead()
    return () => {
      alive = false
    }
  }, [selectedLeadId, supabase])

  const handleCreateConfirm = async (_data: any) => {
    setIsCreateOpen(false)
  }

  const markAllNotificationsAsRead = async () => {
    // Limpiamos UI
    const ids = unreadNotifications.map((n) => n.id)
    setUnreadNotifications([])
    if (ids.length === 0) return
    await supabase.from("notifications").update({ read: true }).in("id", ids)
  }

  const handleNotificationClick = async (n: AppNotification) => {
    // 1) Marcar leída (DB + UI)
    try {
      await supabase.from("notifications").update({ read: true }).eq("id", n.id)
    } catch { }
    setUnreadNotifications((prev) => prev.filter((x) => x.id !== n.id))

    // 2) Navegar al lugar
    if (n.lead_id) {
      // Si es chat: ir a Mis Ventas y abrir directamente el chat de esa venta
      if (n.type === "chat") {
        setCurrentView("mysales")
        setOpenMySalesLeadId(n.lead_id)
        setOpenMySalesTab(n.target_tab === "files" ? "files" : "chat")
        setIsNotifOpen(false)
        return
      }

      // Venta relacionada (status/agenda/etc): abrimos LeadDetail directo
      setSelectedLeadId(n.lead_id)
      setIsNotifOpen(false)
      return
    }

    // Notifs globales: mover a la vista adecuada
    if (n.type === "wiki") setCurrentView("wiki")
    else if (n.type === "announcement") setCurrentView("announcements")

    setIsNotifOpen(false)
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
      {/* --- SIDEBAR --- */}
      <aside
        className={`h-full bg-slate-50/50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${isSidebarOpen ? "w-[260px] min-w-[260px]" : "w-0 min-w-0 opacity-0 overflow-hidden"
          }`}
      >
        <div className="p-6 h-16 flex items-center border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-[#1e3a8a] dark:text-blue-400 font-black text-xl tracking-tighter whitespace-nowrap">
            GML <span className="font-light text-slate-600 dark:text-slate-400">SALES</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
          <Button
            variant={currentView === "board" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("board")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <LayoutDashboard className="h-4 w-4 shrink-0" /> Tablero
          </Button>

          <Button
            variant={currentView === "agenda" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("agenda")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <CalendarDays className="h-4 w-4 shrink-0" /> Agenda
          </Button>

          <Button
            variant={currentView === "contacts" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("contacts")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <Contact className="h-4 w-4 shrink-0" /> Contactos
          </Button>

          <p className="text-xs font-semibold text-slate-400 px-4 mb-2 mt-4 uppercase tracking-wider shrink-0">
            Gestión
          </p>

          <Button
            variant={currentView === "mysales" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("mysales")}
            className="w-full justify-between gap-3 mb-1 shadow-none relative group"
          >
            <div className="flex items-center gap-3">
              <DollarSign className="h-4 w-4 shrink-0 text-green-600" /> Mis Ventas
            </div>

            {/* ✅ AHORA: contador de NOTIFICACIONES de MIS VENTAS (lead_id) */}
            {unreadSalesNotifCount > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold h-5 w-5 flex items-center justify-center rounded-full animate-pulse shadow-sm">
                {unreadSalesNotifCount}
              </span>
            )}
          </Button>

          <Button
            variant={currentView === "stats" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("stats")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <BarChart3 className="h-4 w-4 shrink-0" /> Métricas
          </Button>

          <Button
            variant={currentView === "rankings" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("rankings")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <Trophy className="h-4 w-4 shrink-0 text-yellow-500" /> Ranking
          </Button>

          <p className="text-xs font-semibold text-slate-400 px-4 mb-2 mt-4 uppercase tracking-wider shrink-0">
            Herramientas
          </p>

          <Button
            variant={currentView === "wiki" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("wiki")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <BookOpen className="h-4 w-4 shrink-0 text-purple-500" /> Wiki
          </Button>

          <Button
            variant={currentView === "focus" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("focus")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <Target className="h-4 w-4 shrink-0 text-red-500" /> Modo Foco
          </Button>

          <Button
            variant={currentView === "announcements" ? "secondary" : "ghost"}
            onClick={() => setCurrentView("announcements")}
            className="w-full justify-start gap-3 mb-1 shadow-none"
          >
            <Megaphone className="h-4 w-4 shrink-0" /> Novedades
          </Button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 mb-2 text-slate-500 hover:text-slate-800 dark:hover:text-white"
            onClick={() => setCurrentView("settings")}
          >
            <Settings className="h-4 w-4" /> Config
          </Button>

          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
              <Avatar className="h-8 w-8">
                {/* ✅ FOTO REAL */}
                <AvatarImage
                  src={realAvatarUrl || `https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser}`}
                  className="object-cover"
                />
                <AvatarFallback>{currentUser[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{currentUser}</span>
                <span className="text-[10px] text-slate-500 uppercase">Vendedora</span>
              </div>
            </div>

            <Button variant="ghost" size="icon" onClick={onLogout} title="Cerrar Sesión">
              <LogOut className="h-4 w-4 text-red-400" />
            </Button>
          </div>
        </div>
      </aside>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-950 z-10 transition-colors">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
              <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
            </Button>

            <div className="flex flex-col">
              <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-none">
                {currentView === "board"
                  ? "Tablero Principal"
                  : currentView === "agenda"
                    ? "Agenda de Llamados"
                    : currentView === "mysales"
                      ? "Mis Ventas Mensuales"
                      : currentView === "stats"
                        ? "Mis Métricas"
                        : currentView === "rankings"
                          ? "Ranking de Ventas"
                          : currentView === "settings"
                            ? "Configuración"
                            : currentView === "wiki"
                              ? "Wiki de Ventas"
                              : currentView === "focus"
                                ? "Modo Foco 🎯"
                                : currentView === "announcements"
                                  ? "Novedades"
                                  : "Base de Contactos"}
              </h1>
              <span className="text-[10px] text-slate-500">GML Sales CRM</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* ⚠️ ALERTAS (TRIÁNGULO): Agendas Vencidas y Próximas */}
            <Popover open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-amber-500 hover:bg-amber-50 relative"
                  title="Alertas de Agenda"
                >
                  <AlertTriangle className="h-5 w-5" />

                  {(expiredTasks.length > 0 || quoteAlertsCount > 0) && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-600 rounded-full border border-white animate-pulse"></span>
                  )}

                  {expiredTasks.length + quoteAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                      {expiredTasks.length + quoteAlertsCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b bg-amber-50 flex justify-between items-center text-amber-900">
                  <h4 className="font-bold text-sm">Agenda & Alertas</h4>
                </div>

                <div className="max-h-80 overflow-auto">
                  {quoteAlertsCount > 0 && (
                    <div className="p-3 border-b">
                      <div className="text-sm font-semibold text-blue-600">Cotizaciones nuevas</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Tenés {quoteAlertsCount} cotización(es) nueva(s).
                      </div>
                    </div>
                  )}

                  {expiredTasks.length > 0 ? (
                    expiredTasks.map((task: any, i) => (
                      <div
                        key={i}
                        className="p-3 border-b hover:bg-slate-50 cursor-pointer"
                        onClick={() => setSelectedLeadId(task.leadId)}
                      >
                        <div
                          className={`flex items-center gap-2 font-bold text-xs mb-1 ${task.type === "vencida" ? "text-red-600" : "text-amber-600"
                            }`}
                        >
                          <CalendarClock size={12} /> {task.type === "vencida" ? "VENCIDA" : "PRÓXIMA (30 min)"}
                        </div>
                        <p className="text-sm font-medium text-slate-700">{task.title}</p>
                        <span className="text-[10px] text-slate-400">
                          {new Date(task.time).toLocaleTimeString('es-AR', { hour: "2-digit", minute: "2-digit", timeZone: 'America/Argentina/Buenos_Aires' })} hs
                        </span>
                      </div>
                    ))
                  ) : quoteAlertsCount === 0 ? (
                    <div className="p-4 text-xs text-slate-500 text-center italic">Agenda al día.</div>
                  ) : null}

                  {/* ✅ Botones de limpieza */}
                  {(expiredTasks.filter(t => t.type === "vencida").length > 0 || quoteAlertsCount > 0) && (
                    <div className="p-3 border-t bg-slate-50 dark:bg-slate-900 flex justify-end gap-2">
                      {expiredTasks.filter(t => t.type === "vencida").length > 0 && (
                        <Button variant="outline" size="sm" onClick={clearExpiredAgendas} className="text-xs">
                          Limpiar agendas vencidas
                        </Button>
                      )}
                      {quoteAlertsCount > 0 && (
                        <Button variant="outline" size="sm" onClick={() => setQuoteAlertsCount(0)} className="text-xs">
                          Limpiar cotizaciones
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* 🔔 NOTIFICACIONES (CAMPANA): VERDAD ABSOLUTA (DB) */}
            <Popover open={isNotifOpen} onOpenChange={setIsNotifOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="icon" className="relative dark:border-slate-700 dark:bg-slate-900">
                  <Bell className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                  {unreadNotifications.length > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                      {unreadNotifications.length}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-4 border-b flex justify-between items-center">
                  <h4 className="font-bold">Notificaciones</h4>
                  <span className="text-xs text-slate-500">{unreadNotifications.length} nuevas</span>
                </div>

                <div className="max-h-80 overflow-auto">
                  {unreadNotifications.length === 0 ? (
                    <div className="p-4 text-sm text-slate-500 text-center">Sin novedades.</div>
                  ) : (
                    unreadNotifications.map((n) => (
                      <div
                        key={n.id}
                        className={`p-3 border-b last:border-b-0 cursor-pointer hover:bg-slate-50 ${n.type === "chat" ? "bg-blue-50/50" : ""
                          }`}
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold flex items-center gap-2">
                            {/* Icono según tipo */}
                            {n.type === "chat" ? (
                              <MessageCircle size={14} className="text-blue-600" />
                            ) : n.type === "wiki" ? (
                              <BookOpen size={14} className="text-purple-500" />
                            ) : n.type === "announcement" ? (
                              <Megaphone size={14} className="text-orange-500" />
                            ) : (
                              <Info size={14} className="text-slate-400" />
                            )}

                            {n.title ?? "Notificación"}
                          </div>

                          <span className="text-[9px] text-slate-400 whitespace-nowrap">
                            {n.created_at
                              ? new Date(n.created_at).toLocaleTimeString('es-AR', { hour: "2-digit", minute: "2-digit", timeZone: 'America/Argentina/Buenos_Aires' })
                              : "Ahora"}
                          </span>
                        </div>

                        {n.body && (
                          <div className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed">{n.body}</div>
                        )}

                        {/* Hint visual si apunta a venta */}
                        {n.lead_id && (
                          <div className="mt-2 text-[10px] text-slate-400">
                            Ir a venta • <span className="font-mono">{String(n.lead_id).slice(0, 8)}…</span>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>

                {unreadNotifications.length > 0 && (
                  <div className="p-3 border-t bg-slate-50 dark:bg-slate-900 flex justify-end">
                    <Button variant="outline" size="sm" className="text-xs" onClick={markAllNotificationsAsRead}>
                      Marcar como leídas
                    </Button>
                  </div>
                )}
              </PopoverContent>
            </Popover>

            <Button
              onClick={() => setIsCreateOpen(true)}
              className="bg-[#1e3a8a] hover:bg-blue-900 text-white gap-2 h-9 shadow-sm"
            >
              <PlusCircle className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo Dato</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950/50 relative transition-colors">
          {/* ✅ AQUÍ ESTÁ EL CAMBIO CLAVE: pasar setSelectedLeadId */}
          {currentView === "board" && <KanbanBoard userName={currentUser} onLeadClick={setSelectedLeadId} />}
          {currentView === "contacts" && <ContactsView userName={currentUser} onLeadClick={setSelectedLeadId} />}
          {currentView === "agenda" && <AgendasView userName={currentUser} onLeadClick={setSelectedLeadId} />}

          {currentView === "mysales" && (
            <MySalesView
              userName={currentUser}
              supabase={supabase as any}
              openLeadId={openMySalesLeadId}
              openTab={openMySalesTab}
              onOpenedLead={() => setOpenMySalesLeadId(null)}
            />
          )}

          {currentView === "stats" && <DashboardView />}
          {currentView === "announcements" && <AnnouncementsView />}
          {currentView === "rankings" && <RankingsView />}
          {currentView === "settings" && <SettingsView />}
          {currentView === "wiki" && <WikiView />}
          {currentView === "focus" && <FocusModeView />}
        </div>
      </main>

      <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onConfirm={handleCreateConfirm} userName={currentUser} />

      {/* ✅ UN SOLO LUGAR PARA EL MODAL (EL PADRE) */}
      {selectedLeadId && (
        <LeadDetail
          lead={selectedLead}
          open={!!selectedLeadId}
          onOpenChange={(open) => {
            if (!open) {
              setSelectedLeadId(null)
              setSelectedLead(null)
            }
          }}
        />
      )}
    </div>
  )
}
