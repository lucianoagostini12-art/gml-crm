"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList,
  AreaChart, Area, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts"

import {
  ArrowRight, FileText, Activity, CheckCircle2, AlertOctagon, FolderInput,
  HeartPulse, FileBadge, Layers, Lightbulb, ClipboardList, XCircle, Flame,
  User, Timer, DollarSign, Crosshair, HelpCircle, CalendarDays, Download,
  FileSpreadsheet,
  AlertTriangle, TrendingUp, BrainCircuit, Target, RefreshCw, Zap, Siren,
  ArrowUp, ArrowDown, Users
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// --- TIPOS ---
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
  sold_at?: string | null
  fecha_ingreso?: string | null
  activation_date?: string | null
  fecha_alta?: string | null
}

type StatusEvent = {
  id: number
  lead_id: string
  agent_name?: string | null
  from_status?: string | null
  to_status: string
  changed_at: string
}

type AgentPulse = {
    name: string
    avatar: string
    lastSaleDate: Date | null
    businessDays: number // Días hábiles sin vender
    status: 'green' | 'yellow' | 'red' | 'gray'
}

const AR_TZ = "America/Argentina/Buenos_Aires"

// Horas para el heatmap
const HEAT_HOURS = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21] as const
const HEAT_KEYS = ["h09", "h10", "h11", "h12", "h13", "h14", "h15", "h16", "h17", "h18", "h19", "h20", "h21"] as const

const DAY_LABELS = [
  { key: "Lunes", label: "Lun" }, { key: "Martes", label: "Mar" }, { key: "Miérc", label: "Mié" },
  { key: "Jueves", label: "Jue" }, { key: "Viernes", label: "Vie" }, { key: "Sábado", label: "Sáb" }
]

const norm = (v: any) => String(v ?? "").trim().toLowerCase()

// Normalización fuerte para matchear nombres aunque tengan tildes, dobles espacios, etc.
function normKey(v: any) {
  return String(v ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
}

function toISODate(d: Date) {
  return d.toISOString().slice(0, 10)
}

function safeDate(ts?: string | null) {
  const d = ts ? new Date(ts) : null
  return d && !Number.isNaN(d.getTime()) ? d : null
}

// ✅ HELPER: FECHA DE VENTA (Prioridad: Fecha Ingreso > Sold At > Created At)
// Esto asegura que tome la fecha real de la venta, no la última edición.
const salesDateOf = (l: any) => l.fecha_ingreso || l.sold_at || l.activation_date || l.fecha_alta || l.created_at

// ✅ HELPER: DÍAS HÁBILES (Sin Sábados ni Domingos)
function getBusinessDaysDiff(startDate: Date, endDate: Date) {
    if (startDate >= endDate) return 0;

    let count = 0;
    const curDate = new Date(startDate.getTime());
    curDate.setHours(0,0,0,0);
    const end = new Date(endDate.getTime());
    end.setHours(0,0,0,0);

    while (curDate < end) {
        curDate.setDate(curDate.getDate() + 1);
        const dayOfWeek = curDate.getDay();
        if (dayOfWeek !== 0 && dayOfWeek !== 6) count++; // 0 = Domingo, 6 = Sábado
    }
    return count;
}


// ✅ Helper AR: normalizamos fechas a "día Argentina" para que el semáforo no mienta por timezone del servidor/browser.
function getARDateParts(d: Date) {
  const parts = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d)
  const get = (t: string) => parts.find(p => p.type === t)?.value || "00"
  return { y: Number(get("year")), m: Number(get("month")), d: Number(get("day")) }
}
function toARMidnightUTC(d: Date) {
  const { y, m, d: da } = getARDateParts(d)
  return new Date(Date.UTC(y, m - 1, da, 0, 0, 0))
}
function getBusinessDaysDiffAR(startDate: Date, endDate: Date) {
  const s = toARMidnightUTC(startDate)
  const e = toARMidnightUTC(endDate)
  if (s >= e) return 0
  let count = 0
  const cur = new Date(s.getTime())
  while (cur < e) {
    cur.setUTCDate(cur.getUTCDate() + 1)
    const dow = cur.getUTCDay()
    if (dow !== 0 && dow !== 6) count++
  }
  return count
}


function getARWeekdayHour(iso: string): { weekday: string; hour: number } {
  const weekday = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, weekday: "long" }).format(new Date(iso))
  const hourStr = new Intl.DateTimeFormat("es-AR", { timeZone: AR_TZ, hour: "2-digit", hour12: false }).format(new Date(iso))
  const hour = Number(hourStr)
  return { weekday: weekday.toLowerCase(), hour }
}

function mapWeekdayToLabel(weekdayLower: string) {
  // Debe matchear con DAY_LABELS.label (Lun/Mar/Mié/Jue/Vie/Sáb)
  if (weekdayLower.includes("lunes")) return "Lun"
  if (weekdayLower.includes("martes")) return "Mar"
  if (weekdayLower.includes("miércoles") || weekdayLower.includes("miercoles")) return "Mié"
  if (weekdayLower.includes("jueves")) return "Jue"
  if (weekdayLower.includes("viernes")) return "Vie"
  if (weekdayLower.includes("sábado") || weekdayLower.includes("sabado")) return "Sáb"
  return null
}

function speedStatus(avgMin: number) {
  if (avgMin === 0) return "normal"
  if (avgMin <= 15) return "optimo"
  if (avgMin > 60) return "critico"
  return "normal"
}

const CLOSED_STATUSES = new Set(["vendido", "perdido", "cumplidas", "rechazado", "rechazados"])
// ✅ ESTADOS QUE CUENTAN COMO VENTA (Comercial + Admin)
const SALE_STATUSES = ["ingresado", "precarga", "medicas", "legajo", "demoras", "cumplidas", "rechazado"]

// ✅ PASS unificado (igual que AdminConteo)
const isPass = (l: any) => {
  const t = String(l?.type ?? "").toLowerCase()
  const ss = String(l?.sub_state ?? l?.substate ?? "").toLowerCase()
  const so = String(l?.source ?? l?.origen ?? "").toLowerCase()
  return t === "pass" || ss === "auditoria_pass" || so === "pass"
}

// ✅ Capitas: AMPF cuenta 1 por registro; resto suma capitas (fallback 1)
const pointsByCapitas = (items: any[]) => {
  return (items || []).reduce((acc: number, l: any) => {
    const prep = ((l?.prepaga || l?.quoted_prepaga || "") + "").trim().toLowerCase()
    if (prep === "ampf") return acc + 1
    const c = Number(l?.capitas)
    return acc + (Number.isFinite(c) && c > 0 ? c : 1)
  }, 0)
}

// --- REGLAS DE CÁLCULO (Espejo OpsBilling - Neto) ---
const INITIAL_CALC_RULES = {
  taxRate: 0.105,
  prevencionVat: 0.21,
  doctoRed: { base: 1.8, specialPlan: "500" },
  ampf: { multiplier: 2.0 },
  prevencion: { A1: 0.9, "A1 CP": 0.9, A2: 1.3, "A2 CP": 1.3, A4: 1.5, A5: 1.5, default: 1.3 },
  generalGroup: { multiplier: 1.8 },
}

// ✅ Neto oficial: billing_price_override manda; si no, cálculo espejo OpsBilling
const calculateBillingNeto = (op: any) => {
  let val = 0
  if (op?.billing_price_override !== null && op?.billing_price_override !== undefined) {
    val = parseFloat(op.billing_price_override.toString())
    return Number(val.toFixed(2))
  }

  const full = parseFloat(op.full_price || op.price || "0")
  const aportes = parseFloat(op.aportes || "0")
  const desc = parseFloat(op.descuento || "0")
  const p = (op.prepaga || op.quoted_prepaga || "").toLowerCase()
  const plan = op.plan || op.quoted_plan || ""
  const condicionLaboral = op.labor_condition || op.condicionLaboral || ""

  if (p.includes("preven")) {
    const base = full - desc
    // @ts-ignore
    const rate = INITIAL_CALC_RULES.prevencion[plan] || INITIAL_CALC_RULES.prevencion.default
    val = base * rate
  } else if (p.includes("ampf")) {
    val = full * INITIAL_CALC_RULES.ampf.multiplier
  } else {
    let base = full * (1 - INITIAL_CALC_RULES.taxRate)
    if (p.includes("doctored") && String(plan).includes("500") && String(condicionLaboral) === "empleado") {
      base = aportes * (1 - INITIAL_CALC_RULES.taxRate)
    }
    val = base * INITIAL_CALC_RULES.generalGroup.multiplier
  }

  return Number(val.toFixed(2))
}


export function AdminMetrics() {
  const supabase = createClient()

  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)

  const [dateStart, setDateStart] = useState<string>(toISODate(firstDay))
  const [dateEnd, setDateEnd] = useState<string>(toISODate(today))
  const [agent, setAgent] = useState("global")
  
  const [agentsList, setAgentsList] = useState<any[]>([])
  const [metrics, setMetrics] = useState<any>(null)
  const [teamPulse, setTeamPulse] = useState<AgentPulse[]>([])
  
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const [exportLeads, setExportLeads] = useState<any[]>([])


  // --- DESCARGA DE REPORTES (misma linea OpsMetrics) ---
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadMode, setDownloadMode] = useState<"current" | "global" | "custom">("current")
  const now = new Date()
  const [downloadMonth, setDownloadMonth] = useState(String(now.getMonth() + 1))
  const [downloadYear, setDownloadYear] = useState(String(now.getFullYear()))

  // 1. CARGA DE AGENTES (Vendedores y Gestores)
  useEffect(() => {
    const loadAgents = async () => {
        const { data } = await supabase.from('profiles').select('*')
        if (data) {
            const sellers = data.filter((p: any) => {
                const r = (p.role || "").toLowerCase()
                return r === 'seller' || r === 'gestor' || r === 'vendedor'
            })
            
            setAgentsList(sellers.map(p => ({
                name: p.full_name || p.email,
                avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}`
            })).sort((a: any, b: any) => a.name.localeCompare(b.name)))
        }
    }
    loadAgents()
  }, [])

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
    setDateStart(toISODate(start))
    setDateEnd(toISODate(end))
    setIsCalendarOpen(false)
  }

  const heatMapBase = useMemo(() => {
    return DAY_LABELS.map((d) => ({
      day: d.label,
      h09: 0, h10: 0, h11: 0, h12: 0, h13: 0, h14: 0, h15: 0, h16: 0, h17: 0, h18: 0, h19: 0, h20: 0, h21: 0
    }))
  }, [])

  const getHeatColor = (value: number) => {
    if (value >= 8) return "bg-red-500 text-white font-bold"
    if (value >= 5) return "bg-orange-400 text-white"
    if (value >= 3) return "bg-yellow-300 text-yellow-900"
    return "bg-slate-100 text-slate-400"
  }

  const InfoTooltip = ({ text }: { text: string }) => (
    <Popover>
        <PopoverTrigger><HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help hover:text-blue-500 transition-colors ml-1" /></PopoverTrigger>
        <PopoverContent className="text-xs bg-slate-800 text-white border-none p-3 w-64 shadow-xl z-50"><p className="leading-relaxed">{text}</p></PopoverContent>
    </Popover>
  )

  // --- EXPORT CSV (misma linea OpsMetrics) ---
  const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return

    const headers = Object.keys(data[0] || {})
    const rows = data.map((row: any) =>
      headers.map((h) => `"${String(row?.[h] ?? "").replace(/"/g, '""')}"`).join(",")
    )

    const csv = [headers.join(","), ...rows].join("\n")
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `${filename}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }


  const fetchData = async () => {
    setLoading(true)

    // A. FECHAS (Rango seleccionado)
    const currentStart = new Date(`${dateStart}T00:00:00-03:00`)
    const currentEnd = new Date(`${dateEnd}T23:59:59-03:00`)
    const diffTime = Math.abs(currentEnd.getTime() - currentStart.getTime());
    const prevEnd = new Date(currentStart.getTime() - 86400000); 
    const prevStart = new Date(prevEnd.getTime() - diffTime);

    // ✅ Rango en formato YYYY-MM-DD (para columnas DATE como fecha_ingreso)
    const endExclusive = new Date(`${dateEnd}T00:00:00-03:00`)
    endExclusive.setDate(endExclusive.getDate() + 1)
    const fechaIngresoStartStr = dateStart
    const fechaIngresoEndExclusiveStr = toISODate(endExclusive)

    const prevStartStr = toISODate(prevStart)
    const prevEndMid = new Date(`${toISODate(prevEnd)}T00:00:00-03:00`)
    prevEndMid.setDate(prevEndMid.getDate() + 1)
    const prevEndExclusiveStr = toISODate(prevEndMid)

    // ✅ Periodos billing (YYYY-MM) cubiertos por el rango (puede cruzar meses)
    const periodsBetween = (start: Date, end: Date) => {
      const out: string[] = []
      const cur = new Date(start.getFullYear(), start.getMonth(), 1)
      const last = new Date(end.getFullYear(), end.getMonth(), 1)
      while (cur.getTime() <= last.getTime()) {
        out.push(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, '0')}`)
        cur.setMonth(cur.getMonth() + 1)
      }
      return out
    }
    const targetPeriods = periodsBetween(currentStart, currentEnd)
    const prevPeriods = periodsBetween(prevStart, prevEnd)

    // B. QUERIES
    let leadsQuery = supabase.from("leads").select("*").gte("created_at", currentStart.toISOString()).lte("created_at", currentEnd.toISOString())
    let prevLeadsQuery = supabase.from("leads").select("status, price, quoted_price").gte("created_at", prevStart.toISOString()).lte("created_at", prevEnd.toISOString())
    let historyQuery = supabase.from("lead_status_history").select("*").gte("changed_at", currentStart.toISOString()).lte("changed_at", currentEnd.toISOString())

    if (agent !== "global") {
      leadsQuery = leadsQuery.eq("agent_name", agent)
      prevLeadsQuery = prevLeadsQuery.eq("agent_name", agent)
      historyQuery = historyQuery.eq("agent_name", agent)
    }

    const [resLeads, resPrev, resHistory] = await Promise.all([leadsQuery, prevLeadsQuery, historyQuery])

    const leads = (resLeads.data || []) as Lead[]

    setExportLeads(resLeads.data || [])
    const prevLeads = (resPrev.data || []) as any[]
    const events = (resHistory.data || []) as StatusEvent[]


    // ✅ Ventas OPS del mes por fecha_ingreso (CAPITAS + PASS/ALTAS)
    let salesOps: any[] = []
    try {
      let salesQ = supabase
        .from("leads")
        .select("id, agent_name, status, fecha_ingreso, prepaga, quoted_prepaga, capitas, type, sub_state, source")
        .in("status", SALE_STATUSES)
        .not("fecha_ingreso", "is", null)
                .gte("fecha_ingreso", fechaIngresoStartStr)
        .lt("fecha_ingreso", fechaIngresoEndExclusiveStr)

      if (agent !== "global") salesQ = salesQ.eq("agent_name", agent)

      const { data: salesData } = await salesQ
      if (salesData) salesOps = salesData
    } catch {}

    // ✅ Liquidación oficial del mes (OpsBilling) para Ticket Promedio por Cápita
    let billingOps: any[] = []
    let prevBillingOps: any[] = []
    try {
      let billQ = supabase
        .from("leads")
        .select("id, agent_name, status, billing_approved, billing_period, billing_price_override, full_price, price, aportes, descuento, prepaga, quoted_prepaga, plan, quoted_plan, labor_condition, capitas, type, sub_state, source")
        .eq("status", "cumplidas")
        .eq("billing_approved", true)
                .in("billing_period", targetPeriods)

      if (agent !== "global") billQ = billQ.eq("agent_name", agent)

      const { data: billData } = await billQ
      if (billData) billingOps = billData
    } catch {}

    try {
      let prevBillQ = supabase
        .from("leads")
        .select("id, agent_name, status, billing_approved, billing_period, billing_price_override, full_price, price, aportes, descuento, prepaga, quoted_prepaga, plan, quoted_plan, labor_condition, capitas, type, sub_state, source")
        .eq("status", "cumplidas")
        .eq("billing_approved", true)
                .in("billing_period", prevPeriods)

      if (agent !== "global") prevBillQ = prevBillQ.eq("agent_name", agent)

      const { data: prevBillData } = await prevBillQ
      if (prevBillData) prevBillingOps = prevBillData
    } catch {}


    // --- 🚦 CÁLCULO DE SEMÁFORO (TEAM PULSE) ---
// La forma robusta es NO inferir desde leads (porque el lead sigue moviéndose),
// sino leer un evento persistente de ventas (sales_events) que se registra cuando entra a INGRESADO (OPS).
let lastSaleByAgent = new Map<string, Date>()

try {
  const { data: seData, error: seErr } = await supabase
    .from("sales_events")
    .select("agent_name, sale_at")
    .eq("event_type", "sale_ingresado")
    .order("sale_at", { ascending: false })
    .limit(5000)

  if (!seErr && seData) {
    // Tomamos el MAX por agente (no dependemos del orden del SELECT)
    const tmp = new Map<string, Date>()
    for (const row of seData as any[]) {
      const name = String(row?.agent_name || "").trim()
      const d = safeDate(row?.sale_at || null)
      if (!name || !d) continue
      const key = normKey(name)
      const prev = tmp.get(key)
      if (!prev || d.getTime() > prev.getTime()) tmp.set(key, d)
    }
    lastSaleByAgent = tmp
  } else {
    // Fallback (por si todavía no creaste la tabla)
    const { data: allSales } = await supabase
      .from("leads")
      .select("agent_name, status, sold_at, fecha_ingreso, activation_date, fecha_alta, created_at")
      .in("status", SALE_STATUSES)

    for (const s of (allSales || []) as any[]) {
      const name = String(s?.agent_name || "").trim()
      const d = safeDate(salesDateOf(s) || null)
      if (!name || !d) continue
      const key = normKey(name)
      const prev = lastSaleByAgent.get(key)
      if (!prev || d.getTime() > prev.getTime()) lastSaleByAgent.set(key, d)
    }
  }
} catch {
  // Fallback seguro
  const { data: allSales } = await supabase
    .from("leads")
    .select("agent_name, status, sold_at, fecha_ingreso, activation_date, fecha_alta, created_at")
    .in("status", SALE_STATUSES)

  for (const s of (allSales || []) as any[]) {
    const name = String(s?.agent_name || "").trim()
    const d = safeDate(salesDateOf(s) || null)
    if (!name || !d) continue
    const key = normKey(name)
    const prev = lastSaleByAgent.get(key)
    if (!prev || d.getTime() > prev.getTime()) lastSaleByAgent.set(key, d)
  }
}

if (agentsList.length > 0) {
  const pulseMap: AgentPulse[] = agentsList.map(a => {
    const lastDate = lastSaleByAgent.get(normKey(a.name)) || null

    let businessDays = 999
    if (lastDate) {
      const now = new Date()
      businessDays = getBusinessDaysDiffAR(lastDate, now)
    }

    let status: AgentPulse['status'] = 'gray'
    if (businessDays <= 1) status = 'green'      // Hoy o Ayer (Hábil)
    else if (businessDays === 2) status = 'yellow' // 2 Días hábiles
    else if (businessDays >= 3) status = 'red'     // 3 o más
    if (businessDays === 999) status = 'gray'

    return { name: a.name, avatar: a.avatar, lastSaleDate: lastDate, businessDays, status }
  })
  setTeamPulse(pulseMap.sort((a,b) => a.businessDays - b.businessDays))
}

    // --- CÁLCULOS MÉTRICAS ---
    const counts: Record<string, number> = { 
        nuevo: 0, contactado: 0, cotizacion: 0, ingresado: 0, 
        precarga: 0, medicas: 0, legajo: 0, demoras: 0, 
        cumplidas: 0, rechazado: 0, documentacion: 0, vendido: 0 
    }
    let totalRevenue = 0

    leads.forEach((l) => {
      let s = norm(l.status)
      if(s.includes('doc')) s = 'documentacion'
      if(s.includes('cotiz')) s = 'cotizacion'
      // ✅ "Sin trabajar" cuenta como NUEVO
      if (s.includes('sin trabajar') || s.includes('sin_trabajar') || s.includes('sintrabajar')) s = 'nuevo'

      if (counts[s] !== undefined) counts[s]++
      else if (SALE_STATUSES.includes(s)) counts['ingresado']++ 
    })

    const totalNeto = billingOps.reduce((acc: number, op: any) => acc + calculateBillingNeto(op), 0)
    const billingCapitas = pointsByCapitas(billingOps)
    const avgTicketPerCapita = billingCapitas > 0 ? totalNeto / billingCapitas : 0

    const prevTotalNeto = prevBillingOps.reduce((acc: number, op: any) => acc + calculateBillingNeto(op), 0)
    const prevBillingCapitas = pointsByCapitas(prevBillingOps)
    const prevAvgTicketPerCapita = prevBillingCapitas > 0 ? prevTotalNeto / prevBillingCapitas : 0

    // Facturación (card): Ticket promedio por cápita (liquidación oficial)
    totalRevenue = avgTicketPerCapita

    const totalLeads = leads.length
    const activeLeads = counts.contactado + counts.cotizacion + counts.documentacion
    const salesCapitasTotal = pointsByCapitas(salesOps)
    const salesCapitasPass = pointsByCapitas(salesOps.filter((l:any) => isPass(l)))
    const salesCapitasAltas = Math.max(0, salesCapitasTotal - salesCapitasPass)

    const salesCount = salesCapitasTotal

    // ✅ Ventas por prepaga (ALTAS ONLY) + Cumplidas oficiales (ALTAS ONLY) + % Cumplimiento
// - Ventas: por fecha_ingreso + CAPITAS (excluye PASS)
// - Cumplidas: liquidación oficial (billing_approved + billing_period del rango) + CAPITAS (excluye PASS)
const prepLabel = (v: any) => {
  const raw = String(v ?? "").trim()
  if (!raw) return "Sin prepaga"
  const low = raw.toLowerCase()
  if (low.includes("preven")) return "Prevención"
  if (low.includes("docto")) return "DoctoRed"
  if (low.includes("avalian")) return "Avalian"
  if (low.includes("swiss")) return "Swiss"
  if (low.includes("galeno")) return "Galeno"
  if (low.includes("ampf")) return "AMPF"
  // Título simple
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

const prepBadgeClass = (p: any) => {
  const name = String(p ?? "")
  if (name.includes("Prevención")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
  if (name.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
  if (name.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
  if (name.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
  if (name.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
  if (name.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"
  return "bg-slate-50 dark:bg-[#3A3B3C] border-slate-200 text-slate-700"
}

const prepAgg = new Map<string, { ventas: number; cumplidas: number }>()
// Ventas (ALTAS)
for (const l of salesOps as any[]) {
  if (isPass(l)) continue // ✅ SOLO ALTAS
  const name = prepLabel(l?.prepaga || l?.quoted_prepaga)
  if (!prepAgg.has(name)) prepAgg.set(name, { ventas: 0, cumplidas: 0 })
  const pts = pointsByCapitas([l])
  prepAgg.get(name)!.ventas += pts
}
// Cumplidas oficiales (ALTAS)
for (const l of billingOps as any[]) {
  if (isPass(l)) continue // ✅ SOLO ALTAS
  const name = prepLabel(l?.prepaga || l?.quoted_prepaga)
  if (!prepAgg.has(name)) prepAgg.set(name, { ventas: 0, cumplidas: 0 })
  const pts = pointsByCapitas([l])
  prepAgg.get(name)!.cumplidas += pts
}

const salesByPrepaga = Array.from(prepAgg.entries())
  .map(([name, v]) => {
    const pct = v.ventas > 0 ? Math.round((v.cumplidas / v.ventas) * 100) : 0
    return { name, ventas: v.ventas, cumplidas: v.cumplidas, pct, className: prepBadgeClass(name) }
  })
  .sort((a, b) => b.ventas - a.ventas)


    let prevSalesCapitasTotal = 0
    try {
      let prevSalesQ = supabase
        .from("leads")
        .select("id, prepaga, quoted_prepaga, capitas, type, sub_state, source")
        .in("status", SALE_STATUSES)
        .not("fecha_ingreso", "is", null)
                .gte("fecha_ingreso", prevStartStr)
        .lt("fecha_ingreso", prevEndExclusiveStr)
      if (agent !== "global") prevSalesQ = prevSalesQ.eq("agent_name", agent)
      const { data: prevSalesData } = await prevSalesQ
      if (prevSalesData) prevSalesCapitasTotal = pointsByCapitas(prevSalesData as any[])
    } catch {}
    const prevSalesCount = prevSalesCapitasTotal
    const prevRevenue = prevAvgTicketPerCapita

    const getTrend = (curr: number, prev: number) => {
        if (prev === 0) return { val: 100, dir: 'up' }
        const diff = ((curr - prev) / prev) * 100
        return { val: Math.abs(Math.round(diff)), dir: diff >= 0 ? 'up' : 'down' }
    }

    const salesTrend = getTrend(salesCount, prevSalesCount)
    const revTrend = getTrend(totalRevenue, prevRevenue)

    const rpl = totalLeads > 0 ? Math.round(totalNeto / totalLeads).toString() : "0"
    const strikeRate = totalLeads > 0 ? ((salesOps.length / totalLeads) * 100).toFixed(1) : "0.0"

    // --- VELOCIDAD ---
    const firstEventByLead = new Map<string, string>()
    for (const ev of events) {
      if (!firstEventByLead.has(ev.lead_id)) firstEventByLead.set(ev.lead_id, ev.changed_at)
    }

    let speedSum = 0; let speedSample = 0
    leads.forEach((l) => {
      const created = safeDate((l as any).assigned_at) || safeDate((l as any).picked_at) || safeDate(l.created_at)
      if (!created) return
      const fc = safeDate(l.first_contact_at) || safeDate(firstEventByLead.get(l.id) || null)
      if (!fc) return
      const diffMin = Math.max(0, Math.round((fc.getTime() - created.getTime()) / 60000))
      speedSum += diffMin; speedSample++
    })
    const speedValue = speedSample > 0 ? Math.round(speedSum / speedSample) : 0
    const speedSt = speedStatus(speedValue)

    // --- STOCK PODRIDO ---
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

    // --- HEATMAP ---
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

    // --- DAILY ---
    const dailyBuckets = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(currentEnd)
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

    // --- RADAR & COACH ---
    const performanceFactor = salesCount > 5 ? 1 : 0.5
    const insistenciaScore = Math.min(100, Math.round((events.length / (totalLeads || 1)) * 20))
    const radarData = [
      { subject: "Velocidad", A: speedValue === 0 ? 0 : Math.max(0, Math.min(100, Math.round(100 - (speedValue / 60) * 100))), fullMark: 100 },
      { subject: "Cierre", A: Math.min(100, Number(strikeRate) * 2), fullMark: 100 },
      { subject: "Insistencia", A: Math.round(insistenciaScore * performanceFactor), fullMark: 100 },
      { subject: "Ticket", A: totalRevenue > 500000 ? 90 : totalRevenue > 0 ? 60 : 0, fullMark: 100 },
      { subject: "Volumen", A: Math.min(100, totalLeads / 2), fullMark: 100 },
    ]
    let coachAdvice = "Ritmo constante. Seguir monitoreando métricas de cierre."
    if (Number(strikeRate) > 15) coachAdvice = "💎 EXCELENTE CIERRE: El equipo está convirtiendo muy bien. Priorizar calidad sobre cantidad."
    if (stagnantPercent > 30) coachAdvice = "⚠️ ALERTA STOCK: Muchos leads dormidos (>48hs). Recomendación: Día de limpieza de base."
    if (totalLeads > 0 && salesCount === 0) coachAdvice = "📉 FOCO: Hay leads pero no hay cierres. Revisar guión, calidad de base y seguimiento."

    const funnelData = [
      { name: "Total Datos", value: totalLeads, fill: "#94a3b8" },
      { name: "Contactados", value: counts.contactado + counts.cotizacion + salesCount, fill: "#3b82f6" },
      { name: "Cotizados", value: counts.cotizacion + salesCount, fill: "#8b5cf6" },
      { name: "Cierres", value: salesCount, fill: "#10b981" },
    ]

// ✅ Auditoría (Mesa de Entradas) debe reaccionar al calendario:
// usamos el mismo criterio del tablero (OPS por fecha_ingreso) y NO created_at.
const auditCounts: Record<string, number> = {
  ingresado: 0,
  precarga: 0,
  medicas: 0,
  legajo: 0,
  demoras: 0,
  cumplidas: 0,
  rechazado: 0,
}
;(salesOps || []).forEach((l: any) => {
  let s = norm(l?.status)
  if (!s) return
  if (s.includes("rechaz")) s = "rechazado"
  if (s.includes("cumpl")) s = "cumplidas"
  if ((auditCounts as any)[s] !== undefined) (auditCounts as any)[s] += 1
})

    const auditSteps = [
      { label: "INGRESADO", count: auditCounts.ingresado, icon: FolderInput, color: "text-slate-600", bg: "bg-slate-100", border: "border-slate-200" },
      { label: "PRECARGA", count: auditCounts.precarga, icon: FileText, color: "text-blue-600", bg: "bg-blue-50", border: "border-blue-200" },
      { label: "MÉDICAS", count: auditCounts.medicas, icon: HeartPulse, color: "text-purple-600", bg: "bg-purple-50", border: "border-purple-200" },
      { label: "LEGAJO", count: auditCounts.legajo, icon: FileBadge, color: "text-yellow-600", bg: "bg-yellow-50", border: "border-yellow-200" },
      { label: "DEMORAS", count: auditCounts.demoras, icon: AlertTriangle, color: "text-indigo-600", bg: "bg-indigo-50", border: "border-indigo-200" },
      { label: "CUMPLIDAS", count: auditCounts.cumplidas, icon: CheckCircle2, color: "text-white", bg: "bg-green-500 shadow-md transform scale-105", border: "border-green-600" },
      { label: "RECHAZADOS", count: auditCounts.rechazado, icon: AlertOctagon, color: "text-white", bg: "bg-red-500 shadow-md", border: "border-red-600" },
    ]

    const sourceAgg = new Map<string, { datos: number; ventas: number }>()
    leads.forEach((l) => {
      const src = String(l.source ?? "Desconocido").trim()
      if (!sourceAgg.has(src)) sourceAgg.set(src, { datos: 0, ventas: 0 })
      sourceAgg.get(src)!.datos += 1
      if (SALE_STATUSES.includes(norm(l.status))) sourceAgg.get(src)!.ventas += 1
    })
    const conversionBySource = Array.from(sourceAgg.entries()).sort((a, b) => b[1].datos - a[1].datos).slice(0, 8).map(([name, v], idx) => {
      const tasa = v.datos > 0 ? Math.round((v.ventas / v.datos) * 100) : 0
      const palette = ["#f59e0b", "#8b5cf6", "#3b82f6", "#10b981", "#ef4444", "#64748b", "#eab308", "#22c55e"]
      return { name, datos: v.datos, ventas: v.ventas, tasa, color: palette[idx % palette.length] }
    })

    const lossAgg = new Map<string, number>()
    leads.forEach((l) => {
      const lr = String(l.loss_reason ?? "").trim(); if (!lr) return; if (!["perdido", "rechazado"].includes(norm(l.status))) return
      lossAgg.set(lr, (lossAgg.get(lr) || 0) + 1)
    })
    const lossReasons = Array.from(lossAgg.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([name, value], idx) => {
      const palette = ["#ef4444", "#f97316", "#eab308", "#64748b", "#8b5cf6", "#3b82f6", "#10b981", "#0ea5e9"]
      return { name, value, fill: palette[idx % palette.length] }
    })

    const monthDays = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()
    const timePct = Math.round((today.getDate() / monthDays) * 100)
    const goal = Math.ceil(salesCount * 1.5) || 10
    const goalPct = goal > 0 ? Math.round((salesCount / goal) * 100) : 0
    const pacingStatus = goalPct >= timePct ? "ontrack" : "behind"

    setMetrics({
      sales: { count: salesCount, pass: salesCapitasPass, altas: salesCapitasAltas, trend: salesTrend },
      salesByPrepaga,
      revenue: { total: totalRevenue, neto: totalNeto, capitas: billingCapitas, trend: revTrend },   
      inventory: { newLeads: counts.nuevo, activeLeads, sales: salesCount, goal },
      killerMetrics: { speed: { value: speedValue, status: speedSt, sample: speedSample }, rpl, strikeRate },
      advanced: { radar: radarData, coach: coachAdvice, daily },
      pacing: { time: timePct, goal: goalPct, status: pacingStatus },
      stagnation: { count: stagnantCount, percent: stagnantPercent, status: stagnantPercent > 20 ? "critical" : "healthy" },
      conversionBySource: conversionBySource.length ? conversionBySource : [{ name: "Sin Datos", datos: 0, ventas: 0, tasa: 0, color: "#94a3b8" }],
      funnelData,
      lossReasons: lossReasons.length ? lossReasons : [{ name: "Sin Datos", value: 0, fill: "#e2e8f0" }],
      auditSteps,
      heatMap,
    })

    setLoading(false)
  }

  // ✅ CORRECCIÓN FINAL: 'agentsList' en dependencias asegura que el semáforo se calcule
  useEffect(() => {
    fetchData()
    const channel = supabase.channel('admin_metrics_realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'lead_status_history' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales_events' }, () => fetchData())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [agent, dateStart, dateEnd, agentsList])

  const handleDownloadReport = async () => {
    let dataToExport: any[] = exportLeads || []
    let filename = `Reporte_AdminMetrics_${dateStart}_al_${dateEnd}_${agent}`

    if (downloadMode === "global") {
      // Global: últimos 90 días (para no explotar el navegador)
      const since = new Date()
      since.setDate(since.getDate() - 90)
      let q = supabase.from("leads").select("*").gte("created_at", since.toISOString())
      if (agent !== "global") q = q.eq("agent_name", agent)
      const { data } = await q
      dataToExport = (data || []) as any[]
      filename = `Reporte_AdminMetrics_Global_${agent}_ultimos_90_dias`
    }

    if (downloadMode === "custom") {
      const m = String(downloadMonth).padStart(2, "0")
      const start = `${downloadYear}-${m}-01`
      const endD = new Date(Number(downloadYear), Number(downloadMonth), 1) // next month
      const end = `${endD.getFullYear()}-${String(endD.getMonth() + 1).padStart(2, "0")}-01`

      let q = supabase.from("leads").select("*")
        .not("fecha_ingreso", "is", null)
        .gte("fecha_ingreso", start)
        .lt("fecha_ingreso", end)
      if (agent !== "global") q = q.eq("agent_name", agent)
      const { data } = await q
      dataToExport = (data || []) as any[]
      filename = `Reporte_AdminMetrics_${downloadYear}_${m}_${agent}`
    }

    exportToCSV(dataToExport, filename)
    setDownloadModalOpen(false)
  }


  if (!metrics) {
    return <div className="flex h-full items-center justify-center"><RefreshCw className="animate-spin mr-2" /> Cargando Tablero...</div>
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-[1600px] mx-auto space-y-8 pb-20">
      
      {/* HEADER & FILTROS */}
      <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-6">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-3">
            <Activity className="h-8 w-8 text-blue-600" /> Tablero de Comando
            {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />}
          </h2>
          <p className="text-slate-500 font-medium">Analítica Comercial y Administrativa Real.</p>
        </div>

        <div className="flex flex-wrap gap-2 bg-white p-2 rounded-xl shadow-sm border items-center">
          <Button
            variant="outline"
            className="h-10 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-bold gap-2 shadow-sm"
            onClick={() => setDownloadModalOpen(true)}
          >
            <Download size={16} /> Descargar Reporte
          </Button>

          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" className="border-0 bg-slate-50 text-slate-700 font-bold hover:bg-slate-100 h-10 w-[240px] justify-start">
                <CalendarDays className="w-4 h-4 mr-2 text-slate-500" />
                {dateStart} <span className="mx-1 text-slate-400">➔</span> {dateEnd}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <div className="flex">
                <div className="flex flex-col gap-1 p-2 border-r bg-slate-50 w-40">
                  <span className="text-[10px] font-bold text-slate-400 uppercase mb-1 px-2">Accesos Rápidos</span>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(0)}>Hoy</Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(1)}>Ayer</Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(7)}>Últimos 7 días</Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset(30)}>Últimos 30 días</Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset("month")}>Este Mes</Button>
                  <Button variant="ghost" className="justify-start text-xs h-8" onClick={() => setPreset("lastMonth")}>Mes Pasado</Button>
                </div>
                <div className="p-4 space-y-4">
                  <div className="grid gap-2">
                    <div className="grid grid-cols-3 items-center gap-4"><Label className="text-xs">Desde</Label><Input type="date" value={dateStart} onChange={(e) => setDateStart(e.target.value)} className="col-span-2 h-8 text-xs"/></div>
                    <div className="grid grid-cols-3 items-center gap-4"><Label className="text-xs">Hasta</Label><Input type="date" value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} className="col-span-2 h-8 text-xs"/></div>
                  </div>
                  <Button className="w-full h-8 text-xs bg-slate-900 text-white" onClick={() => { fetchData(); setIsCalendarOpen(false) }}>Aplicar</Button>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <div className="h-8 w-px bg-slate-200 hidden md:block"></div>

          <Select value={agent} onValueChange={setAgent}>
            <SelectTrigger className={`w-[200px] font-bold border-none h-10 ${agent !== "global" ? "bg-purple-100 text-purple-700 hover:bg-purple-200" : "bg-white text-slate-700 hover:bg-slate-50"}`}>
              <User className={`w-4 h-4 mr-2 ${agent !== "global" ? "text-purple-600" : "text-slate-400"}`} />
              <SelectValue placeholder="Agente" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="global" className="font-bold">🌍 Global (Empresa)</SelectItem>
              {agentsList.map(a => <SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>)}
            </SelectContent>
          </Select>
</div>
      </div>

      {/* --- MODAL DESCARGA (misma linea OpsMetrics) --- */}
      <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5 text-indigo-600" /> Descargar Reporte</DialogTitle>
            <DialogDescription>Exporta un CSV de leads para auditoría y control.</DialogDescription>
          </DialogHeader>

          <Tabs value={downloadMode} onValueChange={(v) => setDownloadMode(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="current">Actual</TabsTrigger>
              <TabsTrigger value="global">Global</TabsTrigger>
              <TabsTrigger value="custom">Mes/Año</TabsTrigger>
            </TabsList>

            <TabsContent value="current" className="mt-4 text-sm text-slate-600">
              Exporta lo que está cargado para el rango actual (<b>{dateStart}</b> a <b>{dateEnd}</b>).
            </TabsContent>

            <TabsContent value="global" className="mt-4 text-sm text-slate-600">
              Exporta últimos <b>90 días</b> (para evitar archivos gigantes).
            </TabsContent>

            <TabsContent value="custom" className="mt-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-bold text-slate-500">Mes</label>
                  <Select value={downloadMonth} onValueChange={setDownloadMonth}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                        <SelectItem key={m} value={String(m)}>{String(m).padStart(2, "0")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500">Año</label>
                  <Select value={downloadYear} onValueChange={setDownloadYear}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
          </Tabs>

          <DialogFooter className="mt-2">
            <Button variant="outline" onClick={() => setDownloadModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleDownloadReport} className="bg-indigo-600 hover:bg-indigo-700">
              <Download className="h-4 w-4 mr-2" /> Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* --- 🚦 SEMÁFORO (TEAM PULSE) --- */}
      {teamPulse.length > 0 && (
          <Card className="border-none shadow-sm bg-white mb-6 animate-in fade-in slide-in-from-top-4 duration-700">
              <CardHeader className="pb-3 border-b border-slate-100">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                      <CardTitle className="text-sm font-black uppercase text-slate-600 flex items-center gap-2">
                          <Users className="h-4 w-4"/> Pulso de Ventas (Tiempo real)
                      </CardTitle>
                      <div className="flex gap-4 text-[10px] font-bold uppercase text-slate-400">
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-green-500 shadow-sm shadow-green-200"></div> Hoy/Ayer (Hábil)</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-yellow-400 shadow-sm shadow-yellow-200"></div> 2 Días</span>
                          <span className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500 shadow-sm shadow-red-200"></div> +3 Días</span>
                      </div>
                  </div>
              </CardHeader>
              <CardContent className="p-4 pt-6">
                  <div className="flex flex-wrap gap-6 justify-center">
                      {teamPulse.map((p, i) => (
                          <div key={i} className="flex flex-col items-center gap-2 group cursor-help relative">
                              {/* Círculo indicador de estado */}
                              <div className={`
                                  relative p-1 rounded-full border-4 transition-all duration-300
                                  ${p.status === 'green' ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.4)] scale-110 z-10' : 
                                    p.status === 'yellow' ? 'border-yellow-400' : 
                                    p.status === 'red' ? 'border-red-500 grayscale-[0.3] hover:grayscale-0' : 'border-slate-200 grayscale opacity-50'}
                              `}>
                                  <Avatar className="h-12 w-12 border-2 border-white bg-slate-100">
                                      <AvatarImage src={p.avatar} />
                                      <AvatarFallback className="font-bold text-slate-400">{p.name[0]}</AvatarFallback>
                                  </Avatar>
                                  
                                  {/* Iconos de estado */}
                                  {p.status === 'green' && (
                                      <div className="absolute -bottom-1 -right-1 bg-green-500 text-white rounded-full p-1 border-2 border-white shadow-sm animate-pulse">
                                          <Zap size={10} fill="currentColor"/>
                                      </div>
                                  )}
                                  {p.status === 'red' && (
                                      <div className="absolute -bottom-1 -right-1 bg-red-500 text-white rounded-full p-1 border-2 border-white shadow-sm">
                                          <Siren size={10} fill="currentColor"/>
                                      </div>
                                  )}
                              </div>
                              
                              <span className="text-[10px] font-bold text-slate-600 max-w-[80px] truncate text-center leading-tight">
                                  {p.name}
                              </span>
                              
                              {/* TOOLTIP FLOTANTE */}
                              <div className="absolute bottom-full mb-3 bg-slate-900 text-white text-[10px] py-1.5 px-3 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none whitespace-nowrap z-50 -translate-y-1 group-hover:translate-y-0">
                                  {p.businessDays === 999 
                                      ? "Sin ventas recientes" 
                                      : p.businessDays === 0 
                                          ? "🔥 ¡Venta HOY!" 
                                          : `Hace ${p.businessDays} días hábiles`
                                  }
                                  <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></div>
                              </div>
                          </div>
                      ))}
                  </div>
              </CardContent>
          </Card>
      )}

      {/* ... RESTO DE COMPONENTES ... */}
      
      <Tabs defaultValue="commercial" className="w-full">
        <TabsList className="grid w-full max-w-[400px] grid-cols-2 h-10 mb-6 bg-slate-100 p-1 rounded-lg">
          <TabsTrigger value="commercial" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-blue-700 shadow-sm rounded-md">📊 Gestión Comercial</TabsTrigger>
          <TabsTrigger value="audit" className="text-xs font-bold data-[state=active]:bg-white data-[state=active]:text-indigo-700 shadow-sm rounded-md">📋 Auditoría ({agent === "global" ? "Global" : agent})</TabsTrigger>
        </TabsList>

        <TabsContent value="commercial" className="space-y-6 animate-in fade-in-50">
          
          {/* 1. METRICAS PRINCIPALES (CON TENDENCIAS) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            
            {/* VENTAS */}
            <Card className="border-0 shadow-lg bg-white relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Target size={60} className="text-blue-600"/></div>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Ventas Cerradas</span>
                        <InfoTooltip text="Total de ventas que llegaron a estados finales (Ingresado, Médicas, Cumplida, etc)." />
                    </div>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black text-slate-800">{metrics.sales.count}</span>
                        {/* ✅ TENDENCIA VENTAS */}
                        <Badge variant="outline" className={`mb-1.5 ${metrics.sales.trend.dir === 'up' ? 'text-green-600 bg-green-50 border-green-200' : 'text-red-600 bg-red-50 border-red-200'}`}>
                            {metrics.sales.trend.dir === 'up' ? <ArrowUp size={10} className="mr-1"/> : <ArrowDown size={10} className="mr-1"/>} 
                            {metrics.sales.trend.val}%
                        </Badge>
                    </div>
                    <p className="text-[10px] text-slate-400 mt-2">Vs. periodo anterior</p>
                </CardContent>
            </Card>

            {/* FACTURACIÓN */}
            <Card className="border-0 shadow-lg bg-slate-900 text-white relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10"><DollarSign size={60} className="text-white"/></div>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">Facturación Est.</span>
                        <InfoTooltip text="Suma del valor (Price o Quoted Price) de todas las ventas cerradas en el período." />
                    </div>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black text-green-400">$ {parseInt(metrics.revenue.total).toLocaleString()}</span>
                        <Badge variant="secondary" className={`mb-1.5 border-0 ${metrics.revenue.trend.dir === 'up' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
                            {metrics.revenue.trend.dir === 'up' ? <ArrowUp size={10} className="mr-1"/> : <ArrowDown size={10} className="mr-1"/>}
                            {metrics.revenue.trend.val}%
                        </Badge>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-2">Vs. periodo anterior</p>
                </CardContent>
            </Card>

            {/* VELOCIDAD */}
            <Card className={`border-0 shadow-lg text-white relative overflow-hidden ${metrics.killerMetrics.speed.status === 'optimo' ? 'bg-blue-600' : metrics.killerMetrics.speed.status === 'normal' ? 'bg-indigo-600' : 'bg-slate-600'}`}>
                <div className="absolute top-0 right-0 p-4 opacity-10"><Timer size={60} className="text-white"/></div>
                <CardContent className="p-6">
                    <div className="flex items-center gap-2 mb-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-blue-200">Velocidad Gestión</span>
                        <InfoTooltip text="Tiempo promedio desde que el lead entra (Nuevo) hasta el primer cambio de estado." />
                    </div>
                    <div className="flex items-end gap-3">
                        <span className="text-4xl font-black">{metrics.killerMetrics.speed.value} min</span>
                        <Badge variant="secondary" className="mb-1.5 bg-white/20 text-white border-0">
                            {metrics.killerMetrics.speed.status === 'optimo' ? '⚡ RAYO' : metrics.killerMetrics.speed.status === 'normal' ? '👍 BIEN' : '🐢 LENTO'}
                        </Badge>
                    </div>
                    <p className="text-[10px] text-blue-200 mt-2">Objetivo: &lt; 20 min</p>
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

          {/* 2.B VENTAS POR PREPAGA */}
          <Card className="shadow-md border-slate-200">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-indigo-600" /> Ventas por Prepaga
              </CardTitle>
              <CardDescription>Conteo por cápitas.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {(metrics.salesByPrepaga || []).length ? (
                  metrics.salesByPrepaga.slice(0, 9).map((p: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-3 rounded-xl border bg-white hover:bg-slate-50 transition-colors">
                      <div className="flex flex-col">
                        <span className="text-xs font-black text-slate-700">{p.name}</span>
                        <span className="text-[10px] text-slate-400">
                          Ventas: <b className="text-slate-600">{p.ventas}</b> • Cumplidas: <b className="text-slate-600">{p.cumplidas}</b> • <b className="text-slate-600">{p.pct}%</b>
                        </span>
                      </div>
                      <Badge variant="outline" className={`font-black ${p.className}`}>{p.ventas}</Badge>
                    </div>
                  ))
                ) : (
                  <div className="text-sm text-slate-500">Sin ventas en el rango seleccionado.</div>
                )}
              </div>
            </CardContent>
          </Card>

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

            {/* 6. HEATMAP (REPARADO: GRILLA FIJA) */}
            <Card className="shadow-md lg:col-span-1 border-slate-200">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base"><Flame className="h-5 w-5 text-orange-500"/> Horarios de Oro (Heatmap)</CardTitle>
                    <CardDescription>Intensidad de gestión real (cambios de estado) por hora y día.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="w-full overflow-x-auto">
                        <div className="min-w-[720px]">
                            {/* Header de horas Fijo */}
                            <div className="grid grid-cols-[40px_repeat(13,1fr)] gap-1 mb-2">
                                <span></span>
                                {HEAT_KEYS.map(k => <span key={k} className="text-[10px] font-bold text-slate-400 text-center">{k.replace('h','')}hs</span>)}
                            </div>
                            {/* Filas de días */}
                            <div className="space-y-1">
                                {metrics.heatMap.map((d:any, i:number) => (
                                    <div key={i} className="grid grid-cols-[40px_repeat(13,1fr)] gap-1 items-center">
                                        <span className="text-[10px] font-bold text-slate-600 uppercase text-right pr-2">{d.day}</span>
                                        {HEAT_KEYS.map(k => (
                                            <div key={k} className={`h-8 rounded-sm flex items-center justify-center text-[10px] transition-all hover:scale-110 cursor-default ${getHeatColor(d[k])}`}>
                                                {d[k] > 0 ? d[k] : ''}
                                            </div>
                                        ))}
                                    </div>
                                ))}
                            </div>
                        </div>
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
                    {i < 6 && <ArrowRight className="h-6 w-6 text-slate-300 mx-3 hidden lg:block" />}
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