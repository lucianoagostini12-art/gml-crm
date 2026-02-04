"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { DollarSign, Save, Lock, Settings2, LayoutGrid, Filter, CheckCircle2, Download, Undo2, Calendar, Clock, User, Globe, Phone, Users, Plus, X, ArrowRight, ArrowLeft, Loader2, ChevronLeft, ChevronRight, Info, Eye, EyeOff, BarChart3, AlertTriangle, Copy, Check, Trash2, ExternalLink } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"

// IMPORTAMOS EL MODAL Y HELPERS
import { OpsModal } from "./OpsModal"
import { getStatusColor, getSubStateStyle } from "./data"

// --- TIPOS ---
type Operation = {
    id: string
    entryDate: string
    clientName: string
    dni: string
    origen: string
    seller: string
    prepaga: string
    plan: string
    fullPrice: string
    aportes: string
    descuento: string
    status: string
    subState?: string
    condicionLaboral?: string
    hijos?: any[]
    billing_approved?: boolean
    billing_period?: string
    billing_price_override?: number
    billing_portfolio_override?: number
    // Campos extra para OpsModal
    chat?: any[]
    reminders?: any[]
    history?: any[]
    adminNotes?: any[]
    phone?: string
    email?: string
    cuit?: string
    dob?: string
    address_street?: string
    address_city?: string
    address_zip?: string
    cbu_tarjeta?: string
    metodoPago?: string
    cuitEmpleador?: string
    capitas?: number
}

// --- REGLAS INICIALES ---
const INITIAL_COMMISSION_RULES = {
    special: {
        plans: ['A1', '500', 'AMPF'],
        percentage: 0.10
    },
    scales: {
        '5hs': { absorbable: 8, tiers: [{ min: 9, max: 14, pct: 0.15 }, { min: 15, max: 20, pct: 0.20 }, { min: 21, max: 24, pct: 0.25 }, { min: 25, max: 999, pct: 0.30 }] },
        '8hs': { absorbable: 12, tiers: [{ min: 13, max: 18, pct: 0.15 }, { min: 19, max: 24, pct: 0.20 }, { min: 25, max: 30, pct: 0.25 }, { min: 31, max: 999, pct: 0.30 }] }
    }
}

const INITIAL_CALC_RULES = {
    taxRate: 0.105,
    prevencionVat: 0.21,
    doctoRed: { base: 1.80, specialPlan: '500' },
    ampf: { multiplier: 2.0 },
    prevencion: { 'A1': 0.90, 'A1 CP': 0.90, 'A2': 1.30, 'A2 CP': 1.30, 'A4': 1.50, 'A5': 1.50, default: 1.30 },
    generalGroup: { multiplier: 1.80 },
    portfolioRate: 0.05
}

// --- HELPERS VISUALES (COLORES) ---
const getPrepagaBadgeColor = (prepaga: string) => {
    const p = prepaga || ""
    if (p.includes("Prevención")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
    if (p.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
    if (p.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
    if (p.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
    if (p.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
    if (p.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"

    return "bg-slate-50 border-slate-100 text-slate-800"
}

const getSourceIcon = (source: string) => {
    const s = source?.toLowerCase() || ""
    if (s.includes('google')) return <Globe size={10} className="mr-1 text-blue-500" />
    if (s.includes('meta') || s.includes('face') || s.includes('insta')) return <Globe size={10} className="mr-1 text-pink-500" />
    if (s.includes('referido')) return <User size={10} className="mr-1 text-green-500" />
    return <Phone size={10} className="mr-1" />
}

// --- HELPER DE COPIA INTELIGENTE (CUIT -> DNI) ---
function CopyDniButton({ cuit, dni }: { cuit?: string, dni: string }) {
    const [copied, setCopied] = useState(false)

    const handleCopy = (e: React.MouseEvent) => {
        e.stopPropagation()
        let textToCopy = dni

        if (cuit) {
            const digits = String(cuit).replace(/\D/g, "")
            if (digits.length === 11) textToCopy = digits.substring(2, 10)
            else if (digits.length === 10) textToCopy = digits.substring(2)
            else textToCopy = digits || dni
        }

        navigator.clipboard.writeText(textToCopy)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 ml-1 text-slate-300 hover:text-blue-600 hover:bg-blue-50"
            onClick={handleCopy}
            title="Copiar DNI (Extraído del CUIT)"
        >
            {copied ? <Check size={10} className="text-green-600" /> : <Copy size={10} />}
        </Button>
    )
}

const getCurrentMonth = () => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}


export function OpsBilling({ searchTerm = "", userName = "Administración" }: { searchTerm?: string, userName?: string }) {
    const supabase = createClient()

    // --- ESTADO ---
    const [operations, setOperations] = useState<Operation[]>([])
    const [loading, setLoading] = useState(true)
    const [activeTab, setActiveTab] = useState("audit")
    const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth())
    const [isLocked, setIsLocked] = useState(false)

    // ESTADO PARA EL OJO DE PRIVACIDAD
    const [showValues, setShowValues] = useState(true)

    // Config
    const [calcRules, setCalcRules] = useState(INITIAL_CALC_RULES)
    const [commissionRules, setCommissionRules] = useState(INITIAL_COMMISSION_RULES)
    const [showConfig, setShowConfig] = useState(false)
    const [showHistory, setShowHistory] = useState(false)
    const [globalConfig, setGlobalConfig] = useState<{ prepagas: any[], subStates: any }>({ prepagas: [], subStates: {} })

    // Modals
    const [selectedOp, setSelectedOp] = useState<any>(null) // Para OpsModal
    const [modalOpen, setModalOpen] = useState(false) // ✅ Estado para controlar apertura del modal
    const [deferOpId, setDeferOpId] = useState<string | null>(null) // ID para mover al PROXIMO mes
    const [retroOpId, setRetroOpId] = useState<string | null>(null) // ID para mover al ANTERIOR mes
    const [manualPortfolio, setManualPortfolio] = useState<any[]>([])

    const [isAddingClient, setIsAddingClient] = useState(false)
    const [newClient, setNewClient] = useState({ name: "", dni: "", prepaga: "Prevención Salud", plan: "", fullPrice: "0", aportes: "0", descuento: "0", hijos: [] as { name: string, dni: string }[] })

    const [filters, setFilters] = useState({ seller: 'all', prepaga: 'all' })
    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [viewingSeller, setViewingSeller] = useState<string | null>(null)

    // ✅ Estado para modal de Cartera Caída
    const [carteraCaidaOp, setCarteraCaidaOp] = useState<any>(null)
    const [carteraCaidaMotivo, setCarteraCaidaMotivo] = useState("")
    const [isSavingCarteraCaida, setIsSavingCarteraCaida] = useState(false)
    // ✅ Filtro de mes de cartera
    const [filterCarteraMes, setFilterCarteraMes] = useState<string>('all')
    // ✅ Filtros de verificación
    const [filterVerificadoLiq, setFilterVerificadoLiq] = useState<'all' | 'verified' | 'pending'>('all')
    const [filterVerificadoCartera, setFilterVerificadoCartera] = useState<'all' | 'verified' | 'pending'>('all')

    // MAPA DE VENDEDORES (Para horas y fotos)
    const [sellersMap, setSellersMap] = useState<Record<string, { shift: '5hs' | '8hs', photo: string }>>({})

    // --- FETCH ---
    const fetchSellers = async () => {
        const { data: profiles } = await supabase.from('profiles').select('full_name, work_hours, avatar_url, email').eq('role', 'seller')
        if (profiles) {
            const map: Record<string, any> = {}
            profiles.forEach((p: any) => {
                if (!p.full_name) return
                const hStr = String(p.work_hours || "5")
                const shift = hStr.includes("8") ? '8hs' : '5hs'

                map[p.full_name] = {
                    shift,
                    photo: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}`
                }
            })
            setSellersMap(map)
        }
    }

    const fetchData = async () => {
        setLoading(true)
        const { data: opsData } = await supabase.from('leads').select('*').eq('status', 'cumplidas').order('last_update', { ascending: false })

        if (opsData) {
            const mapped: Operation[] = opsData.map((d: any) => ({
                id: d.id,
                entryDate: d.created_at,
                cumplida_at: d.cumplida_at, // ✅ Fecha cuando pasó a cumplidas
                clientName: d.name || "Sin Nombre",
                dni: d.dni || "",
                origen: d.source || "Dato",
                seller: d.agent_name || "Desconocido",
                prepaga: d.prepaga || d.quoted_prepaga,
                plan: d.plan || d.quoted_plan,
                fullPrice: d.full_price || d.price || "0",
                aportes: d.aportes || "0",
                descuento: d.descuento || "0",
                status: d.status,
                subState: d.sub_state,
                condicionLaboral: d.labor_condition,
                hijos: d.family_members || d.hijos || [],
                billing_approved: d.billing_approved,
                billing_period: d.billing_period,
                billing_price_override: d.billing_price_override,
                billing_portfolio_override: d.billing_portfolio_override,
                // ✅ Campos de cartera caída
                cartera_caida: d.cartera_caida || false,
                cartera_caida_motivo: d.cartera_caida_motivo || "",
                cartera_caida_at: d.cartera_caida_at,
                // ✅ Tipo de operación (alta/pass)
                type: d.type || 'alta',
                // ✅ Verificación de billing
                billing_verified: d.billing_verified || false,
                billing_verified_at: d.billing_verified_at,
                // ✅ Grupo familiar (igual que OpsPostsale)
                capitas: d.capitas || 1,
                familia: d.family_members || d.hijos || [],

                // Mapeo completo para OpsModal
                phone: d.phone,
                email: d.email,
                cuit: d.cuit,
                dob: d.dob,
                address_street: d.address_street,
                address_city: d.address_city,
                address_zip: d.address_zip,
                cuitEmpleador: d.employer_cuit,
                metodoPago: d.payment_method,
                cbu_tarjeta: d.cbu_card,
                chat: [],
                reminders: [],
                history: [],
                adminNotes: d.admin_notes || []
            }))
            setOperations(mapped)
        }

        const { data: manualData } = await supabase.from('billing_manual_clients').select('*').order('created_at', { ascending: false })
        if (manualData) setManualPortfolio(manualData)

        const { data: config } = await supabase.from('system_config').select('*')
        if (config) {
            const p = config.find(c => c.key === 'prepagas_plans')?.value || []
            const s = config.find(c => c.key === 'workflow_substates')?.value || {}
            setGlobalConfig({ prepagas: p, subStates: s })
        }

        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        fetchSellers()
        const channel = supabase.channel('billing_realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leads', filter: 'status=eq.cumplidas' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'billing_manual_clients' }, () => fetchData())
            .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchSellers())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [])

    const formatMoney = (val: number, round: boolean = false) => {
        if (!showValues) return "$ ****"
        const valueToUse = round ? Math.round(val) : val
        const decimals = round ? 0 : 2
        return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(valueToUse)
    }

    const updateOpBilling = async (id: string, updates: any) => {
        setOperations(prev => prev.map(op => op.id === id ? { ...op, ...updates } : op))
        await supabase.from('leads').update(updates).eq('id', id)
    }

    const calculate = (op: any) => {
        let val = 0, formula = ""
        if (op.billing_price_override !== null && op.billing_price_override !== undefined) {
            val = parseFloat(op.billing_price_override.toString())
            formula = "Manual (Editado)"
        } else {
            const full = parseFloat(op.fullPrice || "0"); const aportes = parseFloat(op.aportes || "0"); const desc = parseFloat(op.descuento || "0")
            const p = op.prepaga?.toLowerCase() || ""; const plan = op.plan || ""
            if (p.includes("preven")) {
                const base = full - desc
                // @ts-ignore
                const rate = calcRules.prevencion[plan] || calcRules.prevencion.default
                val = base * rate
                formula = `(Full - Desc) * ${rate}`
            } else if (p.includes("ampf")) {
                val = full * calcRules.ampf.multiplier
                formula = `Full * ${calcRules.ampf.multiplier}`
            } else {
                let base = full * (1 - calcRules.taxRate)
                formula = `(Full - 10.5%) * ${calcRules.generalGroup.multiplier}`
                if (p.includes("doctored") && plan.includes("500") && op.condicionLaboral === 'empleado') {
                    base = aportes * (1 - calcRules.taxRate)
                    formula = `(Aportes - 10.5%) * ${calcRules.generalGroup.multiplier}`
                }
                val = base * calcRules.generalGroup.multiplier
            }
            if (p.includes("pass")) { val = 0; formula = "Manual" }
        }

        // ✅ CARTERA: Solo se calcula para Prevención Salud
        let portfolioVal = 0
        const prepagaLower = op.prepaga?.toLowerCase() || ""
        const isPrevention = prepagaLower.includes("preven")

        if (isPrevention) {
            if (op.billing_portfolio_override !== null && op.billing_portfolio_override !== undefined) {
                portfolioVal = parseFloat(op.billing_portfolio_override.toString())
            } else {
                const full = parseFloat(op.fullPrice || "0"); const aportes = parseFloat(op.aportes || "0"); const desc = parseFloat(op.descuento || "0")
                const netPayable = Math.max(0, full - desc - aportes)
                portfolioVal = Number((netPayable * calcRules.portfolioRate).toFixed(2))
            }
        }
        // Si no es Prevención, portfolioVal queda en 0

        return { val: Number(val.toFixed(2)), formula, portfolio: Number(portfolioVal.toFixed(2)) }
    }

    const changeMonth = (delta: number) => {
        const [y, m] = selectedMonth.split('-').map(Number)
        const date = new Date(y, m - 1 + delta, 1)
        setSelectedMonth(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
    }
    const formatMonth = (isoMonth: string) => {
        const [y, m] = isoMonth.split('-').map(Number)
        return new Date(y, m - 1, 1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })
    }

    const opsInPeriod = useMemo(() => {
        const term = searchTerm.toLowerCase().trim()
        return operations.filter((op: any) => {
            // ✅ QUIRÚRGICO: Usar cumplida_at para período de liquidación (solo en OpsBilling)
            const opDate = new Date(op.cumplida_at || op.entryDate)
            const defaultMonth = `${opDate.getFullYear()}-${String(opDate.getMonth() + 1).padStart(2, '0')}`
            const targetMonth = op.billing_period || defaultMonth

            if (targetMonth !== selectedMonth) return false
            if (filters.seller !== 'all' && op.seller !== filters.seller) return false
            if (filters.prepaga !== 'all' && op.prepaga !== filters.prepaga) return false

            // ✅ Filtro de búsqueda global
            if (term) {
                const matchesSearch =
                    (op.clientName?.toLowerCase().includes(term)) ||
                    (op.dni?.toLowerCase().includes(term)) ||
                    (op.cuit?.toLowerCase().includes(term)) ||
                    (op.seller?.toLowerCase().includes(term)) ||
                    (op.prepaga?.toLowerCase().includes(term))
                if (!matchesSearch) return false
            }
            return true
        })
    }, [operations, selectedMonth, filters, searchTerm])

    // ✅ CARTERA ACUMULATIVA: Todas las operaciones de Prevención aprobadas (snowball)
    const allPortfolioOps = useMemo(() => {
        const term = searchTerm.toLowerCase().trim()
        const [selectedYear, selectedMonthNum] = selectedMonth.split('-').map(Number)
        const selectedDate = new Date(selectedYear, selectedMonthNum - 1, 1)

        return operations.filter((op: any) => {
            // ✅ Usar cumplida_at para determinar el mes de cartera
            const opDate = new Date(op.cumplida_at || op.entryDate)
            const defaultMonth = `${opDate.getFullYear()}-${String(opDate.getMonth() + 1).padStart(2, '0')}`
            const targetMonth = op.billing_period || defaultMonth
            const [opYear, opMonth] = targetMonth.split('-').map(Number)
            const opMonthDate = new Date(opYear, opMonth - 1, 1)

            // Solo operaciones de meses ANTERIORES al seleccionado
            if (opMonthDate >= selectedDate) return false
            if (op.billing_approved !== true) return false
            // ✅ Excluir carteras caídas
            if (op.cartera_caida === true) return false
            // ✅ CARTERA: Solo operaciones de Prevención Salud generan cartera
            const prepagaLower = op.prepaga?.toLowerCase() || ""
            if (!prepagaLower.includes("preven")) return false
            // ✅ Aplicar filtros de vendedor y prepaga
            if (filters.seller !== 'all' && op.seller !== filters.seller) return false
            if (filters.prepaga !== 'all' && op.prepaga !== filters.prepaga) return false

            // ✅ Filtro de búsqueda global
            if (term) {
                const matchesSearch =
                    (op.clientName?.toLowerCase().includes(term)) ||
                    (op.dni?.toLowerCase().includes(term)) ||
                    (op.cuit?.toLowerCase().includes(term)) ||
                    (op.seller?.toLowerCase().includes(term))
                if (!matchesSearch) return false
            }
            return true
        }).map((op: any) => {
            // ✅ Agregar campo con mes de inicio de cartera para badge
            const opDate = new Date(op.cumplida_at || op.entryDate)
            const defaultMonth = `${opDate.getFullYear()}-${String(opDate.getMonth() + 1).padStart(2, '0')}`
            const carteraMes = op.billing_period || defaultMonth
            return { ...op, cartera_inicio_mes: carteraMes }
        })
    }, [operations, selectedMonth, filters, searchTerm])

    // ✅ Meses únicos de cartera para el filtro
    const uniqueCarteraMeses = useMemo(() => {
        const meses = allPortfolioOps.map((op: any) => op.cartera_inicio_mes).filter(Boolean)
        return [...new Set(meses)].sort().reverse() // Más reciente primero
    }, [allPortfolioOps])

    // ✅ Operaciones de cartera filtradas por mes
    const filteredPortfolioOps = useMemo(() => {
        if (filterCarteraMes === 'all') return allPortfolioOps
        return allPortfolioOps.filter((op: any) => op.cartera_inicio_mes === filterCarteraMes)
    }, [allPortfolioOps, filterCarteraMes])

    // ✅ Filtrado adicional por verificación en Cartera
    const filteredPortfolioOpsFinal = useMemo(() => {
        if (filterVerificadoCartera === 'all') return filteredPortfolioOps
        if (filterVerificadoCartera === 'verified') return filteredPortfolioOps.filter((op: any) => op.billing_verified === true)
        return filteredPortfolioOps.filter((op: any) => op.billing_verified !== true)
    }, [filteredPortfolioOps, filterVerificadoCartera])

    const pendingOps = opsInPeriod.filter((op: any) => op.billing_approved !== true)
    const approvedOpsBase = opsInPeriod.filter((op: any) => op.billing_approved === true)

    // ✅ Filtrado por verificación en Liquidación Oficial
    const approvedOps = useMemo(() => {
        if (filterVerificadoLiq === 'all') return approvedOpsBase
        if (filterVerificadoLiq === 'verified') return approvedOpsBase.filter((op: any) => op.billing_verified === true)
        return approvedOpsBase.filter((op: any) => op.billing_verified !== true)
    }, [approvedOpsBase, filterVerificadoLiq])

    const historyData = useMemo(() => {
        const aggregated: Record<string, number> = {}
        operations.forEach(op => {
            if (op.billing_approved === true) {
                const opDate = new Date(op.entryDate)
                const month = op.billing_period || `${opDate.getFullYear()}-${String(opDate.getMonth() + 1).padStart(2, '0')}`
                const val = calculate(op).val
                aggregated[month] = (aggregated[month] || 0) + val
            }
        })
        return Object.entries(aggregated).sort((a, b) => a[0].localeCompare(b[0])).map(([month, total]) => ({ month, total })).slice(-12)
    }, [operations, calcRules])

    const { totalNeto, totalIVA, breakdown } = useMemo(() => {
        let neto = 0, preve = 0, sumPreve = 0, sumXP = 0, sumAMPF = 0
        approvedOps.forEach(op => {
            const val = calculate(op).val
            neto += val
            const p = op.prepaga?.toLowerCase() || ""
            if (p.includes("preven")) { preve += val; sumPreve += val }
            else if (p.includes("ampf")) { sumAMPF += val }
            else { sumXP += val }
        })
        const iva = preve * calcRules.prevencionVat
        return { totalNeto: neto, totalIVA: iva, breakdown: { sumPreve, sumXP, sumAMPF } }
    }, [approvedOps, calcRules])

    const totalBilling = totalNeto + totalIVA
    const portfolioOps = allPortfolioOps.reduce((acc, op) => acc + calculate(op).portfolio, 0)
    const portfolioManualTotal = manualPortfolio.reduce((acc, item) => acc + (parseFloat(item.calculated_liquidation || "0") * calcRules.portfolioRate), 0)
    const totalPortfolio = portfolioOps + portfolioManualTotal

    const sellersCommissions = useMemo(() => {
        const result: any[] = []
        const grouped: Record<string, Operation[]> = {}
        approvedOps.forEach(op => { if (!grouped[op.seller]) grouped[op.seller] = []; grouped[op.seller].push(op) })

        Object.keys(grouped).forEach(sellerName => {
            const ops = grouped[sellerName]
            const sellerInfo = sellersMap[sellerName] || { shift: '5hs', photo: `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerName}` }
            const shiftRules = commissionRules.scales[sellerInfo.shift]

            let specialCommission = 0
            let variableCommission = 0
            const standardOps: Operation[] = []
            const specialOps: Operation[] = []

            ops.forEach(op => {
                const plan = op.plan?.toUpperCase() || ""
                const prepaga = op.prepaga?.toUpperCase() || ""
                const isSpecial = commissionRules.special.plans.some(k => plan.includes(k) || prepaga.includes(k))
                if (isSpecial) specialOps.push(op)
                else standardOps.push(op)
            })

            standardOps.sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
            const totalStandardCount = standardOps.reduce((acc, op) => {
                const isAMPF = op.prepaga?.toUpperCase().includes("AMPF")
                return acc + (isAMPF ? 1 : (op.capitas || 1))
            }, 0)

            const absorbableLimit = shiftRules.absorbable
            const isThresholdMet = totalStandardCount > absorbableLimit
            let scalePercentage = 0
            let payableCount = 0

            if (isThresholdMet) {
                const tier = shiftRules.tiers.find(t => totalStandardCount >= t.min && totalStandardCount <= t.max)
                const finalTier = tier || shiftRules.tiers[shiftRules.tiers.length - 1]
                scalePercentage = finalTier.pct
                payableCount = standardOps.slice(absorbableLimit).length
                const totalLiquidatedStandard = standardOps.slice(absorbableLimit).reduce((acc, op) => acc + calculate(op).val, 0)
                variableCommission = totalLiquidatedStandard * scalePercentage
                const totalLiquidatedSpecial = specialOps.reduce((acc, op) => acc + calculate(op).val, 0)
                specialCommission = totalLiquidatedSpecial * commissionRules.special.percentage
            }

            result.push({
                name: sellerName, info: sellerInfo, totalCount: ops.length, specialCount: specialOps.length, variableCount: totalStandardCount, absorbableCount: absorbableLimit,
                payableCount, specialCommission, variableCommission, scalePercentage, total: specialCommission + variableCommission, isThresholdMet
            })
        })
        return result.sort((a, b) => b.total - a.total)
    }, [approvedOps, commissionRules, calcRules, sellersMap])

    const handlePriceChange = (id: string, v: string) => updateOpBilling(id, { billing_price_override: parseFloat(v) })
    const handlePortfolioChange = (id: string, v: string) => updateOpBilling(id, { billing_portfolio_override: parseFloat(v) })

    const confirmDefer = () => {
        if (deferOpId) {
            const [y, m] = selectedMonth.split('-').map(Number);
            const nextM = m === 12 ? 1 : m + 1;
            const nextY = m === 12 ? y + 1 : y;
            updateOpBilling(deferOpId, { billing_period: `${nextY}-${String(nextM).padStart(2, '0')}` });
            setDeferOpId(null)
        }
    }

    const confirmRetro = () => {
        if (retroOpId) {
            const [y, m] = selectedMonth.split('-').map(Number);
            const prevM = m === 1 ? 12 : m - 1;
            const prevY = m === 1 ? y - 1 : y;
            updateOpBilling(retroOpId, { billing_period: `${prevY}-${String(prevM).padStart(2, '0')}` });
            setRetroOpId(null)
        }
    }

    const approveOp = (id: string) => updateOpBilling(id, { billing_approved: true })
    const unapproveOp = (id: string) => updateOpBilling(id, { billing_approved: false })

    const calculateManualLiquidation = () => {
        const full = parseFloat(newClient.fullPrice || "0")
        const desc = parseFloat(newClient.descuento || "0")
        return newClient.prepaga.toLowerCase().includes('preven') ? (full - desc) * calcRules.prevencion.default : full
    }

    const handleAddClient = async () => {
        if (!newClient.name) return
        const val = calculateManualLiquidation()
        await supabase.from('billing_manual_clients').insert({
            name: newClient.name, dni: newClient.dni, prepaga: newClient.prepaga, plan: newClient.plan, full_price: parseFloat(newClient.fullPrice), aportes: parseFloat(newClient.aportes), descuento: parseFloat(newClient.descuento), calculated_liquidation: val, hijos: newClient.hijos
        })
        setNewClient({ name: "", dni: "", prepaga: "Prevención Salud", plan: "", fullPrice: "0", aportes: "0", descuento: "0", hijos: [] }); setIsAddingClient(false)
    }

    // ✅ FUNCIÓN: Marcar cartera como caída
    const handleCarteraCaida = async () => {
        if (!carteraCaidaOp || !carteraCaidaMotivo.trim()) return
        setIsSavingCarteraCaida(true)
        await supabase.from('leads').update({
            cartera_caida: true,
            cartera_caida_motivo: carteraCaidaMotivo.trim(),
            cartera_caida_at: new Date().toISOString()
        }).eq('id', carteraCaidaOp.id)

        // Actualizar operaciones localmente
        setOperations(prev => prev.map(op =>
            op.id === carteraCaidaOp.id
                ? { ...op, cartera_caida: true, cartera_caida_motivo: carteraCaidaMotivo.trim() }
                : op
        ))

        setCarteraCaidaOp(null)
        setCarteraCaidaMotivo("")
        setIsSavingCarteraCaida(false)
    }

    // ✅ FUNCIÓN: Toggle de verificación de billing (OPTIMISTA)
    const toggleBillingVerified = async (opId: string, currentValue: boolean) => {
        const newValue = !currentValue
        const now = newValue ? new Date().toISOString() : null

        // 1. Actualizar localmente PRIMERO (instantáneo, sin retardo)
        setOperations(prev => prev.map(op =>
            op.id === opId
                ? { ...op, billing_verified: newValue, billing_verified_at: now }
                : op
        ))

        // 2. Guardar en Supabase en background
        await supabase.from('leads').update({
            billing_verified: newValue,
            billing_verified_at: now
        }).eq('id', opId)
    }

    const uniqueSellers = Array.from(new Set(operations.map(o => o.seller)))
    const uniquePrepagas = Array.from(new Set(operations.map(o => o.prepaga).filter((p): p is string => !!p)))

    const getSellerOpsDetail = (sellerName: string | null) => {
        if (!sellerName) return []
        const ops = approvedOps.filter((op: any) => op.seller === sellerName)
        const sellerInfo = sellersMap[sellerName] || { shift: '5hs', photo: '' }
        const threshold = commissionRules.scales[sellerInfo.shift].absorbable
        const standardOps = ops.filter(op => {
            const plan = op.plan?.toUpperCase() || ""; const prepaga = op.prepaga?.toUpperCase() || ""
            return !commissionRules.special.plans.some(k => plan.includes(k) || prepaga.includes(k))
        }).sort((a, b) => new Date(a.entryDate).getTime() - new Date(b.entryDate).getTime())
        const isThresholdMet = standardOps.length > threshold
        const statusMap: Record<string, string> = {}
        ops.forEach(op => {
            const plan = op.plan?.toUpperCase() || ""; const prepaga = op.prepaga?.toUpperCase() || ""
            const isSpecial = commissionRules.special.plans.some(k => plan.includes(k) || prepaga.includes(k))
            if (isSpecial) statusMap[op.id] = isThresholdMet ? "special_paid" : "special_locked"
        })
        standardOps.forEach((op, index) => { statusMap[op.id] = index < threshold ? "absorbed" : "paid" })
        return ops.map((op: any) => ({ ...op, payStatus: statusMap[op.id] }))
    }

    if (loading && operations.length === 0) return <div className="h-screen flex items-center justify-center text-slate-400 gap-2"><Loader2 className="animate-spin" /> Cargando...</div>

    return (
        <div className="p-6 h-full flex flex-col gap-6 overflow-hidden max-w-[1900px] mx-auto pb-20">
            {/* HEADER */}
            <div className="flex justify-between items-center bg-white p-3 rounded-xl border border-slate-200 shadow-sm shrink-0">
                <div className="flex items-center gap-4 px-2">
                    <div className="h-10 w-10 bg-slate-900 rounded-lg flex items-center justify-center text-white"><DollarSign /></div>
                    <div>
                        <h2 className="text-lg font-black text-slate-800 leading-none">Centro Financiero</h2>
                        <div className="flex items-center gap-2 mt-1">
                            <Badge variant={isLocked ? "destructive" : "outline"} className="text-[10px] h-5">{isLocked ? "CERRADO" : "ABIERTO"}</Badge>
                            <span className="text-xs text-slate-400">Auditoría y Facturación</span>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-4 bg-slate-50 p-1.5 rounded-lg border border-slate-200">
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => changeMonth(-1)}><ChevronLeft size={16} /></Button>
                    <div className="flex flex-col items-center w-36">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Período</span>
                        <span className="text-sm font-black text-slate-800 capitalize leading-tight">{formatMonth(selectedMonth)}</span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500" onClick={() => changeMonth(1)}><ChevronRight size={16} /></Button>
                </div>

                <div className="flex items-center gap-2">
                    {/* BOTÓN DE PRIVACIDAD */}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setShowValues(!showValues)} title={showValues ? "Ocultar Valores" : "Mostrar Valores"}>
                        {showValues ? <Eye size={16} /> : <EyeOff size={16} />}
                    </Button>
                    <div className="h-4 w-px bg-slate-200 mx-1"></div>
                    <Button variant="outline" size="sm" onClick={() => setShowConfig(true)}><Settings2 size={14} className="mr-2" /> Reglas</Button>
                    <Button size="sm" variant={isLocked ? "secondary" : "default"} onClick={() => setIsLocked(!isLocked)} className="gap-2 font-bold min-w-[130px]">{isLocked ? <><Lock size={14} /> Reabrir Mes</> : <><Save size={14} /> Cerrar Mes</>}</Button>
                </div>
            </div>

            {/* TOTALES */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0">
                <Card className="bg-slate-900 border-0 text-white shadow-xl relative overflow-hidden">
                    <CardContent className="p-5 flex flex-col justify-between h-full z-10 relative">
                        <div>
                            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Total Facturación (Neto)</p>
                            <div className="text-4xl font-black text-green-400">{formatMoney(totalNeto, true)}</div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-slate-700/50 flex flex-col gap-1 text-[10px] text-slate-400">
                            <div className="flex justify-between"><span>+ IVA (Prevención {calcRules.prevencionVat * 100}%):</span> <span className="font-bold text-white">{formatMoney(totalIVA, true)}</span></div>
                            <div className="flex justify-between"><span>Facturación Total:</span> <span className="font-bold text-white">{formatMoney(totalBilling, true)}</span></div>
                        </div>
                    </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-blue-500 shadow-md">
                    <CardContent className="p-5">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Cartera Nueva</p>
                        <div className="text-3xl font-black text-slate-800">{formatMoney(totalPortfolio, true)}</div>
                        <p className="text-xs text-blue-600 mt-2 font-bold">Cobro Estimado</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-l-4 border-l-pink-500 shadow-md">
                    <CardContent className="p-5">
                        <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-1">Pago Comisiones</p>
                        <div className="text-3xl font-black text-slate-800">{formatMoney(sellersCommissions.reduce((acc, s) => acc + s.total, 0), true)}</div>
                        <p className="text-xs text-pink-600 mt-2 font-bold">Total equipo de ventas</p>
                    </CardContent>
                </Card>
                <Card onClick={() => setShowHistory(true)} className="bg-slate-50 border-dashed border-2 border-slate-200 shadow-none hover:bg-slate-100 transition-colors cursor-pointer flex items-center justify-center group">
                    <div className="text-center">
                        <div className="h-10 w-10 bg-slate-200 rounded-full flex items-center justify-center mx-auto mb-2 text-slate-500 group-hover:bg-slate-300 group-hover:text-slate-700"><LayoutGrid size={20} /></div>
                        <p className="text-xs font-bold text-slate-500 group-hover:text-slate-700">Ver Historial Anual</p>
                    </div>
                </Card>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
                <div className="flex justify-between items-end border-b border-slate-200 mb-4 px-1">
                    <TabsList className="bg-transparent gap-6 p-0 h-auto">
                        <TabsTrigger value="audit" className="rounded-none border-b-4 border-transparent data-[state=active]:border-orange-500 data-[state=active]:text-orange-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">⏳ Mesa de Entrada ({pendingOps.length})</TabsTrigger>
                        <TabsTrigger value="official" className="rounded-none border-b-4 border-transparent data-[state=active]:border-green-600 data-[state=active]:text-green-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">✅ Liquidación Oficial ({approvedOps.length})</TabsTrigger>
                        <TabsTrigger value="portfolio" className="rounded-none border-b-4 border-transparent data-[state=active]:border-blue-600 data-[state=active]:text-blue-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">📈 Cartera ({allPortfolioOps.length})</TabsTrigger>
                        <TabsTrigger value="commissions" className="rounded-none border-b-4 border-transparent data-[state=active]:border-pink-600 data-[state=active]:text-pink-700 px-4 py-2 text-slate-400 font-bold uppercase tracking-widest transition-all">💸 Comisiones</TabsTrigger>
                    </TabsList>
                    <div className="flex gap-2 mb-2 items-center">
                        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
                            <PopoverTrigger asChild><Button variant={filters.seller !== 'all' || filters.prepaga !== 'all' ? "secondary" : "outline"} size="sm" className="h-9 gap-2"><Filter size={14} /> {filters.seller !== 'all' || filters.prepaga !== 'all' ? "Filtros Activos" : "Filtrar"}</Button></PopoverTrigger>
                            <PopoverContent className="w-64 p-4 shadow-xl border-slate-200" align="end">
                                <div className="space-y-4">
                                    <div className="space-y-2"><h4 className="font-bold text-xs uppercase text-slate-500">Vendedor</h4><Select value={filters.seller} onValueChange={v => setFilters({ ...filters, seller: v })}><SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{uniqueSellers.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                                    <div className="space-y-2"><h4 className="font-bold text-xs uppercase text-slate-500">Prepaga</h4><Select value={filters.prepaga} onValueChange={v => setFilters({ ...filters, prepaga: v })}><SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger><SelectContent><SelectItem value="all">Todas</SelectItem>{uniquePrepagas.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent></Select></div>
                                    <Button size="sm" variant="ghost" className="w-full text-xs text-red-500" onClick={() => { setFilters({ seller: 'all', prepaga: 'all' }); setIsFilterOpen(false) }}><X size={12} className="mr-1" /> Borrar Filtros</Button>
                                </div>
                            </PopoverContent>
                        </Popover>
                    </div>
                </div>

                {/* --- MESA DE ENTRADA (Mantiene formato original con decimales) --- */}
                <TabsContent value="audit" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col">
                        <div className="bg-orange-50/50 p-3 border-b border-orange-100 flex items-center gap-2 text-xs text-orange-800 font-medium"><AlertTriangle size={14} /> Estas ventas están en el período seleccionado pero aún no fueron aprobadas.</div>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10"><TableRow><TableHead className="w-[250px]">Cliente / Origen</TableHead><TableHead>Vendedor</TableHead><TableHead>Prepaga / Plan</TableHead><TableHead className="text-right">Valores Base</TableHead><TableHead className="w-[180px]">Cálculo</TableHead><TableHead className="text-right font-bold text-slate-700">Estimado</TableHead><TableHead className="text-right">Acciones</TableHead></TableRow></TableHeader>
                                <TableBody>{pendingOps.length === 0 ? (<TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400 font-medium">🎉 Todo al día para {formatMonth(selectedMonth)}.</TableCell></TableRow>) : pendingOps.map((op: any) => {
                                    const calc = calculate(op)
                                    return (
                                        <TableRow key={op.id} className="hover:bg-slate-50 transition-colors group">
                                            <TableCell>
                                                <div className="font-bold text-slate-800 flex items-center gap-1">
                                                    {op.clientName}
                                                    {/* ✅ Badge PASS si aplica */}
                                                    {op.type === 'pass' && (
                                                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] px-1 h-4">PASS</Badge>
                                                    )}
                                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                        {op.cuit || op.dni}
                                                    </span>
                                                    <CopyDniButton cuit={op.cuit} dni={op.dni} />
                                                    {/* ✅ Botón premium para abrir OpsModal */}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 ml-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-blue-200"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedOp(op) }}
                                                        title="Ver detalles"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </Button>
                                                </div>
                                                <div className="flex gap-2 mt-1"><Badge variant="secondary" className="text-[9px] h-4 px-1 border-slate-200 font-normal">{getSourceIcon(op.origen || "")} {op.origen || "Dato"}</Badge></div>
                                            </TableCell>
                                            <TableCell><span className="text-xs font-medium text-slate-600">{op.seller}</span></TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className={`mb-1 border ${getPrepagaBadgeColor(op.prepaga)}`}>{op.prepaga}</Badge>
                                                <div className="text-xs font-bold text-slate-500">{op.plan}</div>
                                            </TableCell>
                                            <TableCell className="text-right text-xs font-mono text-slate-500"><div>FP: ${parseInt(op.fullPrice || "0").toLocaleString()}</div></TableCell>
                                            <TableCell><div className="text-[10px] bg-slate-100 p-1 rounded font-mono text-slate-500 truncate" title={calc.formula}>{calc.formula}</div></TableCell>
                                            <TableCell className="text-right font-bold text-slate-800 text-sm">{formatMoney(calc.val)}</TableCell>
                                            <TableCell className="text-right" onClick={e => e.stopPropagation()}>
                                                <div className="flex justify-end gap-2">
                                                    <Button size="sm" variant="secondary" className="h-8 text-slate-600" onClick={() => setRetroOpId(op.id)}>
                                                        <ArrowLeft size={14} className="mr-1" /> Ant.
                                                    </Button>
                                                    <Button size="sm" variant="outline" className="h-8 border-orange-200 text-orange-600 hover:bg-orange-50" onClick={() => setDeferOpId(op.id)}>
                                                        Próx. <ArrowRight size={14} className="ml-1" />
                                                    </Button>
                                                    <Button size="sm" className="h-8 bg-green-600 hover:bg-green-700 text-white shadow-sm font-bold" onClick={() => approveOp(op.id)}>Aprobar</Button>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    )
                                })}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- LIQUIDACIÓN OFICIAL --- */}
                <TabsContent value="official" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col border-t-4 border-t-green-600">
                        <div className="bg-white p-3 border-b border-slate-100">
                            <div className="flex justify-between items-center mb-4">
                                <div className="text-xs text-green-800 font-medium flex items-center gap-2"><CheckCircle2 size={14} /> Estas ventas ya están computadas para la factura final.</div>
                                <div className="flex items-center gap-3">
                                    {/* ✅ Filtro de verificación */}
                                    <Select value={filterVerificadoLiq} onValueChange={(v) => setFilterVerificadoLiq(v as any)}>
                                        <SelectTrigger className="w-[140px] h-8 text-xs">
                                            <SelectValue placeholder="Verificación" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Todos</SelectItem>
                                            <SelectItem value="verified">✅ Verificados</SelectItem>
                                            <SelectItem value="pending">⏳ Sin verificar</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-2" disabled={approvedOps.length === 0}><Download size={12} /> Exportar Excel</Button>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-4">
                                {/* ✅ Subtotales Redondeados para consistencia con tarjetas */}
                                <div className="bg-pink-50 border border-pink-100 p-3 rounded-lg flex justify-between items-center"><span className="text-[10px] font-black text-pink-500 uppercase tracking-wider">Suma Prevención Salud</span><span className="text-sm font-black text-pink-700">{formatMoney(breakdown.sumPreve, true)}</span></div>
                                <div className="bg-violet-50 border border-violet-100 p-3 rounded-lg flex justify-between items-center"><span className="text-[10px] font-black text-violet-500 uppercase tracking-wider">Suma XP (Docto/Gal/Sw/Ava)</span><span className="text-sm font-black text-violet-700">{formatMoney(breakdown.sumXP, true)}</span></div>
                                <div className="bg-sky-50 border border-sky-100 p-3 rounded-lg flex justify-between items-center"><span className="text-[10px] font-black text-sky-500 uppercase tracking-wider">Suma AMPF Salud</span><span className="text-sm font-black text-sky-700">{formatMoney(breakdown.sumAMPF, true)}</span></div>
                            </div>
                        </div>

                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10"><TableRow><TableHead className="w-[40px]">✓</TableHead><TableHead>Cliente / Plan</TableHead><TableHead>Vendedor</TableHead><TableHead className="text-right">Valores Orig.</TableHead><TableHead className="w-[180px] text-center">Fórmula</TableHead><TableHead className="text-right font-black text-green-700 w-[160px] bg-green-50/50">A LIQUIDAR ($)</TableHead><TableHead className="text-right w-[80px]">Volver</TableHead></TableRow></TableHeader>
                                <TableBody>{approvedOps.length === 0 ? (<TableRow><TableCell colSpan={7} className="text-center py-20 text-slate-400">Aprobá ventas desde la pestaña "Mesa de Entrada".</TableCell></TableRow>) : approvedOps.map((op: any) => {
                                    const calc = calculate(op)
                                    return (
                                        <TableRow key={op.id} className={`hover:bg-slate-50 transition-colors group ${op.billing_verified ? 'bg-emerald-50 border-l-4 border-l-emerald-400' : ''}`}>
                                            {/* ✅ Checkbox de verificación */}
                                            <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                                                <Checkbox
                                                    checked={op.billing_verified || false}
                                                    onCheckedChange={() => toggleBillingVerified(op.id, op.billing_verified)}
                                                    className="data-[state=checked]:bg-green-600 data-[state=checked]:border-green-600"
                                                />
                                            </TableCell>
                                            <TableCell>
                                                <div className="font-bold text-slate-800 flex items-center gap-1">
                                                    {op.clientName}
                                                    {/* ✅ Badge PASS si aplica */}
                                                    {op.type === 'pass' && (
                                                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] px-1 h-4">PASS</Badge>
                                                    )}
                                                    <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                        {op.cuit || op.dni}
                                                    </span>
                                                    <CopyDniButton cuit={op.cuit} dni={op.dni} />
                                                    {/* ✅ Botón premium para abrir OpsModal */}
                                                    <Button
                                                        size="icon"
                                                        variant="ghost"
                                                        className="h-6 w-6 ml-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-blue-200"
                                                        onClick={(e) => { e.stopPropagation(); setSelectedOp(op) }}
                                                        title="Ver detalles"
                                                    >
                                                        <ExternalLink size={12} />
                                                    </Button>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-slate-500">
                                                    <Badge variant="outline" className={`h-4 px-1 text-[9px] border ${getPrepagaBadgeColor(op.prepaga)}`}>{op.prepaga}</Badge>
                                                    <span>{op.plan}</span>
                                                    {/* ✅ Popover de grupo familiar (igual que OpsPostsale) */}
                                                    <Popover>
                                                        <PopoverTrigger asChild>
                                                            <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 cursor-help hover:bg-blue-100 transition-colors" onClick={(e) => e.stopPropagation()}>
                                                                <Users size={10} className="text-blue-500" />
                                                                <span className="text-[10px] font-bold text-blue-700">{op.capitas}</span>
                                                            </div>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-60 p-3 bg-white border-slate-200 shadow-xl">
                                                            <h4 className="text-xs font-black text-slate-600 uppercase mb-2 border-b pb-1">Grupo Familiar</h4>
                                                            <div className="space-y-2">
                                                                <div className="text-xs">
                                                                    <span className="font-bold text-slate-800 block">{op.clientName}</span>
                                                                    <span className="text-[10px] text-slate-400">Titular</span>
                                                                </div>
                                                                {op.familia && op.familia.length > 0 ? op.familia.map((f: any, i: number) => (
                                                                    <div key={i} className="text-xs border-t border-slate-50 pt-1 mt-1">
                                                                        <span className="font-medium text-slate-700 block">{f.nombre}</span>
                                                                        <div className="flex justify-between">
                                                                            <span className="text-[10px] text-slate-400">{f.dni}</span>
                                                                            <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 uppercase">{f.rol || 'Familiar'}</span>
                                                                        </div>
                                                                    </div>
                                                                )) : (
                                                                    op.capitas > 1 ? <p className="text-[10px] text-red-400 italic">No hay datos de familiares cargados.</p> : null
                                                                )}
                                                            </div>
                                                        </PopoverContent>
                                                    </Popover>
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-xs text-slate-600 font-medium">{op.seller}</TableCell>
                                            <TableCell className="text-right font-mono text-xs text-slate-500">${parseInt(op.fullPrice || "0").toLocaleString()}</TableCell>
                                            <TableCell className="text-center"><div className="bg-slate-100 text-[9px] px-2 py-0.5 rounded text-slate-500 truncate inline-block max-w-[150px]" title={calc.formula}>{calc.formula}</div></TableCell>
                                            <TableCell className="text-right bg-green-50/30 p-2" onClick={e => e.stopPropagation()}>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-2.5 text-green-600 font-bold text-xs">$</span>
                                                    {/* ✅ STEP 0.01 PARA PERMITIR DECIMALES */}
                                                    <Input className="h-8 pl-5 font-bold text-green-700 border-green-200 bg-white focus:ring-green-500 text-right text-sm" type="number" step="0.01" value={calc.val} onChange={(e) => handlePriceChange(op.id, e.target.value)} disabled={isLocked} />
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-right" onClick={e => e.stopPropagation()}><Button size="icon" variant="ghost" className="h-8 w-8 text-slate-300 hover:text-red-500" onClick={() => unapproveOp(op.id)}><Undo2 size={16} /></Button></TableCell>
                                        </TableRow>
                                    )
                                })}</TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                {/* --- CARTERA --- */}
                <TabsContent value="portfolio" className="flex-1 overflow-hidden m-0">
                    <Card className="h-full border-0 shadow-md flex flex-col border-t-4 border-t-blue-500">
                        <div className="bg-white p-3 border-b border-slate-100 flex justify-between items-center gap-4">
                            <div className="text-xs text-blue-800 font-medium">
                                Proyección de Cartera Acumulativa - <b>{filteredPortfolioOpsFinal.length} de {allPortfolioOps.length} operaciones</b>
                            </div>
                            <div className="flex items-center gap-3">
                                {/* ✅ Filtro por mes de cartera */}
                                <Select value={filterCarteraMes} onValueChange={setFilterCarteraMes}>
                                    <SelectTrigger className="w-[160px] h-8 text-xs">
                                        <SelectValue placeholder="Filtrar por mes" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos los meses</SelectItem>
                                        {uniqueCarteraMeses.map((m: string) => {
                                            const [y, mo] = m.split("-")
                                            const nombre = new Date(parseInt(y), parseInt(mo) - 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })
                                            return <SelectItem key={m} value={m}>{nombre}</SelectItem>
                                        })}
                                    </SelectContent>
                                </Select>
                                {/* ✅ Filtro de verificación */}
                                <Select value={filterVerificadoCartera} onValueChange={(v) => setFilterVerificadoCartera(v as any)}>
                                    <SelectTrigger className="w-[140px] h-8 text-xs">
                                        <SelectValue placeholder="Verificación" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="verified">✅ Verificados</SelectItem>
                                        <SelectItem value="pending">⏳ Sin verificar</SelectItem>
                                    </SelectContent>
                                </Select>
                                <Button size="sm" className="h-7 text-xs gap-2 bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setIsAddingClient(true)}><Plus size={12} /> Nuevo Cliente</Button>
                            </div>
                        </div>
                        <CardContent className="p-0 flex-1 overflow-auto">
                            <Table>
                                <TableHeader className="bg-slate-50 sticky top-0 z-10"><TableRow><TableHead className="w-[40px]">✓</TableHead><TableHead>Cliente</TableHead><TableHead>Cartera Desde</TableHead><TableHead>Prepaga</TableHead><TableHead>Valor Liquidado</TableHead><TableHead className="text-right font-black text-blue-700 bg-blue-50 w-[180px]">CARTERA (Editable)</TableHead><TableHead className="w-[50px]"></TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {filteredPortfolioOpsFinal.map((op: any) => {
                                        const liq = calculate(op)
                                        // Formatear mes de inicio para badge premium
                                        const mesInicio = op.cartera_inicio_mes || ""
                                        const [year, month] = mesInicio.split("-")
                                        const mesNombre = month ? new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('es-AR', { month: 'short', year: '2-digit' }).toUpperCase() : ""
                                        const isPass = op.type === 'pass'
                                        return (
                                            <TableRow key={op.id} className={`hover:bg-slate-50 group ${op.billing_verified ? 'bg-emerald-50 border-l-4 border-l-emerald-400' : ''}`}>
                                                {/* ✅ Checkbox de verificación */}
                                                <TableCell className="p-2" onClick={(e) => e.stopPropagation()}>
                                                    <Checkbox
                                                        checked={op.billing_verified || false}
                                                        onCheckedChange={() => toggleBillingVerified(op.id, op.billing_verified)}
                                                        className="data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                                                    />
                                                </TableCell>
                                                <TableCell className="font-bold text-slate-700">
                                                    <div className="flex items-center gap-1">
                                                        {op.clientName}
                                                        {/* ✅ Badge PASS violeta */}
                                                        {isPass && (
                                                            <Badge className="bg-purple-500 text-white text-[9px] font-bold px-1.5 py-0 ml-1">
                                                                PASS
                                                            </Badge>
                                                        )}
                                                        <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                            {op.cuit || op.dni}
                                                        </span>
                                                        <CopyDniButton cuit={op.cuit} dni={op.dni} />
                                                        {/* ✅ Botón premium para abrir OpsModal */}
                                                        <Button
                                                            size="icon"
                                                            variant="ghost"
                                                            className="h-6 w-6 ml-2 text-blue-600 hover:bg-blue-50 hover:text-blue-700 opacity-0 group-hover:opacity-100 transition-all shadow-sm border border-transparent hover:border-blue-200"
                                                            onClick={(e) => { e.stopPropagation(); setSelectedOp(op) }}
                                                            title="Ver detalles"
                                                        >
                                                            <ExternalLink size={12} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    {/* ✅ Badge premium de mes de inicio */}
                                                    <Badge className="bg-gradient-to-r from-blue-500 to-blue-600 text-white text-[9px] font-bold px-2 py-0.5 shadow-sm">
                                                        🏷️ {mesNombre}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell onClick={(e) => e.stopPropagation()}>
                                                    <div className="flex items-center gap-2">
                                                        <Badge variant="outline" className={`border ${getPrepagaBadgeColor(op.prepaga)}`}>{op.prepaga}</Badge>
                                                        {/* ✅ Popover de grupo familiar (igual que OpsPostsale) */}
                                                        <Popover>
                                                            <PopoverTrigger asChild>
                                                                <div className="flex items-center gap-1 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 cursor-help hover:bg-blue-100 transition-colors">
                                                                    <Users size={10} className="text-blue-500" />
                                                                    <span className="text-[10px] font-bold text-blue-700">{op.capitas}</span>
                                                                </div>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-60 p-3 bg-white border-slate-200 shadow-xl">
                                                                <h4 className="text-xs font-black text-slate-600 uppercase mb-2 border-b pb-1">Grupo Familiar</h4>
                                                                <div className="space-y-2">
                                                                    <div className="text-xs">
                                                                        <span className="font-bold text-slate-800 block">{op.clientName}</span>
                                                                        <span className="text-[10px] text-slate-400">Titular</span>
                                                                    </div>
                                                                    {op.familia && op.familia.length > 0 ? op.familia.map((f: any, i: number) => (
                                                                        <div key={i} className="text-xs border-t border-slate-50 pt-1 mt-1">
                                                                            <span className="font-medium text-slate-700 block">{f.nombre}</span>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-[10px] text-slate-400">{f.dni}</span>
                                                                                <span className="text-[9px] bg-slate-100 px-1 rounded text-slate-500 uppercase">{f.rol || 'Familiar'}</span>
                                                                            </div>
                                                                        </div>
                                                                    )) : (
                                                                        op.capitas > 1 ? <p className="text-[10px] text-red-400 italic">No hay datos de familiares cargados.</p> : null
                                                                    )}
                                                                </div>
                                                            </PopoverContent>
                                                        </Popover>
                                                    </div>
                                                </TableCell>
                                                <TableCell>{formatMoney(liq.val)}</TableCell>
                                                <TableCell className="text-right bg-blue-50/50 p-2" onClick={e => e.stopPropagation()}>
                                                    <div className="relative">
                                                        <span className="absolute left-3 top-2.5 text-blue-600 font-bold text-xs">$</span>
                                                        {/* ✅ Input de texto para permitir comas/puntos */}
                                                        <Input
                                                            className="h-8 pl-5 font-bold text-blue-700 border-blue-200 bg-white focus:ring-blue-500 text-right text-sm"
                                                            type="text"
                                                            inputMode="decimal"
                                                            pattern="[0-9]*[.,]?[0-9]*"
                                                            value={liq.portfolio}
                                                            onChange={(e) => {
                                                                // Reemplazar coma por punto para parseFloat
                                                                const val = e.target.value.replace(',', '.')
                                                                handlePortfolioChange(op.id, val)
                                                            }}
                                                            disabled={isLocked}
                                                        />
                                                    </div>
                                                </TableCell>
                                                <TableCell className="p-1">
                                                    {/* ✅ Botón de cartera caída */}
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-red-400 hover:text-red-600 hover:bg-red-50"
                                                        onClick={() => setCarteraCaidaOp(op)}
                                                    >
                                                        <Trash2 size={14} />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        )
                                    })}
                                    {manualPortfolio.map(item => {
                                        const currentVal = Number((parseFloat(item.calculated_liquidation || "0") * calcRules.portfolioRate).toFixed(2))
                                        return (
                                            <TableRow key={item.id} className="bg-yellow-50/30">
                                                <TableCell className="font-bold text-slate-700">
                                                    {item.name}
                                                    <span className="ml-2 text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                                        {item.dni}
                                                    </span>
                                                </TableCell>
                                                <TableCell><Badge variant="secondary" className="bg-yellow-100 text-yellow-700 text-[9px]">Manual DB</Badge></TableCell>
                                                <TableCell><Badge variant="outline" className={`border ${getPrepagaBadgeColor(item.prepaga)}`}>{item.prepaga}</Badge></TableCell>
                                                <TableCell>${parseFloat(item.calculated_liquidation || "0").toLocaleString()}</TableCell>
                                                <TableCell className="text-right bg-blue-50/50 p-2"><div className="relative"><span className="absolute left-3 top-2.5 text-blue-600 font-bold text-xs">$</span><Input className="h-8 pl-5 font-bold text-blue-700 border-blue-200 bg-white focus:ring-blue-500 text-right text-sm" value={currentVal} disabled /></div></TableCell>
                                            </TableRow>
                                        )
                                    })}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent >

                {/* --- COMISIONES --- */}
                < TabsContent value="commissions" className="flex-1 overflow-hidden m-0" >
                    <Card className="h-full border-0 shadow-md flex flex-col border-t-4 border-t-pink-500 bg-slate-50/50">
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {sellersCommissions.map((seller, index) => (
                                    <Card key={index} className={`border-0 shadow-md transition-all relative overflow-hidden bg-white h-fit ${!seller.isThresholdMet ? 'opacity-80 grayscale-[0.3]' : ''}`}>
                                        <div className={`absolute top-0 left-0 w-full h-1.5 ${seller.isThresholdMet ? 'bg-gradient-to-r from-pink-500 to-purple-600' : 'bg-slate-300'}`}></div>
                                        {!seller.isThresholdMet && <div className="absolute top-3 left-3 bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded flex items-center gap-1 z-20"><Lock size={10} /> Objetivo No Cumplido</div>}
                                        <div className="absolute top-2 right-2 z-10"><Button size="icon" variant="ghost" className="h-8 w-8 text-slate-400 hover:text-slate-600" onClick={() => setViewingSeller(seller.name)}><Eye size={16} /></Button></div>
                                        <CardContent className="p-6">
                                            <div className="flex items-start justify-between mb-4 mt-4">
                                                <div className="flex items-center gap-3">
                                                    <Avatar className="h-14 w-14 border-2 border-white shadow-md"><AvatarImage src={seller.info.photo} /><AvatarFallback className="bg-pink-100 text-pink-600 font-black">{seller.name.substring(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                                                    <div>
                                                        <h3 className="font-black text-lg text-slate-800 leading-tight">{seller.name}</h3>
                                                        <div className="flex gap-2 mt-1"><Badge variant="outline" className="bg-slate-50 text-[10px] flex w-fit items-center gap-1 border-slate-200"><Clock size={10} /> {seller.info.shift}</Badge><Badge className="bg-slate-100 text-slate-600 text-[10px]">Abs: {seller.absorbableCount}</Badge></div>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    {/* ✅ REDONDEADO EN LA TARJETA */}
                                                    <div className={`text-3xl font-black ${seller.isThresholdMet ? 'text-slate-800' : 'text-slate-400'}`}>{formatMoney(seller.total, true)}</div>
                                                    <div className="text-[10px] font-bold text-green-600 uppercase tracking-wider">A Pagar</div>
                                                </div>
                                            </div>
                                            <div className="space-y-2 text-xs text-slate-500 border-t pt-3">
                                                {/* ✅ REDONDEADO EN EL DESGLOSE */}
                                                <div className="flex justify-between"><span>Estandar ({seller.variableCount} / {seller.absorbableCount}):</span><span className="font-bold text-slate-700">{formatMoney(seller.variableCommission, true)}</span></div>
                                                <div className="flex justify-between"><span>Especiales ({seller.specialCount}):</span><span className="font-bold text-slate-700">{formatMoney(seller.specialCommission, true)}</span></div>
                                                {!seller.isThresholdMet && <div className="text-red-500 font-bold text-center mt-2 text-[10px]">Faltan {seller.absorbableCount - seller.variableCount} ventas estándar para desbloquear cobros.</div>}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        </div>
                    </Card>
                </TabsContent >
            </Tabs >

            {/* ✅ OpsModal restaurado para ver detalles de operaciones (patrón OpsPostsale) */}
            <OpsModal
                op={selectedOp}
                isOpen={!!selectedOp}
                onClose={() => setSelectedOp(null)}
                currentUser={userName}
                role={"admin"}
                globalConfig={globalConfig}
                onUpdateOp={(updatedLead: any) => {
                    // Actualización optimista de la lista local
                    setOperations(prev => prev.map(op =>
                        op.id === updatedLead.id ? { ...op, ...updatedLead } : op
                    ))
                }}
            />

            {/* CONFIGURACIÓN */}
            <Dialog open={showConfig} onOpenChange={setShowConfig}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2"><Settings2 /> Configuración de Reglas</DialogTitle>
                        <DialogDescription>Ajusta porcentajes y escalas. Cambios aplican en tiempo real.</DialogDescription>
                    </DialogHeader>
                    <div className="grid gap-6 py-4">

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><DollarSign size={14} /> Liquidación General (Prepagas)</h4>
                            <div className="grid grid-cols-3 gap-4">
                                <div className="space-y-1"><Label className="text-[10px] uppercase text-slate-500 font-bold">Impuestos (10.5%)</Label><div className="relative"><Input type="number" className="pl-2 pr-6" value={calcRules.taxRate} onChange={e => setCalcRules({ ...calcRules, taxRate: parseFloat(e.target.value) })} step="0.005" /><span className="absolute right-2 top-2 text-xs text-slate-400">%</span></div></div>
                                <div className="space-y-1"><Label className="text-[10px] uppercase text-slate-500 font-bold">IVA Prevención</Label><div className="relative"><Input type="number" className="pl-2 pr-6" value={calcRules.prevencionVat} onChange={e => setCalcRules({ ...calcRules, prevencionVat: parseFloat(e.target.value) })} step="0.01" /><span className="absolute right-2 top-2 text-xs text-slate-400">%</span></div></div>
                                <div className="space-y-1"><Label className="text-[10px] uppercase text-slate-500 font-bold">Mult. General (180%)</Label><Input type="number" value={calcRules.generalGroup.multiplier} onChange={e => setCalcRules({ ...calcRules, generalGroup: { multiplier: parseFloat(e.target.value) } })} step="0.1" /></div>
                            </div>

                            <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-4 gap-3">
                                <div className="space-y-1"><Label className="text-[10px] font-bold text-pink-600">Prev. A1 (90%)</Label><Input className="h-8" type="number" value={calcRules.prevencion['A1']} onChange={e => setCalcRules({ ...calcRules, prevencion: { ...calcRules.prevencion, 'A1': parseFloat(e.target.value) } })} step="0.1" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-bold text-pink-600">Prev. A2 (130%)</Label><Input className="h-8" type="number" value={calcRules.prevencion['A2']} onChange={e => setCalcRules({ ...calcRules, prevencion: { ...calcRules.prevencion, 'A2': parseFloat(e.target.value) } })} step="0.1" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-bold text-pink-600">Prev. A4/A5 (150%)</Label><Input className="h-8" type="number" value={calcRules.prevencion['A4']} onChange={e => setCalcRules({ ...calcRules, prevencion: { ...calcRules.prevencion, 'A4': parseFloat(e.target.value), 'A5': parseFloat(e.target.value) } })} step="0.1" /></div>
                                <div className="space-y-1"><Label className="text-[10px] font-bold text-blue-600">Mult. AMPF (200%)</Label><Input className="h-8" type="number" value={calcRules.ampf.multiplier} onChange={e => setCalcRules({ ...calcRules, ampf: { multiplier: parseFloat(e.target.value) } })} step="0.1" /></div>
                            </div>
                        </div>

                        <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                            <h4 className="font-bold text-sm text-slate-700 mb-3 flex items-center gap-2"><Users size={14} /> Escalas de Vendedores (Absorbible)</h4>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="p-3 bg-white rounded border border-slate-100"><Label className="text-xs font-bold mb-2 block">Turno 5hs (Mínimo)</Label><Input type="number" value={commissionRules.scales['5hs'].absorbable} onChange={e => { const s = { ...commissionRules.scales }; s['5hs'].absorbable = parseInt(e.target.value); setCommissionRules({ ...commissionRules, scales: s }) }} /></div>
                                <div className="p-3 bg-white rounded border border-slate-100"><Label className="text-xs font-bold mb-2 block">Turno 8hs (Mínimo)</Label><Input type="number" value={commissionRules.scales['8hs'].absorbable} onChange={e => { const s = { ...commissionRules.scales }; s['8hs'].absorbable = parseInt(e.target.value); setCommissionRules({ ...commissionRules, scales: s }) }} /></div>
                            </div>
                            <div className="mt-2 text-[10px] text-slate-500 flex items-center gap-1"><Info size={10} /> Planes especiales (AMPF, 500) NO suman al conteo, pero se pagan si se supera el mínimo.</div>
                        </div>

                        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex items-center justify-between">
                            <div><h4 className="font-bold text-sm text-blue-800">Cálculo de Cartera</h4><p className="text-[10px] text-blue-600 mt-1">Fórmula: (Full Price - Descuento - Aportes) * Porcentaje</p></div>
                            <div className="w-24"><Label className="text-[10px] font-bold text-blue-600 mb-1 block">% Comisión</Label><Input type="number" className="bg-white border-blue-200" value={calcRules.portfolioRate} onChange={e => setCalcRules({ ...calcRules, portfolioRate: parseFloat(e.target.value) })} step="0.01" /></div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={() => setShowConfig(false)}>Guardar Cambios</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* ✅ ALERTA DE DIFERIR (PRÓXIMO MES) */}
            <AlertDialog open={!!deferOpId} onOpenChange={() => setDeferOpId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Mover al PRÓXIMO mes?</AlertDialogTitle><AlertDialogDescription>La venta pasará al período siguiente del actual.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmDefer}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

            {/* ✅ ALERTA DE RETROCESO (MES ANTERIOR) */}
            <AlertDialog open={!!retroOpId} onOpenChange={() => setRetroOpId(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>¿Mover al mes ANTERIOR?</AlertDialogTitle><AlertDialogDescription>La venta pasará al período anterior del actual.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancelar</AlertDialogCancel><AlertDialogAction onClick={confirmRetro}>Confirmar</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

            {/* ✅ MODAL DE CARTERA CAÍDA */}
            <Dialog open={!!carteraCaidaOp} onOpenChange={() => { setCarteraCaidaOp(null); setCarteraCaidaMotivo("") }}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-red-600">
                            <Trash2 size={20} /> ¿Esta cartera se cayó?
                        </DialogTitle>
                        <DialogDescription>
                            {carteraCaidaOp?.clientName} - {carteraCaidaOp?.prepaga}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-4 space-y-4">
                        <div className="bg-red-50 border border-red-100 rounded-lg p-3 text-sm text-red-700">
                            Esta acción marcará la cartera como perdida. Podrás recuperarla desde la Base de Datos.
                        </div>
                        <div className="space-y-2">
                            <Label className="text-sm font-bold">Motivo de la pérdida</Label>
                            <textarea
                                className="w-full min-h-[100px] p-3 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                placeholder="Describe el motivo por el cual esta cartera se perdió..."
                                value={carteraCaidaMotivo}
                                onChange={(e) => setCarteraCaidaMotivo(e.target.value)}
                            />
                        </div>
                    </div>
                    <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => { setCarteraCaidaOp(null); setCarteraCaidaMotivo("") }}>
                            Cancelar
                        </Button>
                        <Button
                            className="bg-red-600 hover:bg-red-700 text-white"
                            onClick={handleCarteraCaida}
                            disabled={!carteraCaidaMotivo.trim() || isSavingCarteraCaida}
                        >
                            {isSavingCarteraCaida ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Guardando...</> : "Confirmar Caída"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={showHistory} onOpenChange={setShowHistory}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Historial Anual</DialogTitle></DialogHeader><div className="py-4"><Table><TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="w-[50%]">Gráfico</TableHead></TableRow></TableHeader><TableBody>{historyData.map((data) => { const max = Math.max(...historyData.map(d => d.total)); const w = max > 0 ? (data.total / max) * 100 : 0; return (<TableRow key={data.month}><TableCell className="capitalize font-bold">{formatMonth(data.month)}</TableCell><TableCell className="text-right font-mono">${data.total.toLocaleString()}</TableCell><TableCell><div className="h-4 bg-slate-100 rounded-full w-full overflow-hidden"><div className="h-full bg-green-500" style={{ width: `${w}%` }}></div></div></TableCell></TableRow>) })}</TableBody></Table></div></DialogContent></Dialog>

            <Dialog open={!!viewingSeller} onOpenChange={() => setViewingSeller(null)}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Detalle: {viewingSeller}</DialogTitle></DialogHeader><div className="max-h-[60vh] overflow-y-auto"><Table><TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Plan</TableHead><TableHead className="text-right">Liquidado</TableHead><TableHead>Estado</TableHead></TableRow></TableHeader><TableBody>{getSellerOpsDetail(viewingSeller).map((op: any) => { const calc = calculate(op); return (<TableRow key={op.id} className={op.payStatus === 'absorbed' || op.payStatus === 'special_locked' ? 'opacity-50 bg-slate-50' : ''}><TableCell className="text-xs">{op.entryDate}</TableCell><TableCell className="font-bold text-xs">{op.clientName}</TableCell><TableCell className="text-xs"><Badge variant="outline">{op.prepaga} {op.plan}</Badge></TableCell><TableCell className="text-right font-mono text-xs">{formatMoney(calc.val)}</TableCell><TableCell>{op.payStatus === 'special_paid' && <Badge className="bg-yellow-100 text-yellow-700">Especial OK</Badge>}{op.payStatus === 'special_locked' && <Badge variant="outline" className="text-red-400 border-red-200">Bloqueado</Badge>}{op.payStatus === 'absorbed' && <Badge variant="outline">Absorbida</Badge>}{op.payStatus === 'paid' && <Badge className="bg-purple-100 text-purple-700">Pagada</Badge>}</TableCell></TableRow>) })}</TableBody></Table></div></DialogContent></Dialog>

            <Dialog open={isAddingClient} onOpenChange={setIsAddingClient}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>Agregar Manual</DialogTitle></DialogHeader><div className="grid grid-cols-2 gap-6 py-4"><div className="space-y-4"><div className="space-y-1"><Label>Nombre</Label><Input value={newClient.name} onChange={e => setNewClient({ ...newClient, name: e.target.value })} /></div><div className="space-y-1"><Label>DNI</Label><Input value={newClient.dni} onChange={e => setNewClient({ ...newClient, dni: e.target.value })} /></div></div><div className="space-y-4 bg-slate-50 p-4 rounded"><div className="space-y-1"><Label>Full Price</Label><Input type="number" value={newClient.fullPrice} onChange={e => setNewClient({ ...newClient, fullPrice: e.target.value })} /></div><div className="grid grid-cols-2 gap-2"><div><Label>Aportes</Label><Input type="number" value={newClient.aportes} onChange={e => setNewClient({ ...newClient, aportes: e.target.value })} /></div><div><Label>Desc.</Label><Input type="number" value={newClient.descuento} onChange={e => setNewClient({ ...newClient, descuento: e.target.value })} /></div></div><div className="pt-2 flex justify-between text-sm font-bold text-blue-600"><span>Cartera Est:</span><span>${Math.round((parseFloat(newClient.fullPrice) - parseFloat(newClient.descuento) - parseFloat(newClient.aportes)) * calcRules.portfolioRate).toLocaleString()}</span></div></div></div><DialogFooter><Button onClick={handleAddClient}>Guardar</Button></DialogFooter></DialogContent></Dialog>
        </div >
    )
}