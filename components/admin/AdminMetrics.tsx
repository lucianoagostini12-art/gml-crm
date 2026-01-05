"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
  AreaChart,
  Area,
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts"

import {
  ArrowRight,
  FileText,
  Activity,
  CheckCircle2,
  AlertOctagon,
  FolderInput,
  HeartPulse,
  FileBadge,
  Layers,
  Lightbulb,
  ClipboardList,
  XCircle,
  Flame,
  User,
  Timer,
  DollarSign,
  Crosshair,
  HelpCircle,
  CalendarDays,
  Download,
  AlertTriangle,
  TrendingUp,
  BrainCircuit,
  Target,
  RefreshCw,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type Lead = {
  id: string
  created_at: string
  last_update?: string | null
  first_contact_at?: string | null
  status?: string | null
  agent_name?: string | null
  price?: number | null
  quoted_price?: number | null
  source?: string | null
  loss_reason?: string | null
}

type StatusEvent = {
  id: number
  lead_id: string
  agent_name?: string | null
  from_status?: string | null
  to_status: string
  changed_at: string
}

const AR_TZ = "America/Argentina/Buenos_Aires"

// Horas que tu UI muestra en el heatmap
const HEAT_HOURS = [9, 10, 11, 12, 15, 16, 17] as const
const HEAT_KEYS = ["h09", "h10", "h11", "h12", "h15", "h16", "h17"] as const

const DAY_LABELS: { key: string; label: string }[] = [
  { key: "Lunes", label: "Lunes" },
  { key: "Martes", label: "Martes" },
  { key: "Miérc", label: "Miérc" },
  { key: "Jueves", label: "Jueves" },
  { key: "Viernes", label: "Viernes" },
]

// Normaliza statuses para evitar quilombos por mayúsculas/acentos
const norm = (v: any) => String(v ?? "").trim().toLowerCase()

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function safeDate(ts?: string | null) {
  const d = ts ? new Date(ts) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

// Devuelve { weekday (es), hour } usando TZ Argentina
function getARWeekdayHour(iso: string): { weekday: string; hour: number } {
  // weekday en español (lunes, martes, ...)
  const weekday = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, weekday: "long" }).format(new Date(iso))
  const hourStr = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, hour: "2-digit", hour12: false }).format(new Date(iso))
  const hour = Number(hourStr)
  return { weekday: weekday.toLowerCase(), hour }
}

// Mapeo weekday -> tu etiqueta
function mapWeekdayToLabel(weekdayLower: string) {
  if (weekdayLower.includes("lunes")) return "Lunes"
  if (weekdayLower.includes("martes")) return "Martes"
  if (weekdayLower.includes("miércoles") || weekdayLower.includes("miercoles")) return "Miérc"
  if (weekdayLower.includes("jueves")) return "Jueves"
  if (weekdayLower.includes("viernes")) return "Viernes"
  return null
}

function speedStatus(avgMin: number) {
  if (avgMin === 0) return "normal"
  if (avgMin <= 15) return "optimo"
  if (avgMin > 60) return "critico"
  return "normal"
}

// Estados que consideramos “cerrados / no activos”
const CLOSED_STATUSES = new Set(["vendido", "perdido", "cumplidas", "rechazado", "rechazados"])

export function AdminMetrics() {
  const supabase = createClient()

  const today = new Date().toISOString().split("T")[0]
  const firstDay = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0]

  const [dateStart, setDateStart] = useState<string>(firstDay)
  const [dateEnd, setDateEnd] = useState<string>(today)
  const [agent, setAgent] = useState("global")

  const [metrics, setMetrics] = useState<any>(null)
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Presets calendario
  const setPreset = (days: number | string) => {
    const end = new Date()
    const start = new Date()
    if (typeof days === "number") start.setDate(end.getDate() - days)
    else if (days === "month") start.setDate(1)
    else if (days === "lastMonth") {
      start.setMonth(start.getMonth() - 1)
      start.setDate(1)
      end.setDate(0)
    }
    setDateStart(start.toISOString().split("T")[0])
    setDateEnd(end.toISOString().split("T")[0])
    setIsCalendarOpen(false)
  }

  const heatMapBase = useMemo(() => {
    return DAY_LABELS.map((d) => ({
      day: d.label,
      h09: 0,
      h10: 0,
      h11: 0,
      h12: 0,
      h15: 0,
      h16: 0,
      h17: 0,
    }))
  }, [])

  const getHeatColor = (value: number) => {
    if (value >= 8) return "bg-red-500 text-white font-bold"
    if (value >= 5) return "bg-orange-400 text-white"
    if (value >= 3) return "bg-yellow-300 text-yellow-900"
    return "bg-slate-100 text-slate-400"
  }

  const fetchData = async () => {
    setLoading(true)

    // --- 1) LEADS (mínimo necesario) ---
    // Usamos select * para evitar errores si faltan columnas específicas como first_contact_at
    // pero intentamos mapear lo que existe
    let leadsQuery = supabase
      .from("leads")
      .select("*") 
      .gte("created_at", `${dateStart}T00:00:00`)
      .lte("created_at", `${dateEnd}T23:59:59`)

    if (agent !== "global") {
      const agentName = agent.charAt(0).toUpperCase() + agent.slice(1)
      // Intentamos filtrar por columna agent_name si existe
      leadsQuery = leadsQuery.ilike("agent_name", `%${agentName}%`)
    }

    const { data: leadsRaw, error: leadsErr } = await leadsQuery
    if (leadsErr) console.error("Error cargando leads:", leadsErr)

    const leads: Lead[] = Array.isArray(leadsRaw) ? (leadsRaw as any) : []

    // --- 2) HISTORIAL DE ESTADOS (gestión real) ---
    // Mapeamos las columnas de la BD (status, created_at) a lo que espera este componente (to_status, changed_at)
    let events: StatusEvent[] = []
    try {
      let evQuery = supabase
        .from("lead_status_history")
        .select("id, lead_id, agent_name, to_status:status, changed_at:created_at") // Alias clave para que funcione el gráfico
        .gte("created_at", `${dateStart}T00:00:00`)
        .lte("created_at", `${dateEnd}T23:59:59`)
        .order("created_at", { ascending: true })

      if (agent !== "global") {
        const agentName = agent.charAt(0).toUpperCase() + agent.slice(1)
        // Nota: Si lead_status_history no tiene agent_name, este filtro podría fallar en historial, 
        // pero seguimos adelante para no romper la app.
        evQuery = evQuery.ilike("agent_name", `%${agentName}%`)
      }

      const { data: evRaw, error: evErr } = await evQuery
      if (evErr) {
        console.warn("No se pudo leer lead_status_history:", evErr.message)
      } else {
        events = Array.isArray(evRaw) ? (evRaw as any) : []
      }
    } catch (e) {
      console.warn("lead_status_history no disponible o error de conexión:", e)
    }

    // --- CÁLCULOS REALES ---
    const counts: Record<string, number> = {
      nuevo: 0,
      contactado: 0,
      cotizacion: 0,
      ingresado: 0,
      precarga: 0,
      medicas: 0,
      legajo: 0,
      demoras: 0,
      cumplidas: 0,
      rechazado: 0,
      documentacion: 0,
    }

    let totalRevenue = 0

    leads.forEach((l) => {
      const s = norm(l.status) as keyof typeof counts
      if (counts[s] !== undefined) counts[s]++

      // Revenue solo si no es “muy temprano”
      if (!["nuevo", "contactado", "perdido"].includes(s)) {
        // Fallback a 0 si no hay precio cargado
        totalRevenue += Number(l.price) || Number(l.quoted_price) || 0
      }
    })

    const totalLeads = leads.length
    const activeLeads = counts.contactado + counts.cotizacion + counts.documentacion
    const salesCount =
      counts.ingresado + counts.precarga + counts.medicas + counts.legajo + counts.demoras + counts.cumplidas

    const rpl = totalLeads > 0 ? Math.round(totalRevenue / totalLeads).toString() : "0"
    const strikeRate = totalLeads > 0 ? ((salesCount / totalLeads) * 100).toFixed(1) : "0.0"

    // --- Velocidad real (primer “contacto/gestión”) ---
    // 1) first_contact_at si existe en la tabla leads
    // 2) fallback: primer evento en lead_status_history para ese lead
    const firstEventByLead = new Map<string, string>()
    for (const ev of events) {
      if (!firstEventByLead.has(ev.lead_id)) firstEventByLead.set(ev.lead_id, ev.changed_at)
    }

    let speedSum = 0
    let speedSample = 0

    leads.forEach((l) => {
      const created = safeDate(l.created_at)
      if (!created) return

      const fc = safeDate(l.first_contact_at) || safeDate(firstEventByLead.get(l.id) || null)
      if (!fc) return

      const diffMin = Math.max(0, Math.round((fc.getTime() - created.getTime()) / 60000))
      speedSum += diffMin
      speedSample++
    })

    const speedValue = speedSample > 0 ? Math.round(speedSum / speedSample) : 0
    const speedSt = speedStatus(speedValue)

    // --- Stock podrido (usa last_update real de gestión; fallback created_at) ---
    const now = new Date()
    const stagnantCount = leads.filter((l) => {
      const s = norm(l.status)
      if (CLOSED_STATUSES.has(s)) return false

      const lastUp = safeDate(l.last_update) || safeDate(l.created_at)
      if (!lastUp) return false

      const diffDays = Math.ceil(Math.abs(now.getTime() - lastUp.getTime()) / (1000 * 60 * 60 * 24))
      return diffDays > 2
    }).length

    const stagnantPercent = totalLeads > 0 ? Math.floor((stagnantCount / totalLeads) * 100) : 0

    // --- Heatmap real (por cambios de estado) ---
    const heatMap = heatMapBase.map((row) => ({ ...row }))
    const heatMapIndex = new Map<string, any>()
    heatMap.forEach((r) => heatMapIndex.set(r.day, r))

    for (const ev of events) {
      const { weekday, hour } = getARWeekdayHour(ev.changed_at)
      const label = mapWeekdayToLabel(weekday)
      if (!label) continue

      const idx = HEAT_HOURS.indexOf(hour as any)
      if (idx === -1) continue

      const key = HEAT_KEYS[idx]
      const row = heatMapIndex.get(label)
      if (!row) continue
      row[key] = (row[key] || 0) + 1
    }

    // --- Daily real (consistencia) por cambios de estado (últimos 7 días desde dateEnd) ---
    const dailyBuckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(dateEnd + "T00:00:00")
      d.setDate(d.getDate() - (6 - i))
      const iso = toISODate(d)
      return { day: `Día ${i + 1}`, iso, value: 0 }
    })
    const dailyMap = new Map(dailyBuckets.map((b) => [b.iso, b]))

    for (const ev of events) {
      const iso = String(ev.changed_at).slice(0, 10)
      const bucket = dailyMap.get(iso)
      if (bucket) bucket.value += 1
    }

    const daily = dailyBuckets.map((b) => ({ day: b.day, value: b.value }))

    // --- Insistencia real (movimientos por lead, promedio simple) ---
    const movesByLead = new Map<string, number>()
    for (const ev of events) movesByLead.set(ev.lead_id, (movesByLead.get(ev.lead_id) || 0) + 1)
    const movesTotal = Array.from(movesByLead.values()).reduce((a, b) => a + b, 0)
    const insistenciaAvg = movesByLead.size > 0 ? movesTotal / movesByLead.size : 0 // promedio
    const insistenciaScore = Math.min(100, Math.round(insistenciaAvg * 20)) // escala simple

    // --- Radar real ---
    const performanceFactor = salesCount > 5 ? 1 : 0.5
    const radarData = [
      { subject: "Velocidad", A: speedValue === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (speedValue / 60) * 100))), fullMark: 100 },
      { subject: "Cierre", A: Math.min(100, Number(strikeRate) * 2), fullMark: 100 },
      { subject: "Insistencia", A: Math.round(insistenciaScore * performanceFactor), fullMark: 100 },
      { subject: "Ticket", A: totalRevenue > 500000 ? 90 : totalRevenue > 0 ? 60 : 0, fullMark: 100 },
      { subject: "Volumen", A: Math.min(100, totalLeads / 2), fullMark: 100 },
    ]

    // --- Coach dinámico real ---
    let coachAdvice = "Ritmo constante. Seguir monitoreando métricas de cierre."
    if (Number(strikeRate) > 15) coachAdvice = "💎 EXCELENTE CIERRE: El equipo está convirtiendo muy bien. Priorizar calidad sobre cantidad."
    if (stagnantPercent > 30) coachAdvice = "⚠️ ALERTA STOCK: Muchos leads dormidos (>48hs). Recomendación: Día de limpieza de base."
    if (totalLeads > 0 && salesCount === 0) coachAdvice = "📉 FOCO: Hay leads pero no hay cierres. Revisar guión, calidad de base y seguimiento."

    // --- Funnel real (como tu original) ---
    const funnelData = [
      { name: "Total Datos", value: totalLeads, fill: "#94a3b8" },
      { name: "Contactados", value: counts.contactado + counts.cotizacion + salesCount, fill: "#3b82f6" },
      { name: "Cotizados", value: counts.cotizacion + salesCount, fill: "#8b5cf6" },
      { name: "Cierres", value: salesCount, fill: "#10b981" },
    ]

    // --- Audit steps real ---
    const auditSteps = [
      { label: "INGRESADO", count: counts.ingresado, icon: FolderInput, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" },
      { label: "PRECARGA", count: counts.precarga, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
      { label: "MÉDICAS", count: counts.medicas, icon: HeartPulse, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
      { label: "LEGAJO", count: counts.legajo, icon: FileBadge, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
      { label: "DEMORAS", count: counts.demoras, icon: AlertTriangle, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
      { label: "CUMPLIDAS", count: counts.cumplidas, icon: CheckCircle2, color: "text-white", bg: "bg-green-500 shadow-md transform scale-105", border: "border-green-600" },
      { label: "RECHAZADOS", count: counts.rechazado, icon: AlertOctagon, color: "text-white", bg: "bg-red-500 shadow-md", border: "border-red-600" },
    ]

    // --- ConversionBySource real si existe leads.source; si no existe, queda 0 ---
    const sourceAgg = new Map<string, { datos: number; ventas: number }>()
    for (const l of leads) {
      const src = String(l.source ?? "").trim()
      if (!src) continue
      const key = src
      if (!sourceAgg.has(key)) sourceAgg.set(key, { datos: 0, ventas: 0 })
      sourceAgg.get(key)!.datos += 1

      const st = norm(l.status)
      const isSale = ["ingresado", "precarga", "medicas", "legajo", "demoras", "cumplidas"].includes(st)
      if (isSale) sourceAgg.get(key)!.ventas += 1
    }

    const conversionBySource = Array.from(sourceAgg.entries())
      .sort((a, b) => b[1].datos - a[1].datos)
      .slice(0, 8)
      .map(([name, v], idx) => {
        const tasa = v.datos > 0 ? Math.round((v.ventas / v.datos) * 100) : 0
        const palette = ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ef4444", "#64748b", "#eab308", "#22c55e"]
        return { name, datos: v.datos, ventas: v.ventas, tasa, color: palette[idx % palette.length] }
      })

    // Si no hay sources, mantenemos tu UI “limpia” (mismo look, pero 0)
    const conversionBySourceSafe =
      conversionBySource.length > 0
        ? conversionBySource
        : [
            { name: "Llamador", datos: 0, ventas: 0, tasa: 0, color: "#f59e0b" },
            { name: "Meta Ads", datos: 0, ventas: 0, tasa: 0, color: "#8b5cf6" },
            { name: "Google", datos: 0, ventas: 0, tasa: 0, color: "#3b82f6" },
          ]

    // --- LossReasons real si existe leads.loss_reason; si no existe, 0 ---
    const lossAgg = new Map<string, number>()
    for (const l of leads) {
      const lr = String(l.loss_reason ?? "").trim()
      if (!lr) continue
      // contamos solo si el estado está perdido/rechazado
      const st = norm(l.status)
      if (!["perdido", "rechazado"].includes(st)) continue
      lossAgg.set(lr, (lossAgg.get(lr) || 0) + 1)
    }

    const lossReasons = Array.from(lossAgg.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, value], idx) => {
        const palette = ["#ef4444", "#f97316", "#eab308", "#64748b", "#8b5cf6", "#3b82f6", "#10b981", "#0ea5e9"]
        return { name, value, fill: palette[idx % palette.length] }
      })

    const lossReasonsSafe =
      lossReasons.length > 0
        ? lossReasons
        : [
            { name: "Precio", value: 0, fill: "#ef4444" },
            { name: "IOMA", value: 0, fill: "#f97316" },
            { name: "No contesta", value: 0, fill: "#eab308" },
            { name: "Competencia", value: 0, fill: "#64748b" },
          ]

    // --- Pacing real (mes actual vs ventas/objetivo) ---
    const nowLocal = new Date()
    const monthDays = new Date(nowLocal.getFullYear(), nowLocal.getMonth() + 1, 0).getDate()
    const timePct = Math.round((nowLocal.getDate() / monthDays) * 100)
    const goal = Math.ceil(salesCount * 1.5) || 10
    const goalPct = goal > 0 ? Math.round((salesCount / goal) * 100) : 0
    const pacingStatus = goalPct >= timePct ? "ontrack" : "behind"

    setMetrics({
      inventory: {
        newLeads: counts.nuevo,
        activeLeads,
        sales: salesCount,
        goal,
      },
      killerMetrics: {
        speed: { value: speedValue, status: speedSt, sample: speedSample },
        rpl,
        strikeRate,
      },
      advanced: {
        radar: radarData,
        coach: coachAdvice,
        daily,
      },
      pacing: { time: timePct, goal: goalPct, status: pacingStatus },
      stagnation: { count: stagnantCount, percent: stagnantPercent, status: stagnantPercent > 20 ? "critical" : "healthy" },
      conversionBySource: conversionBySourceSafe,
      funnelData,
      lossReasons: lossReasonsSafe,
      auditSteps,
      heatMap, // 👈 la UI lo usa abajo
    })

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agent, dateStart, dateEnd])

  const handleExport = () => {
    alert(`📥 GENERANDO REPORTE EXCEL...\n\n📅 Período: ${dateStart} al ${dateEnd}\n👤 Filtro: ${agent.toUpperCase()}\n\nEl archivo se está descargando.`)
  }

  if (!metrics) {
    return (
      <div className="flex h-full items-center justify-center">
        <RefreshCw className="animate-spin mr-2" /> Cargando Tablero...
      </div>
    )
  }

  const heatMap = metrics.heatMap ?? heatMapBase

  return (
    <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8">
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Activity className="h-8 w-8 text-blue-600" /> Tablero de Comando
            {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />}
          </h2>
          <p className="text-slate-500">Analítica Comercial y Administrativa Real.</p>
        </div>

        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm border items-center">
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="border-0 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 h-10 w-[240px] justify-start"
              >
                <CalendarDays className="w-4 h-4 mr-2 text-slate-500" />
                {dateStart} <span className="mx-1 text-slate-400">➔</span> {dateEnd}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                <div className="flex flex-col gap-1 p-2 border-r bg-slate-50 w-40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 px-2">Accesos Rápidos</span>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(0)}>
                    Hoy
                  </Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(1)}>
                    Ayer
                  </Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(7)}>
                    Últimos 7 días
                  </Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(30)}>
                    Últimos 30 días
                  </Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset("month")}>
                    Este Mes
                  </Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset("lastMonth")}>
                    Mes Pasado
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-xs">Desde</Label>
                      <Input
                        type="date"
                        value={dateStart}
                        onChange={(e) => setDateStart(e.target.value)}
                        className="col-span-2 h-8 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-3 items-center gap-4">
                      <Label className="text-xs">Hasta</Label>
                      <Input
                        type="date"
                        value={dateEnd}
                        onChange={(e) => setDateEnd(e.target.value)}
                        className="col-span-2 h-8 text-xs"
                      />
                    </div>
                  </div>
                  <Button
                    className="w-full h-8 text-xs bg-slate-900 text-white"
                    onClick={() => {
                      fetchData()
                      setIsCalendarOpen(false)
                    }}
                  >
                    Aplicar
                  </Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger
              className={`w-[200px] font-bold border-none h-10 ${
                agent !== "global" ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-white text-slate-700 hover:bg-slate-50"
              }`}
            >
              <User className={`w-4 h-4 mr-2 ${agent !== "global" ? "text-purple-600" : "text-slate-400"}`} />
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global">🌍 Global (Empresa)</SelectItem>
              <SelectItem value="maca">👩‍💼 Maca (Vendedora)</SelectItem>
              <SelectItem value="gonza">👨‍💼 Gonza (Vendedora)</SelectItem>
              <SelectItem value="cami">🎣 Cami (Gestora)</SelectItem>
            </SelectContent>
          </Select>

          <Button variant="default" className="bg-green-600 hover:bg-green-700 h-10 text-white shadow-sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-2" /> Exportar
          </Button>
        </div>
      </div>

      <Tabs defaultValue="commercial" className="w-full">
        <TabsList className="grid w-full grid-cols-2 h-14 mb-8 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl">
          <TabsTrigger
            value="commercial"
            className="h-full text-base font-bold data-[state=active]:bg-white data-[state=active]:text-blue-700 shadow-sm rounded-lg"
          >
            📊 Gestión Comercial
          </TabsTrigger>
          <TabsTrigger
            value="audit"
            className="h-full text-base font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 shadow-sm rounded-lg"
          >
            📋 Auditoría ({agent === "global" ? "Global" : agent})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="commercial" className="space-y-6 animate-in fade-in-50">
          {/* 1. KILLER METRICS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card
              className={`${
                metrics.killerMetrics.speed.status === "optimo"
                  ? "bg-green-600"
                  : metrics.killerMetrics.speed.status === "critico"
                  ? "bg-red-600"
                  : "bg-blue-600"
              } text-white border-none shadow-lg relative overflow-hidden`}
            >
              <div className="absolute top-2 right-2 opacity-20">
                <Timer className="h-16 w-16" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                  <span className="text-xs font-bold uppercase tracking-wider">Velocidad</span>
                  <Popover>
                    <PopoverTrigger>
                      <HelpCircle className="h-4 w-4 cursor-pointer hover:text-white/80" />
                    </PopoverTrigger>
                    <PopoverContent className="text-xs bg-slate-900 text-white border-none p-2 w-60">
                      Tiempo promedio hasta el primer cambio de estado desde <b>Nuevo</b>.<br />
                      <b>Ideal: &lt; 15 min.</b>
                      <div className="mt-1 opacity-80">Muestra: {metrics.killerMetrics.speed.sample ?? 0} leads</div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="flex items-baseline gap-2">
                  <p className="text-4xl font-black">{metrics.killerMetrics.speed.value} min</p>
                  <Badge variant="secondary" className="bg-white/20 text-white border-none text-[10px]">
                    {metrics.killerMetrics.speed.status === "optimo"
                      ? "⚡ ÓPTIMO"
                      : metrics.killerMetrics.speed.status === "critico"
                      ? "🐢 LENTO"
                      : "NORMAL"}
                  </Badge>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-slate-900 text-white border-none shadow-lg relative overflow-hidden">
              <div className="absolute top-2 right-2 opacity-20">
                <DollarSign className="h-16 w-16" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1 opacity-90">
                  <span className="text-xs font-bold uppercase tracking-wider text-green-400">RPL</span>
                  <Popover>
                    <PopoverTrigger>
                      <HelpCircle className="h-4 w-4 cursor-pointer hover:text-green-400" />
                    </PopoverTrigger>
                    <PopoverContent className="text-xs bg-slate-800 text-white border-none p-2 w-60">
                      <b>Revenue Per Lead:</b>
                      <br />$ por dato entregado.
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-4xl font-black">$ {parseInt(metrics.killerMetrics.rpl).toLocaleString()}</p>
              </CardContent>
            </Card>

            <Card className="bg-white text-slate-800 border-t-4 border-t-orange-500 shadow-lg relative">
              <div className="absolute top-2 right-2 opacity-10">
                <Crosshair className="h-16 w-16 text-orange-500" />
              </div>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-1 text-orange-600">
                  <span className="text-xs font-bold uppercase tracking-wider">Strike Rate</span>
                  <Popover>
                    <PopoverTrigger>
                      <HelpCircle className="h-4 w-4 cursor-pointer hover:text-orange-600" />
                    </PopoverTrigger>
                    <PopoverContent className="text-xs bg-orange-50 text-orange-900 border-orange-200 p-2 w-60">
                      <b>Efectividad Cierre:</b>
                      <br />
                      Ventas sobre TOTAL.
                    </PopoverContent>
                  </Popover>
                </div>
                <p className="text-4xl font-black text-slate-800">{metrics.killerMetrics.strikeRate}%</p>
              </CardContent>
            </Card>
          </div>

          {/* 2. INVENTARIO */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="border-l-4 border-l-blue-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-slate-500 font-bold flex justify-between">
                  Datos Nuevos <Layers className="h-4 w-4 text-blue-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">{metrics.inventory.newLeads}</div>
                <div className="text-xs text-blue-600 font-bold mt-1">Disponibles</div>
                <Progress value={30} className="h-1.5 mt-2 bg-blue-100" />
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-purple-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-slate-500 font-bold flex justify-between">
                  En Gestión <Activity className="h-4 w-4 text-purple-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">{metrics.inventory.activeLeads}</div>
                <div className="text-xs text-purple-600 font-bold mt-1">Cartera Activa</div>
                <Progress value={70} className="h-1.5 mt-2 bg-purple-100" />
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500 shadow-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs uppercase text-slate-500 font-bold flex justify-between">
                  Ventas <CheckCircle2 className="h-4 w-4 text-green-500" />
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">{metrics.inventory.sales}</div>
                <div className="text-xs text-green-600 font-bold mt-1">Obj: {metrics.inventory.goal}</div>
                <Progress value={(metrics.inventory.sales / metrics.inventory.goal) * 100} className="h-1.5 mt-2 bg-green-100" />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* 3. TABLA CONVERSIÓN */}
            <Card className="shadow-md lg:col-span-2">
              <CardHeader>
                <CardTitle>Calidad de Origen (Real)</CardTitle>
                <CardDescription>Efectividad por fuente ({agent === "global" ? "Equipo" : agent}).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {metrics.conversionBySource.map((source: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center justify-between text-sm p-2 hover:bg-slate-50 rounded-lg transition-colors border-b border-slate-100 last:border-0"
                    >
                      <div className="flex items-center gap-3 w-1/3">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: source.color }}></div>
                        <span className="font-bold text-slate-700">{source.name}</span>
                      </div>
                      <div className="flex flex-col items-center w-1/4">
                        <span className="font-black text-slate-800">{source.datos}</span>
                      </div>
                      <div className="flex flex-col items-center w-1/4">
                        <span className="font-black text-green-600">{source.ventas}</span>
                        <span className="text-[10px] text-slate-400 uppercase">Ventas</span>
                      </div>
                      <div className="w-1/6 text-right">
                        <Badge
                          variant="outline"
                          className={`font-bold ${
                            source.tasa > 10 ? "bg-green-50 text-green-700 border-green-200" : "bg-slate-50 text-slate-600"
                          }`}
                        >
                          {source.tasa}%
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* 4. EMBUDO */}
            <Card className="shadow-md lg:col-span-1 bg-slate-50/50">
              <CardHeader>
                <CardTitle>Embudo Real</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-2">
                  {metrics.funnelData.map((stage: any, i: number) => (
                    <div key={i} className="relative">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-bold text-slate-600">{stage.name}</span>
                        <span className="font-black">{stage.value}</span>
                      </div>
                      <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${(stage.value / (metrics.funnelData[0].value || 1)) * 100}%`, backgroundColor: stage.fill }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-xl space-y-2">
                  <div className="flex items-center gap-2 text-yellow-700 font-bold text-sm">
                    <Lightbulb className="h-4 w-4" /> Diagnóstico:
                  </div>
                  <ul className="text-xs text-yellow-800 space-y-2 pl-4 list-disc">
                    <li>
                      <b>{agent === "global" ? "Equipo" : agent}:</b> Tiene {metrics.inventory.activeLeads} leads activos.
                    </li>
                    <li>
                      Strike Rate de <b>{metrics.killerMetrics.strikeRate}%</b>.
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 5. MOTIVOS */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <XCircle className="h-5 w-5 text-red-500" /> Motivos de Pérdida
                </CardTitle>
                <CardDescription>¿Por qué no compran? (Real si cargás loss_reason)</CardDescription>
              </CardHeader>
              <CardContent className="h-[250px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.lossReasons} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
                    <XAxis type="number" hide />
                    <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 11, fontWeight: "bold" }} />
                    <Tooltip cursor={{ fill: "transparent" }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={25}>
                      {metrics.lossReasons.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                      <LabelList dataKey="value" position="right" style={{ fontSize: "12px", fontWeight: "bold", fill: "#64748b" }} />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* 6. HEATMAP */}
            <Card className="shadow-md">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Flame className="h-5 w-5 text-orange-500" /> Horarios de Oro
                </CardTitle>
                <CardDescription>Mejor hora para mover tarjetas (cambios de estado reales).</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-8 text-xs text-center font-bold text-slate-400 mb-2">
                  <span></span>
                  <span>09</span>
                  <span>10</span>
                  <span>11</span>
                  <span>12</span>
                  <span>15</span>
                  <span>16</span>
                  <span>17</span>
                </div>
                <div className="space-y-1">
                  {heatMap.map((d: any, i: number) => (
                    <div key={i} className="grid grid-cols-8 gap-1 items-center">
                      <span className="text-[10px] font-bold text-slate-600 uppercase text-right pr-2">{d.day}</span>
                      {HEAT_KEYS.map((h) => (
                        <div key={h} className={`h-6 rounded flex items-center justify-center ${getHeatColor(d[h])}`}>
                          {d[h]}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* --- ZONA PRO --- */}
          <div className="mt-8 pt-8 border-t-2 border-slate-100">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <BrainCircuit className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-800">Coach Virtual: Análisis de Perfil</h3>
                <p className="text-sm text-slate-500">Inteligencia de hábitos y habilidades (basado en gestión real).</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. RADAR CHART */}
              <Card className="shadow-lg border-indigo-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-center uppercase text-slate-500">Perfil de Habilidades</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart cx="50%" cy="50%" outerRadius="70%" data={metrics.advanced.radar}>
                      <PolarGrid gridType="polygon" />
                      <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fontWeight: "bold" }} />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
                      <Radar name={agent} dataKey="A" stroke="#4f46e5" fill="#6366f1" fillOpacity={0.5} />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 2. RITMO DIARIO */}
              <Card className="shadow-lg border-indigo-100">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold text-center uppercase text-slate-500">Consistencia Diaria</CardTitle>
                </CardHeader>
                <CardContent className="h-[250px] relative">
                  <div className="absolute bottom-6 left-0 right-0 h-10 bg-red-50/50 border-t border-red-100 z-0 flex items-center justify-center">
                    <span className="text-[9px] text-red-300 font-bold uppercase tracking-widest">Zona de Peligro (Baja Gestión)</span>
                  </div>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={metrics.advanced.daily}>
                      <defs>
                        <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Tooltip contentStyle={{ fontSize: "12px", borderRadius: "8px" }} itemStyle={{ color: "#2563eb", fontWeight: "bold" }} labelStyle={{ display: "none" }} />
                      <Area type="monotone" dataKey="value" stroke="#2563eb" fillOpacity={1} fill="url(#colorValue)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              {/* 3. DIAGNÓSTICO */}
              <Card className="bg-slate-900 text-white shadow-xl flex flex-col justify-center border-none">
                <CardHeader>
                  <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center mb-4">
                    <Target className="h-6 w-6 text-green-400" />
                  </div>
                  <CardTitle className="text-xl">Diagnóstico</CardTitle>
                  <CardDescription className="text-slate-400">Basado en datos reales.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="p-4 bg-white/10 rounded-xl border border-white/10">
                    <p className="text-sm font-medium leading-relaxed">"{metrics.advanced.coach}"</p>
                  </div>
                  <div className="mt-6 flex gap-2">
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      Salud
                    </Badge>
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      Ventas
                    </Badge>
                    <Badge variant="outline" className="text-xs border-slate-600 text-slate-400">
                      Gestión
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* --- ANTI-SERRUCHO --- */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 mt-4">
              <h3 className="text-lg font-black text-slate-700 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-indigo-600" /> Análisis de Constancia
              </h3>
              <Badge variant="outline" className="border-indigo-200 text-indigo-600 bg-indigo-50">
                Evitar Serrucho
              </Badge>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* 1. PACING */}
              <Card className="border-t-4 border-t-slate-800 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase text-slate-500 flex justify-between">
                    Proyección Mes{" "}
                    <span className={metrics.pacing.status === "ontrack" ? "text-green-600" : "text-red-500"}>
                      {metrics.pacing.status === "ontrack" ? "EN CAMINO" : "ATRASADO"}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-600">
                      <span>Tiempo Transcurrido</span>
                      <span>{metrics.pacing.time}%</span>
                    </div>
                    <Progress value={metrics.pacing.time} className="h-2 bg-slate-100" />
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-bold text-slate-800">
                      <span>Cumplimiento Objetivo</span>
                      <span className="text-blue-600">{metrics.pacing.goal}%</span>
                    </div>
                    <Progress value={metrics.pacing.goal} className="h-3 bg-blue-100" />
                  </div>
                </CardContent>
              </Card>

              {/* 2. STOCK PODRIDO */}
              <Card className="border-t-4 border-t-red-500 shadow-md">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-bold uppercase text-slate-500 flex justify-between">
                    Stock Podrido (&gt;48hs) <AlertTriangle className="h-4 w-4 text-red-500" />
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-4xl font-black text-slate-800">{metrics.stagnation.count}</div>
                    <div className={`text-right ${metrics.stagnation.status === "critical" ? "text-red-600 animate-pulse" : "text-green-600"}`}>
                      <span className="block text-xl font-bold">{metrics.stagnation.percent}%</span>
                      <span className="text-[10px] uppercase font-bold">de la cartera</span>
                    </div>
                  </div>
                  <div className="mt-4 bg-red-50 p-2 rounded text-xs text-red-700 border border-red-100">
                    {metrics.stagnation.status === "critical"
                      ? "⚠️ ALERTA: Muchos leads abandonados. Hay que limpiar o reasignar."
                      : "✅ Base sana. Buen ritmo de gestión."}
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* --- AUDITORÍA --- */}
        <TabsContent value="audit" className="animate-in fade-in-50">
          <Card className="border-t-4 border-t-indigo-600 shadow-xl mb-6">
            <CardHeader className="pb-4 border-b bg-slate-50/50">
              <CardTitle className="text-lg font-bold uppercase text-slate-700 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-600" /> Mesa de Entradas: {agent === "global" ? "Global" : agent}
              </CardTitle>
              <CardDescription>Visualizando legajos del filtro seleccionado.</CardDescription>
            </CardHeader>
            <CardContent className="pt-8 pb-8">
              <div className="flex flex-wrap items-center justify-center gap-6">
                {metrics.auditSteps.map((step: any, i: number) => (
                  <div key={i} className="flex items-center group relative">
                    <div
                      className={`flex flex-col items-center justify-center w-32 h-28 rounded-2xl border-2 transition-all transform hover:scale-105 cursor-default ${step.bg} ${step.border}`}
                    >
                      <step.icon className={`h-6 w-6 mb-2 ${step.color} opacity-80`} />
                      <span className={`text-3xl font-black ${step.color}`}>{step.count}</span>
                      <span className={`text-[10px] font-bold mt-1 text-center leading-tight uppercase ${step.color} opacity-80 px-2`}>{step.label}</span>
                    </div>
                    {i < 4 && <ArrowRight className="h-6 w-6 text-slate-300 mx-3 hidden lg:block" />}
                    {i === 4 && <div className="h-20 w-px bg-slate-300 mx-6 hidden lg:block"></div>}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}