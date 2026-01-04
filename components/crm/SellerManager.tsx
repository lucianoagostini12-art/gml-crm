"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@supabase/supabase-js"

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
} from "lucide-react"

// --- TUS VISTAS ---
import { KanbanBoard } from "@/components/crm/KanbanBoard"
import { ContactsView } from "@/components/crm/ContactsView"
import { AgendasView } from "@/components/crm/AgendasView"
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog"
import { LeadDetail } from "@/components/crm/LeadDetail"

import { DashboardView } from "@/components/shared/DashboardView"
import { AnnouncementsView } from "@/components/shared/AnnouncementsView"
import { RankingsView } from "@/components/shared/RankingsView"
import { SettingsView } from "@/components/shared/SettingsView"
import { WikiView } from "@/components/shared/WikiView"
import { FocusModeView } from "@/components/shared/FocusModeView"
import { MySalesView } from "@/components/seller/MySalesView"

// ✅ Supabase client (sin auth-helpers)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type AppNotification = {
  id: string
  user_name: string | null
  type: string | null
  title: string | null
  body: string | null
  read: boolean | null
  created_at: string | null
}

type Lead = {
  id: string
  name?: string | null
  phone?: string | null
  email?: string | null
  source?: string | null
  status?: string | null
  assigned_to?: string | null
  agent_name?: string | null
  created_at?: string | null
  [key: string]: any
}

export function SellerManager({
  userName,
  onLogout,
}: {
  userName: string | null
  onLogout: () => void
}) {
  const currentUser = userName || "Vendedor"

  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
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
  >("board")

  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [announcements, setAnnouncements] = useState<any[]>([])

  // Alertas & Notificaciones
  const [expiredTasks, setExpiredTasks] = useState<any[]>([])
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0)

  // ✅ NOTIFICATIONS (tu tabla real)
  const [unreadNotifications, setUnreadNotifications] = useState<AppNotification[]>([])
  const [isNotifOpen, setIsNotifOpen] = useState(false)

  // ✅ COTIZACIONES (quotes) -> alerta por triángulo
  const [quoteAlertsCount, setQuoteAlertsCount] = useState(0)
  const [isAlertsOpen, setIsAlertsOpen] = useState(false)

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)

  // ✅ NUEVO: guardamos el lead completo porque LeadDetail espera `lead` (no `leadId`)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [leadDetailLoading, setLeadDetailLoading] = useState(false)

  // Anti-spam auto-open
  const lastAutoOpenAtRef = useRef<number>(0)

  useEffect(() => {
    if (!currentUser) return

    let notifChannel: any = null
    let quotesChannel: any = null
    let alive = true

    const init = async () => {
      // Inicial: traemos notificaciones no leídas del vendedor
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_name", currentUser)
        .eq("read", false)
        .order("created_at", { ascending: false })
        .limit(50)

      if (!alive) return
      if (!error && data) setUnreadNotifications(data as AppNotification[])
    }

    const openBellSoft = () => {
      const now = Date.now()
      if (now - lastAutoOpenAtRef.current > 1200) {
        lastAutoOpenAtRef.current = now
        setIsNotifOpen(true)
      }
    }

    const openAlertsSoft = () => {
      const now = Date.now()
      if (now - lastAutoOpenAtRef.current > 1200) {
        lastAutoOpenAtRef.current = now
        setIsAlertsOpen(true)
      }
    }

    // ✅ Realtime: NOTIFICACIONES
    notifChannel = supabase
      .channel(`rt-notifications-${currentUser}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_name=eq.${currentUser}`,
        },
        (payload: any) => {
          const n = payload.new as AppNotification
          setUnreadNotifications((prev) => [n, ...prev])
          openBellSoft()
        }
      )
      .subscribe()

    // ✅ Realtime: QUOTES (NO tiene user -> validamos por lead)
    quotesChannel = supabase
      .channel(`rt-quotes-${currentUser}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "quotes",
        },
        async (payload: any) => {
          const newQuote = payload.new as { id: string; lead_id: string | null }

          if (!newQuote?.lead_id) return

          // Buscamos el lead para ver a qué vendedor pertenece
          const { data: lead, error } = await supabase
            .from("leads")
            .select("id, assigned_to, agent_name")
            .eq("id", newQuote.lead_id)
            .maybeSingle()

          if (error || !lead) return

          const belongsToSeller =
            lead.assigned_to === currentUser || lead.agent_name === currentUser

          if (!belongsToSeller) return

          setQuoteAlertsCount((c) => c + 1)
          openAlertsSoft()
        }
      )
      .subscribe()

    init()

    return () => {
      alive = false
      if (notifChannel) supabase.removeChannel(notifChannel)
      if (quotesChannel) supabase.removeChannel(quotesChannel)
    }
  }, [currentUser])

  // ✅ NUEVO: cuando cambia selectedLeadId, traemos el lead completo para pasarlo a LeadDetail como `lead`
  useEffect(() => {
    let alive = true

    const fetchLead = async () => {
      if (!selectedLeadId) {
        setSelectedLead(null)
        return
      }

      setLeadDetailLoading(true)
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", selectedLeadId)
        .maybeSingle()

      if (!alive) return

      if (error) {
        console.error(error)
        setSelectedLead(null)
      } else {
        setSelectedLead((data as Lead) || null)
      }
      setLeadDetailLoading(false)
    }

    fetchLead()

    return () => {
      alive = false
    }
  }, [selectedLeadId])

  const handleCreateConfirm = async (_data: any) => {
    setIsCreateOpen(false)
  }

  const markAllNotificationsAsRead = async () => {
    const ids = unreadNotifications.map((n) => n.id)
    if (ids.length === 0) return

    // UI primero
    setUnreadNotifications([])

    // DB
    await supabase
      .from("notifications")
      .update({ read: true })
      .in("id", ids)
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
      {/* --- SIDEBAR ORIGINAL (AZUL) --- */}
      <aside
        className={`h-full bg-slate-50/50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${
          isSidebarOpen
            ? "w-[260px] min-w-[260px]"
            : "w-0 min-w-0 opacity-0 overflow-hidden"
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
            {totalUnreadMessages > 0 && (
              <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                {totalUnreadMessages}
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
                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser}`} />
                <AvatarFallback>{currentUser[0]}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">
                  {currentUser}
                </span>
                <span className="text-[10px] text-slate-500 uppercase">Vendedor</span>
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
            {/* ✅ ALERTAS (triángulo): cotizaciones + vencidos */}
            <Popover open={isAlertsOpen} onOpenChange={setIsAlertsOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-amber-500 hover:bg-amber-50 relative"
                  title="Alertas"
                >
                  <AlertTriangle className="h-5 w-5" />

                  {(expiredTasks.length > 0 || quoteAlertsCount > 0) && (
                    <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-600 rounded-full border border-white animate-pulse"></span>
                  )}

                  {quoteAlertsCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-red-600 text-white text-[10px] flex items-center justify-center">
                      {quoteAlertsCount}
                    </span>
                  )}
                </Button>
              </PopoverTrigger>

              <PopoverContent className="w-80 p-0" align="end">
                <div className="p-3 border-b flex justify-between items-center">
                  <h4 className="font-bold text-sm">Alertas</h4>
                  <span className="text-xs text-slate-500">
                    {expiredTasks.length + quoteAlertsCount} activas
                  </span>
                </div>

                <div className="max-h-80 overflow-auto">
                  {quoteAlertsCount > 0 && (
                    <div className="p-3 border-b">
                      <div className="text-sm font-semibold">Cotizaciones nuevas</div>
                      <div className="text-xs text-slate-500 mt-1">
                        Tenés {quoteAlertsCount} cotización(es) nueva(s).
                      </div>
                    </div>
                  )}

                  {expiredTasks.length === 0 && quoteAlertsCount === 0 && (
                    <div className="p-4 text-xs text-slate-500">Todo al día.</div>
                  )}

                  {quoteAlertsCount > 0 && (
                    <div className="p-3 border-t bg-slate-50 dark:bg-slate-900 flex justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setQuoteAlertsCount(0)}
                        className="text-xs"
                      >
                        Marcar cotizaciones como vistas
                      </Button>
                    </div>
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {/* ✅ NOTIFICACIONES (campanita): auto-open + listado */}
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
                      <div key={n.id} className="p-3 border-b last:border-b-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="text-sm font-semibold">
                            {n.title ?? n.type ?? "Notificación"}
                          </div>
                          {n.type && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-200">
                              {n.type}
                            </span>
                          )}
                        </div>

                        {n.body && <div className="text-xs text-slate-500 mt-1">{n.body}</div>}

                        {n.created_at && (
                          <div className="text-[10px] text-slate-400 mt-1">
                            {new Date(n.created_at).toLocaleString()}
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
          {currentView === "board" && <KanbanBoard userName={currentUser} />}
          {currentView === "contacts" && <ContactsView userName={currentUser} />}
          {currentView === "agenda" && <AgendasView userName={currentUser} />}
          {currentView === "mysales" && <MySalesView userName={currentUser} />}

          {currentView === "stats" && <DashboardView />}
          {currentView === "announcements" && <AnnouncementsView />}
          {currentView === "rankings" && <RankingsView />}
          {currentView === "settings" && <SettingsView />}
          {currentView === "wiki" && <WikiView />}
          {currentView === "focus" && <FocusModeView />}
        </div>
      </main>

      <CreateLeadDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onConfirm={handleCreateConfirm}
        userName={currentUser}
      />

      {/* ✅ FIX: LeadDetail recibe `lead`, no `leadId` */}
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
