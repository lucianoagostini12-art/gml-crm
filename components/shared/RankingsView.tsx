"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Flame, TrendingUp, Crown } from "lucide-react"

type Period = "month" | "year"

export function RankingsView() {
    const supabase = createClient()

    const [rankings, setRankings] = useState<any[]>([])
    const [period, setPeriod] = useState<Period>("month")
    const [loading, setLoading] = useState(true)

    const fetchRankings = async () => {
        setLoading(true)

        const now = new Date()
        let fromDate: Date

        if (period === "month") {
            fromDate = new Date(now.getFullYear(), now.getMonth(), 1)
        } else {
            fromDate = new Date(now.getFullYear(), 0, 1)
        }

        // ✅ CORRECCIÓN: Filtramos por TODOS los estados de éxito, no solo 'vendido'
        // Esto asegura consistencia con el Dashboard personal
        const successStatuses = ['ingresado', 'vendido', 'cumplidas', 'legajo', 'medicas', 'precarga']
        
        const { data, error } = await supabase
            .from("leads")
            .select("agent_name, capitas, created_at, status")
            .gte("created_at", fromDate.toISOString())

        if (error) {
            console.error("Ranking fetch error:", error)
            setLoading(false)
            return
        }

        // Agrupamos por vendedor (filtrando localmente los estados para mayor flexibilidad)
        const map: Record<string, any> = {}

        data.filter((l: any) => successStatuses.includes(l.status)).forEach((l: any) => {
            const name = l.agent_name || "Sin Nombre"
            if (!map[name]) {
                map[name] = {
                    name,
                    sales: 0,
                    amount: 0,
                    streak: 0,
                }
            }
            // Sumamos cápitas reales, default 1 si no hay dato
            map[name].sales += Number(l.capitas) || 1
        })

        // Convertimos a array + ordenamos
        const array = Object.values(map)
            .sort((a: any, b: any) => b.sales - a.sales)
            .map((u: any, i: number) => ({
                ...u,
                position: i + 1,
                level:
                    u.sales >= 50 ? "ORO 🥇" :
                    u.sales >= 25 ? "PLATA 🥈" :
                    u.sales >= 10 ? "BRONCE 🥉" :
                    "INICIO 🚀",
                // Lógica simple de racha: simulamos 'on fire' si tiene muchas ventas
                streak: u.sales >= 5 ? Math.min(u.sales, 10) : 0
            }))

        setRankings(array)
        setLoading(false)
    }

    useEffect(() => {
        fetchRankings()

        const channel = supabase
            .channel("rankings_realtime")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "leads" },
                () => fetchRankings()
            )
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [period])

    return (
        <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto space-y-6 text-slate-900 dark:text-slate-100">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-black flex justify-center items-center gap-3">
                    <Trophy className="h-10 w-10 text-yellow-500 animate-bounce" />
                    Salón de la Fama
                </h2>
                <p className="text-slate-500 font-medium">
                    Ranking {period === "month" ? "Mensual" : "Anual"} de Cápitas
                </p>

                <div className="flex justify-center gap-2 mt-4 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg w-fit mx-auto">
                    <Button
                        size="sm"
                        variant={period === "month" ? "default" : "ghost"}
                        onClick={() => setPeriod("month")}
                        className="text-xs font-bold"
                    >
                        Mes Actual
                    </Button>
                    <Button
                        size="sm"
                        variant={period === "year" ? "default" : "ghost"}
                        onClick={() => setPeriod("year")}
                        className="text-xs font-bold"
                    >
                        Acumulado Año
                    </Button>
                </div>
            </div>

            {loading && (
                <div className="text-center text-slate-400 py-10 animate-pulse">Calculando posiciones...</div>
            )}

            {!loading && rankings.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">Aún no hay ventas registradas en este período.</p>
                    <p className="text-xs text-slate-400 mt-1">¡Sé el primero en aparecer acá!</p>
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {rankings.map((user) => (
                    <Card
                        key={user.name}
                        className={`relative overflow-hidden transition-all hover:scale-[1.01] hover:shadow-lg cursor-default group
                            ${user.position === 1
                                ? "border-2 border-yellow-400 bg-yellow-50/50 dark:bg-yellow-900/10 shadow-md"
                                : "border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                            }`}
                    >
                        {/* DECORACIÓN TOP 1 */}
                        {user.position === 1 && (
                            <div className="absolute -right-4 -top-4 w-20 h-20 bg-yellow-400/20 rounded-full blur-xl animate-pulse"></div>
                        )}

                        <div className="p-4 flex items-center gap-4 relative z-10">
                            {/* POSICIÓN */}
                            <div className={`text-3xl font-black w-12 text-center flex flex-col items-center justify-center
                                ${user.position === 1 ? "text-yellow-500 drop-shadow-sm scale-110" : 
                                  user.position === 2 ? "text-slate-400" : 
                                  user.position === 3 ? "text-orange-700" : "text-slate-300 text-2xl"
                                }`}>
                                #{user.position}
                            </div>

                            {/* AVATAR */}
                            <div className="relative">
                                <Avatar className={`h-14 w-14 border-2 shadow-sm
                                    ${user.position === 1 ? "border-yellow-400 ring-2 ring-yellow-400/30" : "border-slate-200"}`}>
                                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                                    <AvatarFallback className="font-bold text-slate-500">{user.name[0]}</AvatarFallback>
                                </Avatar>
                                {user.position === 1 && (
                                    <div className="absolute -top-3 -right-1 animate-bounce">
                                        <Crown className="h-6 w-6 text-yellow-500 fill-yellow-500 drop-shadow-md" />
                                    </div>
                                )}
                            </div>

                            {/* DATOS */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-black text-lg text-slate-800 dark:text-white truncate">{user.name}</h3>
                                    {user.streak > 3 && (
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-600 border-orange-200 flex gap-1 px-1.5 h-5 text-[10px]">
                                            <Flame className="h-3 w-3 fill-orange-500" /> ON FIRE
                                        </Badge>
                                    )}
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs font-bold text-slate-500 uppercase tracking-wider bg-slate-100 px-2 py-0.5 rounded">
                                        {user.level}
                                    </span>
                                </div>
                            </div>

                            {/* PUNTAJE */}
                            <div className="text-right">
                                <p className="text-4xl font-black text-slate-800 dark:text-white tracking-tighter leading-none">
                                    {user.sales}
                                </p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">
                                    Cápitas
                                </p>
                            </div>
                        </div>

                        {/* BARRA PROGRESO INFERIOR */}
                        <div className={`h-1.5 w-full absolute bottom-0 left-0
                            ${user.position === 1 ? "bg-yellow-400" : 
                              user.position === 2 ? "bg-slate-300" : 
                              user.position === 3 ? "bg-orange-400" : "bg-slate-100"
                            }`}
                        />
                    </Card>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl text-center border border-blue-100 dark:border-blue-900 shadow-sm mt-8">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex justify-center items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> ¡Seguí escalando!
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                    Al llegar a <b>50 cápitas</b> desbloqueás el nivel <b>ORO 🥇</b>
                </p>
            </div>
        </div>
    )
}