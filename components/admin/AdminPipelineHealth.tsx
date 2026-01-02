"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { AlertTriangle, Sprout, Target, ThermometerSun, AlertOctagon, TrendingUp, Send, Trash, Check, Lock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

export function AdminPipelineHealth() {
    // ESTADO SIMULADO DE ZOMBIES
    // warningSent: false (Fresco) | true (Condenado)
    const [zombies, setZombies] = useState([
        { id: 1, name: "Lead A", warningSent: false },
        { id: 2, name: "Lead B", warningSent: false },
        { id: 3, name: "Lead C", warningSent: true }, // Ya avisado
        { id: 4, name: "Lead D", warningSent: true }, // Ya avisado
        // ... imaginemos que hay 42 en total
    ])

    // CONTADORES INTELIGENTES
    // 30 Condenados (Simulados para el ejemplo visual)
    const warnedCount = 30 
    // 12 Frescos (Simulados)
    const freshCount: number = 12
    const totalZombies = warnedCount + freshCount

    const handleSendWarning = () => {
        alert(`🔔 AVISO ENVIADO: Se notificó a las vendedoras sobre ${freshCount} leads en riesgo.\n\nLes aparecerá un cartel bloqueante: "Actualizá estos datos HOY o se pierden".`)
        // En la vida real, acá hacemos: UPDATE leads SET warning_sent = true, warning_date = NOW() WHERE ...
    }

    const handleExecuteKill = () => {
        alert(`💀 EJECUCIÓN: Se recuperaron ${warnedCount} leads que tenían aviso previo y no se movieron.\n\nFueron enviados a la Bandeja de Entrada como [RECUPERO].`)
        // En la vida real: UPDATE leads SET agent_name = 'Sin Asignar', status = 'nuevo', source = 'Recupero' WHERE warning_sent = true
    }

    // DATOS DE RATIO VENDEDORAS
    const agentsRatio = [
        { name: "Brenda", ratio: 12, label: "Francotiradora", color: "bg-green-500", status: "Excelente" },
        { name: "Maca", ratio: 15, label: "Muy Eficiente", color: "bg-green-500", status: "Excelente" },
        { name: "Sofi", ratio: 20, label: "Estándar", color: "bg-blue-500", status: "Normal" },
        { name: "Lucas", ratio: 35, label: "Desgaste", color: "bg-yellow-500", status: "Atención" },
        { name: "Cami", ratio: 40, label: "Alto Esfuerzo", color: "bg-orange-500", status: "Revisar" },
        { name: "Gonza", ratio: 65, label: "Ametralladora", color: "bg-red-500", status: "Crítico" },
    ]

    return (
        <div className="p-6 h-full overflow-y-auto max-w-6xl mx-auto space-y-8">
            <div className="flex justify-between items-end">
                <div><h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2"><ThermometerSun className="h-8 w-8 text-orange-500" /> Salud del Tubo (Pipeline)</h2><p className="text-slate-500">Indicadores predictivos para evitar el "Efecto Serrucho".</p></div>
                <div className="bg-green-100 text-green-800 px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 border border-green-200"><TrendingUp className="h-4 w-4" /> Pronóstico Mes Próximo: ESTABLE</div>
            </div>

            {/* 1. NIVEL DE SIEMBRA */}
            <Card className="border-t-4 border-t-green-500 shadow-lg"><CardHeader><CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Sprout className="h-5 w-5 text-green-600" /> Nivel de Siembra (Futuro)</CardTitle></CardHeader><CardContent><div className="flex justify-between items-end mb-2"><div><p className="text-4xl font-black text-slate-800 dark:text-white">125%</p><p className="text-xs text-slate-400 uppercase font-bold">Cobertura de Cuota</p></div><p className="text-sm font-bold text-green-600">Exceso de Leads (+25%)</p></div><Progress value={100} className="h-4 bg-slate-100" /><div className="mt-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg text-sm text-slate-600 dark:text-slate-400"><p>Tenés <b>150 prospectos frescos</b> ingresados esta semana.</p><p className="font-bold text-green-600 mt-1">✅ El equipo está sembrando correctamente.</p></div></CardContent></Card>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* 2. ZOMBIES INTELIGENTES (Lógica Doble Instancia) */}
                <Card className="border-t-4 border-t-red-500 shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><AlertTriangle className="h-5 w-5 text-red-500" /> Detector de Zombies</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex items-center gap-4 mb-4">
                            <div className="p-4 bg-red-100 rounded-full"><AlertOctagon className="h-8 w-8 text-red-600" /></div>
                            <div>
                                <p className="text-3xl font-black text-red-600">{totalZombies}</p>
                                <p className="text-xs font-bold text-slate-500 uppercase">Leads Estancados Total</p>
                            </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-3 mt-6">
                            {/* INSTANCIA 1: AVISO */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                    <span>Frescos (Sin aviso)</span>
                                    <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">{freshCount}</Badge>
                                </div>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-auto py-3 flex flex-col items-center gap-1 border-yellow-300 bg-yellow-50 hover:bg-yellow-100 text-yellow-800 shadow-sm"
                                    onClick={handleSendWarning}
                                    disabled={freshCount === 0}
                                >
                                    <span className="flex items-center gap-2 font-bold"><Send className="h-4 w-4"/> Enviar Aviso</span>
                                    <span className="text-[10px] opacity-70">Notificación Bloqueante</span>
                                </Button>
                            </div>

                            {/* INSTANCIA 2: EJECUCIÓN */}
                            <div className="space-y-2">
                                <div className="flex justify-between text-xs font-bold text-slate-600">
                                    <span>Condenados (Ya avisados)</span>
                                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">{warnedCount}</Badge>
                                </div>
                                <Button 
                                    variant="outline" 
                                    className="w-full h-auto py-3 flex flex-col items-center gap-1 border-red-300 bg-red-50 hover:bg-red-100 text-red-800 shadow-sm"
                                    onClick={handleExecuteKill}
                                    disabled={warnedCount === 0}
                                >
                                    <span className="flex items-center gap-2 font-bold"><Trash className="h-4 w-4"/> Ejecutar</span>
                                    <span className="text-[10px] opacity-70">Forzar Recupero</span>
                                </Button>
                            </div>
                        </div>
                        
                        <div className="mt-4 p-2 bg-slate-50 rounded border text-[10px] text-slate-400 text-center">
                            * El sistema solo permite ejecutar a quienes ya recibieron el aviso hace +24hs.
                        </div>

                    </CardContent>
                </Card>

                {/* 3. RATIO DE TIRO (LISTA COMPLETA) */}
                <Card className="border-t-4 border-t-blue-500 shadow-lg">
                    <CardHeader><CardTitle className="flex items-center gap-2 text-slate-700 dark:text-slate-200"><Target className="h-5 w-5 text-blue-500" /> Ratio de Tiro (Eficiencia)</CardTitle></CardHeader>
                    <CardContent>
                        <div className="flex justify-between items-center mb-4"><p className="text-xs text-slate-500">Leads necesarios para <b>1 venta</b>.</p><span className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded">Obj: &lt; 25</span></div>
                        <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                            {agentsRatio.map((agent) => (
                                <div key={agent.name} className="flex items-center gap-3">
                                    <Avatar className="h-8 w-8 border border-slate-200"><AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${agent.name}`} /><AvatarFallback>{agent.name[0]}</AvatarFallback></Avatar>
                                    <div className="flex-1 space-y-1"><div className="flex justify-between text-xs"><span className="font-bold text-slate-700 dark:text-slate-200">{agent.name}</span><span className={`font-mono font-bold ${agent.ratio > 40 ? 'text-red-500' : agent.ratio > 25 ? 'text-yellow-600' : 'text-green-600'}`}>1:{agent.ratio} ({agent.status})</span></div><div className="h-2 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden"><div className={`h-full ${agent.color}`} style={{width: `${Math.min((agent.ratio / 70) * 100, 100)}%`}}></div></div></div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}