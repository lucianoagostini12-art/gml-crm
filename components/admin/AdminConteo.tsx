"use client"

import { useState, useEffect, useMemo, useRef } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Calculator, Filter, DollarSign, RefreshCw, CheckCircle2, TrendingUp, Download, FileSpreadsheet } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

// --- REGLAS DE CÁLCULO ---
const INITIAL_CALC_RULES = {
  taxRate: 0.105,
  prevencionVat: 0.21,
  doctoRed: { base: 1.8, specialPlan: "500" },
  ampf: { multiplier: 2.0 },
  prevencion: { A1: 0.9, "A1 CP": 0.9, A2: 1.3, "A2 CP": 1.3, A4: 1.5, A5: 1.5, default: 1.3 },
  generalGroup: { multiplier: 1.8 },
  portfolioRate: 0.05,
}

export function AdminConteo() {
  const supabase = createClient()

  // --- UTILIDAD PARA EXPORTAR A CSV (Mismo estilo OpsMetrics) ---
  const exportToCSV = (rows: any[], filename: string) => {
    if (!rows || rows.length === 0) return

    const headers = [
      "Vendedor",
      "Ventas (Altas)",
      "Ventas PASS",
      "Cumplidas (Oficial)",
      "Cumplidas PASS",
      "Efectividad %",
      "Hoy",
      "Semana",
      "Estado",
    ]

    const dataRows = rows.map((r: any) => [
      r.name,
      r.monthly ?? 0,
      r.monthlyPassCount ?? 0,
      r.fulfilled ?? 0,
      r.passCount ?? 0,
      r.ratio ?? 0,
      r.daily ?? 0,
      r.weekly ?? 0,
      r.status ?? "-",
    ])

    const csvContent = [
      headers.join(","),
      ...dataRows.map((e: any) => e.map((item: any) => `"${String(item).replace(/"/g, '""')}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const link = document.createElement("a")
    const url = URL.createObjectURL(blob)
    link.setAttribute("href", url)
    link.setAttribute("download", `${filename}.csv`)
    link.style.visibility = "hidden"
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Filtros dinámicos
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // Años dinámicos
  const [yearOptions, setYearOptions] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [globalTotals, setGlobalTotals] = useState({ monthly: 0, fulfilled: 0, revenue: 0 })
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({})
  const [allLeads, setAllLeads] = useState<any[]>([])

  // --- DRILLDOWN (ver operaciones al clickear números) ---
  const [drillOpen, setDrillOpen] = useState(false)
  const [drillSellerName, setDrillSellerName] = useState<string>("")
  const [drillMode, setDrillMode] = useState<"ventas" | "cumplidas">("ventas")
  const [drillScope, setDrillScope] = useState<"daily" | "weekly" | "monthly">("monthly")
  const [drillTab, setDrillTab] = useState<"altas" | "pass">("altas")

  const openDrill = (
    sellerName: string,
    mode: "ventas" | "cumplidas",
    scope: "daily" | "weekly" | "monthly" = "monthly",
    tab: "altas" | "pass" = "altas"
  ) => {
    setDrillSellerName(sellerName)
    setDrillMode(mode)
    setDrillScope(scope)
    setDrillTab(tab)
    setDrillOpen(true)
  }


  // --- ESTADO MODAL DESCARGA (mismo patrón que OpsMetrics) ---
  const currentYear = new Date().getFullYear()
  const [downloadModalOpen, setDownloadModalOpen] = useState(false)
  const [downloadType, setDownloadType] = useState("current") // 'current' | 'global' | 'custom'
  const [downloadMonth, setDownloadMonth] = useState((new Date().getMonth() + 1).toString())
  const [downloadYear, setDownloadYear] = useState(currentYear.toString())

  // Helpers
  const norm = (v: any) => String(v ?? "").trim().toLowerCase()

  // ✅ PASS unificado (misma regla que AdminPerformance)
  // type='pass' OR sub_state='auditoria_pass' OR source='pass'
  const isPass = (l: any) => {
    const t = norm(l?.type)
    const ss = norm(l?.sub_state)
    const src = norm(l?.source)

    // fallback tolerante por si viene algún flag legacy
    const flag = l?.is_pass === true || l?.pass === true

    return flag || t === "pass" || ss === "auditoria_pass" || src === "pass"
  }

  // ✅ LISTA DE ESTADOS QUE CUENTAN COMO VENTA
  const SALE_STATUSES = [
  "ingresado",
  "precarga",
  "medicas",
  "legajo",
  "demoras",
  "cumplidas",
  "rechazado",
]


  const OPS_STATUSES = SALE_STATUSES

  const safeDate = (v: any) => {
    if (!v) return null
    const d = new Date(v)
    return Number.isFinite(d.getTime()) ? d : null
  }

  // ✅ Parse robusto de fecha_ingreso (prioridad absoluta para Ventas)
  const parseFechaIngreso = (v: any) => {
    if (!v) return null
    if (v instanceof Date) return Number.isFinite(v.getTime()) ? v : null
    const s = String(v).trim()
    if (!s) return null

    // ISO date YYYY-MM-DD (campo DATE)
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
      const iso = `${yyyy}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`
      return safeDate(`${iso}T00:00:00-03:00`)
    }

    // fallback: intentar Date()
    return safeDate(s)
  }

  const shiftWeekendToMonday = (d: Date) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    const day = x.getDay() // 0 dom, 6 sáb
    if (day === 6) x.setDate(x.getDate() + 2)
    if (day === 0) x.setDate(x.getDate() + 1)
    return x
  }

  // ✅ Puntos de ALTA: capitas (fallback 1), AMPF siempre 1
  const altasPointsOfLead = (l: any) => {
    const prep = norm(l?.prepaga ?? l?.quoted_prepaga)
    const plan = norm(l?.plan ?? l?.quoted_plan)
    if (prep.includes("ampf") || plan.includes("ampf")) return 1
    const c = Number(l?.capitas)
    return Number.isFinite(c) && c > 0 ? c : 1
  }

const startOfWeekMonday = (ref: Date) => {
    const d = new Date(ref)
    const day = d.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diffToMonday)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // --- FÓRMULA DE FACTURACIÓN (ESPEJO OpsBilling - NETO) ---
  // - Usa billing_price_override si existe (OPS manual/auditado)
  // - Si no existe, calcula igual que OpsBilling (val con 2 decimales)
  // - NO anula PASS por type (PASS suma si OPS lo define; override manda)
  const calculateBillingNeto = (op: any) => {
    let val = 0

    if (op.billing_price_override !== null && op.billing_price_override !== undefined) {
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

    // ⚠️ En OpsBilling hay una regla: if (p.includes("pass")) val = 0
    // Acá NO la aplicamos por pedido tuyo: PASS suma y OPS define el monto manual.
    // Si algún PASS dependiera de cálculo automático, lo vas a manejar con override.

    return Number(val.toFixed(2))
  }

  // Genera años (Asegurando 2025)
  const buildYearOptions = async () => {
    const currentYear = new Date().getFullYear()
    let minYear = 2025

    try {
      const { data, error } = await supabase.from("leads").select("created_at").order("created_at", { ascending: true }).limit(1)
      if (!error && data && data.length > 0) {
        const y = new Date(data[0].created_at).getFullYear()
        if (!Number.isNaN(y) && y < minYear) minYear = y
      }
    } catch {}

    const years: string[] = []
    for (let y = minYear; y <= currentYear + 1; y++) years.push(String(y))
    setYearOptions(years)
    if (!years.includes(selectedYear)) setSelectedYear(String(currentYear))
  }

  
  const periodRange = useMemo(() => {
    if (selectedYear === "all") return null
    const y = parseInt(selectedYear, 10)
    const m = parseInt(selectedMonth, 10)
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) return null
    const startStr = `${y}-${String(m).padStart(2, "0")}-01`
    const end = new Date(`${startStr}T00:00:00-03:00`)
    // endExclusive = primer día del mes siguiente
    const endExclusive = new Date(end)
    endExclusive.setMonth(endExclusive.getMonth() + 1)
    endExclusive.setDate(1)
    endExclusive.setHours(0, 0, 0, 0)
    const start = new Date(`${startStr}T00:00:00-03:00`)
    start.setHours(0, 0, 0, 0)
    return { start, endExclusive }
  }, [selectedMonth, selectedYear])
  const targetPeriod = useMemo(() => {
    if (selectedYear === "all") return null
    return `${selectedYear}-${String(parseInt(selectedMonth, 10)).padStart(2, "0")}`
  }, [selectedMonth, selectedYear])

  const isBillingMonth = (op: any) => {
    if (selectedYear === "all") return true
    if (op?.billing_period && targetPeriod) return String(op.billing_period) === targetPeriod
    const d = safeDate(op?.created_at)
    if (!d) return false
    return d.getFullYear() === parseInt(selectedYear, 10) && d.getMonth() + 1 === parseInt(selectedMonth, 10)
  }


  const salesDate = (lead: any) => {
    const d = parseFechaIngreso(lead?.fecha_ingreso)
    if (!d) return null
    return shiftWeekendToMonday(d)
  }

  const isInSelectedPeriod = (lead: any) => {
    if (selectedYear === "all") return true
    const d = salesDate(lead)
    if (!d || !periodRange) return false
    return d >= periodRange.start && d < periodRange.endExclusive
  }

  const isSalesToday = (lead: any, nowRef?: Date) => {
    const now = nowRef ?? new Date()
    const d = salesDate(lead)
    if (!d) return false
    return d.toDateString() === now.toDateString()
  }

  const isSalesThisWeek = (lead: any, nowRef?: Date) => {
    const now = nowRef ?? new Date()
    const weekStart = startOfWeekMonday(now)
    const d = salesDate(lead)
    if (!d) return false
    return d >= weekStart && d <= now
  }

const fetchProfiles = async () => {
    const { data } = await supabase.from("profiles").select("full_name, avatar_url, email")
    if (data) {
      const map: Record<string, string> = {}
      data.forEach((p: any) => {
        if (p.full_name) map[norm(p.full_name)] = p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}`
      })
      setProfilesMap(map)
    }
  }

  const fetchData = async () => {
    setLoading(true)

    // 1. DEFINIR RANGO DE FECHAS Y PERIODO OBJETIVO
    let productionLeads: any[] = []
    let billingLeads: any[] = []

    // Periodo seleccionado
    const targetPeriod = `${selectedYear}-${selectedMonth.padStart(2, "0")}`

    // Helpers de fecha (VENTAS por fecha_ingreso; fallback para legacy)
    const salesDateOf = (l: any) => l?.fecha_ingreso || l?.sold_at || l?.activation_date || l?.fecha_alta || l?.created_at

    // ✅ Para campos tipo DATE (fecha_ingreso), usamos YYYY-MM-DD (sin timezone)
    const startDateStr =
      selectedYear !== "all"
        ? `${parseInt(selectedYear, 10)}-${String(parseInt(selectedMonth, 10)).padStart(2, "0")}-01`
        : null

    // End exclusivo: primer día del mes siguiente (evita bugs por timezone/UTC)
    const endDateStr =
      selectedYear !== "all"
        ? (() => {
            const y = parseInt(selectedYear, 10)
            const m = parseInt(selectedMonth, 10)
            const nextM = m === 12 ? 1 : m + 1
            const nextY = m === 12 ? y + 1 : y
            return `${nextY}-${String(nextM).padStart(2, "0")}-01`
          })()
        : null

  // ISO timestamps (UTC) para filtros en DB (creados desde AR -03:00)
  // Usamos rango completo del mes en hora Argentina y lo convertimos a ISO UTC
  const startDateISO =
    selectedYear !== "all" && startDateStr
      ? new Date(`${startDateStr}T00:00:00-03:00`).toISOString()
      : null
  const endDateISO =
    selectedYear !== "all" && endDateStr
      ? new Date(`${endDateStr}T23:59:59.999-03:00`).toISOString()
      : null

    // A. PRODUCCIÓN (VENTAS por fecha_ingreso: se cuentan cuando llegan a INGRESADO y siguen contando aunque avancen)
    if (selectedYear !== "all") {
      const { data: prodData } = await supabase
        .from("leads")
        .select("*")
        .in("status", SALE_STATUSES)
        .gte("fecha_ingreso", startDateStr as string)
        .lte("fecha_ingreso", endDateStr as string)

      if (prodData) productionLeads = prodData
    } else {
      const { data } = await supabase.from("leads").select("*").in("status", SALE_STATUSES).not("fecha_ingreso","is",null)
      if (data) productionLeads = data
    }

    // B. LIQUIDACIÓN (ESPEJO OpsBilling)
    // - Solo cumplidas
    // - Solo aprobadas por OPS (billing_approved=true)
    // - Periodo por billing_period; si no tiene, cae al mes de created_at (como OpsBilling)
    if (selectedYear !== "all") {
      const { data: billData } = await supabase
        .from("leads")
        .select("*")
        .eq("status", "cumplidas")
        .eq("billing_approved", true)
        .or(`billing_period.eq.${targetPeriod},and(billing_period.is.null,created_at.gte.${startDateISO},created_at.lte.${endDateISO})`)

      if (billData) billingLeads = billData
    }

    // Unificar listas
    const allLeadsMap = new Map()
    productionLeads.forEach((l) => allLeadsMap.set(l.id, l))
    billingLeads.forEach((l) => allLeadsMap.set(l.id, l))
    const safeLeads = Array.from(allLeadsMap.values())
    setAllLeads(safeLeads)


    const now = new Date()
    const weekStart = startOfWeekMonday(now)

    // 2. Identificar Vendedores
    const MANUAL_BUCKETS = ["Iara", "Oficina", "Calle", "Otros"]
    const manualBucketSet = new Set(MANUAL_BUCKETS.map((n) => norm(n)))

    let sellerNames: string[] = []
    try {
      const { data: sellers } = await supabase.from("profiles").select("full_name, role").eq("role", "seller")
      sellerNames = (sellers || [])
        .map((s: any) => String(s.full_name ?? "").trim())
        .filter(Boolean)
        .filter((n: string) => !manualBucketSet.has(norm(n)))
    } catch {}

    const manualNamesThisPeriod = [
      ...new Set(
        safeLeads
          .map((l: any) => String(l.agent_name ?? "").trim())
          .filter(Boolean)
          .filter((n: string) => !sellerNames.some((s) => norm(s) === norm(n)))
      ),
    ]

    const agentNames = [...new Set([...sellerNames, ...manualNamesThisPeriod])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"))

    // 3. PROCESAR DATOS
    let totalSalesGlobal = 0
    let totalFulfilledGlobal = 0

    // ✅ Helper: Conteo (registros) — para que cierre 1:1 con SQL
    const calculatePoints = (items: any[]) => items.length
    // ✅ Desglose por prepaga (abajo): por capitas, excepto AMPF (1 por registro)
    const pointsByCapitas = (items: any[]) => {
      return (items || []).reduce((acc: number, l: any) => {
        const prep = ((l?.prepaga || l?.quoted_prepaga || "") + "").trim().toLowerCase()
        if (prep === "ampf") return acc + 1
        const c = Number(l?.capitas)
        return acc + (Number.isFinite(c) && c > 0 ? c : 1)
      }, 0)
    }



    // ✅ Helper: Detectar PASS (lógica unificada)
    const isPass = (l: any) => {
      const t = String(l?.type ?? "").toLowerCase()
      const ss = String(l?.sub_state ?? l?.substate ?? "").toLowerCase()
      const so = String(l?.source ?? l?.origen ?? "").toLowerCase()
      return t === "pass" || ss === "auditoria_pass" || so === "pass"
    }


    
    const processedAgents = agentNames.map((name) => {
      const agentLeads = safeLeads.filter((l: any) => norm(l.agent_name) === norm(name))

      // A. VENTAS (AZUL): 1:1 AdminPerformance (fecha_ingreso + OPS statuses; PASS separado)
      const salesLeads = agentLeads.filter((l: any) => OPS_STATUSES.includes(norm(l.status)) && isInSelectedPeriod(l) && !!salesDate(l))
      const salesLeadsNoPass = salesLeads.filter((l: any) => !isPass(l))
      const salesLeadsPass = salesLeads.filter((l: any) => isPass(l))

      const dailyLeads = salesLeadsNoPass.filter((l: any) => isSalesToday(l))
      const weeklyLeads = salesLeadsNoPass.filter((l: any) => isSalesThisWeek(l))

      const daily = dailyLeads.reduce((acc: number, l: any) => acc + altasPointsOfLead(l), 0)
      const weekly = weeklyLeads.reduce((acc: number, l: any) => acc + altasPointsOfLead(l), 0)

      // ✅ Ventas del periodo (SIN PASS)
      const monthly = salesLeadsNoPass.reduce((acc: number, l: any) => acc + altasPointsOfLead(l), 0)


      // ✅ Pass del mes (conteo separado para mostrar +X pass)
      const monthlyPassCount = salesLeadsPass.length

      // B. CUMPLIDAS (VERDE): LIQUIDACIÓN OFICIAL (billing_approved=true) — total (altas+pass)
      const fulfilledAll = agentLeads.filter(
        (l: any) =>
          norm(l.status) === "cumplidas" && l.billing_approved === true && isBillingMonth(l)
      )
      const fulfilledPassLeads = fulfilledAll.filter((l: any) => isPass(l))
      const fulfilledAltasLeads = fulfilledAll.filter((l: any) => !isPass(l))

      const fulfilled = calculatePoints(fulfilledAltasLeads) // liquidables ALTAS (PASS separado)
      const passCount = fulfilledPassLeads.length

      const ratioVal = monthly > 0 ? Math.round((fulfilled / monthly) * 100) : 0

      const recentMs = now.getTime() - 600000
      const status = agentLeads.some((l: any) => {
        if (!l.last_update) return false
        const t = new Date(l.last_update).getTime()
        return Number.isFinite(t) && t > recentMs
      })
        ? "online"
        : "offline"

      totalSalesGlobal += monthly
      totalFulfilledGlobal += fulfilled

      const avatarUrl = profilesMap[norm(name)] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`

      return {
        name,
        avatarUrl,
        daily,
        weekly,
        monthly, // ventas sin pass
        monthlyPassCount, // pass de ventas (para mostrar +X)
        fulfilled, // cumplidas oficiales sin pass
        passCount, // pass oficiales en cumplidas
        ratio: ratioVal,
        status,
        breakdown: [...new Set(salesLeadsNoPass.map((l: any) => l.prepaga || l.quoted_prepaga))]
          .filter(Boolean)
          .map((prepName: any) => ({
            name: prepName,
            sold: pointsByCapitas(salesLeadsNoPass.filter((l: any) => (l.prepaga || l.quoted_prepaga) === prepName)),
            fulfilled: pointsByCapitas(fulfilledAll.filter((l: any) => (l.prepaga || l.quoted_prepaga) === prepName)),
          })),
      }
    })

    setAgents(processedAgents)

    // ✅ FACTURACIÓN (NETO) ESPEJO OPSBILLING: solo cumplidas oficiales del período, incluye PASS
    const billingCandidates = safeLeads.filter(
      (l: any) => norm(l.status) === "cumplidas" && l.billing_approved === true && isBillingMonth(l)
    )

    const totalNeto = billingCandidates.reduce((acc: number, curr: any) => acc + calculateBillingNeto(curr), 0)

    // OpsBilling muestra NETO redondeado (formatMoney(totalNeto, true))
    const totalNetoRounded = Math.round(totalNeto)

    setGlobalTotals({ monthly: totalSalesGlobal, fulfilled: totalFulfilledGlobal, revenue: totalNetoRounded })
    setLoading(false)
  }

  useEffect(() => {
    buildYearOptions()
    fetchProfiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (Object.keys(profilesMap).length > 0 || yearOptions.length > 0) fetchData()

    const channel = supabase
      .channel("conteo_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear, profilesMap])

  const drillData = useMemo(() => {
    if (!drillOpen || !drillSellerName) return { altas: [] as any[], pass: [] as any[] }

    const now = new Date()
    const weekStart = startOfWeekMonday(now)

    const inScopeSales = (l: any) => {
      const d = salesDate(l)
      if (!d) return false

      if (drillScope === "daily") return d.toDateString() === now.toDateString()
      if (drillScope === "weekly") return d >= weekStart && d <= now

      // monthly / histórico
      return isInSelectedPeriod(l)
    }

    const inScopeFulfilled = (l: any) => {
      if (!(norm(l.status) === "cumplidas" && l.billing_approved === true && isBillingMonth(l))) return false
      if (drillScope === "daily" || drillScope === "weekly") {
        // para cumplidas, igual respetamos el periodo seleccionado; diario/semanal no aplica a billing con certeza
        return true
      }
      return true
    }

    let base: any[] = []

    if (drillMode === "ventas") {
      base = allLeads.filter((l: any) => norm(l.agent_name) === norm(drillSellerName) && OPS_STATUSES.includes(norm(l.status)) && inScopeSales(l))
    } else {
      base = allLeads.filter((l: any) => norm(l.agent_name) === norm(drillSellerName) && inScopeFulfilled(l))
    }

    const altas = base.filter((l: any) => !isPass(l))
    const pass = base.filter((l: any) => isPass(l))

    const sortByDateDesc = (a: any, b: any) => {
      const da = drillMode === "ventas" ? salesDate(a) : safeDate(a?.created_at)
      const db = drillMode === "ventas" ? salesDate(b) : safeDate(b?.created_at)
      const ta = da ? da.getTime() : 0
      const tb = db ? db.getTime() : 0
      return tb - ta
    }

    altas.sort(sortByDateDesc)
    pass.sort(sortByDateDesc)

    return { altas, pass }
  }, [drillOpen, drillSellerName, drillMode, drillScope, drillTab, allLeads, selectedMonth, selectedYear])

  // --- MANEJO DE DESCARGA (mismo estilo OpsMetrics) ---
  const executeDownload = () => {
    // Exportamos el RESUMEN visible (tabla por vendedor). Para Conteo, esto ya es lo más útil.
    let filename = "Reporte_Conteo"
    if (downloadType === "current") {
      filename = `Reporte_Conteo_${selectedYear === "all" ? "Historico" : `${selectedMonth}_${selectedYear}`}`
    } else if (downloadType === "global") {
      filename = "Reporte_Conteo_Global"
    } else if (downloadType === "custom") {
      filename = `Reporte_Conteo_${downloadMonth}_${downloadYear}`
    }

    exportToCSV(agents, filename)
    setDownloadModalOpen(false)
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8 pb-20 custom-scrollbar">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Calculator className="h-8 w-8 text-indigo-600" /> Tablero de Conteo
          </h2>
          <p className="text-slate-500 font-medium text-sm">Auditoría real de producción y cumplimiento.</p>
        </div>

        <div className="flex gap-2">
          {/* BOTON DESCARGA (mismo look que OpsMetrics) */}
          <Button
            variant="outline"
            className="h-10 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-bold gap-2 shadow-sm"
            onClick={() => setDownloadModalOpen(true)}
          >
            <Download size={16} /> Descargar Reporte
          </Button>

          <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
            <Filter className="h-4 w-4 text-slate-400 ml-2" />
            <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px] border-none shadow-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-indigo-600">
                Histórico Total
              </SelectItem>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedYear !== "all" && (
            <>
              <div className="h-6 w-[1px] bg-slate-200"></div>
              <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                <SelectTrigger className="w-[130px] border-none shadow-none font-bold">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[...Array(12)].map((_, i) => {
                    const m = new Date(0, i).toLocaleString("es-ES", { month: "long" })
                    const label = m.charAt(0).toUpperCase() + m.slice(1)
                    return (
                      <SelectItem key={i} value={String(i + 1)}>
                        {label}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            </>
          )}
            {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-500 ml-2" />}
          </div>
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="shadow-xl border-t-4 border-t-indigo-500 bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold uppercase text-slate-500">
              Resumen General - {selectedYear === "all" ? "HISTÓRICO" : `${selectedMonth}/${selectedYear}`}
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 font-bold">
                Ventas: {globalTotals.monthly}
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 font-bold">
                Liquidables: {globalTotals.fulfilled}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px] pl-6 py-4 font-bold text-slate-700 dark:text-slate-300">Asesora</TableHead>
                <TableHead className="text-center font-bold text-slate-500 text-xs">Diario</TableHead>
                <TableHead className="text-center font-bold text-slate-500 text-xs">Semanal</TableHead>
                <TableHead className="text-center font-black text-lg bg-blue-50/50 dark:bg-blue-900/20 border-x border-slate-100 dark:border-slate-800 text-blue-700 dark:text-blue-400">
                  Ventas (Mes)
                </TableHead>
                <TableHead className="text-center font-bold text-green-700 dark:text-green-400">Cumplidas</TableHead>
                <TableHead className="text-center font-bold text-indigo-600 dark:text-indigo-400">Ratio %</TableHead>
                <TableHead className="text-center font-bold">Eficacia</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.name} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarImage src={agent.avatarUrl} className="object-cover" />
                        <AvatarFallback className="font-bold">{agent.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-base text-slate-800 dark:text-white">{agent.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                          {agent.status === "online" ? (
                            <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span>
                          ) : (
                            <span className="h-2 w-2 bg-slate-300 rounded-full"></span>
                          )}
                          {agent.status === "online" ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center text-slate-500 font-medium">
                    <button
                      className="w-full hover:underline hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      onClick={() => openDrill(agent.name, "ventas", "daily", "altas")}
                      disabled={!agent.daily || agent.daily <= 0}
                      title="Ver operaciones"
                    >
                      {agent.daily || "-"}
                    </button>
                  </TableCell>
                  <TableCell className="text-center text-slate-500 font-medium">
                    <button
                      className="w-full hover:underline hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                      onClick={() => openDrill(agent.name, "ventas", "weekly", "altas")}
                      disabled={!agent.weekly || agent.weekly <= 0}
                      title="Ver operaciones"
                    >
                      {agent.weekly || "-"}
                    </button>
                  </TableCell>

                  {/* VENTAS REALES (SIN PASS) + LABEL PASS */}
                  <TableCell className="text-center bg-blue-50/30 dark:bg-blue-900/10 border-x border-slate-100 dark:border-slate-800">
                    <div className="flex flex-col items-center">
                      <button
                        className="font-black text-2xl text-blue-600 dark:text-blue-400 hover:underline transition-colors"
                        onClick={() => openDrill(agent.name, "ventas", "monthly", "altas")}
                        title="Ver operaciones"
                      >
                        {agent.monthly}
                      </button>
                      {agent.monthlyPassCount > 0 && (
                        <button className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200 hover:opacity-90" onClick={() => openDrill(agent.name, "ventas", "monthly", "pass")} title="Ver PASS">+{agent.monthlyPassCount} pass</button>
                      )}
                    </div>
                  </TableCell>

                  {/* CUMPLIDAS (Pass Separado) */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                      {agent.fulfilled > 0 ? (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-md">
                          <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                          <button
                          className="font-black text-green-700 dark:text-green-400 text-lg hover:underline transition-colors"
                          onClick={() => openDrill(agent.name, "cumplidas", "monthly", "altas")}
                          title="Ver operaciones"
                        >
                          {agent.fulfilled}
                        </button>
                        </div>
                      ) : (
                        <span className="text-slate-300 font-bold text-lg">-</span>
                      )}
                      {agent.passCount > 0 && (
                        <button className="text-[10px] font-bold text-purple-700 bg-purple-50 px-1.5 rounded-full mt-1 border border-purple-200 hover:opacity-90" onClick={() => openDrill(agent.name, "cumplidas", "monthly", "pass")} title="Ver PASS">+{agent.passCount} pass</button>
                      )}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <span className={`font-bold ${agent.ratio >= 50 ? "text-green-600" : "text-slate-500"}`}>{agent.ratio}%</span>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full mx-auto overflow-hidden">
                      <div className={`h-full ${agent.ratio >= 50 ? "bg-green-500" : "bg-slate-400"}`} style={{ width: `${agent.ratio}%` }}></div>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DESGLOSE */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" /> Desglose de Ventas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agents.map(
            (agent) =>
              agent.monthly > 0 && (
                <Card key={agent.name} className="border shadow-sm dark:bg-[#1e1e1e] dark:border-slate-800">
                  <CardContent className="p-4">
                    <div className="flex justify-between items-center mb-3 border-b border-slate-100 dark:border-slate-800 pb-2">
                      <span className="font-bold text-sm text-slate-800 dark:text-white">{agent.name}</span>
                      <span className="text-[10px] font-bold text-green-600">Efectividad {agent.ratio}%</span>
                    </div>
                    <div className="space-y-3">
                      {agent.breakdown.length > 0 ? (
                        agent.breakdown.map((item: any) => {
                          const pct = item.sold > 0 ? (item.fulfilled / item.sold) * 100 : 0
                          return (
                            <div key={item.name} className="space-y-1">
                              <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                                <span>{item.name}</span>
                                <span className="font-mono text-slate-800 dark:text-slate-300">
                                  V:{item.sold} <span className="text-green-600">C:{item.fulfilled}</span>
                                </span>
                              </div>
                              <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden flex">
                                <div className="bg-green-500 h-full transition-all duration-500" style={{ width: `${pct}%` }}></div>
                              </div>
                            </div>
                          )
                        })
                      ) : (
                        <p className="text-[10px] text-slate-400 text-center py-4">Sin operaciones.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
          )}
        </div>
      </div>

      {/* LIQUIDACIÓN ESTIMADA */}
      <div className="mt-8 bg-slate-900 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center border border-slate-700 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-green-500/20 transition-all"></div>
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 bg-green-500/20 rounded-full ring-1 ring-green-500/50">
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Liquidación</h3>
            <p className="text-slate-400 text-xs font-medium max-w-sm leading-relaxed">
             Solo CUMPLIDAS auditadas y aprobadas.
            </p>
          </div>
        </div>
        <div className="text-right relative z-10 mt-4 md:mt-0">
          <p className="text-5xl font-black text-green-400 font-mono tracking-tighter drop-shadow-sm">
            $ {globalTotals.revenue.toLocaleString("es-AR")}
          </p>
          <div className="flex justify-end items-center gap-2 mt-2 opacity-80">
            <CheckCircle2 className="h-3 w-3 text-green-500" />
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Facturación Auditada</p>
          </div>
        </div>
      </div>

      
      {/* MODAL DRILLDOWN (operaciones) */}
      <Dialog open={drillOpen} onOpenChange={setDrillOpen}>
        <DialogContent className="max-w-[1100px] w-[92vw] max-h-[85vh] overflow-visible p-0 rounded-2xl shadow-2xl border">
          <DialogHeader className="sticky top-0 z-10 border-b bg-white/90 dark:bg-slate-950/90 backdrop-blur supports-[backdrop-filter]:bg-white/80 px-6 pt-5 pb-4">
            <DialogTitle className="flex flex-col gap-1">
              <span>
                {drillSellerName} — {drillMode === "ventas" ? "Ventas" : "Cumplidas"}{" "}
                {drillScope === "daily" ? "(Hoy)" : drillScope === "weekly" ? "(Semana)" : selectedYear === "all" ? "(Histórico)" : "(Mes)"}
              </span>
              <span className="text-xs text-slate-500 font-normal">Detalle para auditar (1:1 AdminPerformance)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 overflow-y-auto max-h-[68vh]">
            <div className="flex items-center gap-2 flex-wrap mt-4">
              <Button
                size="sm"
                variant={drillTab === "altas" ? "default" : "outline"}
                className={drillTab === "altas" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
                onClick={() => setDrillTab("altas")}
              >
                Altas ({drillData.altas.length})
              </Button>

              <Button size="sm" variant={drillTab === "pass" ? "default" : "outline"} onClick={() => setDrillTab("pass")}>
                PASS ({drillData.pass.length})
              </Button>

              {drillMode === "ventas" && drillTab === "altas" && (
                <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">
                  Puntos: {drillData.altas.reduce((acc: number, l: any) => acc + altasPointsOfLead(l), 0)}
                </span>
              )}
            </div>

            <div className="mt-4 w-full overflow-auto rounded-xl border">
              <Table className="min-w-[980px] w-full">
                <TableHeader>
                  <TableRow className="bg-slate-50 hover:bg-slate-50">
                    <TableHead className="w-[90px]">Capitas</TableHead>
                    <TableHead className="w-[130px]">Fecha ingreso</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="w-[140px]">CUIT</TableHead>
                    <TableHead className="w-[160px]">Prepaga</TableHead>
                    <TableHead className="w-[180px]">Plan</TableHead>
                    <TableHead className="w-[120px]">Estado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(drillTab === "altas" ? drillData.altas : drillData.pass).length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                        Sin operaciones para mostrar.
                      </TableCell>
                    </TableRow>
                  ) : (
                    (drillTab === "altas" ? drillData.altas : drillData.pass).map((l: any) => {
                      const fi = l?.fecha_ingreso ?? ""
                      const points = drillMode === "ventas" ? (isPass(l) ? 0 : altasPointsOfLead(l)) : 1
                      return (
                        <TableRow key={String(l.id)} className="hover:bg-slate-50/60">
                          <TableCell className="font-bold">{points}</TableCell>
                          <TableCell className="text-xs text-slate-600">{fi || "-"}</TableCell>
                          <TableCell className="font-medium">{l?.full_name || l?.nombre || "-"}</TableCell>
                          <TableCell className="font-mono text-xs">{l?.cuit || l?.dni || "-"}</TableCell>
                          <TableCell className="text-xs">{l?.prepaga || l?.quoted_prepaga || "-"}</TableCell>
                          <TableCell className="text-xs">{l?.plan || l?.quoted_plan || "-"}</TableCell>
                          <TableCell className="text-xs font-bold">{String(l?.status || "-")}</TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex justify-end mt-4">
              <Button variant="outline" onClick={() => setDrillOpen(false)}>
                Cerrar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

{/* MODAL DESCARGA (mismo patrón que OpsMetrics) */}
      <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" /> Descargar Reporte
            </DialogTitle>
            <DialogDescription>
              Exporta un CSV del resumen visible del tablero (tabla por vendedora).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${downloadType === "current" ? "border-green-500 bg-green-50" : "border-slate-200 hover:bg-slate-50"}`}
              onClick={() => setDownloadType("current")}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${downloadType === "current" ? "border-green-600" : "border-slate-300"}`}>
                {downloadType === "current" && <div className="h-2 w-2 rounded-full bg-green-600" />}
              </div>
              <div>
                <p className="font-bold text-sm">Reporte actual</p>
                <p className="text-xs text-slate-500">Lo que estás viendo con los filtros actuales.</p>
              </div>
            </div>

            <div
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${downloadType === "global" ? "border-green-500 bg-green-50" : "border-slate-200 hover:bg-slate-50"}`}
              onClick={() => setDownloadType("global")}
            >
              <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${downloadType === "global" ? "border-green-600" : "border-slate-300"}`}>
                {downloadType === "global" && <div className="h-2 w-2 rounded-full bg-green-600" />}
              </div>
              <div>
                <p className="font-bold text-sm">Reporte global</p>
                <p className="text-xs text-slate-500">Mismo resumen, con nombre “Global”.</p>
              </div>
            </div>

            <div
              className={`flex flex-col gap-3 p-3 rounded-lg border cursor-pointer transition-all ${downloadType === "custom" ? "border-green-500 bg-green-50" : "border-slate-200 hover:bg-slate-50"}`}
              onClick={() => setDownloadType("custom")}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${downloadType === "custom" ? "border-green-600" : "border-slate-300"}`}>
                  {downloadType === "custom" && <div className="h-2 w-2 rounded-full bg-green-600" />}
                </div>
                <div>
                  <p className="font-bold text-sm">Personalizado</p>
                  <p className="text-xs text-slate-500">Define mes y año (para el nombre del archivo).</p>
                </div>
              </div>
              {downloadType === "custom" && (
                <div className="flex gap-2 pl-7">
                  <Select value={downloadMonth} onValueChange={setDownloadMonth}>
                    <SelectTrigger className="h-9 w-[140px] text-xs font-bold">
                      <SelectValue placeholder="Mes" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...Array(12)].map((_, i) => {
                        const m = new Date(0, i).toLocaleString("es-ES", { month: "long" })
                        const label = m.charAt(0).toUpperCase() + m.slice(1)
                        return (
                          <SelectItem key={i} value={String(i + 1)}>
                            {label}
                          </SelectItem>
                        )
                      })}
                    </SelectContent>
                  </Select>
                  <Select value={downloadYear} onValueChange={setDownloadYear}>
                    <SelectTrigger className="h-9 w-[120px] text-xs font-bold">
                      <SelectValue placeholder="Año" />
                    </SelectTrigger>
                    <SelectContent>
                      {[currentYear, currentYear - 1].map((y) => (
                        <SelectItem key={y} value={String(y)}>
                          {y}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDownloadModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={executeDownload} className="bg-indigo-600 hover:bg-indigo-700">
              Descargar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
