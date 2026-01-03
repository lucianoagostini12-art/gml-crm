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
  CheckCircle2,
  ShieldAlert,
  Calculator,
  CalendarDays,
  Banknote,
  BookOpen,
  UserPlus,
  X,
  ArrowRight,
  Sparkles,
  RefreshCw,
  LifeBuoy,
  Megaphone,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"

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

// --- COMPONENTE DE VISIÓN GLOBAL ---
function AdminOverview() {
  const supabase = createClient()
  const [stats, setStats] = useState({ entered: 0, completed: 0, compliance: 0 })
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDashboardData = async () => {
    setLoading(true)
    const { data: leads } = await supabase.from("leads").select("*").order("last_update", { ascending: false })

    if (leads) {
      const entered = leads.filter((l: any) => !["nuevo", "contactado", "perdido"].includes(l.status?.toLowerCase())).length
      const completed = leads.filter((l: any) => l.status?.toLowerCase() === "cumplidas").length
      const rate = entered > 0 ? Math.round((completed / entered) * 100) : 0
      setStats({ entered, completed, compliance: rate })

      const recent = leads.slice(0, 15).map((l: any) => ({
        time: l.last_update ? new Date(l.last_update).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--",
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
  }, [])

  return (
    <div className="p-8 space-y-8 h-full overflow-hidden flex flex-col">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
          Torre de Control 📡 {loading && <RefreshCw className="animate-spin h-5 w-5 text-slate-400" />}
        </h2>
        <div className="bg-white border border-slate-200 px-4 py-2 rounded-lg flex items-center gap-2 shadow-sm">
          <div className="h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-sm font-bold text-slate-600">Sistema Online</span>
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

// --- DASHBOARD PRINCIPAL ---
export function AdminDashboard({ onLogout }: { onLogout: () => void }) {
  const supabase = createClient()
  const [view, setView] = useState("overview")
  const [incomingAlert, setIncomingAlert] = useState<any>(null)
  const [userData, setUserData] = useState<{ name: string; email: string; avatar?: string }>({
    name: "Admin",
    email: "",
  })

  useEffect(() => {
    // 1. Cargar datos iniciales y suscribirse a cambios del perfil
    const initUserData = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user) {
        // Carga inicial
        setUserData({
          name: user.user_metadata?.full_name || user.email?.split("@")[0] || "Admin",
          email: user.email || "",
          avatar: user.user_metadata?.avatar_url,
        })

        // Escuchar cambios en la tabla 'profiles' para este usuario
        const profileChannel = supabase
          .channel("admin_profile_changes")
          .on(
            "postgres_changes",
            {
              event: "UPDATE",
              schema: "public",
              table: "profiles",
              filter: `id=eq.${user.id}`, // Solo escuchamos TU usuario
            },
            (payload) => {
              const newProfile = payload.new as any
              // Actualizamos el estado del sidebar en vivo
              setUserData((prev) => ({
                ...prev,
                name: newProfile.full_name || prev.name,
                avatar: newProfile.avatar_url || prev.avatar,
              }))
            }
          )
          .subscribe()

        return () => {
          supabase.removeChannel(profileChannel)
        }
      }
    }

    initUserData()

    // 2. Alertas de Leads
    const leadsChannel = supabase
      .channel("god_mode_alerts")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "leads" }, (payload) => {
        const newLead = payload.new as any
        setIncomingAlert({
          section: "leads",
          name: newLead.name || "Nuevo Prospecto",
          source: newLead.source || "MetaAds",
          time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(leadsChannel)
    }
  }, [])

  return (
    <div className="flex h-screen w-full bg-slate-100 dark:bg-slate-950 text-slate-900 dark:text-slate-100 relative overflow-hidden">
      {/* ALERTA FLOTANTE */}
      {incomingAlert && (
        <div className="fixed z-[9999] bottom-6 right-6 animate-in slide-in-from-right-full">
          <div className="bg-slate-900 text-white rounded-xl shadow-2xl border-l-4 border-l-emerald-500 p-4 w-80">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-black text-emerald-400 text-xs tracking-widest uppercase flex items-center gap-2">
                <Sparkles className="h-3 w-3" /> ¡DATO INGRESADO!
              </h4>
              <X className="h-4 w-4 cursor-pointer text-slate-500" onClick={() => setIncomingAlert(null)} />
            </div>
            <p className="font-bold text-lg">{incomingAlert.name}</p>
            <Button
              onClick={() => {
                setView(incomingAlert.section)
                setIncomingAlert(null)
              }}
              className="w-full mt-3 bg-emerald-600 text-white text-xs h-9 font-bold tracking-tight"
            >
              VER AHORA
            </Button>
          </div>
        </div>
      )}

      {/* SIDEBAR FIXED LAYOUT */}
      <aside className="w-64 h-full bg-slate-900 text-white flex flex-col shrink-0 shadow-2xl z-20 border-r border-slate-800">
        {/* HEADER - FIXED */}
        <div className="h-16 shrink-0 flex items-center px-6 border-b border-slate-800 font-black text-xl text-blue-400 tracking-tighter">
          GML <span className="text-white ml-1 italic">GOD MODE</span>
        </div>

        {/* NAV - SCROLLABLE (Reemplazado ScrollArea por div nativo para asegurar flex-1) */}
        <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
          <nav className="space-y-1">
            <Button variant={view === "overview" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("overview")}>
              <LayoutDashboard className="h-4 w-4" /> Visión Global
            </Button>

            <Button variant={view === "conteo" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("conteo")}>
              <Calculator className="h-4 w-4 text-indigo-400" /> Conteo (Vivo)
            </Button>

            <Button variant={view === "leads" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("leads")}>
              <Layers className="h-4 w-4 text-orange-400" /> Leads
            </Button>

            <Button variant={view === "setter" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("setter")}>
              <UserPlus className="h-4 w-4 text-pink-400" /> Setter
            </Button>

            <Button variant={view === "agendas" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("agendas")}>
              <CalendarDays className="h-4 w-4 text-blue-500" /> Agendas
            </Button>

            <Button variant={view === "metrics" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("metrics")}>
              <BarChart4 className="h-4 w-4 text-purple-400" /> Analítica
            </Button>

            <Button variant={view === "commissions" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("commissions")}>
              <Banknote className="h-4 w-4 text-green-400" /> Liquidación
            </Button>

            {/* ✅ RESTAURADOS */}
            <Button variant={view === "health" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("health")}>
              <LifeBuoy className="h-4 w-4 text-green-400" /> Salud del Tubo
            </Button>

            <Button variant={view === "team" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("team")}>
              <Users className="h-4 w-4 text-blue-400" /> Equipo
            </Button>

            <Button variant={view === "resources" ? "secondary" : "ghost"} className="w-full justify-start gap-3" onClick={() => setView("resources")}>
              <BookOpen className="h-4 w-4 text-pink-400" /> Recursos
            </Button>

            {/* ✅ RESTAURADOS */}
            <Button
              variant={view === "announcements" ? "secondary" : "ghost"}
              className="w-full justify-start gap-3"
              onClick={() => setView("announcements")}
            >
              <Megaphone className="h-4 w-4 text-pink-500" /> Comunicados
            </Button>

            <Button variant={view === "logs" ? "secondary" : "ghost"} className="w-full justify-start gap-3 text-red-400" onClick={() => setView("logs")}>
              <ShieldAlert className="h-4 w-4" /> Auditoría
            </Button>

            <div className="pt-4 mt-4 border-t border-slate-800 space-y-1">
              <Button
                variant={view === "database" ? "secondary" : "ghost"}
                className="w-full justify-start gap-3 text-slate-400"
                onClick={() => setView("database")}
              >
                <Database className="h-4 w-4" /> Base de Datos
              </Button>
              <Button
                variant={view === "config" ? "secondary" : "ghost"}
                className="w-full justify-start gap-3 text-slate-400"
                onClick={() => setView("config")}
              >
                <Sliders className="h-4 w-4" /> Configuración
              </Button>
            </div>
          </nav>
        </div>

        {/* FOOTER - FIXED (Siempre visible) */}
        <div className="p-4 bg-slate-950 border-t border-slate-800 shrink-0">
          <div className="flex items-center gap-3 mb-4 px-2">
            <Avatar className="h-10 w-10 border-2 border-blue-500 shadow-sm">
              <AvatarImage src={userData.avatar || `https://api.dicebear.com/7.x/initials/svg?seed=${userData.name}`} />
              <AvatarFallback className="bg-slate-800 text-blue-400 font-bold">{userData.name.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="overflow-hidden">
              <p className="font-bold text-sm text-white truncate capitalize">{userData.name}</p>
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Gerencia</p>
            </div>
          </div>

          <Button variant="destructive" className="w-full h-9 text-xs font-bold" onClick={onLogout}>
            <LogOut className="h-3.5 w-3.5 mr-2" /> CERRAR SESIÓN
          </Button>
        </div>
      </aside>

      {/* CONTENIDO PRINCIPAL */}
      <main className="flex-1 h-full overflow-hidden bg-slate-50 dark:bg-slate-950 relative">
        <ScrollArea className="h-full w-full">
          {view === "overview" && <AdminOverview />}
          {view === "conteo" && <AdminConteo />}
          {view === "leads" && <AdminLeadFactory />}
          {view === "metrics" && <AdminMetrics />}
          {view === "team" && <AdminTeam />}
          {view === "logs" && <AdminLogs />}
          {view === "agendas" && <AdminAgendas />}
          {view === "database" && <AdminDatabase />}
          {view === "config" && <AdminConfig />}
          {view === "commissions" && <AdminCommissions />}
          {view === "resources" && <AdminResources />}
          {view === "setter" && <AdminSetterManager />}

          {/* ✅ RESTAURADOS */}
          {view === "health" && <AdminPipelineHealth />}
          {view === "announcements" && <AdminAnnouncements />}
        </ScrollArea>
      </main>
    </div>
  )
}