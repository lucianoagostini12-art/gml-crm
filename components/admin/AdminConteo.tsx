"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Calculator,
  Filter,
  DollarSign,
  Crosshair,
  RefreshCw,
  CheckCircle2,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"

export function AdminConteo() {
  const supabase = createClient()

  // Filtros dinámicos
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // Años dinámicos
  const [yearOptions, setYearOptions] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [prepagaStats, setPrepagaStats] = useState<any[]>([])
  const [globalTotals, setGlobalTotals] = useState({ monthly: 0, fulfilled: 0, revenue: 0 })

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

  // Genera años desde el primer lead de la historia
  const buildYearOptions = async () => {
    const currentYear = new Date().getFullYear()
    let minYear = currentYear

    try {
      const { data, error } = await supabase
        .from("leads")
        .select("created_at")
        .order("created_at", { ascending: true })
        .limit(1)

      if (!error && data && data.length > 0) {
        const y = new Date(data[0].created_at).getFullYear()
        if (!Number.isNaN(y)) minYear = y
      }
    } catch {
      // fallback
    }

    const years: string[] = []
    for (let y = minYear; y <= currentYear + 1; y++) years.push(String(y))

    setYearOptions(years)

    if (!years.includes(selectedYear)) {
      setSelectedYear(String(currentYear))
    }
  }

  const fetchData = async () => {
    setLoading(true)

    // 1. Rango de fechas
    const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString()
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0, 23, 59, 59).toISOString()

    const { data: leads, error } = await supabase
      .from("leads")
      .select("*")
      .gte("created_at", startDate)
      .lte("created_at", endDate)

    if (error) console.error("Error leyendo leads:", error)

    const safeLeads = Array.isArray(leads) ? leads : []
    const now = new Date()
    const weekStart = startOfWeekMonday(now)

    // 2. Identificar Vendedores
    const MANUAL_BUCKETS = ["Iara", "Oficina", "Calle", "Otros"]
    const manualBucketSet = new Set(MANUAL_BUCKETS.map((n) => norm(n)))

    let sellerNames: string[] = []
    try {
      const { data: sellers } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("role", "seller")

      sellerNames = (sellers || [])
        .map((s: any) => String(s.full_name ?? "").trim())
        .filter(Boolean)
        .filter((n: string) => !manualBucketSet.has(norm(n)))
    } catch (e) {
      console.warn("profiles no disponible:", e)
    }

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

    const processedAgents = agentNames.map((name) => {
      const agentLeads = safeLeads.filter((l: any) => norm(l.agent_name) === norm(name))

      // FILTRO: Solo lo que se considera venta
      const salesLeads = agentLeads.filter((l: any) => SALE_STATUSES.includes(norm(l.status)))

      // Contadores
      const daily = salesLeads.filter((l: any) => new Date(l.created_at).toDateString() === now.toDateString()).length
      const weekly = salesLeads.filter((l: any) => new Date(l.created_at) >= weekStart).length
      
      const monthly = salesLeads.length
      const fulfilled = agentLeads.filter((l: any) => norm(l.status) === "cumplidas").length
      const efficiency = monthly > 0 ? Math.round((fulfilled / monthly) * 100) : 0

      const passCount = agentLeads.filter((l: any) => norm(l.status) === "pass").length

      const recentMs = now.getTime() - 600000 // 10 min
      const status = agentLeads.some((l: any) => {
        if (!l.last_update) return false
        const t = new Date(l.last_update).getTime()
        return Number.isFinite(t) && t > recentMs
      }) ? "online" : "offline"

      // Acumular globales
      totalSalesGlobal += monthly
      totalFulfilledGlobal += fulfilled

      return {
        name,
        daily,
        weekly,
        monthly,
        fulfilled,
        efficiency,
        passCount,
        ratio: `1:${monthly > 0 ? Math.round(100 / monthly) : 0}`,
        status,
        lastAction: "Hoy",
        // CORRECCIÓN: Usamos 'prepaga' explícitamente en lugar de 'operator'
        breakdown: [...new Set(salesLeads.map((l: any) => l.prepaga))] 
          .filter(Boolean)
          .map((prepName: any) => ({
            name: prepName, // Ahora mostrará la prepaga
            sold: salesLeads.filter((l: any) => l.prepaga === prepName).length,
            fulfilled: salesLeads.filter((l: any) => l.prepaga === prepName && norm(l.status) === "cumplidas").length,
          })),
      }
    })

    // 5. Estadísticas Globales de Prepaga (CORREGIDO TAMBIÉN AQUÍ)
    const prepagas = [...new Set(safeLeads.map((l: any) => l.prepaga))].filter(Boolean)
    const pStats = prepagas.map((p: any) => {
      const pLeads = safeLeads.filter((l: any) => l.prepaga === p)
      const sold = pLeads.length
      const fulfilled = pLeads.filter((l: any) => norm(l.status) === "cumplidas").length
      return {
        name: p,
        totalSold: sold,
        totalFulfilled: fulfilled,
        rate: sold > 0 ? Math.round((fulfilled / sold) * 100) : 0,
        color: "text-slate-800",
      }
    })

    setAgents(processedAgents)
    setPrepagaStats(pStats)

    // --- CÁLCULO DE TOTALES (CONECTADO A FACTURACIÓN OPS) ---
    const fulfilledLeads = safeLeads.filter((l: any) => norm(l.status) === "cumplidas")
    
    const totalRevenue = fulfilledLeads.reduce((acc: number, curr: any) => {
        const billingVal = Number(curr.billing_price_override)
        const salesVal = Number(curr.price) || Number(curr.full_price)
        const finalVal = !isNaN(billingVal) && billingVal !== 0 ? billingVal : (salesVal || 0)
        return acc + finalVal
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
  }, [])

  useEffect(() => {
    fetchData()
    // Realtime para actualizar
    const channel = supabase
      .channel("conteo_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [selectedMonth, selectedYear])

  const getRatioColor = (ratioStr: string) => {
    const num = parseInt(ratioStr.split(":")[1])
    if (num === 0) return "text-slate-400 bg-slate-50 border-slate-200"
    if (num <= 20) return "text-green-600 bg-green-50 border-green-200"
    if (num <= 40) return "text-blue-600 bg-blue-50 border-blue-200"
    return "text-red-600 bg-red-50 border-red-200"
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

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
          <Filter className="h-4 w-4 text-slate-400 ml-2" />
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

          <div className="h-6 w-[1px] bg-slate-200"></div>

          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] border-none shadow-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
            </SelectContent>
          </Select>

          {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-500 ml-2" />}
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="shadow-xl border-t-4 border-t-indigo-500 bg-white dark:bg-[#1e1e1e] border-slate-200 dark:border-slate-800">
        <CardHeader className="bg-slate-50/50 dark:bg-slate-900/50 pb-2 border-b border-slate-100 dark:border-slate-800">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold uppercase text-slate-500">
              Resumen General - {selectedMonth}/{selectedYear}
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
                <TableHead className="text-center font-bold text-slate-500 text-xs">Cargas Hoy</TableHead>
                <TableHead className="text-center font-bold text-slate-500 text-xs">Cargas Sem</TableHead>
                <TableHead className="text-center font-black text-lg bg-blue-50/50 dark:bg-blue-900/20 border-x border-slate-100 dark:border-slate-800 text-blue-700 dark:text-blue-400">Ventas (Mes)</TableHead>
                <TableHead className="text-center font-bold text-green-700 dark:text-green-400">Cumplidas</TableHead>
                <TableHead className="text-center font-bold text-indigo-600 dark:text-indigo-400">Pass / Rechazo</TableHead>
                <TableHead className="text-center font-bold">Eficacia</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.name} className="hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} />
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

                  {/* CUMPLIDAS */}
                  <TableCell className="text-center">
                    {agent.fulfilled > 0 ? (
                        <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 dark:bg-green-900/30 rounded-md">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
                        <span className="font-black text-green-700 dark:text-green-400">{agent.fulfilled}</span>
                        </div>
                    ) : (
                        <span className="text-slate-300 font-bold">-</span>
                    )}
                  </TableCell>

                  {/* PASS / RECHAZO */}
                  <TableCell className="text-center">
                    {agent.passCount > 0 ? (
                        <Badge variant="outline" className="text-red-600 bg-red-50 border-red-200 font-mono">
                            {agent.passCount}
                        </Badge>
                    ) : (
                        <span className="text-slate-300">-</span>
                    )}
                  </TableCell>

                  {/* EFICACIA */}
                  <TableCell className="text-center">
                      <div className="flex flex-col items-center">
                        <span className={`font-black text-lg ${agent.efficiency >= 50 ? 'text-green-600' : 'text-slate-600'}`}>{agent.efficiency}%</span>
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
                    <span className="text-[10px] font-bold text-green-600">Eficiencia {agent.efficiency}%</span>
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
                                V:{item.sold} <span className="text-green-600">L:{item.fulfilled}</span>
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

      {/* REMUNERACIÓN ESTIMADA REAL */}
      <div className="mt-8 bg-slate-900 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center border border-slate-700 shadow-2xl relative overflow-hidden group">
        {/* Efecto de brillo de fondo */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-green-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-green-500/20 transition-all"></div>
        
        <div className="flex items-center gap-4 relative z-10">
          <div className="p-4 bg-green-500/20 rounded-full ring-1 ring-green-500/50">
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Liquidación Estimada</h3>
            <p className="text-slate-400 text-xs font-medium max-w-sm leading-relaxed">
                Calculado sobre leads en estado <span className="text-green-400 font-bold">CUMPLIDAS</span>. 
                Prioriza valores auditados por ADM.
            </p>
          </div>
        </div>
        <div className="text-right relative z-10 mt-4 md:mt-0">
          <p className="text-5xl font-black text-green-400 font-mono tracking-tighter drop-shadow-sm">
            $ {globalTotals.revenue.toLocaleString("es-AR")}
          </p>
          <div className="flex justify-end items-center gap-2 mt-2 opacity-80">
             <CheckCircle2 className="h-3 w-3 text-green-500"/>
             <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Facturación</p>
          </div>
        </div>
      </div>
    </div>
  )
}