"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Megaphone, Pin } from "lucide-react"

type AnnouncementRow = {
  id: number
  created_at: string | null
  title: string
  message: string
  priority: string | null
  is_blocking: boolean | null
  author_id: string | null
  profiles?: {
    full_name: string | null
    email: string | null
    role: string | null
  } | null
}

// ✅ Tus roles reales (según tu tabla profiles)
// Agregá "ops_god" si lo usás / vas a usar
const ALLOWED_AUTHOR_ROLES = ["admin_god", "supervisor_god", "ops_god"] as const

export function AnnouncementsView() {
  const supabase = createClient()
  const [announcements, setAnnouncements] = useState<AnnouncementRow[]>([])

  const fetchAnnouncements = async () => {
    const { data, error } = await supabase
      .from("announcements")
      // ✅ columnas reales + join al profile del autor
      .select("id, created_at, title, message, priority, is_blocking, author_id, profiles:author_id(full_name, email, role)")
      .order("created_at", { ascending: false })
      .limit(200)

    if (error) {
      console.error("fetchAnnouncements error:", error)
      return
    }

    const rows = (data ?? []) as AnnouncementRow[]

    // ✅ Opción 3 (según tu sistema): ADMIN + OPS + SUPERVISION
    // En tu DB hoy existen: admin_god, supervisor_god
    const filtered = rows.filter((a) => {
      const role = (a.profiles?.role ?? "").toLowerCase()
      return (ALLOWED_AUTHOR_ROLES as readonly string[]).includes(role)
    })

    setAnnouncements(filtered)
  }

  useEffect(() => {
    fetchAnnouncements()

    // ✅ Realtime: aparece sin refresh
    const channel = supabase
      .channel("rt_announcements_vendor")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, () => {
        fetchAnnouncements()
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "announcements" }, () => {
        fetchAnnouncements()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const formatDate = (iso: string | null) => {
    if (!iso) return ""
    return new Date(iso).toLocaleDateString("es-AR")
  }

  const safeAuthorName = (a: AnnouncementRow) => {
    const full = a.profiles?.full_name?.trim()
    if (full) return full

    const email = a.profiles?.email?.trim()
    if (email) return email

    const id = a.author_id?.trim()
    if (id) return `Usuario ${id.slice(0, 8)}…`

    return "Usuario"
  }

  const normalizeRoleLabel = (roleRaw: string | null | undefined) => {
    const r = (roleRaw ?? "").toLowerCase()
    if (r === "admin_god") return "ADMIN"
    if (r === "ops_god") return "OPS"
    if (r === "supervisor_god") return "SUPERVISIÓN"
    return r ? r.toUpperCase() : "—"
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-4xl mx-auto">
      <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
        <Megaphone className="h-6 w-6 text-blue-600" /> Comunicados
      </h2>

      <div className="space-y-6">
        {announcements.length === 0 && (
          <div className="text-center text-slate-400 py-10">No hay comunicados por el momento.</div>
        )}

        {announcements.map((ann) => (
          <Card key={ann.id} className="border-l-4 border-l-blue-600 shadow-md">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start gap-3">
                <CardTitle className="text-lg font-bold text-blue-900 dark:text-blue-400 flex items-center gap-2">
                  <Pin className="h-4 w-4 transform rotate-45" />
                  {ann.title}
                </CardTitle>

                <div className="flex items-center gap-2 shrink-0">
                  {ann.priority && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-slate-100 text-slate-600 border">
                      {ann.priority.toUpperCase()}
                    </span>
                  )}
                  {ann.is_blocking && (
                    <span className="text-[10px] px-2 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                      IMPORTANTE
                    </span>
                  )}
                  <span className="text-xs text-slate-400 bg-slate-100 px-2 py-1 rounded">
                    {formatDate(ann.created_at)}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">{ann.message}</p>

              <div className="mt-4 pt-4 border-t border-slate-100 text-xs text-slate-400 flex justify-end">
                Publicado por: {safeAuthorName(ann)} ({normalizeRoleLabel(ann.profiles?.role)})
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
