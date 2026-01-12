"use client"

import { useEffect, useState, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Trophy, Crown, Star, Users, DollarSign, TrendingUp, Filter, Loader2, ArrowUpCircle } from "lucide-react"

// --- REGLAS DE CÁLCULO (Copiadas de AdminConteo/OpsBilling) ---
const INITIAL_CALC_RULES = {
  taxRate: 0.105,
  prevencionVat: 0.21,
  doctoRed: { base: 1.8, specialPlan: "500" },
  ampf: { multiplier: 2.0 },
  prevencion: { A1: 0.9, "A1 CP": 0.9, A2: 1.3, "A2 CP": 1.3, A4: 1.5, A5: 1.5, default: 1.3 },
  generalGroup: { multiplier: 1.8 },
  portfolioRate: 0.05,
}

// --- TIPOS ---
type RankingMetric = "volume" | "revenue" | "ticket"
type Period = "month" | "year"

export function AdminRanking() {
  const supabase = createClient()

  // Estados de Filtro
  const [period, setPeriod] = useState<Period>("month")
  const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString())
  const [metric, setMetric] = useState<RankingMetric>("revenue") // Default: Plata
  const [prepagaFilter, setPrepagaFilter] = useState("all")

  // Data
  const [rankings, setRankings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [prepagasAvailable, setPrepagasAvailable] = useState<string[]>([])

  // Helpers
  const norm = (v: any) => String(v ?? "").trim().toLowerCase()
  const formatMoney = (val: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(val)

  // 1. CALCULADORA FINANCIERA (Lógica OpsBilling)
  const calculateNetValue = (op: any) => {
    let val = 0

    // Si tiene override manual de OPS, ese es el valor final
    if (op.billing_price_override !== null && op.billing_price_override !== undefined) {
      return parseFloat(op.billing_price_override.toString())
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

    return val
  }

  // 2. FETCH DATA
  const fetchData = async () => {
    setLoading(true)
    
    // Definir Rango Billing Period
    const targetPeriod = `${selectedYear}-${selectedMonth.padStart(2, "0")}`
    const yearStart = `${selectedYear}-01`
    const yearEnd = `${selectedYear}-12`

    let query = supabase
        .from("leads")
        .select("*")
        .eq("status", "cumplidas")
        .eq("billing_approved", true)
        .not("billing_period", "is", null) // Solo lo que tiene periodo asignado

    if (period === "month") {
        query = query.eq("billing_period", targetPeriod)
    } else {
        query = query.gte("billing_period", yearStart).lte("billing_period", yearEnd)
    }

    const { data: leads, error } = await query
    
    // Perfiles para avatares
    const { data: profiles } = await supabase.from("profiles").select("full_name, avatar_url, email")
    const avatarMap: Record<string, string> = {}
    if (profiles) {
        profiles.forEach((p: any) => {
            const key = norm(p.full_name)
            if (!key) return
            avatarMap[key] = p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}`
        })
    }

    if (leads) {
        // A. Extraer prepagas únicas para el filtro
        const uniquePrepagas = Array.from(new Set(leads.map((l:any) => l.prepaga || l.quoted_prepaga).filter(Boolean)))
        setPrepagasAvailable(uniquePrepagas as string[])

        // B. Agrupar por Vendedor
        const stats: Record<string, { name: string, count: number, revenue: number, sales: number }> = {}

        leads.forEach((l: any) => {
            // Filtro de Prepaga en memoria
            const pName = l.prepaga || l.quoted_prepaga || ""
            if (prepagaFilter !== "all" && pName !== prepagaFilter) return

            const agent = (l.agent_name || "Desconocido").trim()
            if (!stats[agent]) stats[agent] = { name: agent, count: 0, revenue: 0, sales: 0 }

            // Lógica de Volumen (Cápitas) - Igual que RankingsView
            const isAMPF = pName.toLowerCase().includes("ampf")
            const points = isAMPF ? 1 : Number(l.capitas) || 1
            
            // Cálculo Financiero
            const money = calculateNetValue(l)

            stats[agent].count += points
            stats[agent].sales += 1 // Cantidad de operaciones (para ticket promedio)
            stats[agent].revenue += money
        })

        // C. Convertir a Array y Ordenar
        const array = Object.values(stats).map((s) => ({
            ...s,
            ticket: s.sales > 0 ? s.revenue / s.sales : 0,
            avatar: avatarMap[norm(s.name)] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${s.name}`
        }))

        array.sort((a, b) => {
            if (metric === "volume") return b.count - a.count
            if (metric === "revenue") return b.revenue - a.revenue
            if (metric === "ticket") return b.ticket - a.ticket
            return 0
        })

        // D. Calcular Gap y Posiciones
        const finalRankings = array.map((u, i) => {
            const score = metric === "volume" ? u.count : metric === "revenue" ? u.revenue : u.ticket
            let gapToNext = null
            if (i > 0) {
                const prev = array[i - 1]
                const prevScore = metric === "volume" ? prev.count : metric === "revenue" ? prev.revenue : prev.ticket
                gapToNext = { 
                    diff: metric === "volume" ? (prevScore - score).toFixed(0) : formatMoney(prevScore - score),
                    name: prev.name.split(" ")[0] 
                }
            }
            return { ...u, position: i + 1, score, gapToNext }
        })

        setRankings(finalRankings)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [period, selectedMonth, selectedYear, metric, prepagaFilter])

  // --- RENDER ---
  const top1 = rankings.find((r) => r.position === 1)
  const top2 = rankings.find((r) => r.position === 2)
  const top3 = rankings.find((r) => r.position === 3)
  const restOfTeam = rankings.filter((r) => r.position > 3)

  const renderScore = (score: number) => {
      if (metric === "volume") return <span className="text-3xl font-black">{Math.round(score)}</span>
      return <span className="text-2xl font-black">{formatMoney(score)}</span>
  }

  const renderMetricLabel = () => {
      if (metric === "volume") return "Cápitas"
      if (metric === "revenue") return "Facturación Est."
      if (metric === "ticket") return "Ticket Promedio"
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-8 pb-20 custom-scrollbar">
        
        {/* HEADER & FILTERS */}
        <div className="flex flex-col gap-6">
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 flex items-center gap-3">
                        <Trophy className="h-8 w-8 text-yellow-500" /> Ranking Oficial
                    </h2>
                    <p className="text-slate-500 font-medium text-sm">Basado en liquidaciones aprobadas (Billing Approved).</p>
                </div>
                
                <div className="flex items-center gap-2 bg-white p-2 rounded-xl border shadow-sm">
                    <Select value={period} onValueChange={(v: any) => setPeriod(v)}>
                        <SelectTrigger className="w-[100px] border-none font-bold bg-slate-100"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="month">Mensual</SelectItem><SelectItem value="year">Anual</SelectItem></SelectContent>
                    </Select>
                    
                    {period === 'month' && (
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[120px] border-none font-bold"><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {[...Array(12)].map((_, i) => {
                                    const m = new Date(0, i).toLocaleString("es-ES", { month: "long" })
                                    return <SelectItem key={i} value={String(i + 1)} className="capitalize">{m}</SelectItem>
                                })}
                            </SelectContent>
                        </Select>
                    )}
                    
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[90px] border-none font-bold"><SelectValue /></SelectTrigger>
                        <SelectContent><SelectItem value="2025">2025</SelectItem><SelectItem value="2026">2026</SelectItem></SelectContent>
                    </Select>
                </div>
            </div>

            {/* METRIC TABS */}
            <div className="flex flex-wrap gap-4 justify-center">
                <Button variant={metric==='revenue'?"default":"outline"} onClick={()=>setMetric('revenue')} className="h-10 px-6 gap-2 rounded-full border-2">
                    <DollarSign size={16}/> Facturación
                </Button>
                <Button variant={metric==='volume'?"default":"outline"} onClick={()=>setMetric('volume')} className="h-10 px-6 gap-2 rounded-full border-2">
                    <Users size={16}/> Volumen (Cápitas)
                </Button>
                <Button variant={metric==='ticket'?"default":"outline"} onClick={()=>setMetric('ticket')} className="h-10 px-6 gap-2 rounded-full border-2">
                    <TrendingUp size={16}/> Ticket Promedio
                </Button>
                
                <div className="w-px h-10 bg-slate-200 mx-2 hidden md:block"></div>
                
                <Select value={prepagaFilter} onValueChange={setPrepagaFilter}>
                    <SelectTrigger className="w-[180px] h-10 rounded-full border-2 border-slate-200 font-bold text-slate-600">
                        <Filter size={14} className="mr-2"/> <SelectValue placeholder="Todas las empresas" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all" className="font-bold">🏢 Todas las Empresas</SelectItem>
                        {prepagasAvailable.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </div>

        {loading ? (
            <div className="py-20 text-center text-slate-400 flex flex-col items-center gap-2"><Loader2 className="animate-spin h-8 w-8"/> Calculando posiciones financieras...</div>
        ) : rankings.length === 0 ? (
            <div className="py-20 text-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
                <p>No hay datos aprobados para este filtro.</p>
                <p className="text-xs mt-2">Asegurate de que las ventas estén en estado "Cumplidas" y con "Billing Approved" en OpsBilling.</p>
            </div>
        ) : (
            <>
                {/* --- PODIO --- */}
                <div className="flex justify-center items-end gap-4 md:gap-8 mb-10 px-2 min-h-[260px] pt-10">
                    {/* #2 */}
                    {top2 && (
                        <div className="flex flex-col items-center w-1/3 max-w-[160px] relative animate-in slide-in-from-bottom-8 duration-700 delay-100">
                            <div className="relative mb-2">
                                <Avatar className="h-20 w-20 border-4 border-slate-300 shadow-lg">
                                    <AvatarImage src={top2.avatar} />
                                    <AvatarFallback>{top2.name[0]}</AvatarFallback>
                                </Avatar>
                                <Badge className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-slate-500 border-2 border-white px-3 shadow-md text-base">#2</Badge>
                            </div>
                            <div className="text-center mt-3">
                                <p className="font-bold text-slate-700 truncate w-full">{top2.name.split(" ")[0]}</p>
                                <div className="text-slate-500">{renderScore(top2.score)}</div>
                                {top2.gapToNext && (
                                    <div className="text-[10px] text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full font-bold mt-1 inline-flex items-center gap-1 border border-orange-100">
                                        <ArrowUpCircle size={10} /> A {top2.gapToNext.diff} de {top2.gapToNext.name}
                                    </div>
                                )}
                            </div>
                            <div className="h-32 w-full bg-gradient-to-t from-slate-200 to-white/0 rounded-t-lg mt-2 border-t-4 border-slate-300 shadow-inner opacity-50"></div>
                        </div>
                    )}

                    {/* #1 */}
                    {top1 && (
                        <div className="flex flex-col items-center w-1/3 max-w-[180px] z-10 animate-in slide-in-from-bottom-10 duration-500 -mt-10">
                            <div className="relative mb-4">
                                <Crown className="absolute -top-10 left-1/2 -translate-x-1/2 h-10 w-10 text-yellow-500 fill-yellow-500 animate-bounce" />
                                <Avatar className="h-28 w-28 border-4 border-yellow-400 shadow-2xl ring-4 ring-yellow-100">
                                    <AvatarImage src={top1.avatar} />
                                    <AvatarFallback>{top1.name[0]}</AvatarFallback>
                                </Avatar>
                                <Badge className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-yellow-500 text-white border-4 border-white px-4 py-1 text-xl font-black shadow-lg">
                                    #1
                                </Badge>
                            </div>
                            <div className="text-center mt-4">
                                <p className="font-black text-slate-800 text-xl">{top1.name.split(" ")[0]}</p>
                                <div className="text-yellow-600 drop-shadow-sm scale-110 transform">{renderScore(top1.score)}</div>
                                <p className="text-[10px] uppercase font-bold text-yellow-700/60 mt-1">{renderMetricLabel()}</p>
                            </div>
                            <div className="h-44 w-full bg-gradient-to-t from-yellow-200 to-yellow-50 rounded-t-2xl mt-4 border-t-4 border-yellow-400 shadow-xl relative overflow-hidden">
                                <div className="absolute inset-0 bg-white/30 skew-y-12"></div>
                                <div className="absolute inset-0 flex items-center justify-center opacity-10">
                                    <Trophy size={80}/>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* #3 */}
                    {top3 && (
                        <div className="flex flex-col items-center w-1/3 max-w-[160px] relative animate-in slide-in-from-bottom-8 duration-700 delay-200">
                            <div className="relative mb-2">
                                <Avatar className="h-20 w-20 border-4 border-orange-300 shadow-lg">
                                    <AvatarImage src={top3.avatar} />
                                    <AvatarFallback>{top3.name[0]}</AvatarFallback>
                                </Avatar>
                                <Badge className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-orange-500 border-2 border-white px-3 shadow-md text-base">#3</Badge>
                            </div>
                            <div className="text-center mt-3">
                                <p className="font-bold text-slate-700 truncate w-full">{top3.name.split(" ")[0]}</p>
                                <div className="text-orange-700">{renderScore(top3.score)}</div>
                                {top3.gapToNext && (
                                    <div className="text-[10px] text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full font-bold mt-1 inline-flex items-center gap-1 border border-slate-200">
                                        <ArrowUpCircle size={10} /> A {top3.gapToNext.diff} de {top3.gapToNext.name}
                                    </div>
                                )}
                            </div>
                            <div className="h-24 w-full bg-gradient-to-t from-orange-200 to-white/0 rounded-t-lg mt-2 border-t-4 border-orange-300 shadow-inner opacity-50"></div>
                        </div>
                    )}
                </div>

                {/* --- TABLA DETALLE --- */}
                <div className="space-y-3 max-w-4xl mx-auto">
                    {restOfTeam.map((user) => (
                        <Card key={user.name} className="flex items-center p-4 hover:shadow-md transition-all border-0 ring-1 ring-slate-100 group animate-in fade-in slide-in-from-bottom-2">
                            <div className="w-12 text-center font-bold text-slate-400 text-xl">#{user.position}</div>

                            <Avatar className="h-12 w-12 border border-slate-200 mr-4">
                                <AvatarImage src={user.avatar} />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                                <div className="flex items-center gap-3">
                                    <h3 className="font-bold text-slate-700 text-lg">{user.name}</h3>
                                    {user.gapToNext && (
                                        <span className="text-[10px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <ArrowUpCircle size={12} /> A {user.gapToNext.diff} de {user.gapToNext.name}
                                        </span>
                                    )}
                                </div>
                                <div className="flex gap-4 mt-1 text-xs text-slate-400">
                                    <span>Vol: <b>{user.count}</b></span>
                                    <span className="w-px h-3 bg-slate-300"></span>
                                    <span>Ticket: <b>{formatMoney(user.ticket)}</b></span>
                                </div>
                            </div>

                            <div className="text-right">
                                <div className="text-xl font-black text-slate-800">{renderScore(user.score)}</div>
                                <span className="text-[10px] text-slate-400 font-bold uppercase block">{renderMetricLabel()}</span>
                            </div>
                        </Card>
                    ))}
                </div>
            </>
        )}
    </div>
  )
}