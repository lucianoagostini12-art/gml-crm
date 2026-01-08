"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calculator, RefreshCw } from "lucide-react"

type Seller = {
  id: string
  name: string
  hours: number
}

type LeadRow = {
  agent_name: string | null
  prepaga: string | null
  plan: string | null
  price: number | null
  status: string | null
  created_at: string
  capitas: number | null // ✅ AGREGADO: Para cálculo correcto
}

type CommissionSettings = {
  avg_value: number
  absorbed_5h: number
  absorbed_8h: number

  special_unit_value: number
  special_pct: number
  special_operator_keywords: string[]

  tier1_qty: number
  tier1_pct: number
  tier2_qty: number
  tier2_pct: number
  tier3_qty: number
  tier3_pct: number
  tier4_pct: number
}

const DEFAULT_SETTINGS: CommissionSettings = {
  avg_value: 40000,
  absorbed_5h: 8,
  absorbed_8h: 12,

  special_unit_value: 30000,
  special_pct: 0.1,
  special_operator_keywords: ["A1", "500", "Sancor"],

  tier1_qty: 6,
  tier1_pct: 0.15,
  tier2_qty: 6,
  tier2_pct: 0.2,
  tier3_qty: 6,
  tier3_pct: 0.25,
  tier4_pct: 0.3,
}

const norm = (v: any) => String(v ?? "").trim().toLowerCase()

export function AdminCommissions() {
  const supabase = createClient()

  const now = new Date()
  const [loading, setLoading] = useState(true)

  // Filtros
  const [selectedMonth, setSelectedMonth] = useState(String(now.getMonth() + 1))
  const [selectedYear, setSelectedYear] = useState(String(now.getFullYear()))
  const [yearOptions, setYearOptions] = useState<string[]>([])

  const [sellers, setSellers] = useState<Seller[]>([])
  const [settings, setSettings] = useState<CommissionSettings>(DEFAULT_SETTINGS)
  const [leads, setLeads] = useState<LeadRow[]>([])

  const months = useMemo(
    () => [
      { v: "1", label: "Enero" },
      { v: "2", label: "Febrero" },
      { v: "3", label: "Marzo" },
      { v: "4", label: "Abril" },
      { v: "5", label: "Mayo" },
      { v: "6", label: "Junio" },
      { v: "7", label: "Julio" },
      { v: "8", label: "Agosto" },
      { v: "9", label: "Septiembre" },
      { v: "10", label: "Octubre" },
      { v: "11", label: "Noviembre" },
      { v: "12", label: "Diciembre" },
    ],
    []
  )

  // ✅ 1. Años dinámicos (Inteligente)
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

  // ✅ 2. Trae settings de la base de datos
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from("commission_settings").select("*").eq("id", 1).maybeSingle()
      if (error) return
      if (data) {
        setSettings({
          avg_value: Number(data.avg_value ?? DEFAULT_SETTINGS.avg_value),
          absorbed_5h: Number(data.absorbed_5h ?? DEFAULT_SETTINGS.absorbed_5h),
          absorbed_8h: Number(data.absorbed_8h ?? DEFAULT_SETTINGS.absorbed_8h),

          special_unit_value: Number(data.special_unit_value ?? DEFAULT_SETTINGS.special_unit_value),
          special_pct: Number(data.special_pct ?? DEFAULT_SETTINGS.special_pct),
          special_operator_keywords: Array.isArray(data.special_operator_keywords)
            ? data.special_operator_keywords.map((x: any) => String(x))
            : DEFAULT_SETTINGS.special_operator_keywords,

          tier1_qty: Number(data.tier1_qty ?? DEFAULT_SETTINGS.tier1_qty),
          tier1_pct: Number(data.tier1_pct ?? DEFAULT_SETTINGS.tier1_pct),
          tier2_qty: Number(data.tier2_qty ?? DEFAULT_SETTINGS.tier2_qty),
          tier2_pct: Number(data.tier2_pct ?? DEFAULT_SETTINGS.tier2_pct),
          tier3_qty: Number(data.tier3_qty ?? DEFAULT_SETTINGS.tier3_qty),
          tier3_pct: Number(data.tier3_pct ?? DEFAULT_SETTINGS.tier3_pct),
          tier4_pct: Number(data.tier4_pct ?? DEFAULT_SETTINGS.tier4_pct),
        })
      }
    } catch {}
  }

  // ✅ 3. Trae Vendedores Reales (Profiles) - CONECTADO A WORK_HOURS REAL
  const fetchSellers = async () => {
    // Traemos perfiles con rol seller Y sus horas cargadas
    const { data: profs, error } = await supabase.from("profiles").select("id, full_name, role, work_hours").eq("role", "seller")
    if (error) {
      setSellers([])
      return
    }

    const merged: Seller[] = (profs || [])
      .map((p: any) => {
        // Detectamos horas: Si el string contiene "8", son 8hs. Si no, default 5hs.
        const hStr = String(p.work_hours || "5")
        const hours = hStr.includes("8") ? 8 : 5

        return {
          id: String(p.id),
          name: String(p.full_name ?? "").trim(),
          hours: hours,
        }
      })
      .filter((p) => p.id && p.name)
      .sort((a, b) => a.name.localeCompare(b.name, "es"))

    setSellers(merged)
  }

  // ✅ 4. Trae Ventas CUMPLIDAS del período
  const fetchLeads = async () => {
    const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString()
    const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0, 23, 59, 59).toISOString()

    const { data, error } = await supabase
      .from("leads")
      .select("agent_name, prepaga, plan, price, status, created_at, capitas")
      .gte("created_at", startDate)
      .lte("created_at", endDate)

    if (error) {
      setLeads([])
      return
    }

    const safe = Array.isArray(data) ? (data as LeadRow[]) : []
    const onlyFulfilled = safe.filter((l) => norm(l.status) === "cumplidas")
    setLeads(onlyFulfilled)
  }

  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([fetchSettings(), fetchSellers(), fetchLeads()])
    setLoading(false)
  }

  useEffect(() => {
    buildYearOptions()
  }, [])

  useEffect(() => {
    refreshAll()

    const channel = supabase
      .channel("commissions_live")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLeads())
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => fetchSellers()) // Escucha cambios en perfiles
      .on("postgres_changes", { event: "*", schema: "public", table: "commission_settings" }, () => fetchSettings())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear])

  // --- LÓGICA DE CÁLCULO DE COMISIÓN ---
  const calculateCommission = (seller: Seller) => {
    const keywords = settings.special_operator_keywords.map((k) => norm(k)).filter(Boolean)

    const agentLeads = leads.filter((l) => norm(l.agent_name) === norm(seller.name))

    // Detección de Especiales (Unidades separadas)
    const specialLeads = agentLeads.filter((l) => {
        const textToCheck = norm(l.prepaga) + " " + norm(l.plan)
        return keywords.some((k) => k && textToCheck.includes(k))
    })
    
    // Detección de Ventas de Escala (Generales)
    const scaleLeads = agentLeads.filter((l) => {
        const textToCheck = norm(l.prepaga) + " " + norm(l.plan)
        return !keywords.some((k) => k && textToCheck.includes(k))
    })

    const specialQty = specialLeads.length
    
    // ✅ CÁLCULO DE PUNTOS DE ESCALA (Regla AMPF = 1, Resto = Cápitas)
    const scalePoints = scaleLeads.reduce((acc, lead) => {
        const isAMPF = lead.prepaga && lead.prepaga.toLowerCase().includes("ampf")
        const points = isAMPF ? 1 : (Number(lead.capitas) || 1)
        return acc + points
    }, 0)

    let commissionTotal = 0
    const breakdown: string[] = []

    // 1. Cálculo Especiales (Pago fijo unitario)
    const specialRevenue = specialQty * settings.special_unit_value * settings.special_pct
    if (specialQty > 0) {
      commissionTotal += specialRevenue
      breakdown.push(`Esp. (${settings.special_operator_keywords.join("/")}) : ${specialQty} unid. = $${Math.round(specialRevenue).toLocaleString("es-AR")}`)
    }

    // 2. Cálculo Escala (Absorción basada en PUNTOS)
    const absorbed = seller.hours === 5 ? settings.absorbed_5h : settings.absorbed_8h
    let scaleRevenue = 0

    if (scalePoints > absorbed) {
      let remaining = scalePoints - absorbed

      // Tier 1
      const t1 = Math.min(remaining, settings.tier1_qty)
      scaleRevenue += t1 * settings.avg_value * settings.tier1_pct
      remaining -= t1

      // Tier 2
      if (remaining > 0) {
        const t2 = Math.min(remaining, settings.tier2_qty)
        scaleRevenue += t2 * settings.avg_value * settings.tier2_pct
        remaining -= t2
      }

      // Tier 3
      if (remaining > 0) {
        const t3 = Math.min(remaining, settings.tier3_qty)
        scaleRevenue += t3 * settings.avg_value * settings.tier3_pct
        remaining -= t3
      }

      // Tier 4 (Infinito)
      if (remaining > 0) {
        scaleRevenue += remaining * settings.avg_value * settings.tier4_pct
      }

      commissionTotal += scaleRevenue
      breakdown.push(`Escala: ${scalePoints} pts = $${Math.round(scaleRevenue).toLocaleString("es-AR")}`)
    } else {
      breakdown.push(`Escala: ${scalePoints} pts (Absorbidos por base ${absorbed})`)
    }

    return {
      total: Math.round(commissionTotal),
      details: breakdown,
      salesQty: scalePoints + specialQty, // Muestra Total de Puntos para coherencia
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
            <Calculator className="h-8 w-8 text-green-600" /> Liquidación Real
          </h2>
          <p className="text-slate-500">Comisiones basadas en ventas cumplidas (Puntaje x Cápita).</p>
        </div>

        <div className="flex gap-2 items-center">
          {/* Selector MES */}
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] font-bold">
              <SelectValue placeholder="Mes" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.v} value={m.v}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Selector AÑO (Inteligente) */}
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[110px] font-bold">
              <SelectValue placeholder="Año" />
            </SelectTrigger>
            <SelectContent>
              {(yearOptions.length ? yearOptions : [selectedYear]).map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {loading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400 mt-1" />}
        </div>
      </div>

      <Card className="border-t-4 border-t-green-600 shadow-lg">
        <CardHeader className="bg-slate-50/50 border-b pb-2">
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">
            Periodo de Liquidación: {selectedMonth}/{selectedYear}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Agente</TableHead>
                <TableHead className="text-center">Jornada</TableHead>
                <TableHead className="text-center">Puntos / Cápitas</TableHead>
                <TableHead>Desglose de Escala</TableHead>
                <TableHead className="text-right text-green-700 font-bold bg-green-50/50 pr-6">A Pagar</TableHead>
              </TableRow>
            </TableHeader>

            <TableBody>
              {sellers.map((seller, i) => {
                const result = calculateCommission(seller)
                return (
                  <TableRow key={seller.id ?? i} className="hover:bg-slate-50/50 transition-colors">
                    <TableCell className="font-bold text-lg pl-6">{seller.name}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="font-bold">
                        {seller.hours} Hs
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-bold text-lg">{result.salesQty}</TableCell>
                    <TableCell className="text-[11px] leading-tight font-medium text-slate-500">
                      {result.details.map((d, idx) => (
                        <p key={idx}>• {d}</p>
                      ))}
                    </TableCell>
                    <TableCell className="text-right font-black text-xl bg-green-50/30 text-green-700 font-mono pr-6">
                      $ {result.total.toLocaleString("es-AR")}
                    </TableCell>
                  </TableRow>
                )
              })}

              {sellers.length === 0 && !loading && (
                <TableRow>
                  <TableCell className="pl-6 py-6 text-slate-500" colSpan={5}>
                    No hay vendedores activos para liquidar en este periodo.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}