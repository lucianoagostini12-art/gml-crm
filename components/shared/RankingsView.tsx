"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Trophy, Flame, TrendingUp, Crown, Star, Users, ArrowUpCircle } from "lucide-react"

type Period = "month" | "year"
type Metric = "capitas" | "prevencion"

export function RankingsView() {
    const supabase = createClient()

    const [rankings, setRankings] = useState<any[]>([])
    const [period, setPeriod] = useState<Period>("month")
    const [metric, setMetric] = useState<Metric>("capitas")
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

        // 1. Traemos ventas (sin campos de dinero, solo lo necesario)
        const { data: leadsData, error } = await supabase
            .from("leads")
            .select("agent_name, capitas, created_at, status, prepaga, source")
            .gte("created_at", fromDate.toISOString())

        if (error) {
            console.error("Ranking fetch error:", error)
            setLoading(false)
            return
        }

        // 2. Traemos perfiles para avatares
        const { data: profilesData } = await supabase
            .from("profiles")
            .select("full_name, avatar_url")
        
        const avatarMap: Record<string, string> = {}
        if (profilesData) {
            profilesData.forEach(p => {
                if (p.full_name) avatarMap[p.full_name] = p.avatar_url
            })
        }

        // Agrupamos
        const map: Record<string, any> = {}

        if (leadsData) {
            leadsData
                .filter((l: any) => l.status === 'cumplidas' && l.source !== 'pass')
                .forEach((l: any) => {
                    const name = l.agent_name || "Sin Nombre"
                    if (!map[name]) {
                        map[name] = {
                            name,
                            capitas: 0,        // Volumen Total
                            prevencionCount: 0, // Calidad (Prevención)
                            streak: 0,
                        }
                    }

                    // --- CÁLCULO VOLUMEN (CÁPITAS) ---
                    const isAMPF = l.prepaga && l.prepaga.includes("AMPF")
                    const points = isAMPF ? 1 : (Number(l.capitas) || 1)
                    map[name].capitas += points

                    // --- CÁLCULO CALIDAD (PREVENCIÓN SALUD) ---
                    if (l.prepaga && l.prepaga.toLowerCase().includes("prevenci")) {
                        map[name].prevencionCount += 1 // Cuenta cantidad de ventas, no cápitas
                    }
                })

            // Array inicial para ordenar
            let array = Object.values(map)

            // Ordenamiento dinámico
            array.sort((a: any, b: any) => {
                if (metric === "capitas") return b.capitas - a.capitas
                return b.prevencionCount - a.prevencionCount
            })

            // Procesamiento final (Posición y "Aliento en la Nuca")
            const finalRankings = array.map((u: any, i: number) => {
                const score = metric === 'capitas' ? u.capitas : u.prevencionCount
                
                // Calcular distancia con el anterior (si no es el primero)
                let gapToNext = null
                if (i > 0) {
                    const prevUser = array[i - 1]
                    const prevScore = metric === 'capitas' ? prevUser.capitas : prevUser.prevencionCount
                    gapToNext = {
                        diff: prevScore - score,
                        name: prevUser.name.split(" ")[0] // Solo primer nombre para que entre
                    }
                }

                return {
                    ...u,
                    position: i + 1,
                    score, // El valor que se muestra
                    gapToNext, // Info para el "Aliento en la nuca"
                    level:
                        u.capitas >= 50 ? "ORO 🥇" :
                        u.capitas >= 25 ? "PLATA 🥈" :
                        u.capitas >= 10 ? "BRONCE 🥉" :
                        "INICIO 🚀",
                    streak: u.capitas >= 5 ? Math.min(u.capitas, 10) : 0,
                    avatar: avatarMap[u.name] || `https://api.dicebear.com/7.x/avataaars/svg?seed=${u.name}`
                }
            })

            setRankings(finalRankings)
        }
        setLoading(false)
    }

    useEffect(() => {
        fetchRankings()
        const channel = supabase.channel("rankings_realtime")
            .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchRankings())
            .subscribe()
        return () => { supabase.removeChannel(channel) }
    }, [period, metric])

    // Separamos el podio del resto
    const top1 = rankings.find(r => r.position === 1)
    const top2 = rankings.find(r => r.position === 2)
    const top3 = rankings.find(r => r.position === 3)
    const restOfTeam = rankings.filter(r => r.position > 3)

    return (
        <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-8 text-slate-900 dark:text-slate-100 pb-20">
            
            {/* HEADER & SWITCHES */}
            <div className="flex flex-col items-center gap-4 mb-8">
                <div className="text-center">
                    <h2 className="text-3xl font-black flex justify-center items-center gap-3 text-slate-800">
                        {metric === 'capitas' ? <Trophy className="h-8 w-8 text-yellow-500" /> : <Star className="h-8 w-8 text-green-500 fill-green-500" />}
                        Salón de la Fama
                    </h2>
                    <p className="text-slate-500 font-medium text-sm mt-1">
                        Ranking Oficial {period === "month" ? "Mensual" : "Anual"}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    {/* Period Switch */}
                    <div className="bg-slate-100 p-1 rounded-lg flex">
                        <Button size="sm" variant={period === "month" ? "default" : "ghost"} onClick={() => setPeriod("month")} className="text-xs font-bold h-8">Mes</Button>
                        <Button size="sm" variant={period === "year" ? "default" : "ghost"} onClick={() => setPeriod("year")} className="text-xs font-bold h-8">Año</Button>
                    </div>

                    {/* Metric Switch */}
                    <div className="bg-white border border-slate-200 p-1 rounded-lg flex shadow-sm">
                        <Button 
                            size="sm" 
                            variant={metric === "capitas" ? "secondary" : "ghost"} 
                            onClick={() => setMetric("capitas")} 
                            className={`text-xs font-bold h-8 gap-2 ${metric === 'capitas' ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'text-slate-500'}`}
                        >
                            <Users size={14}/> Volumen (Cápitas)
                        </Button>
                        <Button 
                            size="sm" 
                            variant={metric === "prevencion" ? "secondary" : "ghost"} 
                            onClick={() => setMetric("prevencion")} 
                            className={`text-xs font-bold h-8 gap-2 ${metric === 'prevencion' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'text-slate-500'}`}
                        >
                            <Star size={14}/> Prevención Salud
                        </Button>
                    </div>
                </div>
            </div>

            {loading && <div className="text-center text-slate-400 py-20 animate-pulse">Calculando posiciones...</div>}

            {!loading && rankings.length === 0 && (
                <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
                    <p className="text-slate-400 font-medium">No hay ventas registradas para este criterio.</p>
                </div>
            )}

            {!loading && rankings.length > 0 && (
                <>
                    {/* --- PODIO VISUAL (TOP 3) --- */}
                    <div className="flex justify-center items-end gap-4 mb-10 px-2 min-h-[220px]">
                        
                        {/* PUESTO 2 */}
                        {top2 && (
                            <div className="flex flex-col items-center w-1/3 max-w-[140px] animate-in slide-in-from-bottom-8 duration-700 delay-100">
                                <div className="relative mb-2">
                                    <Avatar className="h-16 w-16 border-4 border-slate-300 shadow-md">
                                        <AvatarImage src={top2.avatar} />
                                        <AvatarFallback>{top2.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-slate-400 border-2 border-white px-2">#2</Badge>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-slate-700 text-sm truncate w-full">{top2.name.split(" ")[0]}</p>
                                    <p className="font-black text-2xl text-slate-500">{top2.score}</p>
                                    {/* Aliento en la nuca */}
                                    <div className="text-[9px] text-orange-600 font-bold bg-orange-50 px-1.5 py-0.5 rounded mt-1 border border-orange-100 flex items-center justify-center gap-1">
                                        <ArrowUpCircle size={10}/> A {top2.gapToNext?.diff} de {top2.gapToNext?.name}
                                    </div>
                                </div>
                                <div className="h-24 w-full bg-gradient-to-t from-slate-200 to-slate-100 rounded-t-lg mt-2 border-t-4 border-slate-300 shadow-inner"></div>
                            </div>
                        )}

                        {/* PUESTO 1 (REY) */}
                        {top1 && (
                            <div className="flex flex-col items-center w-1/3 max-w-[160px] z-10 animate-in slide-in-from-bottom-10 duration-500">
                                <div className="relative mb-3">
                                    <Crown className="absolute -top-8 left-1/2 -translate-x-1/2 h-8 w-8 text-yellow-500 fill-yellow-500 animate-bounce" />
                                    <Avatar className="h-24 w-24 border-4 border-yellow-400 shadow-xl ring-4 ring-yellow-100">
                                        <AvatarImage src={top1.avatar} />
                                        <AvatarFallback>{top1.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <Badge className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-yellow-500 text-white border-2 border-white px-3 py-0.5 text-lg font-black shadow-md">#1</Badge>
                                </div>
                                <div className="text-center mb-1">
                                    <p className="font-black text-slate-800 text-lg">{top1.name.split(" ")[0]}</p>
                                    <p className="font-black text-4xl text-yellow-600">{top1.score}</p>
                                    <p className="text-[10px] uppercase font-bold text-yellow-700/60 mt-1">{metric === 'capitas' ? 'Cápitas' : 'Ventas'}</p>
                                </div>
                                <div className="h-32 w-full bg-gradient-to-t from-yellow-200 to-yellow-100 rounded-t-xl mt-2 border-t-4 border-yellow-400 shadow-lg relative overflow-hidden">
                                    <div className="absolute inset-0 bg-white/30 skew-y-12"></div>
                                </div>
                            </div>
                        )}

                        {/* PUESTO 3 */}
                        {top3 && (
                            <div className="flex flex-col items-center w-1/3 max-w-[140px] animate-in slide-in-from-bottom-8 duration-700 delay-200">
                                <div className="relative mb-2">
                                    <Avatar className="h-16 w-16 border-4 border-orange-300 shadow-md">
                                        <AvatarImage src={top3.avatar} />
                                        <AvatarFallback>{top3.name[0]}</AvatarFallback>
                                    </Avatar>
                                    <Badge className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-orange-400 border-2 border-white px-2">#3</Badge>
                                </div>
                                <div className="text-center">
                                    <p className="font-bold text-slate-700 text-sm truncate w-full">{top3.name.split(" ")[0]}</p>
                                    <p className="font-black text-2xl text-orange-700">{top3.score}</p>
                                    {/* Aliento en la nuca */}
                                    <div className="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded mt-1 border border-slate-200 flex items-center justify-center gap-1">
                                        <ArrowUpCircle size={10}/> A {top3.gapToNext?.diff} de {top3.gapToNext?.name}
                                    </div>
                                </div>
                                <div className="h-16 w-full bg-gradient-to-t from-orange-200 to-orange-100 rounded-t-lg mt-2 border-t-4 border-orange-300 shadow-inner"></div>
                            </div>
                        )}
                    </div>

                    {/* --- LISTA DEL RESTO (4º HACIA ABAJO) --- */}
                    <div className="space-y-3">
                        {restOfTeam.map((user) => (
                            <Card
                                key={user.name}
                                className="flex items-center p-3 hover:shadow-md transition-all border border-slate-100 group animate-in fade-in slide-in-from-bottom-2"
                            >
                                <div className="w-8 text-center font-bold text-slate-400 text-lg">#{user.position}</div>
                                
                                <Avatar className="h-10 w-10 border border-slate-200 mr-3">
                                    <AvatarImage src={user.avatar} />
                                    <AvatarFallback>{user.name[0]}</AvatarFallback>
                                </Avatar>

                                <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-bold text-slate-700">{user.name}</h3>
                                        {/* Aliento en la nuca en la lista */}
                                        {user.gapToNext && (
                                            <span className="text-[10px] text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded-full font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <ArrowUpCircle size={10}/> A {user.gapToNext.diff} de {user.gapToNext.name}
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <span className="text-xl font-black text-slate-800">{user.score}</span>
                                    <span className="text-[10px] text-slate-400 font-bold uppercase block -mt-1">
                                        {metric === 'capitas' ? 'Cápitas' : 'Ventas'}
                                    </span>
                                </div>
                            </Card>
                        ))}
                    </div>
                </>
            )}
        </div>
    )
}