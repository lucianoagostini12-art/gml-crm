"use client"

import { useState, useEffect } from "react"
// Import corregido para evitar errores de Build en Vercel
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

  // Filtros dinámicos (Por defecto mes y año actual)
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())

  // ✅ Años dinámicos
  const [yearOptions, setYearOptions] = useState<string[]>([])

  const [loading, setLoading] = useState(true)
  const [agents, setAgents] = useState<any[]>([])
  const [prepagaStats, setPrepagaStats] = useState<any[]>([])
  const [globalTotals, setGlobalTotals] = useState({ monthly: 0, fulfilled: 0, revenue: 0 })

  // Helpers
  const norm = (v: any) => String(v ?? "").trim().toLowerCase()

  const startOfWeekMonday = (ref: Date) => {
    const d = new Date(ref)
    const day = d.getDay() // 0 domingo, 1 lunes...
    const diffToMonday = day === 0 ? -6 : 1 - day
    d.setDate(d.getDate() + diffToMonday)
    d.setHours(0, 0, 0, 0)
    return d
  }

  // ✅ Genera años desde el primer lead hasta el año actual + 1
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
      // si falla, nos quedamos con currentYear
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

    // 1. Rango de fechas para el filtro real
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

    // ✅ Estos 4 SIEMPRE se tratan como MANUALES (aunque existan como profiles)
    const MANUAL_BUCKETS = ["Iara", "Oficina", "Calle", "Otros"]
    const manualBucketSet = new Set(MANUAL_BUCKETS.map((n) => norm(n)))

    // ✅ 2) Vendedores reales desde profiles (role='seller')
    let sellerNames: string[] = []
    try {
      const { data: sellers, error: sellersErr } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("role", "seller")

      if (sellersErr) {
        console.warn("No se pudo leer profiles (sellers):", sellersErr.message)
      } else {
        sellerNames = (sellers || [])
          .map((s: any) => String(s.full_name ?? "").trim())
          .filter(Boolean)
          // ✅ IMPORTANTÍSIMO: si alguno de estos 4 está en profiles, NO lo tratamos como seller
          .filter((n: string) => !manualBucketSet.has(norm(n)))
      }
    } catch (e) {
      console.warn("profiles no disponible:", e)
    }

    // ✅ 3) Manuales SOLO si hay ventas en el período
    // Incluye: Iara/Oficina/Calle/Otros + cualquier otro manual que aparezca en agent_name ese mes
    const manualNamesThisPeriod = [...new Set(
      safeLeads
        .map((l: any) => String(l.agent_name ?? "").trim())
        .filter(Boolean)
        // manual = no es seller (por nombre)
        .filter((n: string) => !sellerNames.some((s) => norm(s) === norm(n)))
    )]

    // ✅ Unión final:
    // - sellers SIEMPRE
    // - manuales SOLO si están en leads del mes
    const agentNames = [...new Set([...sellerNames, ...manualNamesThisPeriod])]
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "es"))

    // 4. PROCESAR DATOS POR ASESORA / PRODUCTOR
    const processedAgents = agentNames.map((name) => {
      const agentLeads = safeLeads.filter((l: any) => norm(l.agent_name) === norm(name))

      const daily = agentLeads.filter((l: any) => new Date(l.created_at).toDateString() === now.toDateString()).length
      const weekly = agentLeads.filter((l: any) => new Date(l.created_at) >= weekStart).length

      const monthly = agentLeads.length
      const fulfilled = agentLeads.filter((l: any) => norm(l.status) === "cumplidas").length
      const efficiency = monthly > 0 ? Math.round((fulfilled / monthly) * 100) : 0

      const passCount = agentLeads.filter((l: any) => norm(l.status) === "pass").length

      const recentMs = now.getTime() - 600000 // 10 min
      const status = agentLeads.some((l: any) => {
        if (!l.last_update) return false
        const t = new Date(l.last_update).getTime()
        return Number.isFinite(t) && t > recentMs
      })
        ? "online"
        : "offline"

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
        breakdown: [...new Set(agentLeads.map((l: any) => l.operator))]
          .filter(Boolean)
          .map((op: any) => ({
            name: op,
            sold: agentLeads.filter((l: any) => l.operator === op).length,
            fulfilled: agentLeads.filter((l: any) => l.operator === op && norm(l.status) === "cumplidas").length,
          })),
      }
    })

    // 5. PRODUCTO (PREPAGAS GLOBAL)
    const prepagas = [...new Set(safeLeads.map((l: any) => l.operator))].filter(Boolean)
    const pStats = prepagas.map((p: any) => {
      const pLeads = safeLeads.filter((l: any) => l.operator === p)
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
    setGlobalTotals({
      monthly: safeLeads.length,
      fulfilled: safeLeads.filter((l: any) => norm(l.status) === "cumplidas").length,
      revenue: safeLeads
        .filter((l: any) => norm(l.status) === "cumplidas")
        .reduce((acc: number, curr: any) => acc + (Number(curr.price) || 0), 0),
    })

    setLoading(false)
  }

  useEffect(() => {
    buildYearOptions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel("conteo_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear])

  const getRatioColor = (ratioStr: string) => {
    const num = parseInt(ratioStr.split(":")[1])
    if (num === 0) return "text-slate-400 bg-slate-50 border-slate-200"
    if (num <= 20) return "text-green-600 bg-green-50 border-green-200"
    if (num <= 40) return "text-blue-600 bg-blue-50 border-blue-200"
    return "text-red-600 bg-red-50 border-red-200"
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-8 pb-20">
      {/* HEADER CON FILTROS REALES */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Calculator className="h-8 w-8 text-indigo-600" /> Tablero de Conteo
          </h2>
          <p className="text-slate-500 font-medium">Auditoría real de producción y cumplimiento.</p>
        </div>

        <div className="flex items-center gap-2 bg-white dark:bg-slate-900 p-2 rounded-lg border shadow-sm">
          <Filter className="h-4 w-4 text-slate-400 ml-2" />
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[130px] border-none shadow-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">Enero</SelectItem>
              <SelectItem value="2">Febrero</SelectItem>
              <SelectItem value="3">Marzo</SelectItem>
              <SelectItem value="4">Abril</SelectItem>
              <SelectItem value="5">Mayo</SelectItem>
              <SelectItem value="6">Junio</SelectItem>
              <SelectItem value="7">Julio</SelectItem>
              <SelectItem value="8">Agosto</SelectItem>
              <SelectItem value="9">Septiembre</SelectItem>
              <SelectItem value="10">Octubre</SelectItem>
              <SelectItem value="11">Noviembre</SelectItem>
              <SelectItem value="12">Diciembre</SelectItem>
            </SelectContent>
          </Select>

          <div className="h-6 w-[1px] bg-slate-200"></div>

          {/* ✅ Año dinámico */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[90px] border-none shadow-none font-bold">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.length > 0 ? (
                yearOptions.map((y) => (
                  <SelectItem key={y} value={y}>
                    {y}
                  </SelectItem>
                ))
              ) : (
                <SelectItem value={selectedYear}>{selectedYear}</SelectItem>
              )}
            </SelectContent>
          </Select>

          {loading && <RefreshCw className="h-4 w-4 animate-spin text-indigo-500 ml-2" />}
        </div>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="shadow-xl border-t-4 border-t-indigo-500">
        <CardHeader className="bg-slate-50/50 pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm font-bold uppercase text-slate-500">
              Resumen General - {selectedMonth}/{selectedYear}
            </CardTitle>
            <div className="flex gap-2">
              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                Total Mes: {globalTotals.monthly}
              </Badge>
              <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                Cumplidas: {globalTotals.fulfilled}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[250px] pl-6 py-4">Asesora (Estado)</TableHead>
                <TableHead className="text-center font-bold">Diarias</TableHead>
                <TableHead className="text-center font-bold">Semanales</TableHead>
                <TableHead className="text-center font-black text-lg bg-blue-50/50 border-x">Mensuales</TableHead>
                <TableHead className="text-center font-bold text-green-700">Cumplidas</TableHead>
                <TableHead className="text-center font-bold text-indigo-600">Ratio</TableHead>
                <TableHead className="text-center">Eficiencia</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {agents.map((agent) => (
                <TableRow key={agent.name} className="hover:bg-slate-50 transition-colors">
                  <TableCell className="pl-6 py-4">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 border border-slate-200">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} />
                        <AvatarFallback>{agent.name[0]}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-bold text-base">{agent.name}</p>
                        <p className="text-[10px] text-slate-400 uppercase font-bold flex items-center gap-1">
                          {agent.status === "online" ? <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span> : null}
                          {agent.status === "online" ? "Activa ahora" : "Offline"}
                        </p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center font-bold">{agent.daily || "-"}</TableCell>
                  <TableCell className="text-center font-bold">{agent.weekly}</TableCell>

                  <TableCell className="text-center bg-blue-50/30 border-x">
                    <div className="flex flex-col">
                      <span className="font-black text-2xl text-blue-600">{agent.monthly}</span>
                      {agent.passCount > 0 && <span className="text-[9px] text-slate-400">+{agent.passCount} Pass</span>}
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 rounded-md">
                      <CheckCircle2 className="h-4 w-4 text-green-600" />
                      <span className="font-bold text-green-700">{agent.fulfilled}</span>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge variant="outline" className={`${getRatioColor(agent.ratio)} font-mono`}>
                      <Crosshair className="h-3 w-3 mr-1" /> {agent.ratio}
                    </Badge>
                  </TableCell>

                  <TableCell className="text-center font-black text-lg text-slate-700">{agent.efficiency}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* DETALLE POR VENDEDORA (DINÁMICO) */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-slate-700 flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-green-600" /> Detalle Vendido vs. Cumplido
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {agents.map((agent) => (
            <Card key={agent.name} className="border shadow-sm">
              <CardContent className="p-4">
                <div className="flex justify-between items-center mb-3 border-b pb-2">
                  <span className="font-bold text-sm">{agent.name}</span>
                  <span className="text-[10px] font-bold text-green-600">{agent.efficiency}% Efic.</span>
                </div>
                <div className="space-y-3">
                  {agent.breakdown.length > 0 ? (
                    agent.breakdown.map((item: any) => {
                      const pct = item.sold > 0 ? (item.fulfilled / item.sold) * 100 : 0
                      return (
                        <div key={item.name} className="space-y-1">
                          <div className="flex justify-between text-[10px] uppercase font-bold text-slate-500">
                            <span>{item.name}</span>
                            <span className="font-mono text-slate-800">
                              V:{item.sold} C:{item.fulfilled}
                            </span>
                          </div>
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden flex">
                            <div className="bg-green-500 h-full" style={{ width: `${pct}%` }}></div>
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-[10px] text-slate-400 text-center py-4">Sin operaciones este mes.</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* REMUNERACIÓN ESTIMADA REAL */}
      <div className="mt-8 bg-slate-900 text-white p-6 rounded-xl flex flex-col md:flex-row justify-between items-center border border-slate-700 shadow-2xl">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-green-500/20 rounded-full">
            <DollarSign className="h-8 w-8 text-green-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold tracking-tight">Caja de Cobranza (Mes)</h3>
            <p className="text-slate-400 text-sm font-medium">Suma de Price en ventas cumplidas del periodo.</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-4xl font-black text-green-400 font-mono tracking-tighter">
            $ {globalTotals.revenue.toLocaleString("es-AR")}
          </p>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Facturación final</p>
        </div>
      </div>
    </div>
  )
}
