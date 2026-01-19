"use client"

import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Badge } from "@/components/ui/badge"
import { ArrowUpRight, TrendingUp, AlertCircle, Target, Users, Trophy, AlertTriangle, Clock, RefreshCw, HelpCircle, Filter, MapPin, Building2, ChevronRight, Calendar, Globe, Download, FileSpreadsheet } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// COLORES PARA GRAFICOS
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1']

// --- DEFINICIÓN DEL MUNDO OPS ---
const OPS_SCOPE = [
    'vendido', 
    'ingresado', 
    'precarga', 
    'medicas', 
    'documentacion', 
    'legajo', 
    'demoras', 
    'cumplidas', 
    'rechazado', 
    'baja'
]



// --- NORMALIZACIÓN DE FECHAS Y UBICACIONES (AGREGADO) ---
const APP_TZ = 'America/Argentina/Buenos_Aires'

const safeString = (v: any) => (v === null || v === undefined ? '' : String(v))

const stripAccents = (str: string) =>
    str.normalize('NFD').replace(/[\u0300-\u036f]/g, '')

const normalizeText = (v: any) => {
    const s = stripAccents(safeString(v).trim().toUpperCase())
    return s
        .replace(/[^A-Z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

const normalizeCP = (v: any) => {
    const raw = safeString(v).trim().toUpperCase()
    if (!raw) return ''
    const digits = (raw.match(/\d+/g) || []).join('')
    // En Argentina, el CP numérico clásico suele ser de 4 dígitos (ej: 7600). Tomamos los primeros 4.
    if (digits.length >= 4) return digits.slice(0, 4)
    return digits
}

const canonicalProvince = (prov: any) => {
    const p = normalizeText(prov)
    if (!p) return ''

    const alias: Record<string, string> = {
        'CABA': 'CABA',
        'CAPITAL FEDERAL': 'CABA',
        'CIUDAD AUTONOMA DE BUENOS AIRES': 'CABA',
        'CIUDAD DE BUENOS AIRES': 'CABA',
        'BUENOS AIRES': 'BUENOS AIRES',
        'BS AS': 'BUENOS AIRES',
        'B S AS': 'BUENOS AIRES',
        'PBA': 'BUENOS AIRES',
        'PROVINCIA DE BUENOS AIRES': 'BUENOS AIRES',
        'CORDOBA': 'CÓRDOBA',
        'SANTA FE': 'SANTA FE',
        'MENDOZA': 'MENDOZA',
        'ENTRE RIOS': 'ENTRE RÍOS',
        'ENTRE RIOS ': 'ENTRE RÍOS',
        'TUCUMAN': 'TUCUMÁN',
        'SALTA': 'SALTA',
        'CHACO': 'CHACO',
        'CORRIENTES': 'CORRIENTES',
        'MISIONES': 'MISIONES',
        'NEUQUEN': 'NEUQUÉN',
        'RIO NEGRO': 'RÍO NEGRO',
        'CHUBUT': 'CHUBUT',
        'SANTA CRUZ': 'SANTA CRUZ',
        'TIERRA DEL FUEGO': 'TIERRA DEL FUEGO',
        'LA PAMPA': 'LA PAMPA',
        'SAN JUAN': 'SAN JUAN',
        'SAN LUIS': 'SAN LUIS',
        'LA RIOJA': 'LA RIOJA',
        'CATAMARCA': 'CATAMARCA',
        'JUJUY': 'JUJUY',
        'FORMOSA': 'FORMOSA',
        'SANTIAGO DEL ESTERO': 'SANTIAGO DEL ESTERO'
    }

    return alias[p] || (p.charAt(0) + p.slice(1).toLowerCase())
}

const canonicalLocality = (loc: any, cp: any, provCanon: string) => {
    const l = normalizeText(loc)
    const cpNorm = normalizeCP(cp)

    // Caso especial Mar del Plata (MDP) con CP 7600
    if (cpNorm == '7600') {
        if (l === 'MDP' || l === 'MAR DEL PLATA' || l === 'MARDELPLATA') return 'Mar del Plata'
    }

    // Alias generales
    if (l === 'MDP' && (provCanon === 'BUENOS AIRES' || provCanon === '')) return 'Mar del Plata'

    if (!l) return ''

    // Title case simple
    return l
        .split(' ')
        .map(w => w.charAt(0) + w.slice(1).toLowerCase())
        .join(' ')
}

const getMonthYearInTZ = (dateLike: any) => {
    const d = new Date(dateLike)
    if (Number.isNaN(d.getTime())) return { month: null as any, year: null as any }

    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: APP_TZ,
        year: 'numeric',
        month: '2-digit'
    })

    const parts = fmt.formatToParts(d)
    const year = parts.find(p => p.type === 'year')?.value
    const month = parts.find(p => p.type === 'month')?.value
    return { month: month ? Number(month) : null, year: year ? Number(year) : null }
}

const formatDateInTZ = (dateLike: any) => {
    const d = new Date(dateLike)
    if (Number.isNaN(d.getTime())) return '-'
    return new Intl.DateTimeFormat('es-AR', {
        timeZone: APP_TZ,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    }).format(d)
}

// --- UTILIDAD PARA EXPORTAR A CSV (AGREGADO) ---
const exportToCSV = (data: any[], filename: string) => {
    if (!data || data.length === 0) return;

    // Definir encabezados
    const headers = [
        "ID", "Fecha Ingreso", "Estado", "Vendedor", "Origen", 
        "Prepaga", "Plan", "Provincia", "Localidad", "CP", "Ultima Actualizacion"
    ];

    // Mapear filas
    const rows = data.map(row => [
        row.id,
        formatDateInTZ(row.entryDate),
        row.status,
        row.seller || "Sin Asignar",
        row.origen,
        row.prepaga,
        row.plan,
        row.provincia,
        row.localidad,
        row.cp,
        row.lastUpdate ? formatDateInTZ(row.lastUpdate) : '-'
    ]);

    // Construir contenido CSV
    const csvContent = [
        headers.join(","), 
        ...rows.map(e => e.map(item => `"${String(item).replace(/"/g, '""')}"`).join(","))
    ].join("\n");

    // Crear Blob y descargar
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `${filename}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// --- COMPONENTE INTERNO DE TOOLTIP (HELP) ---
const InfoTooltip = ({ text }: { text: string }) => {
    const [isVisible, setIsVisible] = useState(false)
    return (
        <div className="relative inline-flex items-center ml-1.5 align-middle group">
            <HelpCircle 
                className="h-3.5 w-3.5 text-slate-400 cursor-help hover:text-blue-500 transition-colors" 
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            />
            {isVisible && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-slate-800 text-white text-[10px] leading-tight rounded shadow-xl z-50 pointer-events-none animate-in fade-in zoom-in-95 duration-200">
                    {text}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800"></div>
                </div>
            )}
        </div>
    )
}

// --- COMPONENTE CUSTOM TOOLTIP PARA GRÁFICOS ---
const CustomChartTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
        const data = payload[0].payload
        return (
            <div className="bg-white p-3 border border-slate-200 shadow-xl rounded-lg text-xs min-w-[140px] z-50">
                <p className="font-black text-slate-800 mb-1 border-b border-slate-100 pb-1">{data.name}</p>
                {payload.map((entry: any, index: number) => (
                    <div key={index} className="flex justify-between items-center gap-4 mb-1">
                        <span style={{ color: entry.color }} className="font-bold">{entry.name}:</span>
                        <span className="font-mono text-slate-600">{entry.value}</span>
                    </div>
                ))}
                
                {data.tasa !== undefined && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="font-bold text-slate-500">Efectividad:</span>
                        <span className={`font-black ${Number(data.tasa) > 30 ? 'text-green-600' : 'text-slate-700'}`}>{data.tasa}%</span>
                    </div>
                )}
                
                {data.share !== undefined && (
                    <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                        <span className="font-bold text-slate-500">Impacto:</span>
                        <span className="font-black text-blue-600">{data.share}%</span>
                    </div>
                )}
            </div>
        )
    }
    return null
}

interface OpsMetricsProps {
    onApplyFilter?: (type: string, value: string) => void;
}

export function OpsMetrics({ onApplyFilter }: OpsMetricsProps) {
    const supabase = createClient()

    // --- ESTADO DE DATOS ---
    const [operations, setOperations] = useState<any[]>([]) 
    const [sellersList, setSellersList] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    
    // --- ESTADO FILTROS GENERALES ---
    const currentYear = new Date().getFullYear()
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedYear, setSelectedYear] = useState(currentYear.toString())
    const [selectedSeller, setSelectedSeller] = useState("all")

    // --- ESTADO FILTRO GEO (NUEVO) ---
    const [geoViewMode, setGeoViewMode] = useState("monthly") // 'monthly' | 'historical'

    // --- ESTADO DEL MODAL DE UBICACIÓN ---
    const [geoModalOpen, setGeoModalOpen] = useState(false)
    const [selectedGeoData, setSelectedGeoData] = useState<any>(null)

    // --- ESTADO MODAL DESCARGA (AGREGADO) ---
    const [downloadModalOpen, setDownloadModalOpen] = useState(false)
    const [downloadType, setDownloadType] = useState("current") // 'current' | 'global' | 'custom'
    const [downloadMonth, setDownloadMonth] = useState((new Date().getMonth() + 1).toString())
    const [downloadYear, setDownloadYear] = useState(currentYear.toString())

    // --- CONEXIÓN A SUPABASE ---
    useEffect(() => {
        const fetchData = async () => {
            setLoading(true)
            
            // 1. Traemos TODO
            const { data, error } = await supabase
                .from('leads')
                .select('*')
            
            if (data) {
                const mappedData = data.map((l: any) => {
                    // --- Fecha de Ingreso (REGLA MADRE) ---
                    // 1) Usar fecha_ingreso (si existe en leads)
                    // 2) Fallbacks: entry_date / sold_at / created_at (para no romper históricos)
                    const entryDate = l.fecha_ingreso || l.entry_date || l.sold_at || l.created_at

                    // --- Geo RAW ---
                    const provRaw = l.province || l.provincia || l.state || ''
                    const locRaw = l.city || l.localidad || ''
                    const cpRaw = l.zip_code || l.cp || l.postal_code || ''

                    // --- Geo Canon ---
                    const provCanon = canonicalProvince(provRaw)
                    const locCanon = canonicalLocality(locRaw, cpRaw, provCanon)
                    const cpCanon = normalizeCP(cpRaw)

                    return {
                        id: l.id,
                        entryDate,
                        status: l.status ? l.status.toLowerCase() : 'desconocido',
                        origen: l.source,
                        seller: l.agent_name,
                        lastUpdate: l.last_update,
                        prepaga: l.prepaga || l.quoted_prepaga || 'Sin Dato',
                        plan: l.plan || l.quoted_plan || 'General',

                        // Mapeo geográfico (canonizado para métricas)
                        provincia: provCanon || 'Provincia Desc.',
                        localidad: locCanon || 'Localidad Desc.',
                        cp: cpCanon || 'S/D'
                    }
                })
                setOperations(mappedData)
            }

            // 2. Traemos Vendedores
            const { data: profiles } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('role', 'seller')
            
            if (profiles) {
                setSellersList(profiles)
            }

            setLoading(false)
        }

        fetchData()
    }, [])

    // --- PROCESAMIENTO DE DATOS ---
    const { 
        totalOps, 
        cumplidas, 
        tasaExito, 
        dataOrigen, 
        dataPrepagas, 
        topPlanes, 
        bottleneckData, 
        sellerData, 
        dataAging, 
        velocidadPromedio,
        rejectedCount,
        geoLocations,
        filteredOps // EXPORTADO PARA EL REPORTE
    } = useMemo(() => {
        
        // 1. FILTRO DE ALCANCE (SCOPE)
        const opsScopeOperations = operations.filter(o => OPS_SCOPE.includes(o.status))

        // 2. FILTRO DE FECHAS Y VENDEDOR (GENERAL)
        const filteredOps = opsScopeOperations.filter(o => {
            const { month: opMonth, year: opYear } = getMonthYearInTZ(o.entryDate)

            const matchDate = opMonth !== null && opYear !== null && opMonth === parseInt(selectedMonth) && opYear === parseInt(selectedYear)
            const matchSeller = selectedSeller === 'all' || 
                (o.seller && o.seller.trim().toLowerCase() === selectedSeller.trim().toLowerCase())

            return matchDate && matchSeller
        })

        // 3. CLASIFICACIÓN FINAL (GENERAL)
        const rejectedStatuses = ['rechazado', 'baja', 'cancelado', 'perdido']
        const validOps = filteredOps.filter(o => !rejectedStatuses.includes(o.status))
        const rejectedOps = filteredOps.filter(o => rejectedStatuses.includes(o.status))

        // --- MÉTRICAS GENERALES ---
        const total = validOps.length
        const rejected = rejectedOps.length
        const closed = validOps.filter((o:any) => o.status === 'cumplidas').length
        const rate = total > 0 ? ((closed / total) * 100).toFixed(1) : "0"

        // ... (CÁLCULO DE MÉTRICAS STANDARD: ORIGEN, PREPAGAS, ETC - MANTIENEN LÓGICA MENSUAL)
        const originMap: Record<string, {name: string, ingresado: number, cumplido: number}> = {}
        validOps.forEach((op: any) => {
            const source = op.origen || "Desconocido"
            if (!originMap[source]) originMap[source] = { name: source, ingresado: 0, cumplido: 0 }
            originMap[source].ingresado += 1
            if (op.status === 'cumplidas') originMap[source].cumplido += 1
        })
        const _dataOrigen = Object.values(originMap)
            .map(o => ({ ...o, tasa: o.ingresado > 0 ? ((o.cumplido / o.ingresado) * 100).toFixed(1) : "0" }))
            .sort((a,b) => b.ingresado - a.ingresado).slice(0, 5)

        const prepagasStats: Record<string, { total: number, ok: number }> = {}
        validOps.forEach((op:any) => {
            const p = op.prepaga || 'Otros'
            if (!prepagasStats[p]) prepagasStats[p] = { total: 0, ok: 0 }
            prepagasStats[p].total += 1
            if (op.status === 'cumplidas') prepagasStats[p].ok += 1
        })
        const _dataPrepagas = Object.keys(prepagasStats).map(key => ({
            name: key, 
            value: prepagasStats[key].total,
            tasa: ((prepagasStats[key].ok / prepagasStats[key].total) * 100).toFixed(1)
        })).sort((a:any,b:any) => b.value - a.value)

        const planMap: Record<string, { prepaga: string, plan: string, ventas: number, ok: number }> = {}
        validOps.forEach((op: any) => {
            const key = `${op.prepaga}-${op.plan}`
            if(!planMap[key]) planMap[key] = { prepaga: op.prepaga || '?', plan: op.plan || '?', ventas: 0, ok: 0 }
            planMap[key].ventas += 1
            if(op.status === 'cumplidas') planMap[key].ok += 1
        })
        const _topPlanes = Object.values(planMap)
            .filter(p => p.ventas > 0)
            .map(p => ({ ...p, efectividad: Math.round((p.ok / p.ventas) * 100) }))
            .sort((a,b) => b.ok - a.ok).slice(0, 5)

        const activeStatuses = ['ingresado', 'precarga', 'medicas', 'documentacion', 'legajo', 'demoras']
        const totalActive = validOps.filter((o:any) => activeStatuses.includes(o.status)).length
        const _bottleneckData = activeStatuses.map(status => {
            const cnt = validOps.filter((o:any) => o.status === status).length
            return {
                name: status.charAt(0).toUpperCase() + status.slice(1),
                cantidad: cnt,
                share: totalActive > 0 ? ((cnt / totalActive) * 100).toFixed(1) : "0"
            }
        })

        const sellers = Array.from(new Set(validOps.map((o:any) => o.seller).filter(Boolean)))
        const _sellerData = sellers.map(seller => {
            const ops = validOps.filter((o:any) => o.seller === seller)
            const totalS = ops.length
            const okS = ops.filter((o:any) => o.status === 'cumplidas').length
            const rateS = totalS > 0 ? ((okS / totalS) * 100).toFixed(0) : "0"
            return { name: seller || "Sin Asignar", total: totalS, ok: okS, rate: rateS }
        }).sort((a:any, b:any) => b.ok - a.ok).slice(0, 5)

        const now = new Date()
        const agingBuckets = { '< 7 días': 0, '7-15 días': 0, '15-30 días': 0, '> 30 días': 0 }
        validOps.filter((o:any) => !['cumplidas', 'vendido'].includes(o.status)).forEach((op:any) => {
            const entry = new Date(op.entryDate)
            const diffTime = now.getTime() - entry.getTime()
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
            if (diffDays < 7) agingBuckets['< 7 días']++
            else if (diffDays <= 15) agingBuckets['7-15 días']++
            else if (diffDays <= 30) agingBuckets['15-30 días']++
            else agingBuckets['> 30 días']++
        })
        const _dataAging = [
            { name: '< 7 días', cantidad: agingBuckets['< 7 días'], color: '#10b981' },
            { name: '7-15 días', cantidad: agingBuckets['7-15 días'], color: '#f59e0b' },
            { name: '15-30 días', cantidad: agingBuckets['15-30 días'], color: '#f97316' },
            { name: '> 30 días', cantidad: agingBuckets['> 30 días'], color: '#ef4444' },
        ]

        let totalDays = 0
        const closedOps = validOps.filter((o:any) => o.status === 'cumplidas')
        closedOps.forEach((op:any) => {
            const start = new Date(op.entryDate)
            const end = op.lastUpdate ? new Date(op.lastUpdate) : new Date()
            const diff = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
            totalDays += diff
        })
        const _velocidad = closedOps.length > 0 ? (totalDays / closedOps.length).toFixed(1) : "0"

        // --- H. GEOGRAFIA (LÓGICA HÍBRIDA) ---
        // 1. Determinar el Universo de Datos para Geo
        let geoUniverseOps = []
        
        if (geoViewMode === 'monthly') {
            // Si es mensual, usamos los datos ya filtrados por fecha
            geoUniverseOps = validOps
        } else {
            // Si es histórico, usamos TODOS los datos del scope, pero aplicamos el filtro de vendedor si existe
            // y excluimos los rechazados/bajas
            geoUniverseOps = opsScopeOperations.filter(o => {
                const isNotRejected = !rejectedStatuses.includes(o.status)
                const matchSeller = selectedSeller === 'all' || 
                    (o.seller && o.seller.trim().toLowerCase() === selectedSeller.trim().toLowerCase())
                return isNotRejected && matchSeller
            })
        }

        // 2. Filtrar solo ventas cumplidas
        const salesForGeo = geoUniverseOps.filter(o => o.status === 'cumplidas')
        
        const locationMap: Record<string, { 
            provincia: string, 
            localidad: string, 
            cp: string, 
            count: number, 
            ops: any[] 
        }> = {}

        salesForGeo.forEach(o => {
            const provCanon = canonicalProvince(o.provincia)
            const cpCanon = normalizeCP(o.cp)
            const locCanon = canonicalLocality(o.localidad, o.cp, provCanon)

            const p = provCanon || (o.provincia || 'Provincia Desc.')
            const l = locCanon || (o.localidad || 'Localidad Desc.')
            const c = cpCanon || (o.cp || 'S/D')

            // Key normalizada: provincia + cp + localidad
            const key = `${p}|${c}|${l}`.toLowerCase()

            if (!locationMap[key]) {
                locationMap[key] = { provincia: p, localidad: l, cp: c, count: 0, ops: [] }
            }
            locationMap[key].count += 1
            locationMap[key].ops.push(o)
        })

        // --- MODIFICACION: QUITAMOS EL SLICE PARA MOSTRAR TODO ---
        const _geoLocations = Object.values(locationMap)
            .sort((a,b) => b.count - a.count)
            // .slice(0, 10) <--- ELIMINADO PARA MOSTRAR TODO

        return {
            filteredCount: filteredOps.length,
            totalOps: total, 
            cumplidas: closed,
            tasaExito: rate,
            dataOrigen: _dataOrigen,
            dataPrepagas: _dataPrepagas,
            topPlanes: _topPlanes,
            bottleneckData: _bottleneckData,
            sellerData: _sellerData,
            dataAging: _dataAging,
            velocidadPromedio: _velocidad,
            rejectedCount: rejected,
            geoLocations: _geoLocations,
            filteredOps // Exportamos para el CSV
        }
    }, [operations, selectedMonth, selectedYear, selectedSeller, geoViewMode]) 

    const handleFilter = (type: string, val: string) => {
        if(onApplyFilter) onApplyFilter(type, val)
    }

    // --- MANEJO DEL MODAL ---
    const handleGeoClick = (locationData: any) => {
        const prepagasLocal = {} as any
        locationData.ops.forEach((op: any) => {
            const p = op.prepaga || 'Desconocido'
            prepagasLocal[p] = (prepagasLocal[p] || 0) + 1
        })
        
        const chartData = Object.entries(prepagasLocal).map(([k,v]:any) => ({
            name: k, value: v
        })).sort((a:any, b:any) => b.value - a.value)

        setSelectedGeoData({
            title: `${locationData.localidad} (${locationData.cp})`,
            subtitle: locationData.provincia,
            total: locationData.count,
            chartData
        })
        setGeoModalOpen(true)
    }

    // --- MANEJO DE DESCARGA (AGREGADO) ---
    const executeDownload = () => {
        let dataToExport: any[] = []
        let filename = "Reporte_Ventas"

        if (downloadType === 'current') {
            // Usar lo que se ve en pantalla
            dataToExport = filteredOps
            filename = `Reporte_${selectedMonth}_${selectedYear}`
        } else if (downloadType === 'global') {
            // Todo el historial
            dataToExport = operations
            filename = `Reporte_Global_Historico`
        } else if (downloadType === 'custom') {
            // Filtrar bajo demanda
            dataToExport = operations.filter(o => {
                const { month: m, year: y } = getMonthYearInTZ(o.entryDate)
                return m === parseInt(downloadMonth) && y === parseInt(downloadYear)
            })
            filename = `Reporte_${downloadMonth}_${downloadYear}`
        }

        exportToCSV(dataToExport, filename)
        setDownloadModalOpen(false)
    }

    if (loading && operations.length === 0) {
        return <div className="h-96 flex items-center justify-center text-slate-400 gap-2"><RefreshCw className="animate-spin h-5 w-5"/> Cargando Operaciones...</div>
    }

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-10">
            
            {/* HEADER CON FILTROS Y DESCARGA */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-black text-slate-800 flex items-center">
                        Métricas Operativas 
                        <InfoTooltip text="Panel de control para analizar el rendimiento del equipo y el flujo de ventas." />
                    </h2>
                    <p className="text-xs text-slate-500">
                        Mostrando datos de {new Date(parseInt(selectedYear), parseInt(selectedMonth)-1).toLocaleString('es-ES', { month: 'long', year: 'numeric' })}.
                    </p>
                </div>
                
                <div className="flex gap-2">
                    {/* BOTON DESCARGA (AGREGADO) */}
                    <Button 
                        variant="outline" 
                        className="h-10 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700 font-bold gap-2 shadow-sm"
                        onClick={() => setDownloadModalOpen(true)}
                    >
                        <Download size={16}/> Descargar Reporte
                    </Button>

                    <div className="flex flex-wrap gap-2 items-center bg-white p-2 rounded-xl border shadow-sm">
                        <Filter size={16} className="text-slate-400 ml-2"/>
                        <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                            <SelectTrigger className="w-[130px] h-8 text-xs font-bold border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                            <SelectContent>{Array.from({length: 12}, (_, i) => i + 1).map(m => (<SelectItem key={m} value={m.toString()}>{new Date(0, m - 1).toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date(0, m - 1).toLocaleString('es-ES', { month: 'long' }).slice(1)}</SelectItem>))}</SelectContent>
                        </Select>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <Select value={selectedYear} onValueChange={setSelectedYear}>
                            <SelectTrigger className="w-[80px] h-8 text-xs font-bold border-none shadow-none focus:ring-0"><SelectValue /></SelectTrigger>
                            <SelectContent>{[currentYear, currentYear - 1].map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
                        </Select>
                        <div className="h-4 w-px bg-slate-200"></div>
                        <Select value={selectedSeller} onValueChange={setSelectedSeller}>
                            <SelectTrigger className={`w-[160px] h-8 text-xs font-bold border-none shadow-none focus:ring-0 ${selectedSeller !== 'all' ? 'text-blue-600' : ''}`}><SelectValue placeholder="Vendedor" /></SelectTrigger>
                            <SelectContent><SelectItem value="all">Todos los Vendedores</SelectItem>{sellersList.map((s:any) => (<SelectItem key={s.full_name} value={s.full_name}>{s.full_name}</SelectItem>))}</SelectContent>
                        </Select>
                    </div>
                </div>
            </div>

            {/* --- KPI CARDS --- */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card className="bg-white border-slate-200 shadow-sm hover:border-blue-300 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">Total Ingresos</CardTitle>
                        <Users className="h-4 w-4 text-blue-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{totalOps}</div>
                        <p className="text-xs text-slate-400 mt-1 flex items-center"><ArrowUpRight className="h-3 w-3 text-green-500 mr-1"/> Operaciones de OPS</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">Efectividad</CardTitle>
                        <Target className="h-4 w-4 text-green-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{tasaExito}%</div>
                        <p className="text-xs text-slate-400 mt-1">Ratio Cierre Global</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">En Proceso</CardTitle>
                        <TrendingUp className="h-4 w-4 text-yellow-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{bottleneckData.reduce((acc, curr) => acc + curr.cantidad, 0)}</div>
                        <p className="text-xs text-slate-400 mt-1">Operaciones activas</p>
                    </CardContent>
                </Card>
                <Card className="bg-white border-slate-200 shadow-sm hover:border-red-300 transition-colors group">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-bold text-slate-500 uppercase tracking-widest flex items-center">Caídas</CardTitle>
                        <AlertCircle className="h-4 w-4 text-red-500 group-hover:scale-110 transition-transform" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-black text-slate-800">{rejectedCount}</div>
                        <p className="text-xs text-slate-400 mt-1">Rechazos en OPS</p>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 1: ORIGENES Y PREPAGAS --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Performance por Origen <InfoTooltip text="Muestra de dónde vienen los datos y su tasa de conversión."/>
                        </CardTitle>
                        <CardDescription>Volumen vs Cierres (Ver tooltip para %).</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dataOrigen} margin={{top: 5, right: 30, left: 20, bottom: 5}}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0"/>
                                    <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                    <YAxis tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                    <Tooltip content={<CustomChartTooltip />} cursor={{fill: '#f1f5f9'}} />
                                    <Legend iconType="circle" wrapperStyle={{paddingTop: '20px', fontSize: '12px'}}/>
                                    <Bar dataKey="ingresado" name="Ingresado" fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={20} />
                                    <Bar dataKey="cumplido" name="Venta Cerrada" fill="#10b981" radius={[4, 4, 0, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Mix de Prepagas <InfoTooltip text="Participación de cada prepaga. Tooltip muestra efectividad."/>
                        </CardTitle>
                        <CardDescription>Distribución del volumen de ventas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[300px] w-full flex items-center justify-center">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={dataPrepagas} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" onClick={(data) => handleFilter('prepaga', data.name)} className="cursor-pointer">
                                        {dataPrepagas.map((entry:any, index:any) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                                    </Pie>
                                    <Tooltip content={<CustomChartTooltip />} />
                                    <Legend layout="vertical" verticalAlign="middle" align="right" wrapperStyle={{fontSize: '11px', fontWeight: 'bold', color: '#475569'}}/>
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 2: PLANES Y CUELLOS DE BOTELLA --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2 shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Top Planes <InfoTooltip text="Planes más vendidos y su tasa de cierre."/>
                        </CardTitle>
                        <CardDescription>Ranking de efectividad por producto.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-5">
                            {topPlanes.length === 0 && <p className="text-xs text-slate-400 italic">No hay ventas registradas en este período.</p>}
                            {topPlanes.map((item, i) => (
                                <div key={i} className="group cursor-pointer" onClick={() => handleFilter('plan', item.plan)}>
                                    <div className="flex justify-between items-end mb-1">
                                        <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-slate-500 font-bold border-slate-200">{i+1}</Badge>
                                            <span className="font-bold text-slate-700 text-sm">{item.prepaga} <span className="text-blue-600">{item.plan}</span></span>
                                        </div>
                                        <div className="text-right">
                                            <span className="block text-xs font-black text-slate-800">{item.ventas} ingresos</span>
                                            <span className="block text-[10px] text-green-600 font-bold">{item.efectividad}% efectividad</span>
                                        </div>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden flex">
                                        <div className="h-full bg-slate-800" style={{width: `${(item.ventas / (topPlanes[0]?.ventas || 1)) * 100}%`}}></div>
                                    </div>
                                    <div className="mt-0.5 h-1 w-full bg-transparent rounded-full overflow-hidden flex">
                                         <div className="h-full bg-green-500 opacity-50" style={{width: `${item.efectividad}%`}}></div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-slate-200 bg-slate-50/50">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center">
                            Cuellos de Botella <InfoTooltip text="Stock actual por etapa. Tooltip muestra % de impacto sobre el total activo."/>
                        </CardTitle>
                        <CardDescription>Dónde se traban las ventas.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[250px] w-full mt-4">
                             <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={bottleneckData} layout="vertical" margin={{top: 0, right: 30, left: 20, bottom: 5}}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0"/>
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={70} tick={{fontSize: 10, fontWeight: 'bold', fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                    <Tooltip content={<CustomChartTooltip />} cursor={{fill: 'transparent'}}/>
                                    <Bar dataKey="cantidad" fill="#6366f1" radius={[0, 4, 4, 0] as any} barSize={24} background={{ fill: 'transparent' }} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* --- SECCION 3: RANKING + AGING --- */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <Card className="shadow-sm border-slate-200">
                    <CardHeader>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <Trophy className="text-yellow-500" size={20}/> Top Vendedores
                        </CardTitle>
                        <CardDescription>Ranking en el período seleccionado.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {sellerData.length === 0 && <p className="text-xs text-slate-400 italic">No hay ventas en este rango.</p>}
                            {sellerData.map((s, i) => (
                                <div key={i} className="flex items-center justify-between p-2 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer" onClick={() => handleFilter('seller', s.name)}>
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center font-black text-xs ${i===0 ? 'bg-yellow-100 text-yellow-700' : 'bg-slate-100 text-slate-500'}`}>
                                            {i+1}
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-700">{s.name}</p>
                                            <p className="text-[10px] text-slate-400">{s.total} Ingresos</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-black text-slate-800">{s.ok} OK</p>
                                        <p className={`text-[10px] font-bold ${Number(s.rate) > 50 ? 'text-green-600' : 'text-orange-500'}`}>{s.rate}% Cierre</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>

                <div className="flex flex-col gap-6">
                    <Card className="shadow-sm border-slate-200 flex-1">
                        <CardHeader>
                            <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                                <AlertTriangle className="text-orange-500" size={20}/> Aging de Stock
                            </CardTitle>
                            <CardDescription>Antigüedad de casos activos.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[200px] w-full">
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={dataAging} margin={{top: 10, right: 10, left: 0, bottom: 0}}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9"/>
                                        <XAxis dataKey="name" tick={{fontSize: 10, fill: '#64748b'}} axisLine={false} tickLine={false}/>
                                        <Tooltip contentStyle={{borderRadius: '8px', fontSize: '12px'}} cursor={{fill: 'transparent'}}/>
                                        <Bar dataKey="cantidad" radius={[4, 4, 0, 0]} barSize={40}>
                                            {dataAging.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </CardContent>
                    </Card>

                    <Card className="shadow-sm border-slate-200 bg-blue-50 border-blue-100">
                        <CardContent className="p-6 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-blue-600 uppercase tracking-widest mb-1 flex items-center">Velocidad de Cierre</p>
                                <h3 className="text-3xl font-black text-blue-900">{velocidadPromedio} días</h3>
                                <p className="text-[10px] text-blue-400">Tiempo de ciclo promedio</p>
                            </div>
                            <div className="h-12 w-12 bg-blue-200 rounded-full flex items-center justify-center">
                                <Clock className="h-6 w-6 text-blue-700"/>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>

            {/* --- SECCION 4: TOP UBICACIONES (UNIFICADO + FILTRO MODO) --- */}
            <Card className="shadow-sm border-slate-200 bg-gradient-to-br from-white to-slate-50">
                <CardHeader className="flex flex-row items-center justify-between">
                    <div>
                        <CardTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                            <MapPin className="text-indigo-500" size={20}/> Ranking de Ventas por Ubicación
                        </CardTitle>
                        <CardDescription>
                            {geoViewMode === 'monthly' ? 'Mostrando según filtros superiores (Mes Actual).' : 'Mostrando todo el historial acumulado.'}
                        </CardDescription>
                    </div>
                    
                    {/* SELECTOR ESPECÍFICO PARA GEO */}
                    <div className="bg-white rounded-lg border shadow-sm px-2 py-1">
                        <Select value={geoViewMode} onValueChange={setGeoViewMode}>
                            <SelectTrigger className="w-[140px] h-7 text-xs font-bold border-none shadow-none focus:ring-0 text-indigo-600">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="monthly">
                                    <div className="flex items-center gap-2"><Calendar size={12}/> Este Mes</div>
                                </SelectItem>
                                <SelectItem value="historical">
                                    <div className="flex items-center gap-2"><Globe size={12}/> Histórico</div>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* LISTA DE UBICACIONES (SCROLLABLE) */}
                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                        {/* HEADER TABLA (STICKY) */}
                        <div className="grid grid-cols-12 gap-2 text-[10px] uppercase font-bold text-slate-400 px-3 pb-2 border-b sticky top-0 bg-slate-50 z-10">
                            <div className="col-span-1">#</div>
                            <div className="col-span-4">Provincia</div>
                            <div className="col-span-4">Localidad</div>
                            <div className="col-span-2">CP</div>
                            <div className="col-span-1 text-right">Ventas</div>
                        </div>

                        {geoLocations.length === 0 && <p className="text-xs text-slate-400 italic py-4 text-center">No hay ventas registradas con ubicación.</p>}
                        {geoLocations.map((loc, i) => (
                            <div 
                                key={i} 
                                onClick={() => handleGeoClick(loc)}
                                className="grid grid-cols-12 gap-2 items-center p-3 rounded-lg hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 cursor-pointer transition-all group"
                            >
                                <div className="col-span-1">
                                    <Badge variant="secondary" className="h-5 w-5 p-0 flex items-center justify-center rounded-full text-[10px] bg-slate-200 text-slate-600 font-bold group-hover:bg-indigo-100 group-hover:text-indigo-600 transition-colors">
                                        {i+1}
                                    </Badge>
                                </div>
                                <div className="col-span-4">
                                    <span className="text-xs font-semibold text-slate-700 truncate block" title={loc.provincia}>{loc.provincia}</span>
                                </div>
                                <div className="col-span-4">
                                    <span className="text-xs font-bold text-slate-800 truncate block" title={loc.localidad}>{loc.localidad}</span>
                                </div>
                                <div className="col-span-2">
                                    <span className="text-[10px] font-mono font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{loc.cp}</span>
                                </div>
                                <div className="col-span-1 text-right flex items-center justify-end gap-1">
                                    <span className="text-sm font-black text-indigo-600">{loc.count}</span>
                                    <ChevronRight className="h-3 w-3 text-slate-300 group-hover:text-indigo-400 opacity-0 group-hover:opacity-100 transition-all"/>
                                </div>
                            </div>
                        ))}
                    </div>
                </CardContent>
            </Card>

            {/* --- MODAL PREMIUM DETALLE GEO --- */}
            <Dialog open={geoModalOpen} onOpenChange={setGeoModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800">
                            <Building2 className="h-5 w-5 text-indigo-500"/>
                            {selectedGeoData?.title}
                        </DialogTitle>
                        <DialogDescription>
                            {selectedGeoData?.subtitle} • Total ventas: <span className="font-bold text-indigo-600">{selectedGeoData?.total}</span>
                        </DialogDescription>
                    </DialogHeader>
                    
                    <div className="py-4">
                        <h4 className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 text-center">Mix de Prepagas en la zona</h4>
                        <div className="h-[200px] w-full relative">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie 
                                        data={selectedGeoData?.chartData} 
                                        cx="50%" 
                                        cy="50%" 
                                        innerRadius={40} 
                                        outerRadius={70} 
                                        paddingAngle={2} 
                                        dataKey="value"
                                    >
                                        {selectedGeoData?.chartData.map((entry:any, index:any) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomChartTooltip />} />
                                    <Legend 
                                        layout="vertical" 
                                        verticalAlign="middle" 
                                        align="right" 
                                        wrapperStyle={{fontSize: '10px', fontWeight: 'bold'}}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* --- MODAL DE DESCARGA (AGREGADO) --- */}
            <Dialog open={downloadModalOpen} onOpenChange={setDownloadModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl font-black text-slate-800">
                            <FileSpreadsheet className="h-6 w-6 text-green-600"/>
                            Exportar Datos
                        </DialogTitle>
                        <DialogDescription>Elige qué datos deseas descargar en formato CSV (Excel).</DialogDescription>
                    </DialogHeader>
                    
                    <div className="grid gap-4 py-4">
                        {/* OPCION 1: LO QUE SE VE */}
                        <div 
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${downloadType === 'current' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}
                            onClick={() => setDownloadType('current')}
                        >
                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${downloadType === 'current' ? 'border-green-600' : 'border-slate-300'}`}>
                                {downloadType === 'current' && <div className="h-2 w-2 rounded-full bg-green-600" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Reporte Actual (En Pantalla)</h4>
                                <p className="text-xs text-slate-500">Descarga los datos filtrados del mes de {new Date(parseInt(selectedYear), parseInt(selectedMonth)-1).toLocaleString('es-ES', { month: 'long' })}.</p>
                            </div>
                        </div>

                        {/* OPCION 2: HISTORICO */}
                        <div 
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${downloadType === 'global' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}
                            onClick={() => setDownloadType('global')}
                        >
                            <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${downloadType === 'global' ? 'border-green-600' : 'border-slate-300'}`}>
                                {downloadType === 'global' && <div className="h-2 w-2 rounded-full bg-green-600" />}
                            </div>
                            <div>
                                <h4 className="text-sm font-bold text-slate-800">Reporte Histórico Completo</h4>
                                <p className="text-xs text-slate-500">Descarga todas las operaciones desde el inicio de los tiempos.</p>
                            </div>
                        </div>

                        {/* OPCION 3: OTRO MES */}
                        <div 
                            className={`flex flex-col gap-3 p-3 rounded-lg border cursor-pointer transition-all ${downloadType === 'custom' ? 'border-green-500 bg-green-50' : 'border-slate-200 hover:bg-slate-50'}`}
                            onClick={() => setDownloadType('custom')}
                        >
                            <div className="flex items-start gap-3">
                                <div className={`mt-0.5 h-4 w-4 rounded-full border flex items-center justify-center ${downloadType === 'custom' ? 'border-green-600' : 'border-slate-300'}`}>
                                    {downloadType === 'custom' && <div className="h-2 w-2 rounded-full bg-green-600" />}
                                </div>
                                <div>
                                    <h4 className="text-sm font-bold text-slate-800">Elegir otro mes específico</h4>
                                    <p className="text-xs text-slate-500">Selecciona un período diferente al actual.</p>
                                </div>
                            </div>
                            
                            {/* SELECTORES CUSTOM (Solo visible si está activo) */}
                            {downloadType === 'custom' && (
                                <div className="flex gap-2 pl-7 mt-1 animate-in slide-in-from-top-2">
                                    <Select value={downloadMonth} onValueChange={setDownloadMonth}>
                                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>{Array.from({length: 12}, (_, i) => i + 1).map(m => (<SelectItem key={m} value={m.toString()}>{new Date(0, m - 1).toLocaleString('es-ES', { month: 'long' }).charAt(0).toUpperCase() + new Date(0, m - 1).toLocaleString('es-ES', { month: 'long' }).slice(1)}</SelectItem>))}</SelectContent>
                                    </Select>
                                    <Select value={downloadYear} onValueChange={setDownloadYear}>
                                        <SelectTrigger className="h-8 text-xs bg-white"><SelectValue /></SelectTrigger>
                                        <SelectContent>{[currentYear, currentYear - 1].map(y => (<SelectItem key={y} value={y.toString()}>{y}</SelectItem>))}</SelectContent>
                                    </Select>
                                </div>
                            )}
                        </div>
                    </div>

                    <DialogFooter>
                        <Button variant="outline" onClick={() => setDownloadModalOpen(false)}>Cancelar</Button>
                        <Button className="bg-green-600 hover:bg-green-700 text-white font-bold" onClick={executeDownload}>
                            <Download className="mr-2 h-4 w-4"/> Descargar CSV
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    )
}