"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calculator,
  Filter,
  DollarSign,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

// --- REGLAS DE CÁLCULO (COPIADAS DE OPSBILLING PARA CONSISTENCIA) ---
const INITIAL_CALC_RULES = {
    taxRate: 0.105, 
    prevencionVat: 0.21,
    doctoRed: { base: 1.80, specialPlan: '500' },
    ampf: { multiplier: 2.0 },
    prevencion: { 'A1': 0.90, 'A1 CP': 0.90, 'A2': 1.30, 'A2 CP': 1.30, 'A4': 1.50, 'A5': 1.50, default: 1.30 },
    generalGroup: { multiplier: 1.80 }, 
    portfolioRate: 0.05 
}

export function AdminConteo() {
  const supabase = createClient()

  // Filtros dinámicos
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // Años dinámicos
  const [yearOptions, setYearOptions] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [globalTotals, setGlobalTotals] = useState({ monthly: 0, fulfilled: 0, revenue: 0 })
  const [profilesMap, setProfilesMap] = useState<Record<string, string>>({}) // Mapa Nombre -> Avatar URL

  // Helpers
  const norm = (v: any) => String(v ?? "").trim().toLowerCase()

  // DEFINICIÓN DE VENTAS (Estados que suman al conteo mensual)
  const SALE_STATUSES = ['vendido', 'ingresado', 'precarga', 'medicas', 'legajo', 'demoras', 'cumplidas', 'finalizada']

  const startOfWeekMonday = (ref: Date) => {
    const d = new Date(ref)
    const day = d.getDay()
    const diffToMonday = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diffToMonday)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // --- FÓRMULA DE FACTURACIÓN (ESPEJO DE OPSBILLING) ---
  const calculateBillingValue = (op: any) => {
      // 1. Si tiene override manual en Billing, gana eso.
      if (op.billing_price_override !== null && op.billing_price_override !== undefined) {
          return parseFloat(op.billing_price_override.toString())
      }
      
      const full = parseFloat(op.full_price || op.price || "0")
      const aportes = parseFloat(op.aportes || "0")
      const desc = parseFloat(op.descuento || "0")
      const p = (op.prepaga || op.quoted_prepaga || "").toLowerCase()
      const plan = op.plan || op.quoted_plan || ""
      let val = 0

      if (p.includes("preven")) {
          const base = full - desc
          // @ts-ignore
          const rate = INITIAL_CALC_RULES.prevencion[plan] || INITIAL_CALC_RULES.prevencion.default
          val = base * rate
      } else if (p.includes("ampf")) {
          val = full * INITIAL_CALC_RULES.ampf.multiplier
      } else {
          let base = full * (1 - INITIAL_CALC_RULES.taxRate)
          if (p.includes("doctored") && plan.includes("500") && op.labor_condition === 'empleado') {
              base = aportes * (1 - INITIAL_CALC_RULES.taxRate)
          }
          val = base * INITIAL_CALC_RULES.generalGroup.multiplier
      }
      
      if (p.includes("pass") || op.type === 'pass') { val = 0 } // Pass no factura
      
      return Math.round(val)
  }

  // Genera años desde el primer lead de la historia
  const buildYearOptions = async () => {
    const currentYear = new Date().getFullYear()
    let minYear = currentYear

    try {
      const { data, error } = await supabase.from("leads").select("created_at").order("created_at", { ascending: true }).limit(1)
      if (!error && data && data.length > 0) {
        const y = new Date(data[0].created_at).getFullYear()
        if (!Number.isNaN(y)) minYear = y
      }
    } catch {}

    const years: string[] = []
    for (let y = minYear; y <= currentYear + 1; y++) years.push(String(y))
    setYearOptions(years)
    if (!years.includes(selectedYear)) setSelectedYear(String(currentYear))
  }

  // Carga perfiles reales para los avatares
  const fetchProfiles = async () => {
      const { data } = await supabase.from('profiles').select('full_name, avatar_url, email')
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

    // 1. Rango de fechas (o TODO si es 'all')
    let query = supabase.from("leads").select("*")
    
    if (selectedYear !== 'all') {
        const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString()
        const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0, 23, 59, 59).toISOString()
        query = query.gte("created_at", startDate).lte("created_at", endDate)
    }

    const { data: leads, error } = await query

    if (error) console.error("Error leyendo leads:", error)

    const safeLeads = Array.isArray(leads) ? leads : []
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

    const manualNamesThisPeriod = [...new Set(
      safeLeads
        .map((l: any) => String(l.agent_name ?? "").trim())
        .filter(Boolean)
        .filter((n: string) => !sellerNames.some((s) => norm(s) === norm(n)))
    )]

    const agentNames = [...new Set([...sellerNames, ...manualNamesThisPeriod])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"))

    // 3. PROCESAR DATOS
    let totalSalesGlobal = 0
    let totalFulfilledGlobal = 0

    const calculatePoints = (items: any[]) => {
        return items.reduce((acc, item) => {
            const pName = (item.prepaga || item.quoted_prepaga || "").toLowerCase()
            const isAMPF = pName.includes("ampf")
            const points = isAMPF ? 1 : (Number(item.capitas) || 1)
            return acc + points
        }, 0)
    }

    const processedAgents = agentNames.map((name) => {
      const agentLeads = safeLeads.filter((l: any) => norm(l.agent_name) === norm(name))

      // FILTRO: Solo lo que se considera venta
      const salesLeads = agentLeads.filter((l: any) => SALE_STATUSES.includes(norm(l.status)))

      // Contadores
      const dailyLeads = salesLeads.filter((l: any) => new Date(l.created_at).toDateString() === now.toDateString())
      const daily = calculatePoints(dailyLeads)

      const weeklyLeads = salesLeads.filter((l: any) => new Date(l.created_at) >= weekStart)
      const weekly = calculatePoints(weeklyLeads)
      
      const monthly = calculatePoints(salesLeads)

      // CUMPLIDAS: Solo tipo 'alta' (o sin tipo definido, asumiendo alta)
      const fulfilledLeads = agentLeads.filter((l: any) => norm(l.status) === "cumplidas" && (!l.type || l.type === 'alta'))
      const fulfilled = calculatePoints(fulfilledLeads)

      // PASS: Solo tipo 'pass'
      const passLeads = agentLeads.filter((l: any) => norm(l.status) === "cumplidas" && l.type === 'pass')
      const passCount = passLeads.length // Pass se cuenta por unidad, no cápita

      // Ratio REAL: Cumplidas / Ingresadas
      const ratioVal = monthly > 0 ? Math.round((fulfilled / monthly) * 100) : 0

      const recentMs = now.getTime() - 600000 // 10 min
      const status = agentLeads.some((l: any) => {
        if (!l.last_update) return false
        const t = new Date(l.last_update).getTime()
        return Number.isFinite(t) && t > recentMs
      }) ? "online" : "offline"

      totalSalesGlobal += monthly
      totalFulfilledGlobal += fulfilled

      // Foto Real
      const avatarUrl = profilesMap[norm(name)] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name}`

      return {
        name,
        avatarUrl,
        daily,
        weekly,
        monthly,
        fulfilled,
        passCount,
        ratio: ratioVal, // Número puro para mostrar %
        status,
        // Desglose visual
        breakdown: [...new Set(salesLeads.map((l: any) => l.prepaga || l.quoted_prepaga))] 
          .filter(Boolean)
          .map((prepName: any) => ({
            name: prepName, 
            sold: calculatePoints(salesLeads.filter((l: any) => (l.prepaga || l.quoted_prepaga) === prepName)),
            fulfilled: calculatePoints(salesLeads.filter((l: any) => (l.prepaga || l.quoted_prepaga) === prepName && norm(l.status) === "cumplidas")),
          })),
      }
    })

    setAgents(processedAgents)

    // --- CÁLCULO DE TOTALES (FÓRMULA EXACTA) ---
    // Usamos TODAS las cumplidas (incluso Pass si OpsBilling las contara, pero billing suele excluir pass)
    // Filtramos solo las que opsbilling consideraría para sumar $
    const billingCandidates = safeLeads.filter((l: any) => norm(l.status) === "cumplidas")
    
    const totalRevenue = billingCandidates.reduce((acc: number, curr: any) => {
        return acc + calculateBillingValue(curr)
    }, 0)

    setGlobalTotals({
      monthly: totalSalesGlobal,
      fulfilled: totalFulfilledGlobal,
      revenue: totalRevenue,
    })

    setLoading(false)
  }

  useEffect(() => {
    buildYearOptions()
    fetchProfiles()
  }, [])

  useEffect(() => {
    if (Object.keys(profilesMap).length > 0 || yearOptions.length > 0) {
        fetchData()
    }
    const channel = supabase
      .channel("conteo_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [selectedMonth, selectedYear, profilesMap]) // Dependencia en profilesMap para recargar avatares

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

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
          <Filter className="h-4 w-4 text-slate-400 ml-2" />
          
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[140px] border-none shadow-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold text-indigo-600">Histórico Total</SelectItem>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {selectedYear !== 'all' && (
              <>
                <div className="h-6 w-[1px] bg-slate-200"></div>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                    <SelectTrigger className="w-[130px] border-none shadow-none font-bold">
                    <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                    {[...Array(12)].map((_, i) => (
                        <SelectItem key={i} value={String(i + 1)}>{new Date(0, i).toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date(0, i).toLocaleString('es-ES', { month: 'long' }).slice(1)}</SelectItem>
                    ))}
                    </SelectContent>
                </Select>
              </>
          )}

          {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-500 ml-2" />}
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="shadow-xl border-t-4 border-t-indigo-500 bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold uppercase text-slate-500">
              Resumen General - {selectedYear === 'all' ? 'HISTÓRICO' : `${selectedMonth}/${selectedYear}`}
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
                <TableHead className="text-center font-black text-lg bg-blue-50/50 dark:bg-blue-900/20 border-x border-slate-100 dark:border-slate-800 text-blue-700 dark:text-blue-400">Ventas (Mes)</TableHead>
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
                          {agent.status === "online" ? <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span> : <span className="h-2 w-2 bg-slate-300 rounded-full"></span>}
                          {agent.status === "online" ? "Online" : "Offline"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  {/* CARGAS (Actividad) */}
                  <TableCell className="text-center text-slate-500 font-medium">{agent.daily || "-"}</TableCell>
                  <TableCell className="text-center text-slate-500 font-medium">{agent.weekly || "-"}</TableCell>

                  {/* VENTAS REALES */}
                  <TableCell className="text-center bg-blue-50/30 dark:bg-blue-900/10 border-x border-slate-100 dark:border-slate-800">
                    <span className="font-black text-2xl text-blue-600 dark:text-blue-400">{agent.monthly}</span>
                  </TableCell>

                  {/* CUMPLIDAS (Pass Chiquito abajo) */}
                  <TableCell className="text-center">
                    <div className="flex flex-col items-center">
                        {agent.fulfilled > 0 ? (
                            <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-md">
                                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                                <span className="font-black text-green-700 dark:text-green-400 text-lg">{agent.fulfilled}</span>
                            </div>
                        ) : (
                            <span className="text-slate-300 font-bold text-lg">-</span>
                        )}
                        {agent.passCount > 0 && (
                            <span className="text-[10px] font-bold text-purple-600 bg-purple-50 px-1.5 rounded-full mt-1">
                                +{agent.passCount} pass
                            </span>
                        )}
                    </div>
                  </TableCell>

                  {/* RATIO % (Matemático Real) */}
                  <TableCell className="text-center">
                    <span className={`font-bold ${agent.ratio >= 50 ? 'text-green-600' : 'text-slate-500'}`}>
                        {agent.ratio}%
                    </span>
                  </TableCell>

                  {/* EFICACIA (Visual) */}
                  <TableCell className="text-center">
                      <div className="w-full max-w-[80px] h-2 bg-slate-100 rounded-full mx-auto overflow-hidden">
                          <div className={`h-full ${agent.ratio >= 50 ? 'bg-green-500' : 'bg-slate-400'}`} style={{width: `${agent.ratio}%`}}></div>
                      </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DETALLE POR VENDEDORA (DINÁMICO) */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-700 dark:text-slate-300 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" /> Desglose de Ventas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agents.map((agent) => (
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
                                {/* CAMBIO VISUAL V: / C: */}
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
          ))}
        </div>
      </div>

      {/* REMUNERACIÓN ESTIMADA REAL (Con Fórmula Importada) */}
      <div className="mt-8 bg-slate-900 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center border border-slate-700 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-green-500/20 transition-all"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 bg-green-500/20 rounded-full ring-1 ring-green-500/50">
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Liquidación Estimada</h3>
            <p className="text-slate-400 text-xs font-medium max-w-sm leading-relaxed">
               Calculado sobre leads en estado CUMPLIDAS.
            </p>
          </div>
        </div>
        <div className="text-right relative z-10 mt-4 md:mt-0">
          <p className="text-5xl font-black text-green-400 font-mono tracking-tighter drop-shadow-sm">
            $ {globalTotals.revenue.toLocaleString("es-AR")}
          </p>
          <div className="flex justify-end items-center gap-2 mt-2 opacity-80">
             <CheckCircle2 className="h-3 w-3 text-green-500"/>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Facturación Auditada</p>
          </div>
        </div>
      </div>
    </div>
  )
}