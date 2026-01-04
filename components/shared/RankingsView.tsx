"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Medal, Flame, TrendingUp, Crown } from "lucide-react"

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

        const { data, error } = await supabase
            .from("leads")
            .select("agent_name, capitas, created_at")
            .eq("status", "vendido")
            .gte("created_at", fromDate.toISOString())

        if (error) {
            console.error("Ranking fetch error:", error)
            setLoading(false)
            return
        }

        // Agrupamos por vendedor
        const map: Record<string, any> = {}

        data.forEach((l: any) => {
            const name = l.agent_name || "Sin Nombre"
            if (!map[name]) {
                map[name] = {
                    name,
                    sales: 0,
                    amount: 0,
                    streak: 0,
                }
            }
            map[name].sales += l.capitas || 1
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
        <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex justify-center items-center gap-3">
                    <Trophy className="h-10 w-10 text-yellow-500 animate-bounce" />
                    Salón de la Fama
                </h2>
                <p className="text-slate-500">
                    Ranking {period === "month" ? "Mensual" : "Anual"}
                </p>

                <div className="flex justify-center gap-2 mt-4">
                    <Button
                        size="sm"
                        variant={period === "month" ? "default" : "outline"}
                        onClick={() => setPeriod("month")}
                    >
                        Mes
                    </Button>
                    <Button
                        size="sm"
                        variant={period === "year" ? "default" : "outline"}
                        onClick={() => setPeriod("year")}
                    >
                        Año
                    </Button>
                </div>
            </div>

            {loading && (
                <div className="text-center text-slate-400">Cargando ranking...</div>
            )}

            {!loading && rankings.length === 0 && (
                <div className="text-center text-slate-400">
                    Aún no hay ventas registradas.
                </div>
            )}

            <div className="grid grid-cols-1 gap-4">
                {rankings.map((user) => (
                    <Card
                        key={user.name}
                        className={`relative overflow-hidden transition-all hover:scale-[1.02]
                            ${user.position === 1
                                ? "border-2 border-yellow-400 bg-yellow-50/30 dark:bg-yellow-900/10"
                                : "border border-slate-200"
                            }`}
                    >
                        <div className="p-4 flex items-center gap-4">
                            <div className={`text-2xl font-black w-8 text-center
                                ${user.position === 1
                                    ? "text-yellow-500"
                                    : user.position === 2
                                    ? "text-slate-400"
                                    : "text-orange-700"
                                }`}>
                                #{user.position}
                            </div>

                            <Avatar className={`h-14 w-14 border-2
                                ${user.position === 1 ? "border-yellow-400" : "border-slate-200"}`}>
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg dark:text-white">{user.name}</h3>
                                    {user.position === 1 && <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500" />}
                                    {user.streak > 3 && (
                                        <Badge variant="secondary" className="bg-orange-100 text-orange-600 flex gap-1">
                                            <Flame className="h-3 w-3" /> On Fire
                                        </Badge>
                                    )}
                                </div>
                                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">
                                    {user.level}
                                </p>
                            </div>

                            <div className="text-right">
                                <p className="text-3xl font-black text-slate-800 dark:text-white">
                                    {user.sales}
                                </p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">
                                    Ventas
                                </p>
                            </div>
                        </div>

                        <div className={`h-1.5 w-full
                            ${user.position === 1
                                ? "bg-yellow-400"
                                : user.position === 2
                                ? "bg-slate-300"
                                : "bg-orange-300"
                            }`}
                        />
                    </Card>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl text-center border border-blue-100 dark:border-blue-900">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex justify-center items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> ¡Seguí escalando!
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                    Al llegar a <b>50 ventas</b> desbloqueás el nivel <b>ORO 🥇</b>
                </p>
            </div>
        </div>
    )
}
