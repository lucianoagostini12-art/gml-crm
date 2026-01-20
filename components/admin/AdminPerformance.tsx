"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  Trophy,
  TrendingUp,
  Target,
  DollarSign,
  Users,
  BarChart3,
  Filter,
  Medal,
  Timer,
  CheckCircle2,
} from "lucide-react"
import { Progress } from "@/components/ui/progress"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

// --- TIPOS Y UTILIDADES ---
type PerformanceMetrics = {
  totalLeads: number

  // ✅ Ventas: ALTAS por capitas (AMPF=1) + PASS separado (registros)
  totalSales: number
  salesPass: number

  // ✅ Cumplidas oficiales (liquidación): ALTAS (registros) + PASS separado (registros)
  totalCompleted: number
  completedPass: number

  totalQuotes: number
  quotesPerSale: number
  conversionRate: number // % (Ventas / Datos)
  complianceRate: number // % (Cumplidas / Ventas)
  leadsPerSale: number
  averageTicket: number
  salesVolume: number
  avgDaysToClose: number
}

type WeeklyBreakdown = { w1: number; w2: number; w3: number; w4: number; w5: number }
type WeeklyPassBreakdown = { w1: number; w2: number; w3: number; w4: number; w5: number }

type OriginStat = { source: string; assigned: number; sold: number; conversion: number }

// Limpiar precios
const parsePrice = (price: any): number => {
  if (!price) return 0
  if (typeof price === "number") return price
  const clean = price.toString().replace(/[^0-9]/g, "")
  return parseInt(clean) || 0
}

// ✅ GENERADOR DE AÑOS INTELIGENTE (Eterno)
const getYearOptions = () => {
  const currentYear = new Date().getFullYear()
  return [currentYear, currentYear + 1]
}

// -----------------------------
// ✅ FUENTE ÚNICA DE VERDAD (VENTAS)
// -----------------------------
type SaleKind = "ALTA" | "PASS"

type NormalizedSale = {
  leadId: string
  agentName: string
  source: string
  saleDate: Date // ya corregida fin de semana
  weekIdx: 0 | 1 | 2 | 3 | 4 | 5
  kind: SaleKind
  altasPoints: number // solo ALTA (capitas con AMPF=1)
  passCount: number // solo PASS (=1)
}

const norm = (v: any) => String(v ?? "").trim().toLowerCase()
const OPS_STATUSES = ["ingresado", "precarga", "medicas", "legajo", "demoras", "cumplidas", "rechazado"]

const safeDate = (v: any) => {
  if (!v) return null
  const d = new Date(v)
  return Number.isFinite(d.getTime()) ? d : null
}

// ✅ Parse robusto de fecha_ingreso (prioridad absoluta para Ventas)
// Acepta: 'YYYY-MM-DD' y 'D/M/YYYY' (o 'DD/MM/YYYY'). Devuelve Date a medianoche ARG.
const parseFechaIngreso = (v: any): Date | null => {
  if (!v) return null
  const s = String(v).trim()
  if (!s) return null

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    return safeDate(`${s}T00:00:00-03:00`)
  }

  // D/M/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) {
    const dd = Number(m[1])
    const mm = Number(m[2])
    const yyyy = Number(m[3])
    if (!Number.isFinite(dd) || !Number.isFinite(mm) || !Number.isFinite(yyyy)) return null
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null
    // Date(y, m0, d) usa TZ local del cliente; luego normalizamos hora.
    const d = new Date(yyyy, mm - 1, dd, 0, 0, 0)
    return Number.isFinite(d.getTime()) ? d : null
  }

  // Fallback (solo si viene ya en formato Date/ISO completo)
  return safeDate(s)
}

const shiftWeekendToMonday = (d0: Date) => {
  const d = new Date(d0)
  d.setHours(0, 0, 0, 0)
  const dow = d.getDay() // 0 dom, 6 sab
  if (dow === 6) d.setDate(d.getDate() + 2)
  if (dow === 0) d.setDate(d.getDate() + 1)
  return d
}

const isPass = (l: any) => {
  const t = norm(l?.type)
  const ss = norm(l?.sub_state ?? l?.substate)
  const so = norm(l?.source ?? l?.origen)
  return t === "pass" || ss === "auditoria_pass" || so === "pass"
}

// Ventas por CAPITAS (AMPF=1, resto capitas fallback 1)
const altasPointsOfLead = (l: any) => {
  const prep = norm(l?.prepaga ?? l?.quoted_prepaga)
  const plan = norm(l?.plan ?? l?.quoted_plan)
  if (prep.includes("ampf") || plan.includes("ampf")) return 1
  const c = Number(l?.capitas)
  return Number.isFinite(c) && c > 0 ? c : 1
}

const buildWeekStarts = (rangeStart: Date, rangeEndExclusive: Date) => {
  const weekStarts: Date[] = []

  // semana 1 arranca el 1ro del mes (aunque no sea lunes)
  const start1 = new Date(rangeStart)
  start1.setHours(0, 0, 0, 0)
  weekStarts.push(start1)

  // primer lunes >= start1 (o start1 si ya es lunes)
  let cursor = new Date(start1)
  const day = cursor.getDay()
  const diffToMonday = day === 0 ? 1 : day === 1 ? 0 : 8 - day
  cursor.setDate(cursor.getDate() + diffToMonday)
  cursor.setHours(0, 0, 0, 0)

  if (cursor.getTime() !== start1.getTime() && cursor < rangeEndExclusive) {
    weekStarts.push(new Date(cursor))
  }

  while (weekStarts.length < 5) {
    cursor = new Date(cursor)
    cursor.setDate(cursor.getDate() + 7)
    cursor.setHours(0, 0, 0, 0)
    if (cursor >= rangeEndExclusive) break
    weekStarts.push(new Date(cursor))
  }

  return weekStarts
}

const weekIdxOfDate = (d: Date, weekStarts: Date[]): 1 | 2 | 3 | 4 | 5 => {
  let idx = 0
  for (let j = weekStarts.length - 1; j >= 0; j--) {
    if (d >= weekStarts[j]) {
      idx = j
      break
    }
  }
  if (idx < 0) idx = 0
  if (idx > 4) idx = 4
  return (idx + 1) as 1 | 2 | 3 | 4 | 5
}

const buildNormalizedSales = (
  leads: any[],
  rangeStart: Date,
  rangeEndExclusive: Date,
  _ingresadoAtByLead: Map<string, Date>
): NormalizedSale[] => {
  const weekStarts = buildWeekStarts(rangeStart, rangeEndExclusive)

  const getSalesDate = (l: any) => {
    // 🔒 Regla madre: Ventas SIEMPRE por fecha_ingreso
    const d = parseFechaIngreso(l?.fecha_ingreso)
    if (!d) return null
    return shiftWeekendToMonday(d)
  }

  const seen = new Set<string>()
  const out: NormalizedSale[] = []

  for (const l of leads || []) {
    const id = String(l?.id ?? "")
    if (!id || seen.has(id)) continue
    seen.add(id)

    if (!OPS_STATUSES.includes(norm(l.status))) continue

    const saleDate = getSalesDate(l)
    if (!saleDate) continue
    if (saleDate < rangeStart || saleDate >= rangeEndExclusive) continue

    const pass = isPass(l)
    out.push({
      leadId: id,
      agentName: String(l.agent_name || ""),
      source: String(l.source || "Desconocido"),
      saleDate,
      weekIdx: weekIdxOfDate(saleDate, weekStarts),
      kind: pass ? "PASS" : "ALTA",
      altasPoints: pass ? 0 : altasPointsOfLead(l),
      passCount: pass ? 1 : 0,
    })
  }

  return out
}

export function AdminPerformance() {
  const supabase = createClient()

  // --- ESTADOS ---
  const [sellers, setSellers] = useState<any[]>([])
  const [allLeads, setAllLeads] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // lead_id -> primer changed_at donde to_status='ingresado'
  const ingresadoAtByLeadRef = useRef<Map<string, Date>>(new Map())

  // Filtros
  const [selectedSellerId, setSelectedSellerId] = useState<string>("all")
  const [selectedMonth, setSelectedMonth] = useState<string>(new Date().getMonth().toString())
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString())

  // Drilldown Matriz Semanal
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillSellerName, setDrillSellerName] = useState<string>("")
  const [drillWeekIdx, setDrillWeekIdx] = useState<0 | 1 | 2 | 3 | 4 | 5>(1)
  const [drillTab, setDrillTab] = useState<'altas' | 'pass'>('altas')
  const [drillMode, setDrillMode] = useState<'ventas' | 'cumplidas'>('ventas')

  const openDrill = (sellerName: string, weekIdx: 0 | 1 | 2 | 3 | 4 | 5, tab: 'altas' | 'pass' = 'altas') => {
    setDrillSellerName(sellerName)
    setDrillWeekIdx(weekIdx)
    setDrillTab(tab)
    setDrillOpen(true)
  }



  // Mes seleccionado (selectedMonth es 0-based en este componente)
  const getPeriodRange = () => {
    const y = parseInt(selectedYear, 10)
    const m0 = parseInt(selectedMonth, 10) // 0-11
    const start = new Date(y, m0, 1, 0, 0, 0)
    const end = new Date(y, m0 + 1, 1, 0, 0, 0) // fin exclusivo
    const targetPeriod = `${y}-${String(m0 + 1).padStart(2, "0")}`
    return { rangeStart: start, rangeEndExclusive: end, targetPeriod }
  }

  const period = useMemo(() => getPeriodRange(), [selectedMonth, selectedYear])
  const leadById = useMemo(() => {
    const m = new Map<string, any>()
    for (const l of allLeads) m.set(String(l.id), l)
    return m
  }, [allLeads])

  const normalizedAllSales = useMemo(() => {
    return buildNormalizedSales(allLeads, period.rangeStart, period.rangeEndExclusive, ingresadoAtByLeadRef.current)
  }, [allLeads, period.rangeStart, period.rangeEndExclusive])

  const drillItems = useMemo(() => {
    if (!drillOpen || !drillSellerName) return []

    if (drillMode === "ventas") {
      const items = normalizedAllSales
        .filter((x) => x.agentName === drillSellerName && (drillWeekIdx === 0 || x.weekIdx === drillWeekIdx))
        .map((x) => ({ ...x, lead: leadById.get(String(x.leadId)) || null }))

      items.sort((a: any, b: any) => {
        if (a.kind !== b.kind) return a.kind === "ALTA" ? -1 : 1
        return new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime()
      })

      return items
    }

    // Cumplidas oficiales del mes (liquidación): status=cumplidas + billing_approved + billing_period
    const monthNum = Number(selectedMonth) + 1
    const pad2 = (n: number) => String(n).padStart(2, "0")
    const targetPeriod = `${selectedYear}-${pad2(monthNum)}`

    const completed = (allLeads || [])
      .filter((l: any) => String(l.agent_name || "") === drillSellerName)
      .filter(
        (l: any) =>
          norm(l.status) === "cumplidas" &&
          l.billing_approved === true &&
          String(l.billing_period || "") === targetPeriod
      )
      .map((l: any) => {
        const kind: SaleKind = isPass(l) ? "PASS" : "ALTA"
        const saleDate = safeDate(l.sold_at) || safeDate(l.last_update) || safeDate(l.created_at) || new Date()
        return {
          leadId: String(l.id),
          agentName: drillSellerName,
          source: String(l.source || "Desconocido"),
          saleDate,
          weekIdx: 1,
          kind,
          altasPoints: kind === "PASS" ? 0 : altasPointsOfLead(l),
          passCount: kind === "PASS" ? 1 : 0,
          lead: l,
        }
      })

    completed.sort((a: any, b: any) => new Date(a.saleDate).getTime() - new Date(b.saleDate).getTime())
    return completed
  }, [drillOpen, drillSellerName, drillWeekIdx, drillMode, normalizedAllSales, leadById, allLeads, selectedMonth, selectedYear])

  const drillAltas = useMemo(() => drillItems.filter((x: any) => x.kind === "ALTA"), [drillItems])
  const drillPass = useMemo(() => drillItems.filter((x: any) => x.kind === "PASS"), [drillItems])
  // ✅ Capitas: ALTAS por regla (AMPF=1), PASS siempre 1 (registro)
  const sumCapitas = (arr: any[]) =>
    arr.reduce((acc, it) => {
      const kind = String(it?.kind || "").toUpperCase()
      if (kind === "PASS") return acc + 1
      return acc + altasPointsOfLead(it?.lead ?? it)
    }, 0)
  const drillAltasCapitas = useMemo(() => sumCapitas(drillAltas as any), [drillAltas])
  const drillPassCapitas = useMemo(() => sumCapitas(drillPass as any), [drillPass])


  // Espejo OpsBilling (NETO): billing_price_override manda; si no, calcula con reglas
  const calculateBillingNeto = (op: any) => {
    let val = 0
    if (op.billing_price_override !== null && op.billing_price_override !== undefined) {
      val = parseFloat(op.billing_price_override.toString())
      return Number(val.toFixed(2))
    }

    const full = parseFloat(op.full_price || op.price || "0")
    const aportes = parseFloat(op.aportes || "0")
    const desc = parseFloat(op.descuento || "0")
    const p = String(op.prepaga || op.quoted_prepaga || "").toLowerCase()
    const plan = op.plan || op.quoted_plan || ""
    const condicionLaboral = op.labor_condition || op.condicionLaboral || ""

    // Reglas espejo (como OpsBilling)
    const taxRate = 0.105
    const generalMult = 1.8
    const ampfMult = 2.0

    const prevencionRates: any = {
      A1: 0.9,
      "A1 CP": 0.9,
      A2: 1.3,
      "A2 CP": 1.3,
      A4: 1.5,
      A5: 1.5,
      default: 1.3,
    }

    if (p.includes("preven")) {
      const base = full - desc
      const rate = prevencionRates[plan] ?? prevencionRates.default
      val = base * rate
    } else if (p.includes("ampf")) {
      val = full * ampfMult
    } else {
      let base = full * (1 - taxRate)
      if (p.includes("doctored") && String(plan).includes("500") && String(condicionLaboral) === "empleado") {
        base = aportes * (1 - taxRate)
      }
      val = base * generalMult
    }

    return Number(val.toFixed(2))
  }

  // --- CARGA DE DATOS ---
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)

      // 1) Vendedoras
      const { data: profiles } = await supabase.from("profiles").select("*").in("role", ["seller", "gestor"])
      if (profiles) setSellers(profiles)

      // 2) Leads
      const { data: leads } = await supabase
        .from("leads")
        .select((
          "id, agent_name, seller_name, status, sub_state, type, source, created_at, last_update, sold_at, fecha_ingreso, capitas, cuit, dni, name, prepaga, plan, quoted_prepaga, quoted_plan, quoted_price, billing_approved, billing_period, billing_price_override"
        ))
      if (leads) setAllLeads(leads)

      // 3) Historial: primer ingresado (buffer por weekend->lunes)
      const { rangeStart, rangeEndExclusive } = getPeriodRange()
      const startBuf = new Date(rangeStart.getTime())
      startBuf.setDate(startBuf.getDate() - 2)
      const endBuf = new Date(rangeEndExclusive.getTime())
      endBuf.setDate(endBuf.getDate() + 2)

      const { data: hist } = await supabase
        .from("lead_status_history")
        .select("lead_id, to_status, changed_at")
        .eq("to_status", "ingresado")
        .gte("changed_at", startBuf.toISOString())
        .lt("changed_at", endBuf.toISOString())

      const map = new Map<string, Date>()
      ;(hist || []).forEach((ev: any) => {
        const t = safeDate(ev.changed_at)
        if (!t) return
        const prev = map.get(ev.lead_id)
        if (!prev || t.getTime() < prev.getTime()) map.set(ev.lead_id, t)
      })

      ingresadoAtByLeadRef.current = map
      setLoading(false)
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear])

  // --- MOTOR DE CÁLCULO GENERAL ---
  const { filteredLeads, activeSeller } = useMemo(() => {
    let filtered = allLeads

    let sellerData: any = null
    if (selectedSellerId !== "all") {
      sellerData = sellers.find((s) => s.id === selectedSellerId) || null
      if (sellerData) filtered = filtered.filter((l) => l.agent_name === sellerData.full_name)
    }

    return { filteredLeads: filtered, activeSeller: sellerData }
  }, [allLeads, selectedSellerId, sellers])

  // --- CÁLCULO DE MÉTRICAS (derivado solo de NormalizedSales + reglas de cumplidas) ---
  const calculateStats = (leads: any[]): PerformanceMetrics => {
    const { rangeStart, rangeEndExclusive, targetPeriod } = getPeriodRange()

    // 1) Datos del mes (created_at)
    const leadsInMonth = (leads || []).filter((l) => {
      const d = safeDate(l.created_at)
      return !!d && d >= rangeStart && d < rangeEndExclusive
    })
    const totalLeads = leadsInMonth.length

    // ✅ 2) Ventas del mes: única fuente
    const sales = buildNormalizedSales(leads || [], rangeStart, rangeEndExclusive, ingresadoAtByLeadRef.current)
    const totalSales = sales.reduce((acc, s) => acc + s.altasPoints, 0) // ALTAS capitas
    const salesPass = sales.reduce((acc, s) => acc + s.passCount, 0) // PASS registros

    // 3) Cumplidas oficiales del mes (liquidación): OpsBilling puro
    const completedOfficial = (leads || []).filter(
      (l) => norm(l.status) === "cumplidas" && l.billing_approved === true && String(l.billing_period || "") === targetPeriod
    )
    const totalCompleted = completedOfficial.length
    const completedPass = completedOfficial.filter((l) => isPass(l)).length

    // 4) Cotizaciones (referencia): del mes por created_at
    const totalQuotes = leadsInMonth.filter(
      (l) => norm(l.status) === "cotizacion" || (l.quoted_price && norm(l.status) !== "perdido")
    ).length

    // ✅ Cotizaciones necesarias por venta (solo ALTAS por registro; 1 cotizacion max por lead)
    const salesAltasReg = sales.filter((s) => s.kind === "ALTA").length
    const quotesPerSale = salesAltasReg > 0 ? Math.round((totalQuotes / salesAltasReg) * 10) / 10 : 0

    // ✅ Tasas con el total visible del header (ALTAS capitas + PASS registros)
    const visibleSales = totalSales + salesPass
    const conversionRate = totalLeads > 0 ? Math.round((visibleSales / totalLeads) * 100) : 0
    const complianceRate = visibleSales > 0 ? Math.round((totalCompleted / visibleSales) * 100) : 0
    const leadsPerSale = visibleSales > 0 ? Math.round((totalLeads / visibleSales) * 10) / 10 : 0

    // 5) Ticket promedio por CÁPITA (desde liquidación oficial)
    const netoTotal = completedOfficial.reduce((acc: number, op: any) => acc + calculateBillingNeto(op), 0)
    const capitasLiquidated = completedOfficial.reduce((acc: number, l: any) => acc + altasPointsOfLead(l), 0)
    const averageTicket = capitasLiquidated > 0 ? Math.round(netoTotal / capitasLiquidated) : 0

    const salesVolume = totalSales

    // 6) Velocidad de cierre (días): fecha_ingreso -> last_update (aprox) SOLO en cumplidas oficiales
    let daysSum = 0
    let daysCount = 0
    completedOfficial.forEach((l: any) => {
      const fi = String(l.fecha_ingreso || "")
      if (!fi) return
      const start = safeDate(`${fi}T00:00:00-03:00`)
      const end = safeDate(l.last_update) || safeDate(l.created_at)
      if (!start || !end) return
      const diffDays = Math.max(0, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
      daysSum += diffDays
      daysCount += 1
    })
    const avgDaysToClose = daysCount > 0 ? Math.round(daysSum / daysCount) : 0

    return {
      totalLeads,
      totalSales,
      salesPass,
      totalCompleted,
      completedPass,
      totalQuotes,
      quotesPerSale,
      conversionRate,
      complianceRate,
      leadsPerSale,
      averageTicket,
      salesVolume,
      avgDaysToClose,
    }
  }

  // --- CÁLCULO SEMANAL (derivado solo de NormalizedSales) ---
  const calculateWeeklyBreakdown = (leads: any[]): { altas: WeeklyBreakdown; pass: WeeklyPassBreakdown } => {
    const { rangeStart, rangeEndExclusive } = getPeriodRange()
    const sales = buildNormalizedSales(leads || [], rangeStart, rangeEndExclusive, ingresadoAtByLeadRef.current)

    const breakdownAltas: WeeklyBreakdown = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }
    const breakdownPass: WeeklyPassBreakdown = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }

    for (const s of sales) {
      const kA = `w${s.weekIdx}` as keyof WeeklyBreakdown
      const kP = `w${s.weekIdx}` as keyof WeeklyPassBreakdown
      breakdownAltas[kA] += s.altasPoints
      breakdownPass[kP] += s.passCount
    }

    return { altas: breakdownAltas, pass: breakdownPass }
  }

  const currentStats = useMemo(() => calculateStats(filteredLeads), [filteredLeads, selectedMonth, selectedYear])

  // --- ORIGEN (assigned por created_at, sold por NormalizedSales) ---
  const originStats: OriginStat[] = useMemo(() => {
    const { rangeStart, rangeEndExclusive } = getPeriodRange()

    // assigned = leads creados en el mes (created_at)
    const leadsInMonth = (filteredLeads || []).filter((l) => {
      const d = safeDate(l.created_at)
      return !!d && d >= rangeStart && d < rangeEndExclusive
    })

    const groups: Record<string, { assigned: number; soldAltasReg: number }> = {}

    leadsInMonth.forEach((l) => {
      const src = String(l.source || "Desconocido")
      if (!groups[src]) groups[src] = { assigned: 0, soldAltasReg: 0 }
      groups[src].assigned += 1
    })

    // sold = ventas del mes (NO depende de created_at)
    const sales = buildNormalizedSales(filteredLeads || [], rangeStart, rangeEndExclusive, ingresadoAtByLeadRef.current)

    // Por origen mostramos ALTAS por REGISTROS (no capitas) como venías haciendo
    for (const s of sales) {
      const src = s.source || "Desconocido"
      if (!groups[src]) groups[src] = { assigned: 0, soldAltasReg: 0 }
      if (s.kind === "PASS") continue // ✅ PASS NO entra en el número principal
      groups[src].soldAltasReg += 1
    }

    return Object.keys(groups)
      .map((src) => {
        const g = groups[src]
        const conversion = g.assigned > 0 ? (g.soldAltasReg / g.assigned) * 100 : 0
        return { source: src, assigned: g.assigned, sold: g.soldAltasReg, conversion }
      })
      .sort((a, b) => b.assigned - a.assigned)
  }, [filteredLeads, selectedMonth, selectedYear])

  // --- MATRIZ SEMANAL (GLOBAL COMPARISON) ---
  const globalMatrix = useMemo(() => {
    return sellers
      .map((seller) => {
        const myLeads = allLeads.filter((l) => l.agent_name === seller.full_name)
        const stats = calculateStats(myLeads)
        const wb = calculateWeeklyBreakdown(myLeads)
        return { ...seller, stats, weekly: wb.altas, weeklyPass: wb.pass }
      })
      .sort((a, b) => b.stats.totalSales - a.stats.totalSales)
  }, [allLeads, sellers, selectedMonth, selectedYear])

  const weeklyTotals = useMemo(() => {
    const init = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }
    return globalMatrix.reduce((acc: any, s: any) => {
      acc.w1 += Number(s.weekly?.w1 || 0)
      acc.w2 += Number(s.weekly?.w2 || 0)
      acc.w3 += Number(s.weekly?.w3 || 0)
      acc.w4 += Number(s.weekly?.w4 || 0)
      acc.w5 += Number(s.weekly?.w5 || 0)
      return acc
    }, init)
  }, [globalMatrix])

  const weeklyPassTotals = useMemo(() => {
    const init = { w1: 0, w2: 0, w3: 0, w4: 0, w5: 0 }
    return globalMatrix.reduce((acc: any, s: any) => {
      acc.w1 += Number(s.weeklyPass?.w1 || 0)
      acc.w2 += Number(s.weeklyPass?.w2 || 0)
      acc.w3 += Number(s.weeklyPass?.w3 || 0)
      acc.w4 += Number(s.weeklyPass?.w4 || 0)
      acc.w5 += Number(s.weeklyPass?.w5 || 0)
      return acc
    }, init)
  }, [globalMatrix])

  const getConversionBadge = (rate: number) => {
    if (rate >= 15) return <Badge className="bg-purple-100 text-purple-700 border-0">🔥 On Fire</Badge>
    if (rate >= 10) return <Badge className="bg-green-100 text-green-700 border-0">✅ Sólido</Badge>
    if (rate >= 5) return <Badge className="bg-blue-50 text-blue-700 border-0">⚖️ Normal</Badge>
    return <Badge className="bg-red-50 text-red-700 border-0">🐢 En Riesgo</Badge>
  }

  if (loading)
    return <div className="p-10 text-center text-slate-400 animate-pulse">Analizando rendimiento...</div>

  // ✅ SOLO para el Resumen Global del Equipo: efectividad basada únicamente en ALTAS (sin PASS)
  const conversionRateAltasOnly =
    currentStats.totalLeads > 0 ? Math.round((currentStats.totalSales / currentStats.totalLeads) * 100) : 0

  return (
    <div className="p-6 h-full overflow-y-auto max-w-none w-full space-y-8 bg-slate-50/50 min-h-screen">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-blue-600" />
            Panel de Rendimiento
          </h2>
          <p className="text-slate-500 text-sm">Métricas de venta, cumplimiento y eficiencia.</p>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <Select value={selectedSellerId} onValueChange={setSelectedSellerId}>
            <SelectTrigger className="w-[200px] font-bold">
              <SelectValue placeholder="Seleccionar Vendedora" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">🏢 Todo el Equipo</SelectItem>
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.full_name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="h-8 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>

          {/* ✅ AÑO INTELIGENTE */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getYearOptions().map((year) => (
                <SelectItem key={year} value={year.toString()}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                "Enero",
                "Febrero",
                "Marzo",
                "Abril",
                "Mayo",
                "Junio",
                "Julio",
                "Agosto",
                "Septiembre",
                "Octubre",
                "Noviembre",
                "Diciembre",
              ].map((m, i) => (
                <SelectItem key={i} value={i.toString()}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* HERO SECTION */}
      {selectedSellerId !== "all" && activeSeller ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* PERFIL */}
          <Card className="md:col-span-1 border-t-4 border-t-blue-600 shadow-md">
            <CardContent className="pt-6 flex flex-col items-center text-center">
              <div className="relative mb-4">
                <Avatar className="h-32 w-32 border-4 border-slate-100 shadow-xl">
                  <AvatarImage src={activeSeller.avatar_url} className="object-cover" />
                  <AvatarFallback className="text-3xl font-black bg-slate-100 text-slate-400">
                    {activeSeller.full_name[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="absolute -bottom-2 -right-2 bg-white p-1 rounded-full shadow-sm">
                  {getConversionBadge(currentStats.conversionRate)}
                </div>
              </div>

              <h3 className="text-xl font-black text-slate-800">{activeSeller.full_name}</h3>
              <p className="text-sm text-slate-500 font-medium uppercase tracking-wider mb-4">Especialista en Ventas</p>

              <div className="w-full grid grid-cols-2 gap-2 mt-2">
                <div className="bg-slate-50 p-2 rounded border text-xs">
                  <span className="block font-bold text-slate-400">EMAIL</span>
                  <span className="truncate block" title={activeSeller.email}>
                    {activeSeller.email}
                  </span>
                </div>
                <div className="bg-slate-50 p-2 rounded border text-xs">
                  <span className="block font-bold text-slate-400">ROL</span>
                  <span>{activeSeller.role || "Seller"}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* METRICS GRID */}
          <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="shadow-sm hover:shadow-md transition-all md:col-span-2 bg-gradient-to-br from-blue-600 to-blue-800 text-white border-0">
              <CardContent className="p-6 flex justify-between items-center h-full">
                <div>
                  <p className="text-blue-200 font-bold uppercase text-xs mb-1">Ventas</p>
                  <div className="text-5xl font-black">{currentStats.totalSales}</div>
                  <p className="text-xs text-blue-200 mt-2">Operaciones cerradas</p>
                  {currentStats.salesPass > 0 && (
                    <p className="text-xs text-purple-100 mt-2 font-bold">+{currentStats.salesPass} pass</p>
                  )}
                </div>

                <div className="text-right">
                  <p className="text-blue-200 font-bold uppercase text-xs mb-1">Cumplidas</p>
                  <div className="text-4xl font-black text-green-300 flex items-center justify-end gap-2">
                    <CheckCircle2 className="h-8 w-8" /> {currentStats.totalCompleted}
                  </div>
                  <p className="text-xs text-blue-200 mt-2">Aprobadas por Ops</p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2">
                  <Target className="h-4 w-4 text-blue-500" /> Efectividad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-blue-600">{currentStats.conversionRate}%</div>
                <Progress value={currentStats.conversionRate} className="h-1.5 mt-2 bg-blue-100" />
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2">
                  <Users className="h-4 w-4 text-purple-500" /> Esfuerzo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-black text-slate-800">{currentStats.leadsPerSale}</div>
                <p className="text-xs text-slate-500 mt-1">Datos x Venta</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-green-700 uppercase tracking-wider flex gap-2">
                  <DollarSign className="h-4 w-4" /> Ticket Promedio
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-green-800">$ {currentStats.averageTicket.toLocaleString()}</div>
              </CardContent>
            </Card>

            {/* NUEVA MÉTRICA: VELOCIDAD */}
            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2">
                  <Timer className="h-4 w-4 text-orange-500" /> Velocidad
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800">
                  {currentStats.avgDaysToClose} <span className="text-sm text-slate-400 font-medium">días</span>
                </div>
                <p className="text-xs text-slate-500 mt-1">Tiempo de cierre</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2">
                  <BarChart3 className="h-4 w-4 text-orange-500" /> Cotizando
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800">{currentStats.totalQuotes}</div>
                <p className="text-xs text-slate-500 mt-1">En proceso</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2">
                  <Target className="h-4 w-4 text-blue-500" /> Cotizaciones x Venta
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800">{currentStats.quotesPerSale}</div>
                <p className="text-xs text-slate-500 mt-1">Cotizaciones por alta</p>
              </CardContent>
            </Card>

            <Card className="shadow-sm hover:shadow-md transition-all">
              <CardHeader className="pb-2">
                <CardTitle className="text-xs font-bold text-slate-400 uppercase tracking-wider flex gap-2">
                  <Filter className="h-4 w-4 text-slate-500" /> Asignados
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-black text-slate-800">{currentStats.totalLeads}</div>
                <p className="text-xs text-slate-500 mt-1">Total periodo</p>
              </CardContent>
            </Card>
          </div>

          {/* ANÁLISIS POR ORIGEN */}
          <Card className="md:col-span-4 shadow-md">
            <CardHeader>
              <CardTitle className="text-lg">Rendimiento por Origen de Datos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {originStats.map((origin) => (
                  <div key={origin.source} className="border p-4 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-sm text-slate-700 truncate">{origin.source}</span>
                      {origin.conversion >= 10 && <Badge className="bg-green-100 text-green-700 border-0 h-5 px-1">⭐</Badge>}
                    </div>

                    <div className="flex justify-between items-end mb-2">
                      <span className="text-2xl font-black text-slate-800">
                        {origin.sold}
                        <span className="text-xs text-slate-400 font-medium">/{origin.assigned}</span>
                      </span>
                      <span className={`text-xs font-bold ${origin.conversion > 10 ? "text-green-600" : "text-slate-500"}`}>
                        {origin.conversion.toFixed(1)}% Efec.
                      </span>
                    </div>

                    <Progress
                      value={origin.conversion}
                      max={20}
                      className={`h-1.5 ${
                        origin.conversion > 10 ? "bg-green-100 [&>div]:bg-green-500" : "bg-slate-100"
                      }`}
                    />
                  </div>
                ))}

                {originStats.length === 0 && (
                  <div className="col-span-full text-center text-slate-400 py-4">Sin datos para analizar este mes.</div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : (
        // VISTA GLOBAL
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in zoom-in duration-300">
          <Card className="md:col-span-3 bg-blue-600 text-white shadow-xl border-0 overflow-hidden relative">
            <div className="absolute top-0 right-0 p-10 opacity-10">
              <Trophy size={150} />
            </div>
            <CardContent className="p-8 relative z-10">
              <h3 className="text-3xl font-black mb-2">Resumen Global del Equipo</h3>
              <p className="text-blue-100 mb-6 max-w-xl">
                Rendimiento consolidado de todas las vendedoras. Selecciona una vendedora arriba para ver su detalle
                profundo.
              </p>

              <div className="flex gap-12">
                <div>
                  <span className="block text-5xl font-black">{currentStats.totalSales}</span>
                  <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Altas</span>
                  {currentStats.salesPass > 0 && (
                    <span className="block text-xs font-bold text-purple-100 mt-2">+{currentStats.salesPass} pass</span>
                  )}
                </div>
                <div>
                  <span className="block text-5xl font-black text-green-300">
                    {currentStats.totalCompleted - currentStats.completedPass}
                  </span>
                  <span className="text-sm font-bold text-green-200 uppercase tracking-widest">Cumplidas</span>
                  {currentStats.completedPass > 0 && (
                    <span className="block text-xs font-bold text-purple-100 mt-2">
                      +{currentStats.completedPass} pass
                    </span>
                  )}
                </div>
                <div>
                  <span className="block text-5xl font-black">{conversionRateAltasOnly}%</span>
                  <span className="text-sm font-bold text-blue-200 uppercase tracking-widest">Efectividad Media</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ✅ MATRIZ SEMANAL DE DESEMPEÑO */}
      <Card className="shadow-lg border-t-4 border-t-slate-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Medal className="h-5 w-5 text-yellow-500" /> Matriz Semanal de Desempeño
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <div className="w-full overflow-x-auto">
                          <Table className="min-w-[980px] w-full">
            <TableHeader>
              <TableRow className="bg-slate-50 hover:bg-slate-50">
                <TableHead className="w-[50px] text-center">#</TableHead>
                <TableHead>Vendedora</TableHead>
                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 1</TableHead>
                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 2</TableHead>
                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 3</TableHead>
                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 4</TableHead>
                <TableHead className="text-center w-16 text-slate-400 font-bold text-xs">SEM 5</TableHead>
                <TableHead className="text-right font-black">TOTAL</TableHead>
                <TableHead className="text-right text-green-600 font-black">CUMPLIDAS</TableHead>
                <TableHead className="text-right">EFECTIVIDAD</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {globalMatrix.map((seller, index) => (
                <TableRow key={seller.id} className={seller.id === selectedSellerId ? "bg-blue-50 hover:bg-blue-100" : ""}>
                  <TableCell className="text-center font-bold text-slate-500">
                    {index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : index + 1}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={seller.avatar_url} />
                        <AvatarFallback>{seller.full_name[0]}</AvatarFallback>
                      </Avatar>
                      <span className="font-bold text-slate-700">{seller.full_name}</span>
                    </div>
                  </TableCell>

                  {/* COLUMNAS SEMANALES */}
                  {(["w1", "w2", "w3", "w4", "w5"] as const).map((wk) => (
                    <TableCell key={wk} className="text-center text-slate-500">
                      <div className="flex flex-col items-center">
                        <button type="button" className="font-black text-slate-700 hover:underline" onClick={() => { setDrillSellerName(seller.full_name); setDrillWeekIdx((wk === "w1" ? 1 : wk === "w2" ? 2 : wk === "w3" ? 3 : wk === "w4" ? 4 : 5) as any); setDrillOpen(true); }}>
                          {seller.weekly[wk] || "-"}
                        </button>
                        {(seller.weeklyPass?.[wk] || 0) > 0 && (
                          <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200">
                            +{seller.weeklyPass[wk]} pass
                          </span>
                        )}
                      </div>
                    </TableCell>
                  ))}

                  <TableCell className="text-right font-black text-base">
                    <div className="flex flex-col items-end">
                      <button type="button" className="hover:underline underline-offset-2" onClick={() => openDrill(seller.full_name, 0, 'altas')} title="Ver detalle de ventas del mes">{seller.stats.totalSales}</button>
                      {(seller.stats.salesPass || 0) > 0 && (
                        <button type="button" className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200 hover:bg-purple-100" onClick={() => openDrill(seller.full_name, 0, 'pass')} title="Ver detalle de PASS del mes">+{seller.stats.salesPass} pass</button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-black text-green-600 text-base">
                    <div className="flex flex-col items-end">
                      <button type="button" className="hover:underline underline-offset-2" onClick={() => openDrill(seller.full_name, 0, 'altas')} title="Ver detalle de cumplidas del mes">{seller.stats.totalCompleted}</button>
                      {(seller.stats.completedPass || 0) > 0 && (
                        <button type="button" className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200 hover:bg-purple-100" onClick={() => openDrill(seller.full_name, 0, 'pass')} title="Ver detalle de PASS cumplidas del mes">+{seller.stats.completedPass} pass</button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-right font-medium">
                    <span className={seller.stats.conversionRate > 10 ? "text-green-600 font-bold" : ""}>
                      {seller.stats.conversionRate}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}

              <TableRow className="bg-slate-100/60">
                <TableCell className="text-center font-black text-slate-400">—</TableCell>
                <TableCell className="font-black text-slate-700">TOTAL SEMANA</TableCell>

                {(["w1", "w2", "w3", "w4", "w5"] as const).map((wk) => (
                  <TableCell key={wk} className="text-center font-black text-slate-700">
                    <div className="flex flex-col items-center">
                      <span>{weeklyTotals[wk] || "-"}</span>
                      {(weeklyPassTotals[wk] || 0) > 0 && (
                        <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200">
                          +{weeklyPassTotals[wk]} pass
                        </span>
                      )}
                    </div>
                  </TableCell>
                ))}

                <TableCell className="text-right font-black text-slate-800">
                  <div className="flex flex-col items-end">
                    <span>{globalMatrix.reduce((acc: number, s: any) => acc + Number(s.stats?.totalSales || 0), 0)}</span>
                    {globalMatrix.reduce((acc: number, s: any) => acc + Number(s.stats?.salesPass || 0), 0) > 0 && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200">
                        +{globalMatrix.reduce((acc: number, s: any) => acc + Number(s.stats?.salesPass || 0), 0)} pass
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right font-black text-green-700">
                  <div className="flex flex-col items-end">
                    <span>
                      {globalMatrix.reduce((acc: number, s: any) => acc + Number(s.stats?.totalCompleted || 0), 0)}
                    </span>
                    {globalMatrix.reduce((acc: number, s: any) => acc + Number(s.stats?.completedPass || 0), 0) > 0 && (
                      <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200">
                        +{globalMatrix.reduce((acc: number, s: any) => acc + Number(s.stats?.completedPass || 0), 0)}{" "}
                        pass
                      </span>
                    )}
                  </div>
                </TableCell>

                <TableCell className="text-right font-bold text-slate-400">-</TableCell>
              </TableRow>
            </TableBody>
          </Table>
                        </div>
        </CardContent>
      </Card>

      {/* 🧾 Drilldown Matriz Semanal */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-[1100px] w-[92vw] max-h-[85vh] overflow-visible p-0 rounded-2xl shadow-2xl border">
          <DialogHeader className="sticky top-0 z-10 border-b bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-6 pt-5 pb-4">
            <DialogTitle className="flex flex-col gap-1">
              <span>{drillSellerName} — Semana {drillWeekIdx}</span>
              <span className="text-xs text-slate-500 font-normal">
                Detalle por fecha_ingreso (verificación de semana)
              </span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 overflow-y-auto max-h-[68vh]">


          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">
              Registros: <b>{drillItems.length}</b>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700">
              Altas: <b>{drillAltas.length}</b> · Capitas: <b>{drillAltasCapitas}</b>
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full border bg-purple-50 text-purple-700">
              Pass: <b>{drillPass.length}</b> · Capitas: <b>{drillPassCapitas}</b>
            </span>
          </div>

          <Tabs value={drillTab} onValueChange={(v) => setDrillTab(v as any)} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="altas">Altas</TabsTrigger>
              <TabsTrigger value="pass">Pass</TabsTrigger>
            </TabsList>

            <TabsContent value="altas" className="mt-4">
              <div className="rounded-xl border overflow-hidden">
                <Table className="min-w-[980px] w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-[80px]">Capitas</TableHead>
                      <TableHead className="w-[120px]">Fecha ingreso</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-[140px]">CUIT</TableHead>
                      <TableHead className="w-[160px]">Prepaga</TableHead>
                      <TableHead className="w-[180px]">Plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillAltas.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                          No hay ALTAS para esa semana.
                        </TableCell>
                      </TableRow>
                    ) : (
                      drillAltas.map((it: any) => {
                        const l = it.lead
                        const fecha = l?.fecha_ingreso || l?.sold_at || it.saleDate
                        const fechaTxt = fecha ? new Date(fecha).toLocaleDateString("es-AR") : "-"
                        const cliente = l?.name || "-"
                        const cuit = l?.cuit || l?.dni || "-"
                        const prepaga = l?.quoted_prepaga || l?.prepaga || "-"
                        const plan = l?.quoted_plan || l?.plan || "-"
                        return (
                          <TableRow key={`${it.leadId}-${it.kind}-${it.saleDate}`}>
                            <TableCell className="text-center">{altasPointsOfLead(l)}</TableCell>
                            <TableCell className="font-medium">{fechaTxt}</TableCell>
                            <TableCell className="max-w-[360px] truncate" title={cliente}>{cliente}</TableCell>
                            <TableCell className="font-mono text-xs">{cuit}</TableCell>
                            <TableCell>{prepaga}</TableCell>
                            <TableCell>{plan}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>

            <TabsContent value="pass" className="mt-4">
              <div className="rounded-xl border overflow-hidden">
                <Table className="min-w-[980px] w-full">
                  <TableHeader>
                    <TableRow className="bg-slate-50 hover:bg-slate-50">
                      <TableHead className="w-[80px]">Capitas</TableHead>
                      <TableHead className="w-[120px]">Fecha ingreso</TableHead>
                      <TableHead>Cliente</TableHead>
                      <TableHead className="w-[140px]">CUIT</TableHead>
                      <TableHead className="w-[160px]">Prepaga</TableHead>
                      <TableHead className="w-[180px]">Plan</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drillPass.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                          No hay PASS para esa semana.
                        </TableCell>
                      </TableRow>
                    ) : (
                      drillPass.map((it: any) => {
                        const l = it.lead
                        const fecha = l?.fecha_ingreso || l?.sold_at || it.saleDate
                        const fechaTxt = fecha ? new Date(fecha).toLocaleDateString("es-AR") : "-"
                        const cliente = l?.name || "-"
                        const cuit = l?.cuit || l?.dni || "-"
                        const prepaga = l?.quoted_prepaga || l?.prepaga || "-"
                        const plan = l?.quoted_plan || l?.plan || "-"
                        return (
                          <TableRow key={`${it.leadId}-${it.kind}-${it.saleDate}`}>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="font-medium">{fechaTxt}</TableCell>
                            <TableCell className="max-w-[360px] truncate" title={cliente}>{cliente}</TableCell>
                            <TableCell className="font-mono text-xs">{cuit}</TableCell>
                            <TableCell>{prepaga}</TableCell>
                            <TableCell>{plan}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </TabsContent>
          </Tabs>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  )
}