"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Activity, DollarSign, TrendingUp, Award, PieChart, CheckCircle2 } from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

export function DashboardView({ userName }: { userName?: string }) {
  const supabase = createClient()
  const [currentUser, setCurrentUser] = useState<string | null>(userName || null)

  // ✅ Selector de Mes/Año inteligente
  const now = new Date()
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth().toString())
  const [selectedYear, setSelectedYear] = useState(now.getFullYear().toString())

  // ✅ Generar opciones de año (desde 2024 hasta año actual + 1)
  const yearOptions = useMemo(() => {
    const currentYear = new Date().getFullYear()
    const years: string[] = []
    for (let y = 2024; y <= currentYear + 1; y++) years.push(String(y))
    return years
  }, [])

  // ✅ Período formateado para billing_period (ej: "2026-02")
  const targetPeriod = useMemo(() => {
    return `${selectedYear}-${String(parseInt(selectedMonth, 10) + 1).padStart(2, "0")}`
  }, [selectedMonth, selectedYear])

  const [stats, setStats] = useState({ totalLeads: 0, contactados: 0, cotizados: 0, vendidos: 0, callsToday: 0 })
  const [sourceStats, setSourceStats] = useState<any[]>([])

  // ✅ CUMPLIDAS: estado y modal
  const [cumplidasLeads, setCumplidasLeads] = useState<any[]>([])
  const [cumplidasOpen, setCumplidasOpen] = useState(false)

  // ✅ Helper: puntos de ALTA (capitas, AMPF=1)
  const altasPointsOfLead = (l: any) => {
    const prep = ((l?.prepaga ?? l?.quoted_prepaga) || "").toLowerCase()
    const plan = ((l?.plan ?? l?.quoted_plan) || "").toLowerCase()
    if (prep.includes("ampf") || plan.includes("ampf")) return 1
    const c = Number(l?.capitas)
    return Number.isFinite(c) && c > 0 ? c : 1
  }

  // ✅ Total capitas de cumplidas
  const cumplidasCapitas = useMemo(() => {
    return cumplidasLeads.reduce((acc, l) => acc + altasPointsOfLead(l), 0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cumplidasLeads])

  // Helper: inicio de período (para métricas del mes actual)
  const getPeriodStart = () => {
    const year = parseInt(selectedYear, 10)
    const month = parseInt(selectedMonth, 10)
    return new Date(year, month, 1, 0, 0, 0, 0)
  }

  // Helper: fecha de venta (prioridad sold_at)
  const saleDateOf = (l: any) => l?.sold_at || l?.fecha_ingreso || l?.activation_date || l?.fecha_alta || l?.created_at

  // 1. IDENTIFICAR AL USUARIO REAL
  useEffect(() => {
    if (userName) {
      setCurrentUser(userName)
    } else {
      const getUser = async () => {
        const { data: { session } } = await supabase.auth.getSession()
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

  // 2. TRAER DATOS
  useEffect(() => {
    if (!currentUser) return

    const fetchData = async () => {
      const periodStart = getPeriodStart()
      const periodEnd = new Date(parseInt(selectedYear, 10), parseInt(selectedMonth, 10) + 1, 0, 23, 59, 59, 999)

      // A. TRAER LEADS DEL VENDEDOR
      const { data: leads, error: leadsError } = await supabase.from("leads").select("*").eq("agent_name", currentUser)

      if (leadsError) {
        console.error("Error cargando leads:", leadsError)
        return
      }

      if (leads) {
        const total = leads.length
        const estadosVenta = ["ingresado", "vendido", "cumplidas", "legajo", "medicas", "precarga"]

        // Filtramos por período seleccionado
        const leadsInPeriod = leads.filter((l: any) => {
          const d = new Date(l.created_at)
          return d >= periodStart && d <= periodEnd
        })

        const contactados = leadsInPeriod.filter((l: any) => l.status === "contactado" || (l.calls && l.calls > 0)).length
        const cotizados = leadsInPeriod.filter((l: any) => l.status === "cotizacion" || l.quoted_price).length
        const vendidos = leads
          .filter((l: any) => estadosVenta.includes(l.status?.toLowerCase()))
          .filter((l: any) => {
            const sd = new Date(saleDateOf(l))
            return sd >= periodStart && sd <= periodEnd
          })
          .reduce((sum: number, l: any) => sum + (Number(l.capitas) || 1), 0)

        const todayStr = new Date().toDateString()
        const callsToday = leads.filter((l: any) => {
          if (!l.last_update) return false
          const updateDate = new Date(l.last_update).toDateString()
          return updateDate === todayStr && l.calls > 0 && !estadosVenta.includes(l.status?.toLowerCase())
        }).length

        setStats({ totalLeads: total, contactados, cotizados, vendidos, callsToday })

        // FUENTES
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

        // B. CALCULAR CUMPLIDAS del período seleccionado (misma lógica que AdminPerformance)
        // Usamos los leads ya cargados y filtramos por status=cumplidas + billing_approved + billing_period
        const norm = (s: any) => String(s || "").trim().toLowerCase()
        const cumplidas = leads.filter((l: any) =>
          norm(l.status) === "cumplidas" &&
          l.billing_approved === true &&
          String(l.billing_period || "") === targetPeriod
        )
        setCumplidasLeads(cumplidas)
      }
    }

    fetchData()

    // REALTIME
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
  }, [currentUser, selectedMonth, selectedYear, targetPeriod])

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
  const monthNames = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"]

  if (!currentUser) return <div className="p-10 text-center text-slate-400">Cargando perfil...</div>

  return (
    <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto text-slate-900 dark:text-slate-100">
      <div className="flex justify-between items-center mb-6 gap-3 flex-wrap">
        <h2 className="text-2xl font-bold flex items-center gap-2">Mi Tablero de Control 📈</h2>

        <div className="flex items-center gap-2 flex-wrap">
          {/* ✅ SELECTOR MES/AÑO */}
          <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger className="h-8 w-[120px] text-xs font-bold border-0 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthNames.map((m, i) => (
                  <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedYear} onValueChange={setSelectedYear}>
              <SelectTrigger className="h-8 w-[90px] text-xs font-bold border-0 bg-transparent">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
            <p className="text-xs text-slate-500">Enviadas en {monthNames[parseInt(selectedMonth, 10)]}</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Ventas (Cápitas)</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.vendidos}</div>
            <p className="text-xs text-slate-500">Del mes seleccionado</p>
          </CardContent>
        </Card>

        <Card className="dark:bg-slate-900 dark:border-slate-800 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500 dark:text-slate-400">Efectividad</CardTitle>
            <BarChart className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{stats.contactados > 0 ? ((stats.vendidos / stats.contactados) * 100).toFixed(1) : 0}%</div>
            <p className="text-xs text-slate-500">Cierre sobre Contactados</p>
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
                    <p className="text-xs text-slate-500">{source.total} leads</p>
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

        {/* ✅ CUMPLIDAS (REEMPLAZA "Últimos Movimientos") */}
        <div>
          <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-slate-700 dark:text-slate-200">
            <CheckCircle2 className="h-5 w-5 text-green-500" /> Cumplidas
          </h3>

          <Card
            className="cursor-pointer hover:border-green-400 transition-all border-2 border-green-500/30 bg-gradient-to-br from-green-50 to-white dark:from-green-950/30 dark:to-slate-900"
            onClick={() => setCumplidasOpen(true)}
          >
            <CardContent className="p-6 text-center">
              <div className="text-5xl font-black text-green-600 dark:text-green-400 mb-2">{cumplidasCapitas}</div>
              <p className="text-sm text-slate-600 dark:text-slate-400 font-medium">
                Cápitas para liquidar en <span className="font-bold">{monthNames[parseInt(selectedMonth, 10)]} {selectedYear}</span>
              </p>
              <p className="text-xs text-slate-400 mt-2">
                {cumplidasLeads.length} {cumplidasLeads.length === 1 ? "operación" : "operaciones"} • Click para ver detalle
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* MODAL DRILLDOWN CUMPLIDAS */}
      <Dialog open={cumplidasOpen} onOpenChange={setCumplidasOpen}>
        <DialogContent className="max-w-[900px] w-[92vw] max-h-[85vh] overflow-visible p-0 rounded-2xl shadow-2xl border">
          <DialogHeader className="sticky top-0 z-10 border-b bg-white/90 dark:bg-slate-950/90 backdrop-blur px-6 pt-5 pb-4">
            <DialogTitle className="flex flex-col gap-1">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-500" />
                Cumplidas — {monthNames[parseInt(selectedMonth, 10)]} {selectedYear}
              </span>
              <span className="text-xs text-slate-500 font-normal">
                Total: {cumplidasCapitas} cápitas en {cumplidasLeads.length} operaciones
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 overflow-y-auto max-h-[68vh]">
            <div className="mt-4 w-full overflow-auto rounded-xl border">
              <Table className="min-w-[700px] w-full">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[80px]">Capitas</TableHead>
                    <TableHead className="w-[120px]">Fecha Ingreso</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-[130px]">CUIT/DNI</TableHead>
                    <TableHead className="w-[150px]">Prepaga</TableHead>
                    <TableHead className="w-[150px]">Plan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {cumplidasLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-slate-500 py-10">
                        No hay operaciones cumplidas para este período.
                      </TableCell>
                    </TableRow>
                  ) : (
                    cumplidasLeads.map((l: any) => (
                      <TableRow key={l.id} className="hover:bg-slate-50/60">
                        <TableCell className="font-bold text-green-600">{altasPointsOfLead(l)}</TableCell>
                        <TableCell className="text-xs text-slate-600">{l.fecha_ingreso || "-"}</TableCell>
                        <TableCell className="font-medium">{l?.full_name || l?.name || "-"}</TableCell>
                        <TableCell className="font-mono text-xs">{l?.cuit || l?.dni || "-"}</TableCell>
                        <TableCell className="text-xs">{l?.prepaga || l?.quoted_prepaga || "-"}</TableCell>
                        <TableCell className="text-xs">{l?.plan || l?.quoted_plan || "-"}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setCumplidasOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
