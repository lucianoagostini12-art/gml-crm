"use client"

import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { DollarSign, TrendingUp, Calculator, Save, Lock, AlertTriangle, Settings2, Calendar, User, ArrowRight, Filter, Users, Globe, Phone, CheckCircle2, Trash2, Download, Undo2, Award, Zap, Clock, X, Plus, History, LayoutGrid, UserPlus, Eye, Target } from "lucide-react"
import { Operation } from "./data"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

// --- 1. CONFIGURACIÓN (SIMULA CONEXIÓN CON SUPERVISIÓN) ---
const SELLERS_DB: Record<string, { shift: '5hs' | '8hs', photo: string }> = {
    "Maca": { shift: '8hs', photo: "https://i.pravatar.cc/150?u=Maca" },
    "Agus": { shift: '5hs', photo: "https://i.pravatar.cc/150?u=Agus" },
    "Lu T": { shift: '8hs', photo: "https://i.pravatar.cc/150?u=LuT" },
    "Eve": { shift: '5hs', photo: "https://i.pravatar.cc/150?u=Eve" },
    "Iara": { shift: '8hs', photo: "https://i.pravatar.cc/150?u=Iara" },
    "Abru": { shift: '5hs', photo: "https://i.pravatar.cc/150?u=Abru" }
}

const COMMISSION_RULES = {
    special: { plans: ['A1', '500', 'AMPF'], percentage: 0.10 },
    scales: {
        '5hs': { 
            absorbable: 8, 
            tiers: [
                { min: 9, max: 14, pct: 0.15 }, 
                { min: 15, max: 20, pct: 0.20 }, 
                { min: 21, max: 24, pct: 0.25 }, 
                { min: 25, max: 999, pct: 0.30 }
            ] 
        },
        '8hs': { 
            absorbable: 12, 
            tiers: [
                { min: 13, max: 18, pct: 0.15 }, 
                { min: 19, max: 24, pct: 0.20 }, 
                { min: 25, max: 30, pct: 0.25 }, 
                { min: 31, max: 999, pct: 0.30 }
            ] 
        }
    }
}

// --- 2. DATOS DEMO (CORREGIDOS: Se eliminaron propiedades conflictivas) ---
const DEMO_DATA: Operation[] = [
    { id: "d1", clientName: "Juan Pérez", dni: "20.123.456", plan: "A2", prepaga: "Prevención Salud", status: "cumplidas", seller: "Maca", entryDate: "2025-01-15", history: [], chat: [], adminNotes: [], reminders: [], type: 'alta', daysInStatus: 0, subState: '', lastUpdate: '', operator: 'Iara', phone: '', condicionLaboral: 'monotributo', origen: 'Meta Ads', hijos: [] },
    { id: "d2", clientName: "Pedro Pendiente", dni: "33.111.222", plan: "A4", prepaga: "Prevención Salud", status: "cumplidas", seller: "Maca", entryDate: "2025-01-29", history: [], chat: [], adminNotes: [], reminders: [], type: 'alta', daysInStatus: 0, subState: '', lastUpdate: '', operator: 'Iara', phone: '', condicionLaboral: 'monotributo', origen: 'Otros', hijos: [] },
    { id: "d3", clientName: "Carlos Ruiz", dni: "20.555.666", plan: "500", prepaga: "DoctoRed", status: "cumplidas", seller: "Maca", entryDate: "2025-01-20", history: [], chat: [], adminNotes: [], reminders: [], type: 'alta', daysInStatus: 0, subState: '', lastUpdate: '', operator: 'Maca', phone: '', condicionLaboral: 'empleado', origen: 'Google Ads', hijos: [] },
    { id: "d4", clientName: "María González", dni: "27.987.654", plan: "220", prepaga: "Galeno", status: "cumplidas", seller: "Agus", entryDate: "2025-01-10", history: [], chat: [], adminNotes: [], reminders: [], type: 'alta', daysInStatus: 0, subState: '', lastUpdate: '', operator: 'Iara', phone: '', condicionLaboral: 'voluntario', origen: 'Referido', hijos: [] },
    { id: "d5", clientName: "Ana López", dni: "23.444.222", plan: "PMO", prepaga: "AMPF", status: "cumplidas", seller: "Agus", entryDate: "2025-01-28", history: [], chat: [], adminNotes: [], reminders: [], type: 'alta', daysInStatus: 0, subState: '', lastUpdate: '', operator: 'Maca', phone: '', condicionLaboral: 'monotributo', origen: 'Referido Personal', hijos: [] },
    { id: "d6", clientName: "Lucía F", dni: "40.111.222", plan: "A1", prepaga: "Prevención Salud", status: "cumplidas", seller: "Eve", entryDate: "2024-12-05", history: [], chat: [], adminNotes: [], reminders: [], type: 'alta', daysInStatus: 0, subState: '', lastUpdate: '', operator: 'Maca', phone: '', condicionLaboral: 'monotributo', origen: 'Google Ads', hijos: [] },
]

const DEFAULT_RULES = {
    taxRate: 0.10,
    prevencionVat: 0.21,
    doctoRed: { base: 1.80, specialPlan: '500' },
    ampf: { multiplier: 2.0 },
    prevencion: { 'A1': 0.90, 'A2': 1.30, 'A4': 1.50, default: 1.30 },
    portfolioRate: 0.05
}

// Helpers Visuales
const getPrepagaColor = (p: string) => {
    const s = p?.toLowerCase() || ""
    if (s.includes('preven')) return "border-l-4 border-l-pink-500" 
    if (s.includes('ampf')) return "border-l-4 border-l-sky-400" 
    if (['galeno', 'avalian', 'swiss', 'docto'].some(k => s.includes(k))) return "border-l-4 border-l-purple-600"
    return "border-l-4 border-l-slate-300"
}

const getSourceIcon = (source: string) => {
    const s = source?.toLowerCase() || ""
    if (s.includes('google')) return <Globe size={10} className="mr-1 text-blue-500"/>
    if (s.includes('meta') || s.includes('face') || s.includes('insta')) return <Globe size={10} className="mr-1 text-pink-500"/>
    if (s.includes('referido')) return <User size={10} className="mr-1 text-green-500"/>
    return <Phone size={10} className="mr-1"/>
}

export function OpsBilling({ operations }: { operations: Operation[] }) {
    const [activeTab, setActiveTab] = useState("audit") 
    const [selectedMonth, setSelectedMonth] = useState("2025-01")
    const [isLocked, setIsLocked] = useState(false)
    const [rules, setRules] = useState(DEFAULT_RULES)
    const [showConfig, setShowConfig] = useState(false)
    
    // --- ESTADOS DE GESTIÓN ---
    const [periodOverrides, setPeriodOverrides] = useState<Record<string, string>>({}) 
    const [priceOverrides, setPriceOverrides] = useState<Record<string, number>>({}) 
    const [approvedIds, setApprovedIds] = useState<string[]>([])
    
    // Manual Portfolio
    const [manualPortfolio, setManualPortfolio] = useState<any[]>([]) 
    const [portfolioOverrides, setPortfolioOverrides] = useState<Record<string, number>>({}) 
    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClient, setNewClient] = useState({ name: "", dni: "", prepaga: "Prevención Salud", plan: "", fullPrice: "0", aportes: "0", descuento: "0", hijos: [] as {name: string, dni: string}[] })
    const [newFamilyMember, setNewFamilyMember] = useState({ name: "", dni: "" })

    // Filtros
    const [filters, setFilters] = useState({ seller: 'all', prepaga: 'all' })
    const [isFilterOpen, setIsFilterOpen] = useState(false)

    // Seller Detail Modal
    const [viewingSeller, setViewingSeller] = useState<string | null>(null)
    
    const allOps = [...operations, ...DEMO_DATA]

    // --- CALCULADORA ---
    const calculate = (op: Operation) => {
        // Calculo Base
        let val = 0, formula = ""
        
        // Uso de 'as any' para evitar errores de TypeScript si el campo no existe en la interfaz
        const opAny = op as any;

        if (priceOverrides[op.id] !== undefined) {
            val = priceOverrides[op.id]
            formula = "Manual (Editado)"
        } else {
            const full = parseFloat(opAny.fullPrice || "0")
            const aportes = parseFloat(opAny.aportes || "0")
            const desc = parseFloat(opAny.descuento || "0")
            const p = op.prepaga?.toLowerCase() || ""

            if (p.includes("preven")) {
                const base = full - desc
                const rate = rules.prevencion.default 
                val = base * rate
                formula = `(Full - Desc) * ${rate*100}%`
            } else if (p.includes("ampf")) {
                val = full * rules.ampf.multiplier
                formula = `Full * ${rules.ampf.multiplier}`
            } else {
                let base = full * (1 - rules.taxRate)
                formula = `(Full - ${rules.taxRate*100}%) * 180%`
                if (p.includes("doctored") && op.condicionLaboral === 'empleado') {
                    base = aportes * (1 - rules.taxRate)
                    formula = `(Aportes - ${rules.taxRate*100}%) * 180%`
                }
                val = base * rules.doctoRed.base
            }
            if (p.includes("pass")) { val = 0; formula = "Manual" }
        }

        // Calculo Portfolio
        let portfolioVal = 0
        if (portfolioOverrides[op.id] !== undefined) {
             portfolioVal = portfolioOverrides[op.id]
        } else {
             portfolioVal = Math.round(val * rules.portfolioRate)
        }

        return { val: Math.round(val), formula, portfolio: portfolioVal }
    }

    // --- LOGICA DE DATOS ---
    const opsInPeriod = useMemo(() => {
        return allOps.filter(op => {
            if (op.status !== 'cumplidas') return false
            const opMonth = op.entryDate.substring(0, 7)
            const target = periodOverrides[op.id] || opMonth
            if (target !== selectedMonth) return false
            if (filters.seller !== 'all' && op.seller !== filters.seller) return false
            if (filters.prepaga !== 'all' && op.prepaga !== filters.prepaga) return false
            return true
        })
    }, [allOps, selectedMonth, periodOverrides, filters])

    const pendingOps = opsInPeriod.filter(op => !approvedIds.includes(op.id))
    const approvedOps = opsInPeriod.filter(op => approvedIds.includes(op.id))

    // --- TOTALES ---
    const { totalNeto, totalPreve, totalMutual, totalXP, totalIVA } = useMemo(() => {
        let neto = 0, preve = 0, mutual = 0, xp = 0
        approvedOps.forEach(op => {
            const val = calculate(op).val
            neto += val
            const p = op.prepaga?.toLowerCase() || ""
            if (p.includes("preven")) preve += val
            else if (p.includes("ampf")) mutual += val
            else xp += val
        })
        const iva = preve * rules.prevencionVat
        return { totalNeto: neto, totalPreve: preve, totalMutual: mutual, totalXP: xp, totalIVA: iva }
    }, [approvedOps, priceOverrides, rules])

    const totalBilling = totalNeto + totalIVA

    // --- PORTFOLIO ---
    const portfolioOps = approvedOps.reduce((acc, op) => op.prepaga?.toLowerCase().includes('preven') ? acc + calculate(op).portfolio : acc, 0)
    
    // Para manuales tambien permitimos override
    const portfolioManualTotal = manualPortfolio.reduce((acc, item) => {
         if (portfolioOverrides[item.id] !== undefined) return acc + portfolioOverrides[item.id]
         return acc + (parseFloat(item.calculatedLiquidation) * rules.portfolioRate)
    }, 0)
    
    const totalPortfolio = portfolioOps + portfolioManualTotal

    // --- COMISIONES VENDEDORAS (CON LOGICA ABSORBIBLE) ---
    const sellersCommissions = useMemo(() => {
        const result: any[] = []
        const grouped: Record<string, Operation[]> = {}
        approvedOps.forEach(op => { if(!grouped[op.seller]) grouped[op.seller] = []; grouped[op.seller].push(op) })

        Object.keys(grouped).forEach(sellerName => {
            const ops = grouped[sellerName]
            const sellerInfo = SELLERS_DB[sellerName] || { shift: '5hs', photo: '' }
            const shiftRules = COMMISSION_RULES.scales[sellerInfo.shift]
            
            let specialCommission = 0
            let variableCommission = 0
            let specialCount = 0
            
            const variableOps: Operation[] = []
            
            // 1. Separar
            ops.forEach(op => {
                const plan = op.plan?.toUpperCase() || ""
                const isSpecial = COMMISSION_RULES.special.plans.some(p => plan.includes(p))
                
                if (isSpecial) {
                    specialCommission += calculate(op).val * COMMISSION_RULES.special.percentage
                    specialCount++
                } else {
                    variableOps.push(op)
                }
            })

            // 2. Ordenar Variables por Fecha (para absorber las primeras)
            variableOps.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())

            // 3. Aplicar Absorción
            const totalVariableCount = variableOps.length
            const absorbableCount = shiftRules.absorbable
            const payableOps = variableOps.slice(absorbableCount) // Quedan solo las que superan la absorción
            const payableCount = payableOps.length // Cantidad a pagar

            let scalePercentage = 0

            // 4. Calcular Comisión Variable
            if (payableCount > 0) {
                const tier = shiftRules.tiers.find(t => totalVariableCount >= t.min && totalVariableCount <= t.max)
                scalePercentage = tier ? tier.pct : 0
                
                const totalLiquidatedPayable = payableOps.reduce((acc, op) => acc + calculate(op).val, 0)
                variableCommission = totalLiquidatedPayable * scalePercentage
            }

            result.push({
                name: sellerName,
                info: sellerInfo,
                totalCount: ops.length,
                specialCount,
                variableCount: totalVariableCount,
                absorbableCount,
                payableCount,
                specialCommission,
                variableCommission,
                scalePercentage,
                total: specialCommission + variableCommission
            })
        })
        return result.sort((a, b) => b.total - a.total)
    }, [approvedOps, priceOverrides, rules])

    // --- HANDLERS ---
    const handlePriceChange = (id: string, newVal: string) => {
        const num = parseFloat(newVal)
        if (!isNaN(num)) setPriceOverrides(prev => ({ ...prev, [id]: num }))
    }
    
    const handlePortfolioChange = (id: string, newVal: string) => {
        const num = parseFloat(newVal)
        if (!isNaN(num)) setPortfolioOverrides(prev => ({ ...prev, [id]: num }))
    }

    const moveToNextMonth = (id: string) => {
        const [y, m] = selectedMonth.split('-').map(Number)
        const nextM = m === 12 ? 1 : m + 1
        const nextY = m === 12 ? y + 1 : y
        const nextStr = `${nextY}-${String(nextM).padStart(2,'0')}`
        setPeriodOverrides(prev => ({...prev, [id]: nextStr}))
    }
    const approveOp = (id: string) => setApprovedIds(prev => [...prev, id])
    const unapproveOp = (id: string) => setApprovedIds(prev => prev.filter(x => x !== id))
    
    const calculateManualLiquidation = () => {
        const full = parseFloat(newClient.fullPrice || "0")
        const desc = parseFloat(newClient.descuento || "0")
        if (newClient.prepaga.toLowerCase().includes('preven')) {
            return (full - desc) * 1.30 
        }
        return full 
    }

    const handleAddClient = () => {
        if(!newClient.name) return
        const val = calculateManualLiquidation()
        setManualPortfolio([...manualPortfolio, { ...newClient, id: Date.now(), calculatedLiquidation: val }])
        setNewClient({ name: "", dni: "", prepaga: "Prevención Salud", plan: "", fullPrice: "0", aportes: "0", descuento: "0", hijos: [] })
        setIsAddingClient(false)
    }

    const uniqueSellers = Array.from(new Set(allOps.map(o => o.seller)))
    const uniquePrepagas = Array.from(new Set(allOps.map(o => o.prepaga)))

    // --- HELPER PARA DETALLE DE COMISIONES (MODAL) ---
    const getSellerOpsDetail = (sellerName: string | null) => {
        if (!sellerName) return []
        
        const ops = approvedOps.filter(op => op.seller === sellerName)
        
        const variableOps = ops.filter(op => {
            const plan = op.plan?.toUpperCase() || ""
            return !COMMISSION_RULES.special.plans.some(p => plan.includes(p))
        }).sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())

        const sellerInfo = SELLERS_DB[sellerName] || { shift: '5hs', photo: '' }
        const absorbLimit = COMMISSION_RULES.scales[sellerInfo.shift].absorbable

        const statusMap: Record<string, string> = {}
        
        ops.forEach(op => {
            const plan = op.plan?.toUpperCase() || ""
            if (COMMISSION_RULES.special.plans.some(p => plan.includes(p))) {
                statusMap[op.id] = "special"
            }
        })

        variableOps.forEach((op, index) => {
            if (index < absorbLimit) statusMap[op.id] = "absorbed"
            else statusMap[op.id] = "paid"
        })

        return ops.map(op => ({ ...op, payStatus: statusMap[op.id] }))
    }

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden max-w-[1900px] mx-auto pb-20">
            
            {/* 1. HEADER */}
            <div className="flex justify-between items-center bg-white p-2 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center text-white"><DollarSign/></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 leading-none">Centro Financiero</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isLocked ? "destructive" : "outline"} className="text-[10px] h-5">{isLocked ? "CERRADO" : "ABIERTO"}</Badge>
                            <span className="text-xs text-slate-400">Auditoría y Facturación</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-slate-50 rounded-lg border border-slate-200 px-3 py-1.5 gap-3">
                        <History size={16} className="text-slate-400"/>
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Período:</span>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="border-0 font-black bg-transparent focus:ring-0 h-auto p-0 text-slate-800 w-[140px] text-sm"><SelectValue/></SelectTrigger>
                            <SelectContent align="end">
                                <SelectItem value="2025-03">Marzo 2025</SelectItem>
                                <SelectItem value="2025-02">Febrero 2025</SelectItem>
                                <SelectItem value="2025-01">Enero 2025</SelectItem>
                                <div className="h-px bg-slate-100 my-1"></div>
                                <SelectItem value="2024-12">Diciembre 2024</SelectItem>
                                <SelectItem value="2024-11">Noviembre 2024</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="h-8 w-px bg-slate-200 mx-2"></div>
                    <Button variant="outline" size="sm" onClick={() => setShowConfig(!showConfig)}>
                        <Settings2 size={14} className="mr-2"/> Reglas
                    </Button>
                    <Button size="sm" variant={isLocked ? "secondary" : "default"} onClick={() => setIsLocked(!isLocked)} className="gap-2 font-bold min-w-[130px]">
                        {isLocked ? <><Lock size={14}/> Reabrir Mes</> : <><Save size={14}/> Cerrar Mes</>}
                    </Button>
                </div>
            </div>

            {/* 2. TABLERO DE TOTALES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
                <Card className="bg-slate-900 border-0 text-white shadow-xl relative overflow-hidden">
                    <CardContent className="p-5 flex flex-col justify-between h-full z-10 relative">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Facturación (Neto)</p>
                            <div className="text-4xl font-black text-green-400">{Math.round(totalNeto).toLocaleString()}</div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col gap-1 text-[10px] text-slate-400">
                            <div className="flex justify-between"><span>+ IVA (Prevención {rules.prevencionVat * 100}%):</span> <span className="font-bold text-white">${Math.round(totalIVA).toLocaleString()}</span></div>
                            <div className="flex justify-between"><span>Facturación Total:</span> <span className="font-bold text-white">${Math.round(totalBilling).toLocaleString()}</span></div>
                        </div>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-blue-500 shadow-md">
                    <CardContent className="p-5">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cartera Nueva</p>
                        <div className="text-3xl font-black text-slate-800">${Math.round(totalPortfolio).toLocaleString()}</div>
                        <p className="text-xs text-blue-600 mt-2 font-bold">Proyección a 60 días</p>
                    </CardContent>
                </Card>

                <Card className="bg-white border-l-4 border-l-pink-500 shadow-md">
                    <CardContent className="p-5">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pago Comisiones</p>
                        <div className="text-3xl font-black text-slate-800">
                            ${Math.round(sellersCommissions.reduce((acc, s) => acc + s.total, 0)).toLocaleString()}
                        </div>
                        <p className="text-xs text-pink-600 mt-2 font-bold">Total equipo de ventas</p>
                    </CardContent>
                </Card>

                <Card className="bg-slate-50 border-dashed border-2 border-slate-200 shadow-none hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center group">
                    <div className="text-center">
                        <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-500 group-hover:bg-slate-300 group-hover:text-slate-700 transition-colors">
                            <LayoutGrid size={20}/>
                        </div>
                        <p className="text-xs font-bold text-slate-500 group-hover:text-slate-700">Ver Historial Anual</p>
                    </div>
                </Card>
            </div>

            {/* CONFIGURACIÓN */}
            {showConfig && (
                <Card className="border-slate-300 bg-slate-50 animate-in slide-in-from-top-2 shrink-0">
                    <CardHeader className="pb-3 border-b border-slate-200 py-3 bg-slate-100/50">
                        <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-700"><Calculator size={16}/> Reglas de Facturación</CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-5 gap-6 pt-4 pb-4">
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-slate-500">Desc. Base (Tax Rate)</label><div className="flex items-center"><Input value={rules.taxRate} onChange={e=>setRules({...rules, taxRate: parseFloat(e.target.value)})} type="number" step="0.01" className="h-8 bg-white font-mono"/><span className="ml-2 text-xs font-bold text-slate-400">%</span></div></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-pink-600">IVA Prevención</label><div className="flex items-center"><Input value={rules.prevencionVat} onChange={e=>setRules({...rules, prevencionVat: parseFloat(e.target.value)})} type="number" step="0.01" className="h-8 bg-white font-mono border-pink-200"/><span className="ml-2 text-xs font-bold text-slate-400">%</span></div></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-slate-500">Mult. Docto/Galeno</label><Input value={rules.doctoRed.base} onChange={e=>setRules({...rules, doctoRed: {...rules.doctoRed, base: parseFloat(e.target.value)}})} type="number" step="0.1" className="h-8 bg-white font-mono"/></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-slate-500">Mult. AMPF</label><Input value={rules.ampf.multiplier} onChange={e=>setRules({...rules, ampf: {multiplier: parseFloat(e.target.value)}})} type="number" step="0.1" className="h-8 bg-white font-mono"/></div>
                        <div className="space-y-1"><label className="text-[10px] font-bold uppercase text-slate-500">% Cartera</label><Input value={rules.portfolioRate} onChange={e=>setRules({...rules, portfolioRate: parseFloat(e.target.value)})} type="number" step="0.01" className="h-8 bg-white font-mono"/></div>
                    </CardContent>
                </Card>
            )}

            {/* TABS PRINCIPALES */}
            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                
                <div className="flex justify-between items-end border-b border-slate-200 mb-4 px-1">
                    <TabsList className="bg-transparent gap-6 p-0 h-auto">
                        <TabsTrigger value="audit" className="rounded-none border-b-4 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">
                            ⏳ Mesa de Entrada ({pendingOps.length})
                        </TabsTrigger>
                        <TabsTrigger value="official" className="rounded-none border-b-4 border-transparent data-[state=active]:border-green-600 data-[state=active]:text-green-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">
                            ✅ Liquidación Oficial ({approvedOps.length})
                        </TabsTrigger>
                        <TabsTrigger value="portfolio" className="rounded-none border-b-4 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">
                            📈 Cartera
                        </TabsTrigger>
                        <TabsTrigger value="commissions" className="rounded-none border-b-4 border-transparent data-[state=active]:border-pink-600 data-[state=active]:text-pink-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">
                            💸 Comisiones
                        </TabsTrigger>
                    </TabsList>
                    
                    <div className="flex gap-2 mb-2 items-center">
                        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <PopoverTrigger asChild>
                                <Button variant={filters.seller !== 'all' || filters.prepaga !== 'all' ? "secondary" : "outline"} size="sm" className="h-9 gap-2">
                                    <Filter size={14}/> 
                                    {filters.seller !== 'all' || filters.prepaga !== 'all' ? "Filtros Activos" : "Filtrar"}
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-4 shadow-xl border-slate-200" align="end">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-xs uppercase text-slate-500">Vendedor</h4>
                                        <Select value={filters.seller} onValueChange={v => setFilters({...filters, seller: v})}>
                                            <SelectTrigger><SelectValue placeholder="Todos"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todos</SelectItem>
                                                {uniqueSellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="space-y-2">
                                        <h4 className="font-bold text-xs uppercase text-slate-500">Prepaga</h4>
                                        <Select value={filters.prepaga} onValueChange={v => setFilters({...filters, prepaga: v})}>
                                            <SelectTrigger><SelectValue placeholder="Todas"/></SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">Todas</SelectItem>
                                                {uniquePrepagas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <Button size="sm" variant="ghost" className="w-full text-xs text-red-500" onClick={() => {setFilters({seller:'all', prepaga:'all'}); setIsFilterOpen(false)}}>
                                        <X size={12} className="mr-1"/> Borrar Filtros
                                    </Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                        <Input placeholder="Buscar por DNI o Nombre..." className="h-9 w-64 bg-white" />
                    </div>
                </div>

                {/* --- MESA DE ENTRADA --- */}
                <TabsContent value="audit" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col">
                        <div className="bg-orange-50/50 p-3 border-b border-orange-100 flex items-center gap-2 text-xs text-orange-800 font-medium">
                            <AlertTriangle size={14}/> Estas ventas están en el período seleccionado pero aún no fueron aprobadas para facturar.
                        </div>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead className="w-[220px]">Cliente / Origen</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead>Prepaga / Plan</TableHead>
                                        <TableHead className="text-right">Valores Base</TableHead>
                                        <TableHead className="w-[180px]">Cálculo</TableHead>
                                        <TableHead className="text-right font-bold text-slate-700">Estimado</TableHead>
                                        <TableHead className="text-right">Acciones</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {pendingOps.length === 0 ? (
                                        <TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400 font-medium">🎉 Todo al día para {selectedMonth}.</TableCell></TableRow>
                                    ) : pendingOps.map(op => {
                                        const calc = calculate(op)
                                        const capitasCount = (op.hijos?.length || 0) + 1
                                        
                                        // Casteo seguro para visualización
                                        const opAny = op as any;

                                        return (
                                            <TableRow key={op.id} className={`hover:bg-slate-50 transition-colors ${getPrepagaColor(op.prepaga)}`}>
                                                <TableCell>
                                                    <div className="font-bold text-slate-800">{op.clientName}</div>
                                                    <div className="text-[11px] font-mono text-slate-400">{op.dni}</div>
                                                    <div className="flex gap-2 mt-1">
                                                        <Badge variant="secondary" className="text-[9px] h-4 px-1 border-slate-200 font-normal">
                                                            {getSourceIcon(op.origen || "")} {op.origen || "Dato"}
                                                        </Badge>
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <div className="flex items-center gap-1 text-[10px] font-bold text-blue-600 cursor-pointer hover:underline">
                                                                    <Users size={10}/> {capitasCount} Cápitas
                                                                </div>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-64 p-0 shadow-xl border-slate-200">
                                                                <div className="bg-slate-50 p-2 border-b text-xs font-bold text-slate-500 uppercase flex items-center justify-between">
                                                                    <div className="flex items-center gap-2"><Users size={12}/> Grupo Familiar</div>
                                                                    {op.condicionLaboral?.toLowerCase().includes('voluntario') 
                                                                        ? <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-[10px] border-0">VOL</Badge> 
                                                                        : <Badge className="bg-green-100 text-green-700 hover:bg-green-100 text-[10px] border-0">OBL</Badge>
                                                                    }
                                                                </div>
                                                                <div className="p-2 space-y-2">
                                                                    <div className="flex justify-between text-xs">
                                                                        <span className="font-bold text-slate-700">👑 {op.clientName}</span>
                                                                        <span className="font-mono text-slate-400">{op.dni}</span>
                                                                    </div>
                                                                    {op.hijos?.map((h: any, i: number) => (
                                                                        <div key={i} className="flex justify-between text-xs pl-2 border-l-2 border-slate-100">
                                                                            <span className="text-slate-600">{h.nombre}</span>
                                                                            <span className="font-mono text-slate-400">{h.dni}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2">
                                                        <Avatar className="h-6 w-6 border"><AvatarFallback className="text-[9px]">{op.seller.substring(0,2)}</AvatarFallback></Avatar>
                                                        <span className="text-xs font-medium text-slate-600">{op.seller}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary" className="mb-1 bg-white border border-slate-200 text-slate-700">{op.prepaga}</Badge>
                                                    <div className="text-xs font-bold text-slate-500">{op.plan}</div>
                                                </TableCell>
                                                <TableCell className="text-right text-xs font-mono text-slate-500">
                                                    <div>FP: ${parseInt(opAny.fullPrice || "0").toLocaleString()}</div>
                                                    {opAny.aportes!=="0" && <div>Ap: ${parseInt(opAny.aportes || "0").toLocaleString()}</div>}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="text-[10px] bg-slate-100 p-1 rounded font-mono text-slate-500 truncate" title={calc.formula}>{calc.formula}</div>
                                                </TableCell>
                                                <TableCell className="text-right font-bold text-slate-800 text-sm">
                                                    ${calc.val.toLocaleString()}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <Button size="sm" variant="outline" className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50 hover:text-orange-700" title="Patear al mes siguiente" onClick={() => moveToNextMonth(op.id)}>
                                                            <Calendar size={14} className="mr-1"/> Diferir
                                                        </Button>
                                                        <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm font-bold" onClick={() => approveOp(op.id)}>
                                                            Aprobar <ArrowRight size={14} className="ml-1"/>
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- LIQUIDACIÓN OFICIAL --- */}
                <TabsContent value="official" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col border-t-4 border-t-green-600">
                        <div className="bg-white p-3 border-b border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-xs text-green-800 font-medium flex items-center gap-2">
                                    <CheckCircle2 size={14}/> Estas ventas ya están computadas para la factura final.
                                </div>
                                <Button size="sm" variant="outline" className="h-7 text-xs gap-2" disabled={approvedOps.length === 0}>
                                    <Download size={12}/> Exportar Excel
                                </Button>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="bg-pink-50 border border-pink-200 rounded-lg p-3 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-pink-700 uppercase tracking-wider">SUMA PREVE (c/IVA)</span>
                                    <span className="text-lg font-black text-pink-800">${Math.round(totalPreve * (1 + rules.prevencionVat)).toLocaleString()}</span>
                                </div>
                                <div className="bg-sky-50 border border-sky-200 rounded-lg p-3 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-sky-700 uppercase tracking-wider">SUMA MUTUAL</span>
                                    <span className="text-lg font-black text-sky-800">${Math.round(totalMutual).toLocaleString()}</span>
                                </div>
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 flex justify-between items-center">
                                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">SUMA XP (Resto)</span>
                                    <span className="text-lg font-black text-purple-800">${Math.round(totalXP).toLocaleString()}</span>
                                </div>
                            </div>
                        </div>

                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead>Cliente / Plan</TableHead>
                                        <TableHead>Vendedor</TableHead>
                                        <TableHead className="text-right">Valores Orig.</TableHead>
                                        <TableHead className="w-[180px] text-center">Fórmula</TableHead>
                                        <TableHead className="text-right font-black text-green-700 w-[160px] bg-green-50/50">A LIQUIDAR ($)</TableHead>
                                        <TableHead className="text-right w-[80px]">Volver</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {approvedOps.length === 0 ? (
                                        <TableRow><TableCell colSpan={6} className="text-center py-20 text-slate-400">Aprobá ventas desde la pestaña "Mesa de Entrada".</TableCell></TableRow>
                                    ) : approvedOps.map(op => {
                                        const calc = calculate(op)
                                        const opAny = op as any;

                                        return (
                                            <TableRow key={op.id} className="hover:bg-slate-50 transition-colors">
                                                <TableCell>
                                                    <div className="font-bold text-slate-800">{op.clientName}</div>
                                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                                        <Badge variant="outline" className="h-4 px-1 text-[9px]">{op.prepaga}</Badge>
                                                        <span>{op.plan}</span>
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-xs text-slate-600 font-medium">{op.seller}</TableCell>
                                                <TableCell className="text-right font-mono text-xs text-slate-500">${parseInt(opAny.fullPrice || "0").toLocaleString()}</TableCell>
                                                <TableCell className="text-center">
                                                    <div className="bg-slate-100 text-[9px] px-2 py-0.5 rounded text-slate-500 truncate inline-block max-w-[150px]" title={calc.formula}>{calc.formula}</div>
                                                </TableCell>
                                                <TableCell className="text-right bg-green-50/30 p-2">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-green-600 font-bold text-xs">$</span>
                                                        <Input 
                                                            className="h-8 pl-5 font-bold text-green-700 border-green-200 bg-white focus:ring-green-500 text-right text-sm" 
                                                            value={calc.val} 
                                                            onChange={(e) => handlePriceChange(op.id, e.target.value)} 
                                                            disabled={isLocked}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:text-red-500" title="Devolver a Pendientes" onClick={() => unapproveOp(op.id)}>
                                                        <Undo2 size={16}/>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>

                        <div className="p-4 bg-slate-50 border-t flex justify-end items-center gap-8">
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Subtotal Neto</p>
                                <p className="text-lg font-bold text-slate-700">${Math.round(totalNeto).toLocaleString()}</p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase text-pink-600">+ IVA Prevención</p>
                                <p className="text-lg font-bold text-pink-600">${Math.round(totalIVA).toLocaleString()}</p>
                            </div>
                            <div className="h-10 w-px bg-slate-300"></div>
                            <div className="text-right">
                                <p className="text-xs text-slate-500 font-bold uppercase">Total a Percibir</p>
                                <p className="text-2xl font-black text-green-600">${Math.round(totalBilling).toLocaleString()}</p>
                            </div>
                        </div>
                    </Card>
                </TabsContent>

                {/* --- CARTERA --- */}
                <TabsContent value="portfolio" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col border-t-4 border-t-blue-500">
                        <div className="bg-white p-3 border-b border-slate-100 flex justify-between items-center">
                            <div className="text-xs text-blue-800 font-medium">
                                Proyección de Cartera (Automática + Manual)
                            </div>
                            <Button size="sm" className="h-7 text-xs gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsAddingClient(true)}>
                                <Plus size={12}/> Nuevo Cliente
                            </Button>
                        </div>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10">
                                    <TableRow>
                                        <TableHead>Cliente</TableHead>
                                        <TableHead>Origen</TableHead>
                                        <TableHead>Prepaga</TableHead>
                                        <TableHead>Valor Liquidado</TableHead>
                                        <TableHead className="text-right font-black text-blue-700 bg-blue-50 w-[180px]">CARTERA (Editable)</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {approvedOps.filter(o => o.prepaga?.toLowerCase().includes('preven')).map(op => {
                                        const liq = calculate(op)
                                        return (
                                            <TableRow key={op.id}>
                                                <TableCell className="font-bold text-slate-700">{op.clientName}</TableCell>
                                                <TableCell><Badge variant="secondary" className="text-[9px]">Automático</Badge></TableCell>
                                                <TableCell><Badge variant="outline">{op.prepaga}</Badge></TableCell>
                                                <TableCell>${liq.val.toLocaleString()}</TableCell>
                                                <TableCell className="text-right bg-blue-50/50 p-2">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-blue-600 font-bold text-xs">$</span>
                                                        <Input 
                                                            className="h-8 pl-5 font-bold text-blue-700 border-blue-200 bg-white focus:ring-blue-500 text-right text-sm" 
                                                            value={liq.portfolio} 
                                                            onChange={(e) => handlePortfolioChange(op.id, e.target.value)} 
                                                            disabled={isLocked}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {manualPortfolio.map(item => {
                                        const currentVal = portfolioOverrides[item.id] !== undefined 
                                            ? portfolioOverrides[item.id] 
                                            : Math.round(parseFloat(item.calculatedLiquidation) * rules.portfolioRate)
                                        
                                        return (
                                            <TableRow key={item.id} className="bg-yellow-50/30">
                                                <TableCell className="font-bold text-slate-700">{item.name}</TableCell>
                                                <TableCell><Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-[9px]">Manual</Badge></TableCell>
                                                <TableCell><Badge variant="outline">{item.prepaga}</Badge></TableCell>
                                                <TableCell>${parseFloat(item.calculatedLiquidation).toLocaleString()}</TableCell>
                                                <TableCell className="text-right bg-blue-50/50 p-2">
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-blue-600 font-bold text-xs">$</span>
                                                        <Input 
                                                            className="h-8 pl-5 font-bold text-blue-700 border-blue-200 bg-white focus:ring-blue-500 text-right text-sm" 
                                                            value={currentVal} 
                                                            onChange={(e) => handlePortfolioChange(item.id, e.target.value)} 
                                                            disabled={isLocked}
                                                        />
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- COMISIONES --- */}
                <TabsContent value="commissions" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col border-t-4 border-t-pink-500 bg-slate-50/50">
                        <div className="p-4 bg-white border-b flex items-center justify-between">
                            <div className="flex items-center gap-2 text-pink-700 font-black">
                                <Award className="text-pink-600"/> LIQUIDACIÓN DE COMISIONES
                            </div>
                            <Button size="sm" variant="outline" className="h-8"><Download size={14} className="mr-2"/> Exportar PDF</Button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sellersCommissions.map((seller, index) => (
                                    <Card key={index} className="border-0 shadow-md hover:shadow-xl transition-all relative overflow-hidden group bg-white h-fit">
                                        <div className="absolute top-0 left-0 w-full h-1.5 bg-gradient-to-r from-pink-500 to-purple-600"></div>
                                        <div className="absolute top-2 right-2 z-10">
                                            <Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setViewingSeller(seller.name)}>
                                                <Eye size={16}/>
                                            </Button>
                                        </div>
                                        <CardContent className="p-6">
                                            <div className="flex items-start justify-between mb-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-14 w-14 border-2 border-white shadow-md">
                                                        <AvatarImage src={seller.info.photo} />
                                                        <AvatarFallback className="bg-pink-100 text-pink-600 font-black">{seller.name.substring(0,2).toUpperCase()}</AvatarFallback>
                                                    </Avatar>
                                                    <div>
                                                        <h3 className="font-black text-lg text-slate-800 leading-tight">{seller.name}</h3>
                                                        <div className="flex gap-2 mt-1">
                                                            <Badge variant="outline" className="bg-slate-50 text-[10px] flex w-fit items-center gap-1 border-slate-200">
                                                                <Clock size={10}/> {seller.info.shift}
                                                            </Badge>
                                                            <Badge className="bg-slate-100 text-slate-600 text-[10px]">Abs: {seller.absorbableCount}</Badge>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-3xl font-black text-slate-800">${Math.round(seller.total).toLocaleString()}</div>
                                                    <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider">A Pagar</div>
                                                </div>
                                            </div>

                                            <div className="space-y-3">
                                                <div className="bg-yellow-50 p-2 rounded-lg border border-yellow-100 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-yellow-100 p-1.5 rounded text-yellow-700"><Award size={12}/></div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-yellow-800 uppercase">Especiales (10%)</p>
                                                            <p className="text-xs text-yellow-600">{seller.specialCount} ventas</p>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-yellow-800 text-sm">${Math.round(seller.specialCommission).toLocaleString()}</span>
                                                </div>

                                                <div className="bg-purple-50 p-2 rounded-lg border border-purple-100 flex justify-between items-center">
                                                    <div className="flex items-center gap-2">
                                                        <div className="bg-purple-100 p-1.5 rounded text-purple-700"><Zap size={12}/></div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-purple-800 uppercase">Escala ({seller.scalePercentage * 100}%)</p>
                                                            <p className="text-xs text-purple-600">{seller.variableCount} total - {seller.absorbableCount} abs = <strong>{seller.payableCount} pagas</strong></p>
                                                        </div>
                                                    </div>
                                                    <span className="font-bold text-purple-800 text-sm">${Math.round(seller.variableCommission).toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between items-center text-xs text-slate-400">
                                                <span>Total Ventas: {seller.totalCount}</span>
                                                <span>Eficiencia: {Math.round((seller.total / (seller.totalCount || 1))).toLocaleString()}/u</span>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </Card>
                </TabsContent>

            </Tabs>

            {/* DIALOGO DETALLE VENDEDOR */}
            <Dialog open={!!viewingSeller} onOpenChange={() => setViewingSeller(null)}>
                <DialogContent className="max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>Detalle Liquidación: {viewingSeller}</DialogTitle>
                        <DialogDescription>Listado de operaciones aprobadas para el período actual.</DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cliente</TableHead>
                                    <TableHead>Plan</TableHead>
                                    <TableHead className="text-right">Liquidado</TableHead>
                                    <TableHead>Tipo</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {getSellerOpsDetail(viewingSeller).map(op => {
                                    const calc = calculate(op)
                                    return (
                                        <TableRow key={op.id} className={op.payStatus === 'absorbed' ? 'opacity-50 bg-slate-50' : ''}>
                                            <TableCell className="text-xs">{op.entryDate}</TableCell>
                                            <TableCell className="font-bold text-xs">{op.clientName}</TableCell>
                                            <TableCell className="text-xs"><Badge variant="outline">{op.prepaga} {op.plan}</Badge></TableCell>
                                            <TableCell className="text-right font-mono text-xs">${calc.val.toLocaleString()}</TableCell>
                                            <TableCell>
                                                {op.payStatus === 'special' && <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-100 text-[10px]">Especial 10%</Badge>}
                                                {op.payStatus === 'absorbed' && <Badge variant="outline" className="text-slate-400 border-slate-300 text-[10px]">Absorbida</Badge>}
                                                {op.payStatus === 'paid' && <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100 text-[10px]">Paga Variable</Badge>}
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* DIALOGO AGREGAR CLIENTE MANUAL */}
            <Dialog open={isAddingClient} onOpenChange={setIsAddingClient}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><UserPlus className="text-blue-600"/> Agregar Cliente a Cartera Manual</DialogTitle>
                        <DialogDescription>Ingresá los datos completos para calcular la liquidación y la cartera estimada.</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid grid-cols-2 gap-6 py-4">
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500">Nombre Titular</Label>
                                <Input value={newClient.name} onChange={e => setNewClient({...newClient, name: e.target.value})} placeholder="Ej: Juan Perez" />
                            </div>
                            <div className="space-y-1">
                                <Label className="text-xs font-bold text-slate-500">DNI</Label>
                                <Input value={newClient.dni} onChange={e => setNewClient({...newClient, dni: e.target.value})} placeholder="12345678" />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500">Prepaga</Label>
                                    <Select value={newClient.prepaga} onValueChange={v => setNewClient({...newClient, prepaga: v})}>
                                        <SelectTrigger><SelectValue/></SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="Prevención Salud">Prevención Salud</SelectItem>
                                            <SelectItem value="Galeno">Galeno</SelectItem>
                                            <SelectItem value="Sancor">Sancor</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs font-bold text-slate-500">Plan</Label>
                                    <Input value={newClient.plan} onChange={e => setNewClient({...newClient, plan: e.target.value})} placeholder="Ej: A2" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-4 bg-slate-50 p-4 rounded-lg border border-slate-100">
                            <h4 className="text-xs font-black text-slate-400 uppercase tracking-wider mb-2">Valores Económicos</h4>
                            <div className="space-y-1">
                                <Label className="text-xs">Full Price ($)</Label>
                                <Input type="number" value={newClient.fullPrice} onChange={e => setNewClient({...newClient, fullPrice: e.target.value})} />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="space-y-1">
                                    <Label className="text-xs">Aportes ($)</Label>
                                    <Input type="number" value={newClient.aportes} onChange={e => setNewClient({...newClient, aportes: e.target.value})} />
                                </div>
                                <div className="space-y-1">
                                    <Label className="text-xs">Descuento ($)</Label>
                                    <Input type="number" value={newClient.descuento} onChange={e => setNewClient({...newClient, descuento: e.target.value})} />
                                </div>
                            </div>
                            
                            <div className="mt-4 pt-3 border-t border-slate-200">
                                <div className="flex justify-between text-xs mb-1">
                                    <span className="text-slate-500">Liquidación Est:</span>
                                    <span className="font-bold text-slate-700">
                                        ${calculateManualLiquidation().toLocaleString()}
                                    </span>
                                </div>
                                <div className="flex justify-between text-sm font-black text-blue-600">
                                    <span>Cartera (5%):</span>
                                    <span>
                                        ${Math.round(calculateManualLiquidation() * 0.05).toLocaleString()}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-slate-100 pt-4">
                        <Label className="text-xs font-bold text-slate-500 mb-2 block">Grupo Familiar (Cápitas)</Label>
                        <div className="flex gap-2 mb-2">
                            <Input placeholder="Nombre familiar" className="h-8 text-xs" value={newFamilyMember.name} onChange={e => setNewFamilyMember({...newFamilyMember, name: e.target.value})} />
                            <Input placeholder="DNI" className="h-8 w-24 text-xs" value={newFamilyMember.dni} onChange={e => setNewFamilyMember({...newFamilyMember, dni: e.target.value})} />
                            <Button size="sm" variant="secondary" className="h-8" onClick={() => {
                                if(newFamilyMember.name) {
                                    setNewClient({...newClient, hijos: [...newClient.hijos, newFamilyMember]})
                                    setNewFamilyMember({name:"", dni:""})
                                }
                            }}><Plus size={14}/></Button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {newClient.hijos.map((h, i) => (
                                <Badge key={i} variant="outline" className="bg-white">{h.name} ({h.dni})</Badge>
                            ))}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setIsAddingClient(false)}>Cancelar</Button>
                        <Button onClick={handleAddClient} className="bg-blue-600 hover:bg-blue-700 text-white">Guardar Cliente</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}