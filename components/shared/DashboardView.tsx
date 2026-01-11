"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Activity, DollarSign, TrendingUp, Award, PieChart, History, ChevronDown, ChevronUp } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"

type Period = "month" | "year"

export function DashboardView({ userName }: { userName?: string }) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<string | null>(userName || null)

  // ✅ NUEVO: switch período
  const [period, setPeriod] = useState<Period>("month")

  const [stats, setStats] = useState({ totalLeads: 0, contactados: 0, cotizados: 0, vendidos: 0, callsToday: 0 })
  const [sourceStats, setSourceStats] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [isAuditExpanded, setIsAuditExpanded] = useState(false)

  // Helper: inicio de período (mes/año)
  const getPeriodStart = (p: Period) => {
    const now = new Date()
    if (p === "month") return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0)
    return new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0)
  }

  // Helper: fecha de venta (prioridad sold_at)
  const saleDateOf = (l: any) => l?.sold_at || l?.fecha_ingreso || l?.activation_date || l?.fecha_alta || l?.created_at

  // 1. IDENTIFICAR AL USUARIO REAL (Si no viene por props, lo buscamos en la sesión)
  useEffect(() => {
    if (userName) {
      setCurrentUser(userName)
    } else {
      const getUser = async () => {
        const {
          data: { session },
        } = await supabase.auth.getSession()
        if (session?.user) {
          const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", session.user.id).single()

          if (profile?.full_name) {
            setCurrentUser(profile.full_name)
          }
        }
      }
      getUser()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userName])

  // 2. TRAER DATOS (Se ejecuta cuando ya tenemos el usuario identificado)
  useEffect(() => {
    if (!currentUser) return

    const fetchData = async () => {
      const periodStart = getPeriodStart(period)

      // A. TRAER LEADS DEL VENDEDOR
      const { data: leads, error: leadsError } = await supabase.from("leads").select("*").eq("agent_name", currentUser)

      if (leadsError) {
        console.error("Error cargando leads:", leadsError)
        return
      }

      if (leads) {
        const total = leads.length

        // ✅ Estados de venta (éxito)
        const estadosVenta = ["ingresado", "vendido", "cumplidas", "legajo", "medicas", "precarga"]

        // ✅ Filtramos por período
        const leadsInPeriod = leads.filter((l: any) => {
          const d = new Date(l.created_at)
          return d >= periodStart
        })

        // ✅ Contactados del período
        const contactados = leadsInPeriod.filter((l: any) => l.status === "contactado" || (l.calls && l.calls > 0)).length

        // ✅ Cotizados del período
        const cotizados = leadsInPeriod.filter((l: any) => l.status === "cotizacion" || l.quoted_price).length

        // ✅ Vendidos del período (por sold_at si existe)
        const vendidos = leads
          .filter((l: any) => estadosVenta.includes(l.status?.toLowerCase()))
          .filter((l: any) => {
            const sd = new Date(saleDateOf(l))
            return sd >= periodStart
          })
          .reduce((sum: number, l: any) => sum + (Number(l.capitas) || 1), 0)

        // ✅ Llamadas Hoy (no depende del período)
        const todayStr = new Date().toDateString()
        const callsToday = leads.filter((l: any) => {
          if (!l.last_update) return false
          const updateDate = new Date(l.last_update).toDateString()
          return updateDate === todayStr && l.calls > 0 && !estadosVenta.includes(l.status?.toLowerCase())
        }).length

        setStats({ totalLeads: total, contactados, cotizados, vendidos, callsToday })

        // ✅ FUENTES: también del período (para que tenga sentido con el switch)
        const sourcesMap: Record<string, { total: number; won: number }> = {}
        leadsInPeriod.forEach((l: any) => {
          let sourceName = l.source || "Desconocido"
          if (["Google", "Meta", "Facebook", "Instagram", "Ads"].some((k) => sourceName.includes(k))) {
            sourceName = "Publicidad (Ads)"
          }

          if (!sourcesMap[sourceName]) sourcesMap[sourceName] = { total: 0, won: 0 }

          sourcesMap[sourceName].total += 1
          if (estadosVenta.includes(l.status?.toLowerCase())) {
            sourcesMap[sourceName].won += 1
          }
        })

        const sourceArray = Object.entries(sourcesMap)
          .map(([name, data]) => ({
            name,
            total: data.total,
            won: data.won,
            rate: data.total > 0 ? ((data.won / data.total) * 100).toFixed(1) : "0.0",
          }))
          .sort((a, b) => b.total - a.total)

        setSourceStats(sourceArray)
      }

      // B. TRAER HISTORIAL REAL (lead_status_history)
      // (lo dejamos como estaba: últimos 15 movimientos; si querés que también respete Mes/Año, lo ajustamos)
      const { data: history, error: historyError } = await supabase
        .from("lead_status_history")
        .select(
          `
            id,
            from_status,
            to_status,
            changed_at,
            leads ( name )
        `
        )
        .eq("agent_name", currentUser)
        .order("changed_at", { ascending: false })
        .limit(15)

      if (!historyError && history) {
        const formattedLogs = history.map((h: any) => ({
          id: h.id,
          action: `Cambio: ${h.to_status?.toUpperCase()}`,
          details: `${h.leads?.name || "Cliente"} (de ${h.from_status} a ${h.to_status})`,
          created_at: h.changed_at,
        }))
        setAuditLogs(formattedLogs)
      }
    }

    fetchData()

    // 3. ACTIVAR REALTIME
    const channel = supabase
      .channel("dashboard_metrics_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads", filter: `agent_name=eq.${currentUser}` }, () => {
        fetchData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, period])

  // --- NIVELES (Gamificación) ---
  const getLevel = (sales: number) => {
    if (sales < 3) return { level: 1, target: 3, msg: "¡Arrancando! 🛵" }
    if (sales < 6) return { level: 2, target: 6, msg: "¡Primera Marcha! 🚗" }
    if (sales < 10) return { level: 3, target: 10, msg: "¡Velocidad Crucero! 🏎️" }
    if (sales < 15) return { level: 4, target: 15, msg: "¡Modo Turbo! 🔥" }
    if (sales < 20) return { level: 5, target: 20, msg: "¡Imparable! 🚀" }
    if (sales < 30) return { level: 6, target: 30, msg: "¡MAESTRO! 💎" }
    if (sales < 50) return { level: 7, target: 50, msg: "¡TITÁN DE VENTAS! 🪐" }
    return { level: 8, target: 100, msg: "¡LEYENDA GML! 👑" }
  }

  const currentLevel = getLevel(stats.vendidos)
  const progress = Math.min((stats.vendidos / currentLevel.target) * 100, 100)
  const visibleLogs = isAuditExpanded ? auditLogs : auditLogs.slice(0, 3)

  if (!currentUser) return <div className="p-10 text-center text-slate-400">Cargando perfil...</div>

  return (
    <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto text-slate-900 dark:text-slate-100">
      <div className="flex justify-between items-center mb-6 gap-3">
        <h2 className="text-2xl font-bold flex items-center gap-2">Mi Tablero de Control 📈</h2>

        <div className="flex items-center gap-2">
          {/* ✅ SWITCH MES/AÑO */}
          <div className="bg-slate-100 dark:bg-slate-800 p-1 rounded-lg flex">
            <Button size="sm" variant={period === "month" ? "default" : "ghost"} onClick={() => setPeriod("month")} className="text-xs font-bold h-8">
              Mes
            </Button>
            <Button size="sm" variant={period === "year" ? "default" : "ghost"} onClick={() => setPeriod("year")} className="text-xs font-bold h-8">
              Año
            </Button>
          </div>

          <div className="text-xs text-slate-400 font-medium bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full">
            Usuario: {currentUser}
          </div>
        </div>
      </div>

      {/* TARJETA DE NIVEL */}
      <Card className="mb-8 border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-sm">
        <CardContent className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-black text-xl flex items-center gap-2 text-slate-800 dark:text-white">
              <Award className="h-6 w-6 text-yellow-500" />
              Nivel {currentLevel.level}: {currentLevel.msg}
            </h3>
            <span className="font-bold text-slate-600 dark:text-slate-400 text-lg">
              {stats.vendidos} / {currentLevel.target} <span className="text-sm font-normal">Cápitas</span>
            </span>
          </div>
          <Progress value={progress} className="h-4 bg-slate-100 dark:bg-slate-800" />
          <p className="text-xs text-slate-500 mt-2 text-center">
            {stats.vendidos >= currentLevel.target ? "¡Objetivo cumplido! 💪" : `¡Faltan solo ${currentLevel.target - stats.vendidos} cápitas para el próximo nivel!`}
          </p>
        </CardContent>
      </Card>

      {/* KPIs PRINCIPALES */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Gestión Hoy</CardTitle>
            <Activity className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.callsToday}</div>
            <p className="text-xs text-slate-500">Clientes tocados</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Cotizaciones</CardTitle>
            <DollarSign className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.cotizados}</div>
            <p className="text-xs text-slate-500">{period === "month" ? "Enviadas este mes" : "Enviadas este año"}</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Ventas (Cápitas)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.vendidos}</div>
            <p className="text-xs text-slate-500">{period === "month" ? "Del mes" : "Del año"}</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Efectividad</CardTitle>
            <BarChart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.contactados > 0 ? ((stats.vendidos / stats.contactados) * 100).toFixed(1) : 0}%</div>
            <p className="text-xs text-slate-500">Cierre sobre Contactados ({period === "month" ? "mes" : "año"})</p>
          </CardContent>
        </Card>
      </div>

      {/* GRÁFICOS Y LISTAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* FUENTES DE DATOS */}
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <PieChart className="h-5 w-5 text-purple-500" /> Canales
          </h3>
          <div className="space-y-3">
            {sourceStats.length === 0 ? (
              <p className="text-sm text-slate-400 italic">No hay datos suficientes aún.</p>
            ) : (
              sourceStats.map((source) => (
                <div key={source.name} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div>
                    <p className="font-bold text-sm">{source.name}</p>
                    <p className="text-xs text-slate-500">{source.total} leads ({period === "month" ? "mes" : "año"})</p>
                  </div>
                  <div className="text-right">
                    <span className="text-green-600 font-bold text-sm">{source.rate}%</span>
                    <div className="h-1 w-16 bg-slate-200 rounded-full mt-1 overflow-hidden">
                      <div className="h-full bg-green-500" style={{ width: `${source.rate}%` }}></div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* HISTORIAL DE MOVIMIENTOS */}
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold flex items-center gap-2 text-slate-700 dark:text-slate-200">
              <History className="h-5 w-5 text-blue-500" /> Últimos Movimientos
            </h3>
            {auditLogs.length > 3 && (
              <Button variant="ghost" size="sm" className="text-slate-500 hover:text-slate-800 dark:hover:text-white" onClick={() => setIsAuditExpanded(!isAuditExpanded)}>
                {isAuditExpanded ? (
                  <span className="flex items-center text-xs">
                    Menos <ChevronUp className="h-4 w-4 ml-1" />
                  </span>
                ) : (
                  <span className="flex items-center text-xs">
                    Ver más <ChevronDown className="h-4 w-4 ml-1" />
                  </span>
                )}
              </Button>
            )}
          </div>

          <div className="space-y-0 relative">
            <div className={`absolute left-3 top-0 bottom-0 w-0.5 bg-slate-200 dark:bg-slate-800 ${isAuditExpanded ? "h-full" : "h-20"}`}></div>
            {visibleLogs.length === 0 ? (
              <p className="text-sm text-slate-400 italic pl-8">Sin actividad reciente.</p>
            ) : (
              visibleLogs.map((log) => (
                <div key={log.id} className="relative pl-8 pb-4 animate-in fade-in slide-in-from-top-2">
                  <div className="absolute left-1.5 top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-4 ring-white dark:ring-slate-950"></div>
                  <div className="bg-white dark:bg-slate-900 p-3 rounded-lg border border-slate-200 dark:border-slate-800 shadow-sm">
                    <div className="flex justify-between items-center mb-1">
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{log.action}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    {log.details && <p className="text-xs text-slate-500">{log.details}</p>}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
