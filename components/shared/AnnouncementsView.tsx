"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone, Pin, ShieldAlert, User } from "lucide-react"
import { Badge } from "@/components/ui/badge"

// Tipos adaptados para la carga manual
type AnnouncementRow = {
  id: number
  created_at: string | null
  title: string
  message: string
  priority: string | null
  is_blocking: boolean | null
  author_id: string | null
  // El perfil lo inyectaremos manualmente
  profiles?: {
    full_name: string | null
    email: string | null
    role: string | null
  } | null
}

const ALLOWED_AUTHOR_ROLES = ["admin_god", "supervisor_god", "ops_god"]

export function AnnouncementsView() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])
  const [loading, setLoading] = useState(true)

  const fetchAnnouncements = async () => {
    setLoading(true)
    
    // PASO 1: Traer anuncios RAW (sin join para evitar error 400)
    const { data: annsData, error: annsError } = await supabase
      .from("announcements")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50)

    if (annsError) {
      console.error("Error al cargar tabla anuncios:", annsError)
      setLoading(false)
      return
    }

    const rawAnns = (annsData || []) as AnnouncementRow[]
    
    // Si no hay anuncios, cortamos acá
    if (rawAnns.length === 0) {
        setAnnouncements([])
        setLoading(false)
        return
    }

    // PASO 2: Recolectar IDs de autores y buscar sus perfiles
    const authorIds = Array.from(new Set(rawAnns.map(a => a.author_id).filter(Boolean)))
    
    let profilesMap: Record<string, any> = {}
    
    if (authorIds.length > 0) {
        const { data: profilesData } = await supabase
            .from("profiles")
            .select("id, full_name, email, role")
            .in("id", authorIds)
        
        if (profilesData) {
            profilesData.forEach((p: any) => {
                profilesMap[p.id] = p
            })
        }
    }

    // PASO 3: Unir datos y Filtrar por Rol
    const mergedData = rawAnns.map(ann => ({
        ...ann,
        profiles: ann.author_id ? profilesMap[ann.author_id] : null
    }))

    const filtered = mergedData.filter((a) => {
      const role = (a.profiles?.role || "").toLowerCase()
      // Si no tiene perfil (ej: borrado), asumimos que no es oficial, o lo mostramos si prefieres. 
      // Aquí seguimos tu regla de solo mostrar roles permitidos.
      return ALLOWED_AUTHOR_ROLES.includes(role)
    })

    setAnnouncements(filtered)
    setLoading(false)
  }

  useEffect(() => {
    fetchAnnouncements()

    const channel = supabase
      .channel("rt_announcements_manual_join")
      .on("postgres_changes", { event: "*", schema: "public", table: "announcements" }, fetchAnnouncements)
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const formatDate = (iso: string | null) => {
    if (!iso) return ""
    return new Date(iso).toLocaleDateString("es-AR", { day: '2-digit', month: 'long' })
  }

  const safeAuthorName = (a: AnnouncementRow) => {
    const profile = a.profiles
    if (profile?.full_name) return profile.full_name
    if (profile?.email) return profile.email.split('@')[0]
    return "Administración"
  }

  const getRoleBadge = (roleRaw: string | null | undefined) => {
    const r = (roleRaw || "").toLowerCase()
    if (r === "admin_god") return <Badge variant="default" className="bg-slate-900 text-[10px]">DIRECCIÓN</Badge>
    if (r === "ops_god") return <Badge variant="default" className="bg-blue-600 text-[10px]">OPERACIONES</Badge>
    if (r === "supervisor_god") return <Badge variant="default" className="bg-purple-600 text-[10px]">SUPERVISIÓN</Badge>
    return <Badge variant="outline" className="text-[10px]">SISTEMA</Badge>
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto custom-scrollbar">
      <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-blue-600" /> Comunicados Oficiales
      </h2>

      <div className="space-y-6">
        {loading && (
            <div className="text-center text-slate-400 py-10 animate-pulse">Cargando novedades...</div>
        )}

        {!loading && announcements.length === 0 && (
          <div className="text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-200">
            <p className="text-slate-400 font-medium">No hay comunicados vigentes.</p>
          </div>
        )}

        {announcements.map((ann) => (
          <Card key={ann.id} className={`shadow-md border-l-[6px] transition-all hover:shadow-lg ${ann.is_blocking ? 'border-l-red-500 bg-red-50/10' : 'border-l-blue-600'}`}>
            <CardHeader className="pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex justify-between items-start gap-3">
                <div className="flex flex-col gap-1">
                    <CardTitle className="text-lg font-bold text-slate-800 dark:text-blue-400 flex items-center gap-2">
                    {ann.is_blocking && <ShieldAlert className="h-5 w-5 text-red-500" />}
                    {ann.title}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                        {getRoleBadge(ann.profiles?.role)}
                        <span className="text-xs text-slate-400 font-medium">
                            • {formatDate(ann.created_at)}
                        </span>
                    </div>
                </div>

                {ann.priority && ann.priority !== 'normal' && (
                    <Badge variant={ann.priority === 'alta' ? "destructive" : "secondary"} className="uppercase text-[10px]">
                      {ann.priority}
                    </Badge>
                )}
              </div>
            </CardHeader>

            <CardContent className="pt-4">
              <div className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed text-sm font-medium">
                {ann.message}
              </div>

              <div className="mt-6 pt-2 flex justify-end items-center gap-2 opacity-60">
                <User size={12} className="text-slate-400"/>
                <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">
                    {safeAuthorName(ann)}
                </span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}