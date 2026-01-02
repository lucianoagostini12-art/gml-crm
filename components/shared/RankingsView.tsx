"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Flame, TrendingUp, Crown } from "lucide-react"

export function RankingsView() {
    const rankings = [
        { position: 1, name: "Maca", sales: 24, amount: 1850000, level: "ORO 🥇", streak: 5 },
        { position: 2, name: "Gonza", sales: 12, amount: 920000, level: "PLATA 🥈", streak: 0 },
        { position: 3, name: "Sofia", sales: 8, amount: 650000, level: "BRONCE 🥉", streak: 2 },
    ]

    return (
        <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto space-y-6">
            <div className="text-center mb-8">
                <h2 className="text-3xl font-black text-slate-800 dark:text-white flex justify-center items-center gap-3">
                    <Trophy className="h-10 w-10 text-yellow-500 animate-bounce" /> Salón de la Fama
                </h2>
                <p className="text-slate-500">¿Quién se lleva el premio este mes?</p>
            </div>

            {/* PODIO PRINCIPAL */}
            <div className="grid grid-cols-1 gap-4">
                {rankings.map((user) => (
                    <Card key={user.name} className={`relative overflow-hidden transition-all hover:scale-[1.02] ${user.position === 1 ? 'border-2 border-yellow-400 bg-yellow-50/30 dark:bg-yellow-900/10' : 'border border-slate-200'}`}>
                        <div className="p-4 flex items-center gap-4">
                            {/* POSICIÓN */}
                            <div className={`text-2xl font-black w-8 text-center ${user.position === 1 ? 'text-yellow-500' : user.position === 2 ? 'text-slate-400' : 'text-orange-700'}`}>
                                #{user.position}
                            </div>

                            {/* AVATAR */}
                            <Avatar className={`h-14 w-14 border-2 ${user.position === 1 ? 'border-yellow-400' : 'border-slate-200'}`}>
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.name}`} />
                                <AvatarFallback>{user.name[0]}</AvatarFallback>
                            </Avatar>

                            {/* DATOS */}
                            <div className="flex-1">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-bold text-lg dark:text-white">{user.name}</h3>
                                    {user.position === 1 && <Crown className="h-4 w-4 text-yellow-500 fill-yellow-500"/>}
                                    {user.streak > 3 && <Badge variant="secondary" className="bg-orange-100 text-orange-600 flex gap-1"><Flame className="h-3 w-3"/> On Fire</Badge>}
                                </div>
                                <p className="text-xs font-bold text-slate-500 mt-1 uppercase tracking-wider">{user.level}</p>
                            </div>

                            {/* MÉTRICAS */}
                            <div className="text-right">
                                <p className="text-3xl font-black text-slate-800 dark:text-white">{user.sales}</p>
                                <p className="text-[10px] text-slate-400 uppercase font-bold">Ventas</p>
                            </div>
                        </div>
                        {/* BARRA DE PROGRESO DECORATIVA */}
                        <div className={`h-1.5 w-full ${user.position === 1 ? 'bg-yellow-400' : user.position === 2 ? 'bg-slate-300' : 'bg-orange-300'}`}></div>
                    </Card>
                ))}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-xl text-center border border-blue-100 dark:border-blue-900">
                <h4 className="font-bold text-blue-800 dark:text-blue-300 mb-2 flex justify-center items-center gap-2"><TrendingUp className="h-5 w-5"/> ¡Seguí escalando!</h4>
                <p className="text-sm text-blue-700 dark:text-blue-400">
                    Al llegar a <b>50 ventas históricas</b> desbloqueás el nivel <b>PLATA 🥈</b> y accedés a mejores leads.
                </p>
            </div>
        </div>
    )
}