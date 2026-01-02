"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone, Pin } from "lucide-react"

export function AnnouncementsView() {
    const supabase = createClient()
    const [announcements, setAnnouncements] = useState<any[]>([])

    useEffect(() => {
        const fetchAnnouncements = async () => {
            const { data } = await supabase.from('announcements').select('*').eq('active', true).order('created_at', { ascending: false })
            if (data) setAnnouncements(data)
        }
        fetchAnnouncements()
    }, [])

    return (
        <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
                <Megaphone className="h-6 w-6 text-blue-600" /> Comunicados de Supervisión
            </h2>

            <div className="space-y-6">
                {announcements.length === 0 && (
                    <div className="text-center text-slate-400 py-10">
                        No hay comunicados activos por el momento.
                    </div>
                )}

                {announcements.map((ann) => (
                    <Card key={ann.id} className="border-l-4 border-l-blue-600 shadow-md">
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
                                    <Pin className="h-4 w-4 transform rotate-45" />
                                    {ann.title}
                                </CardTitle>
                                <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                                    {new Date(ann.created_at).toLocaleDateString()}
                                </span>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">
                                {ann.message}
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-end">
                                Publicado por: {ann.author}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    )
}