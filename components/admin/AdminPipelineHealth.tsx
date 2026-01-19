"use client"

import { useState, useEffect } from "react"
import { createClient } from "@supabase/supabase-js" // Ajustado para consistencia
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Sprout, Target, ThermometerSun, AlertOctagon, Send, Trash, Filter, RefreshCw, Clock, Users } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// Inicialización consistente con SellerManager
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function AdminPipelineHealth() {
    const [loading, setLoading] = useState(true)

    // IDs calculados (para que AVISAR/CEMENTERIO impacten SOLO el universo Seller)
    const [freshZombieIds, setFreshZombieIds] = useState<string[]>([])
    const [killableZombieIds, setKillableZombieIds] = useState<string[]>([])
    
    // Filtros
    const currentYear = new Date().getFullYear()
    const [selectedMonth, setSelectedMonth] = useState((new Date().getMonth() + 1).toString())
    const [selectedYear, setSelectedYear] = useState(currentYear.toString())
    const years = Array.from({ length: 5 }, (_, i) => (2024 + i).toString())

    // ESTADOS
    const [stats, setStats] = useState({
        freshZombies: 0,      // +72hs sin aviso (Listos para avisar)
        pendingZombies: 0,    // Avisados hace menos de 24hs (En gracia)
        killableZombies: 0,   // Avisados hace +24hs (Listos para cementerio)
        totalZombies: 0,
        coverage: 0,
        agentsRatio: [] as any[]
    })

    const fetchData = async () => {
        setLoading(true)
        // Reset de IDs para evitar acciones sobre resultados viejos si falla un fetch
        setFreshZombieIds([])
        setKillableZombieIds([])

        // --- UNIVERSOS ---
        // Seller (Kanban) vs OPS (intocable).
        // Nota: 'documentacion' existe en ambos mundos, por eso hay que desambiguar con lead_status_history.
        const SELLER_STATUSES = ['nuevo', 'contactado', 'cotizacion', 'documentacion']
        const OPS_STATUSES = ['ingresado', 'precarga', 'medicas', 'legajo', 'demoras', 'cumplidas', 'rechazado', 'postventa', 'liquidacion final']
        
        // 1) CARTERA SELLER (solo kanban seller)
        // Importante: acá NO se deben traer estados OPS.
        const { data: rawSellerLeads } = await supabase
            .from('leads')
            .select('*')
            .in('status', SELLER_STATUSES)
            .neq('agent_name', 'Zombie 🧟')

        // 1.1) Desambiguación de DOCUMENTACION (si ya tocó OPS, NO aparece en Salud del Tubo)
        let activeLeads = rawSellerLeads ?? []
        try {
            const docIds = activeLeads
                .filter((l: any) => l?.status === 'documentacion' && l?.id)
                .map((l: any) => l.id as string)

            if (docIds.length > 0) {
                const { data: docOpsRows } = await supabase
                    .from('lead_status_history')
                    .select('lead_id')
                    .in('lead_id', docIds)
                    .in('to_status', OPS_STATUSES)

                const docOpsSet = new Set((docOpsRows ?? []).map((r: any) => r.lead_id))
                activeLeads = activeLeads.filter((l: any) => !(l?.status === 'documentacion' && docOpsSet.has(l.id)))
            }
        } catch {
            // Si algo falla acá, preferimos NO romper el panel.
            // (Quedará como estaba, pero sin afectar OPS porque AVISAR/CEMENTERIO se hará por IDs calculados.)
        }

        // 2. VENTAS DEL MES
        const startDate = new Date(parseInt(selectedYear), parseInt(selectedMonth) - 1, 1).toISOString()
        const endDate = new Date(parseInt(selectedYear), parseInt(selectedMonth), 0, 23, 59, 59).toISOString()
        
        // Lógica ajustada: Cuenta como venta si está 'vendido' (en GV), 'cumplidas' o 'finalizada'
        const { data: salesInMonth } = await supabase
            .from('leads')
            .select('agent_name')
            .in('status', ['vendido', 'cumplidas', 'finalizada'])
            .gte('last_update', startDate)
            .lte('last_update', endDate)

        if (activeLeads && salesInMonth) {
            const now = new Date()
            
            // --- LÓGICA ZOMBIE REFINADA ---
            const allZombies = activeLeads.filter(l => {
                const lastUp = new Date(l.last_update || l.created_at)
                const diffHours = (now.getTime() - lastUp.getTime()) / (1000 * 60 * 60)
                return diffHours > 72 // +3 días sin tocar
            })

            // 1. Frescos: No tienen aviso
            const freshList = allZombies.filter(z => !z.warning_sent)
            const fresh = freshList.length

            // 2. Avisados: Tienen aviso
            const warned = allZombies.filter(z => z.warning_sent)

            // Desglose de avisados por tiempo (Regla de 24hs)
            let pending = 0
            let killable = 0

            const killableIds: string[] = []
            warned.forEach(z => {
                if (z.warning_date) {
                    const warnDate = new Date(z.warning_date)
                    const hoursSinceWarn = (now.getTime() - warnDate.getTime()) / (1000 * 60 * 60)
                    
                    if (hoursSinceWarn < 24) {
                        pending++ // En periodo de gracia
                    } else {
                        killable++ // Pasaron 24hs, listos para cementerio
                        if (z.id) killableIds.push(z.id)
                    }
                } else {
                    killable++
                    if (z.id) killableIds.push(z.id)
                }
            })

            // Guardamos IDs para acciones seguras (solo Seller)
            setFreshZombieIds(freshList.map((z: any) => z.id).filter(Boolean))
            setKillableZombieIds(killableIds)

            // --- RATIOS Y COBERTURA ---
            const agentsWithStock = activeLeads.map(l => l.agent_name).filter(Boolean)
            const agentsWithSales = salesInMonth.map(l => l.agent_name).filter(Boolean)
            
            const allAgents = [...new Set([...agentsWithStock, ...agentsWithSales])]
                .filter(name => name !== 'Recupero' && name !== 'Sistema' && name !== 'Zombie 🧟')

            const ratios = allAgents.map(agent => {
                const currentStock = activeLeads.filter(l => l.agent_name === agent).length
                const monthSales = salesInMonth.filter(l => l.agent_name === agent).length
                const totalManaged = currentStock + monthSales
                const ratioVal = monthSales > 0 ? Math.round(totalManaged / monthSales) : totalManaged
                
                let color = "bg-blue-500"
                if (monthSales === 0) {
                    color = currentStock > 0 ? "bg-red-500" : "bg-slate-300"
                } else if (ratioVal <= 15) { 
                    color = "bg-green-500" 
                } else if (ratioVal > 30) { 
                    color = "bg-orange-500" 
                }

                return { name: agent, ratio: ratioVal, color, stock: currentStock, sales: monthSales }
            }).sort((a, b) => b.stock - a.stock)

            const coverage = Math.min(100, Math.round((activeLeads.length / 200) * 100))

            setStats({
                freshZombies: fresh,
                pendingZombies: pending,
                killableZombies: killable,
                totalZombies: allZombies.length,
                coverage,
                agentsRatio: ratios
            })
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedMonth, selectedYear])

    // --- ACCIÓN 1: AVISAR ---
    const handleSendWarning = async () => {
        if (freshZombieIds.length === 0) {
            alert("No hay leads para avisar.")
            return
        }
        if (!confirm(`¿Enviar alerta a los dueños de ${freshZombieIds.length} leads estancados?`)) return

        const nowIso = new Date().toISOString()

        // IMPORTANTE: update SOLO por IDs calculados en fetchData (universo Seller)
        const { error } = await supabase
            .from('leads')
            .update({
                warning_sent: true,
                warning_date: nowIso,
                last_update: nowIso,
            })
            .in('id', freshZombieIds)
            .is('warning_sent', false)
        
        if (error) alert("Error al enviar avisos: " + error.message)
        else fetchData()
    }

    // --- ACCIÓN 2: MOVER A CEMENTERIO ---
    const handleExecuteKill = async () => {
        if (killableZombieIds.length === 0) {
            alert("No hay leads listos para cementerio.")
            return
        }
        if (!confirm(`¿Mover ${killableZombieIds.length} leads al Cementerio Zombie 🧟?\nSolo se moverán los que recibieron aviso hace más de 24hs.`)) return

        // IMPORTANTE: update SOLO por IDs calculados en fetchData (universo Seller)
        const { error } = await supabase
            .from('leads')
            .update({
                agent_name: 'Zombie 🧟',
                status: 'nuevo',
                warning_sent: false,
                warning_date: null,
                notes: `[ZOMBIE]: Recuperado por inactividad post-aviso.`,
                last_update: new Date().toISOString(),
            })
            .in('id', killableZombieIds)
            .eq('warning_sent', true)
        
        if (error) alert("Error al mover al cementerio: " + error.message)
        else fetchData()
    }

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-8 pb-20">
            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                        <ThermometerSun className="h-8 w-8 text-orange-500" /> Salud del Tubo
                        {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400"/>}
                    </h2>
                    <p className="text-slate-500 font-medium">Estado real de la cartera activa.</p>
                </div>
                
                <div className="flex gap-2 bg-white dark:bg-slate-900 p-2 rounded-xl border shadow-sm items-center">
                    <Filter className="h-4 w-4 text-slate-400 ml-1" />
                    <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                        <SelectTrigger className="w-[120px] font-bold border-none h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"].map((m, i) => (
                                <SelectItem key={i} value={(i+1).toString()}>{m}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <div className="h-4 w-px bg-slate-200"></div>
                    <Select value={selectedYear} onValueChange={setSelectedYear}>
                        <SelectTrigger className="w-[90px] font-bold border-none h-8"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            {/* 1. NIVEL DE SIEMBRA */}
            <Card className="border-t-4 border-t-green-500 shadow-lg dark:bg-[#1e1e1e]">
                <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-lg">
                        <Sprout className="h-5 w-5 text-green-600" /> Nivel de Siembra (Stock Activo)
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="flex justify-between items-end mb-2">
                        <div>
                            <p className="text-4xl font-black text-slate-800 dark:text-white">{stats.coverage}%</p>
                            <p className="text-xs text-slate-400 uppercase font-bold">Ocupación Cartera Global (Meta: 200 Leads)</p>
                        </div>
                        <Badge variant="outline" className={stats.coverage > 80 ? "bg-green-100 text-green-700 border-green-200" : "bg-blue-100 text-blue-700 border-blue-200"}>
                            {stats.coverage >= 100 ? 'Cartera Llena' : 'Espacio Disponible'}
                        </Badge>
                    </div>
                    <Progress value={stats.coverage} className="h-4 bg-slate-100 dark:bg-slate-800" />
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2. ZOMBIES (LÓGICA MEJORADA) */}
                <Card className="border-t-4 border-t-red-500 shadow-lg dark:bg-[#1e1e1e]">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-lg">
                            <AlertTriangle className="h-5 w-5 text-red-500" /> Gestión de Zombies
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-6">
                            <div className="p-4 bg-red-100 rounded-full border-2 border-red-200 dark:bg-red-900/20 dark:border-red-900"><AlertOctagon className="h-8 w-8 text-red-600" /></div>
                            <div>
                                <p className="text-4xl font-black text-red-600">{stats.totalZombies}</p>
                                <p className="text-xs font-bold text-slate-500 uppercase">Total Leads Estancados</p>
                            </div>
                        </div>
                        
                        <div className="space-y-3">
                            {/* BOTÓN 1: AVISAR */}
                            <div className="flex gap-2 items-center">
                                <Button 
                                    className="flex-1 bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold" 
                                    onClick={handleSendWarning} 
                                    disabled={stats.freshZombies === 0}
                                >
                                    <Send className="h-4 w-4 mr-2"/> AVISAR ({stats.freshZombies})
                                </Button>
                                {/* Tooltip Nativo */}
                                <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded-full text-slate-400 cursor-help" title="Envía alerta y espera 24hs para habilitar el recupero.">
                                    <Clock className="h-4 w-4"/>
                                </div>
                            </div>

                            {/* BOTÓN 2: RECUPERAR (CON LÓGICA 24HS) */}
                            <div className="flex gap-2 items-center">
                                <Button 
                                    className="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold" 
                                    onClick={handleExecuteKill} 
                                    disabled={stats.killableZombies === 0}
                                >
                                    <Trash className="h-4 w-4 mr-2"/> CEMENTERIO ({stats.killableZombies})
                                </Button>
                                {stats.pendingZombies > 0 && (
                                    <div className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded border border-orange-200 animate-pulse">
                                        ⏳ {stats.pendingZombies} en espera 24hs
                                    </div>
                                )}
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* 3. RATIO DE TIRO */}
                <Card className="border-t-4 border-t-blue-500 shadow-lg flex flex-col dark:bg-[#1e1e1e]">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200 text-lg">
                            <Target className="h-5 w-5 text-blue-500" /> Eficiencia de Cartera
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col min-h-0">
                        <div className="flex justify-between items-center mb-4">
                            <p className="text-xs text-slate-500">Leads gestionados para lograr <b>1 venta</b>.</p>
                            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded border border-blue-100">Obj: &lt; 25</span>
                        </div>
                        
                        <div className="space-y-3 overflow-y-auto pr-2 custom-scrollbar flex-1 max-h-[250px]">
                            {stats.agentsRatio.length > 0 ? stats.agentsRatio.map((agent: any) => (
                                <div key={agent.name} className="flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded-lg transition-colors border border-transparent hover:border-slate-100 dark:hover:border-slate-800">
                                    <Avatar className="h-8 w-8 border border-slate-200 shadow-sm">
                                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} />
                                        <AvatarFallback className="text-[9px] font-bold">{agent.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <div className="flex-1 space-y-1">
                                        <div className="flex justify-between text-xs items-center">
                                            <div>
                                                <span className="font-bold text-slate-700 dark:text-slate-300 block">{agent.name}</span>
                                                <span className="text-[9px] text-slate-400 uppercase font-bold flex gap-2">
                                                    <span>Stock: {agent.stock}</span>
                                                    <span className="text-green-600">Ventas: {agent.sales}</span>
                                                </span>
                                            </div>
                                            <Badge variant="outline" className={`font-mono text-[10px] ${agent.sales === 0 ? "border-red-200 text-red-600 bg-red-50" : "border-green-200 text-green-700 bg-green-50"}`}>
                                                {agent.sales === 0 ? "0 Vtas" : `1:${agent.ratio}`}
                                            </Badge>
                                        </div>
                                        <div className="h-1.5 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                            <div className={`h-full ${agent.color} transition-all duration-500`} style={{width: `${agent.sales === 0 ? 100 : Math.min((agent.ratio / 50) * 100, 100)}%`}}></div>
                                        </div>
                                    </div>
                                </div>
                            )) : (
                                <div className="flex flex-col items-center py-8 text-slate-400">
                                    <Users className="h-8 w-8 mb-2 opacity-30"/>
                                    <p className="text-xs font-medium">Sin agentes con stock activo.</p>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}