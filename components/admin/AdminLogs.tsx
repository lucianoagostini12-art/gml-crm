"use client"

import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"

import { ShieldAlert, AlertTriangle, UserX, Clock, RefreshCw } from "lucide-react"

type AuditLogRow = {
  id: string
  created_at: string
  level?: "info" | "warning" | "critical" | string
  event_type?: string | null
  actor_name?: string | null
  action?: string | null
  details?: string | null
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString("es-AR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    })
  } catch {
    return iso
  }
}

function levelToType(level?: string) {
  const l = String(level || "info").toLowerCase()
  if (l === "critical") return "critical"
  if (l === "warning") return "warning"
  return "info"
}

function iconByType(t: "info" | "warning" | "critical") {
  if (t === "critical") return <UserX className="h-5 w-5" />
  return <AlertTriangle className="h-5 w-5" />
}

function pillByType(t: "info" | "warning" | "critical") {
  if (t === "critical") return "bg-red-100 text-red-600"
  if (t === "warning") return "bg-orange-100 text-orange-600"
  return "bg-blue-100 text-blue-600"
}

function badgeByType(t: "info" | "warning" | "critical") {
  if (t === "critical") return "bg-red-50 text-red-700 border-red-200"
  if (t === "warning") return "bg-orange-50 text-orange-700 border-orange-200"
  return "bg-blue-50 text-blue-700 border-blue-200"
}

export function AdminLogs() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [logs, setLogs] = useState<AuditLogRow[]>([])
  const [refreshing, setRefreshing] = useState(false)

  const fetchLogs = async () => {
    setRefreshing(true)

    // Traemos últimos 200 eventos (ajustable)
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id, created_at, level, event_type, actor_name, action, details")
      .order("created_at", { ascending: false })
      .limit(200)

    if (!error) setLogs((data as AuditLogRow[]) || [])
    // Si hay error, no mostramos cartel “faltan logs”: solo dejamos el estado actual
    // y en consola para debug.
    if (error) console.error("AdminLogs fetch error:", error)

    setLoading(false)
    setRefreshing(false)
  }

  useEffect(() => {
    fetchLogs()

    // Realtime: cuando se inserta un log nuevo, refrescamos
    const channel = supabase
      .channel("audit_logs_live")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "audit_logs" }, () => fetchLogs())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- Alertas “activas” (solo UI). No depende de que existan triggers extra.
  // Se basa en event_type. Si todavía no estás generando esos event_type,
  // simplemente va a mostrar 0 y listo (sin carteles).
  const alerts = useMemo(() => {
    const since = Date.now() - 24 * 60 * 60 * 1000 // últimas 24h
    const recent = logs.filter((l) => {
      const t = new Date(l.created_at).getTime()
      return Number.isFinite(t) && t >= since
    })

    const countByEvent = (key: string) =>
      recent.filter((l) => String(l.event_type || "").toLowerCase() === key.toLowerCase()).length

    // Estos keys son los recomendados. Si tus triggers usan otros nombres, decime y los mapeo.
    return [
      {
        key: "rapid_discards",
        title: "Descartes Rápidos",
        desc: "Si un agente descarta muchos leads en pocos minutos, queda registrado.",
        count: countByEvent("rapid_discards"),
      },
      {
        key: "post_close_edit",
        title: "Edición Post-Cierre",
        desc: "Cualquier edición sobre una venta ya cerrada/cumplida queda registrada.",
        count: countByEvent("post_close_edit"),
      },
      {
        key: "odd_login",
        title: "Login Extraño",
        desc: "Intentos fuera de horario o patrones raros de acceso.",
        count: countByEvent("odd_login"),
      },
    ]
  }, [logs])

  return (
    <div className="p-6 h-full overflow-y-auto max-w-5xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <ShieldAlert className="h-8 w-8 text-red-600" /> Auditoría de Seguridad
            {refreshing && <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />}
          </h2>
          <p className="text-slate-500">Detección de anomalías y comportamiento sospechoso.</p>
        </div>

        <button
          onClick={fetchLogs}
          className="bg-white/90 px-3 py-1.5 text-xs font-bold text-slate-700 rounded border shadow-sm hover:bg-slate-50 transition-colors flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
          Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* REGISTRO */}
        <Card className="md:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Registro de Eventos</CardTitle>
            <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
              {logs.length} eventos
            </Badge>
          </CardHeader>

          <CardContent className="p-0">
            <ScrollArea className="h-[500px]">
              <div className="divide-y">
                {loading ? (
                  <div className="p-6 flex items-center justify-center text-slate-500">
                    <RefreshCw className="h-4 w-4 animate-spin mr-2" /> Cargando logs…
                  </div>
                ) : logs.length === 0 ? (
                  <div className="p-10 text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-100 text-slate-600 text-xs font-bold">
                      ✅ Sin eventos aún
                    </div>
                    <p className="text-xs text-slate-500 mt-3">
                      Cuando el equipo mueva tarjetas, edite ventas o se disparen auditorías, van a aparecer acá en vivo.
                    </p>
                  </div>
                ) : (
                  logs.map((log) => {
                    const t = levelToType(log.level)
                    const who = (log.actor_name || "Sistema").toString()
                    const action = (log.action || "Evento").toString()
                    const details = (log.details || "").toString()

                    return (
                      <div key={log.id} className="p-4 flex items-start gap-4 hover:bg-slate-50 transition-colors">
                        <div className={`p-2 rounded-full shrink-0 ${pillByType(t)}`}>{iconByType(t)}</div>

                        <div className="flex-1">
                          <div className="flex justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-sm text-slate-800">{action}</p>
                              <Badge variant="outline" className={`text-[10px] font-bold ${badgeByType(t)}`}>
                                {t === "critical" ? "CRÍTICO" : t === "warning" ? "ALERTA" : "INFO"}
                              </Badge>
                            </div>

                            <span className="text-xs font-mono text-slate-400 flex items-center gap-1 shrink-0">
                              <Clock className="h-3 w-3" /> {formatTime(log.created_at)}
                            </span>
                          </div>

                          <p className="text-xs text-slate-600 mt-1">
                            <span className="font-bold">{who}:</span> {details || "—"}
                          </p>

                          {log.event_type ? (
                            <div className="mt-2">
                              <Badge variant="outline" className="text-[10px] bg-white text-slate-600 border-slate-200">
                                {String(log.event_type)}
                              </Badge>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* ALERTAS ACTIVAS */}
        <Card className="bg-red-50 border-red-200">
          <CardHeader>
            <CardTitle className="text-red-800 text-lg flex items-center justify-between">
              Alertas Activas
              <Badge variant="outline" className="bg-white text-red-700 border-red-200">
                {alerts.reduce((acc, a) => acc + a.count, 0)}
              </Badge>
            </CardTitle>
          </CardHeader>

          <CardContent>
            <div className="space-y-4">
              {alerts.map((a) => (
                <div key={a.key} className="bg-white p-3 rounded-lg border border-red-100 shadow-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold text-red-600 text-sm">{a.title}</p>
                    <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
                      {a.count}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">{a.desc}</p>
                </div>
              ))}

              <div className="text-[10px] text-slate-500 font-bold uppercase tracking-widest pt-2">
                Últimas 24hs
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
