"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Calculator, RefreshCw, CheckCircle2, AlertTriangle } from "lucide-react"

// --- TIPOS ---
type Seller = {
  id: string
  name: string
  hours: number
}

type LeadRow = {
  id: string
  agent_name: string | null
  prepaga: string | null
  plan: string | null
  status: string | null
  created_at: string
  capitas: number | null
  // CAMPOS DE SINCRONIZACIÓN DE FECHA
  billing_period: string | null
  billing_approved: boolean | null
  // CAMPOS PARA CÁLCULO DE FACTURACIÓN (REVENUE SHARE)
  full_price: number | null
  aportes: number | null
  descuento: number | null
  labor_condition: string | null
  billing_price_override: number | null
}

type CommissionSettings = {
  absorbed_5h: number
  absorbed_8h: number
  special_pct: number
  special_operator_keywords: string[]
  tier1_pct: number
  tier2_pct: number
  tier3_pct: number
  tier4_pct: number
  // Rangos para detectar tier (basado en cantidad)
  tier1_qty: number
  tier2_qty: number
  tier3_qty: number
}

const DEFAULT_SETTINGS: CommissionSettings = {
  absorbed_5h: 8,
  absorbed_8h: 12,
  special_pct: 0.1, // 10% de la facturación
  special_operator_keywords: ["A1", "500", "Sancor", "AMPF"],
  tier1_pct: 0.15,
  tier2_pct: 0.2,
  tier3_pct: 0.25,
  tier4_pct: 0.3,
  tier1_qty: 6,
  tier2_qty: 6,
  tier3_qty: 6,
}

// --- REGLAS DE CÁLCULO (COPIADAS DE OPSBILLING) ---
const CALC_RULES = {
    taxRate: 0.105, 
    prevencionVat: 0.21,
    ampf: { multiplier: 2.0 },
    prevencion: { 'A1': 0.90, 'A1 CP': 0.90, 'A2': 1.30, 'A2 CP': 1.30, 'A4': 1.50, 'A5': 1.50, default: 1.30 },
    generalGroup: { multiplier: 1.80 }
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

  const months = useMemo(() => [
      { v: "1", label: "Enero" }, { v: "2", label: "Febrero" }, { v: "3", label: "Marzo" },
      { v: "4", label: "Abril" }, { v: "5", label: "Mayo" }, { v: "6", label: "Junio" },
      { v: "7", label: "Julio" }, { v: "8", label: "Agosto" }, { v: "9", label: "Septiembre" },
      { v: "10", label: "Octubre" }, { v: "11", label: "Noviembre" }, { v: "12", label: "Diciembre" },
    ], [])

  // 1. Años dinámicos
  const buildYearOptions = async () => {
    const currentYear = new Date().getFullYear()
    let minYear = currentYear
    try {
      const { data } = await supabase.from("leads").select("created_at").order("created_at", { ascending: true }).limit(1)
      if (data && data.length > 0) {
        const y = new Date(data[0].created_at).getFullYear()
        if (!Number.isNaN(y)) minYear = y
      }
    } catch {}
    const years: string[] = []
    for (let y = minYear; y <= currentYear + 1; y++) years.push(String(y))
    setYearOptions(years)
    if (!years.includes(selectedYear)) setSelectedYear(String(currentYear))
  }

  // 2. Trae settings (Base de Datos)
  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from("commission_settings").select("*").eq("id", 1).maybeSingle()
      if (error) return
      if (data) {
        setSettings({
          absorbed_5h: Number(data.absorbed_5h ?? DEFAULT_SETTINGS.absorbed_5h),
          absorbed_8h: Number(data.absorbed_8h ?? DEFAULT_SETTINGS.absorbed_8h),
          special_pct: Number(data.special_pct ?? DEFAULT_SETTINGS.special_pct),
          special_operator_keywords: Array.isArray(data.special_operator_keywords) ? data.special_operator_keywords.map((x: any) => String(x)) : DEFAULT_SETTINGS.special_operator_keywords,
          tier1_pct: Number(data.tier1_pct ?? DEFAULT_SETTINGS.tier1_pct),
          tier2_pct: Number(data.tier2_pct ?? DEFAULT_SETTINGS.tier2_pct),
          tier3_pct: Number(data.tier3_pct ?? DEFAULT_SETTINGS.tier3_pct),
          tier4_pct: Number(data.tier4_pct ?? DEFAULT_SETTINGS.tier4_pct),
          tier1_qty: Number(data.tier1_qty ?? DEFAULT_SETTINGS.tier1_qty),
          tier2_qty: Number(data.tier2_qty ?? DEFAULT_SETTINGS.tier2_qty),
          tier3_qty: Number(data.tier3_qty ?? DEFAULT_SETTINGS.tier3_qty),
        })
      }
    } catch {}
  }

  // 3. Trae Vendedores
  const fetchSellers = async () => {
    const { data: profs, error } = await supabase.from("profiles").select("id, full_name, role, work_hours").eq("role", "seller")
    if (error) { setSellers([]); return }
    const merged: Seller[] = (profs || []).map((p: any) => {
        const hStr = String(p.work_hours || "5")
        const hours = hStr.includes("8") ? 8 : 5
        return { id: String(p.id), name: String(p.full_name ?? "").trim(), hours: hours }
      }).filter((p) => p.id && p.name).sort((a, b) => a.name.localeCompare(b.name, "es"))
    setSellers(merged)
  }

  // 4. FETCH LEADS (Lógica OpsBilling: Aprobados + Fecha de Liquidación)
  const fetchLeads = async () => {
    const targetPeriod = `${selectedYear}-${selectedMonth.padStart(2, '0')}`
    
    // Traemos campos necesarios para calcular facturación (Neto)
    const { data, error } = await supabase
      .from("leads")
      .select(`
        id, agent_name, prepaga, plan, status, created_at, capitas, 
        billing_period, billing_approved,
        full_price, aportes, descuento, labor_condition, billing_price_override
      `)
      .eq("status", "cumplidas")
      .eq("billing_approved", true) // SOLO LO QUE OPS APROBÓ

    if (error || !data) { setLeads([]); return }

    // Filtro JS para priorizar billing_period sobre created_at
    const filtered = (data as LeadRow[]).filter((l) => {
        const createdDate = new Date(l.created_at)
        const defaultPeriod = `${createdDate.getFullYear()}-${String(createdDate.getMonth() + 1).padStart(2, '0')}`
        const effectivePeriod = l.billing_period || defaultPeriod
        return effectivePeriod === targetPeriod
    })
    setLeads(filtered)
  }

  const refreshAll = async () => {
    setLoading(true)
    await Promise.all([fetchSettings(), fetchSellers(), fetchLeads()])
    setLoading(false)
  }

  useEffect(() => { buildYearOptions() }, [])
  useEffect(() => { 
    refreshAll()
    const channel = supabase.channel("commissions_live_v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchLeads())
      .on("postgres_changes", { event: "*", schema: "public", table: "commission_settings" }, () => fetchSettings())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [selectedMonth, selectedYear])

  // --- 5. CALCULADORA DE FACTURACIÓN (PORTADA DE OPSBILLING) ---
  const calculateLiquidationValue = (op: LeadRow) => {
      // Si tiene override manual de Ops, se usa ese valor directo
      if (op.billing_price_override !== null && op.billing_price_override !== undefined && op.billing_price_override > 0) {
          return Number(op.billing_price_override)
      }

      const full = Number(op.full_price || 0)
      const aportes = Number(op.aportes || 0)
      const desc = Number(op.descuento || 0)
      const p = norm(op.prepaga)
      const plan = String(op.plan || "")

      let val = 0

      if (p.includes("preven")) {
          const base = full - desc
          // @ts-ignore
          const rate = CALC_RULES.prevencion[plan] || CALC_RULES.prevencion.default
          val = base * rate
      } else if (p.includes("ampf")) {
          val = full * CALC_RULES.ampf.multiplier
      } else {
          // Grupo General (Doctored, Avalian, etc)
          let base = full * (1 - CALC_RULES.taxRate)
          
          // Caso especial DoctoRed Plan 500 Empleado
          if (p.includes("doctored") && plan.includes("500") && op.labor_condition === 'empleado') {
              base = aportes * (1 - CALC_RULES.taxRate)
          }
          val = base * CALC_RULES.generalGroup.multiplier
      }

      // Pass no genera facturación
      if (p.includes("pass")) { val = 0 }

      return val
  }

  // --- 6. CÁLCULO DE COMISIÓN (LÓGICA REVENUE SHARE) ---
  const calculateCommission = (seller: Seller) => {
    const keywords = settings.special_operator_keywords.map((k) => norm(k)).filter(Boolean)
    const agentLeads = leads.filter((l) => norm(l.agent_name) === norm(seller.name))

    // Separar Especiales vs Estándar
    const specialLeads: LeadRow[] = []
    const standardLeads: LeadRow[] = []

    agentLeads.forEach(l => {
        const textToCheck = norm(l.prepaga) + " " + norm(l.plan)
        const isSpecial = keywords.some(k => k && textToCheck.includes(k))
        if (isSpecial) specialLeads.push(l)
        else standardLeads.push(l)
    })

    // Ordenar Estándar por fecha (para absorción)
    standardLeads.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

    // Calcular Puntos (Cápitas) para Escala
    const standardPoints = standardLeads.reduce((acc, lead) => {
        // AMPF suele ser especial, pero si cae aquí cuenta como 1. 
        // Si no es AMPF, usa capitas.
        return acc + (Number(lead.capitas) || 1)
    }, 0)

    const specialQty = specialLeads.length
    const totalPoints = standardPoints + specialQty

    // Determinar Absorción
    const absorbedLimit = seller.hours === 5 ? settings.absorbed_5h : settings.absorbed_8h
    const isThresholdMet = standardPoints > absorbedLimit

    let commissionTotal = 0
    const breakdown: string[] = []

    // 1. CALCULAR ESPECIALES (Revenue Share)
    // En OpsBilling: Suma de valores * Porcentaje Especial
    const totalLiquidatedSpecial = specialLeads.reduce((acc, op) => acc + calculateLiquidationValue(op), 0)
    const specialCommission = totalLiquidatedSpecial * settings.special_pct
    
    if (specialQty > 0) {
        commissionTotal += specialCommission
        breakdown.push(`Esp. (${specialQty} vtas): Facturado $${Math.round(totalLiquidatedSpecial).toLocaleString()} -> Paga $${Math.round(specialCommission).toLocaleString()} (${settings.special_pct * 100}%)`)
    }

    // 2. CALCULAR ESCALA (Revenue Share tras absorción)
    if (isThresholdMet) {
        // Determinar Porcentaje de Escala basado en PUNTOS TOTALES (Standard)
        let scalePct = settings.tier4_pct // Default max
        
        // Lógica de rangos acumulativos para determinar el % final a aplicar a TODA la facturación pagable
        // Nota: OpsBilling suele usar tiers simples: "Si vendiste entre 9 y 14, cobras 15%".
        
        // Construimos rangos basados en settings (asumiendo que settings.tierX_qty define el tamaño del escalón)
        // Pero para simplificar y alinear con OpsBilling que usa "min/max", usamos lógica acumulada:
        // Si absorbed = 8.
        // Tier 1 (15%) = 9 a (8+tier1_qty)
        
        const netCount = standardPoints - absorbedLimit
        if (netCount <= settings.tier1_qty) scalePct = settings.tier1_pct
        else if (netCount <= (settings.tier1_qty + settings.tier2_qty)) scalePct = settings.tier2_pct
        else if (netCount <= (settings.tier1_qty + settings.tier2_qty + settings.tier3_qty)) scalePct = settings.tier3_pct
        else scalePct = settings.tier4_pct

        // Calcular Facturación de las ventas que NO fueron absorbidas
        // (Las primeras X ventas se absorben, el resto se paga)
        // NOTA: OpsBilling usa standardOps.slice(absorbableLimit). 
        // Aquí standardLeads ya está ordenado por fecha.
        
        // Problema: standardPoints se basa en CÁPITAS, pero slice corta por VENTA.
        // OpsBilling simplifica cortando por array index. Haremos lo mismo para coincidir.
        
        const payableOps = standardLeads.slice(absorbedLimit) // Cortamos las primeras N ventas (absorbidas)
        const totalLiquidatedStandard = payableOps.reduce((acc, op) => acc + calculateLiquidationValue(op), 0)
        
        const standardCommission = totalLiquidatedStandard * scalePct
        commissionTotal += standardCommission

        breakdown.push(`Escala (${standardPoints} pts): Superó base de ${absorbedLimit}.`)
        breakdown.push(`Liquidado Pagable: $${Math.round(totalLiquidatedStandard).toLocaleString()} al ${scalePct * 100}% = $${Math.round(standardCommission).toLocaleString()}`)
    } else {
        breakdown.push(`Escala: ${standardPoints} pts (No superó base de ${absorbedLimit})`)
    }

    return {
      total: Math.round(commissionTotal),
      details: breakdown,
      salesQty: totalPoints,
      isThresholdMet
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black text-slate-800 flex items-center gap-2">
            <Calculator className="h-8 w-8 text-green-600" /> Liquidación Real
          </h2>
          <div className="flex items-center gap-2 text-slate-500 mt-1">
            <CheckCircle2 size={14} className="text-green-600"/>
            <p className="text-sm">Sincronizado con reglas de facturación de Ops.</p>
          </div>
        </div>

        <div className="flex gap-2 items-center">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[140px] font-bold"><SelectValue placeholder="Mes" /></SelectTrigger>
            <SelectContent>{months.map((m) => <SelectItem key={m.v} value={m.v}>{m.label}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[110px] font-bold"><SelectValue placeholder="Año" /></SelectTrigger>
            <SelectContent>{(yearOptions.length ? yearOptions : [selectedYear]).map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          {loading && <RefreshCw className="h-4 w-4 animate-spin text-slate-400 mt-1" />}
        </div>
      </div>

      <Card className="border-t-4 border-t-green-600 shadow-lg">
        <CardHeader className="bg-slate-50/50 border-b pb-2">
          <CardTitle className="text-sm font-bold uppercase text-slate-500 tracking-wider">
            Periodo Oficial: {selectedMonth}/{selectedYear}
          </CardTitle>
        </CardHeader>

        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Agente</TableHead>
                <TableHead className="text-center">Jornada</TableHead>
                <TableHead className="text-center">Cápitas</TableHead>
                <TableHead>Desglose de Liquidación</TableHead>
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
                      <Badge variant="outline" className="font-bold">{seller.hours} Hs</Badge>
                    </TableCell>
                    <TableCell className="text-center">
                        <div className="font-bold text-lg">{result.salesQty}</div>
                        {!result.isThresholdMet && <span className="text-[9px] text-red-500 font-bold">BASE NO CUBIERTA</span>}
                    </TableCell>
                    <TableCell className="text-[11px] leading-tight font-medium text-slate-500 py-3">
                      {result.details.map((d, idx) => <p key={idx} className="mb-1 last:mb-0">• {d}</p>)}
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