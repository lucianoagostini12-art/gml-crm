"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ShieldAlert, AlertTriangle, UserX, Clock } from "lucide-react"

export function AdminLogs() {
    // LOGS SIMULADOS DE COMPORTAMIENTO
    const logs = [
        { id: 1, type: "warning", user: "Gonza", action: "Descarte Masivo", details: "Pasó 15 leads a 'Perdido' en 1 minuto.", time: "10:45 AM" },
        { id: 2, type: "info", user: "Maca", action: "Edición Post-Cierre", details: "Editó precio de venta #1234 (Ya estaba cerrada).", time: "11:20 AM" },
        { id: 3, type: "critical", user: "Lucas", action: "Login Extraño", details: "Intento de acceso a las 03:00 AM.", time: "03:00 AM" },
        { id: 4, type: "info", user: "Sistema", action: "Zombie Kill", details: "Limpieza automática de 42 leads.", time: "09:00 AM" },
    ]

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-6">
            <div>
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
                    <ShieldAlert className="h-8 w-8 text-red-600" /> Auditoría de Seguridad
                </h2>
                <p className="text-slate-500">Detección de anomalías y comportamiento sospechoso.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="md:col-span-2">
                    <CardHeader><CardTitle>Registro de Eventos</CardTitle></CardHeader>
                    <CardContent className="p-0">
                        <ScrollArea className="h-[500px]">
                            <div className="divide-y">
                                {logs.map((log) => (
                                    <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                                        <div className={`p-2 rounded-full shrink-0 ${log.type === 'critical' ? 'bg-red-100 text-red-600' : log.type === 'warning' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                                            {log.type === 'critical' ? <UserX className="h-5 w-5"/> : <AlertTriangle className="h-5 w-5"/>}
                                        </div>
                                        <div className="flex-1">
                                            <div className="flex justify-between">
                                                <p className="font-bold text-sm text-slate-800">{log.action}</p>
                                                <span className="text-xs font-mono text-slate-400 flex items-center gap-1"><Clock className="h-3 w-3"/> {log.time}</span>
                                            </div>
                                            <p className="text-xs text-slate-600 mt-1"><span className="font-bold">{log.user}:</span> {log.details}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>

                <Card className="bg-red-50 border-red-200">
                    <CardHeader><CardTitle className="text-red-800 text-lg">Alertas Activas</CardTitle></CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                <p className="font-bold text-red-600 text-sm">Descartes Rápidos</p>
                                <p className="text-xs text-slate-500">Monitor activo: Si un agente descarta +5 leads en 2 minutos, se notifica.</p>
                            </div>
                            <div className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                                <p className="font-bold text-red-600 text-sm">Edición de Ventas</p>
                                <p className="text-xs text-slate-500">Monitor activo: Cualquier cambio en una venta "Cerrada" queda registrado.</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    )
}