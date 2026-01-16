"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Database, Download, Search, FileSpreadsheet, Calendar, Trash2, Filter, X, RefreshCw, AlertTriangle, UserCheck, Eye, StickyNote, History, Webhook, BadgeCheck } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"

type LeadRow = any

type LeadNote = {
  id: string
  lead_id: string
  note: string
  created_at: string
  author?: string | null
}

type LeadEvent = {
  id: string
  lead_id: string
  type?: string | null
  payload?: any
  created_at: string
}

type StatusLog = {
  id: string
  lead_id: string
  from_status?: string | null
  to_status?: string | null
  actor?: string | null
  created_at: string
  meta?: any
}

export function AdminDatabase() {
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [leads, setLeads] = useState<LeadRow[]>([])

  // --- LISTAS DINÁMICAS (Se llenan desde DB) ---
  const [agentsList, setAgentsList] = useState<string[]>([])
  const [statusList, setStatusList] = useState<string[]>([])
  const [sourceList, setSourceList] = useState<string[]>([])
  const [lossReasonsList, setLossReasonsList] = useState<string[]>([])

  // --- FILTROS ---
  const [searchTerm, setSearchTerm] = useState("")
  const [filterAgent, setFilterAgent] = useState("all")
  const [filterStatus, setFilterStatus] = useState("all")
  const [filterSource, setFilterSource] = useState("all")
  const [filterLossReason, setFilterLossReason] = useState("all")

  // Filtro de Fecha (Rango)
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")

  const [showFilters, setShowFilters] = useState(false)

  // --- SELECCIÓN MASIVA ---
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [targetAgent, setTargetAgent] = useState("")
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false)

  // Extras
  const [lastExport, setLastExport] = useState("Sin datos")
  const [deleteId, setDeleteId] = useState<string | null>(null)

  // --- MODAL PREMIUM LEAD ---
  const [openLeadId, setOpenLeadId] = useState<string | null>(null)
  const [leadDetail, setLeadDetail] = useState<LeadRow | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)

  // Tabs data
  const [webhookEvents, setWebhookEvents] = useState<LeadEvent[]>([])
  const [statusLogs, setStatusLogs] = useState<StatusLog[]>([])
  const [notes, setNotes] = useState<LeadNote[]>([])

  // Acciones del modal
  const [modalAgent, setModalAgent] = useState("")
  const [modalStatus, setModalStatus] = useState("")
  const [modalLossReason, setModalLossReason] = useState("")
  const [modalNote, setModalNote] = useState("")
  const [savingModal, setSavingModal] = useState(false)
  const [clearingNotes, setClearingNotes] = useState(false)

  // Helpers
  const tryFetchSimpleList = async (table: string, column: string) => {
    try {
      const { data, error } = await supabase.from(table).select(column)
      if (error) return null
      const arr = (data || []).map((r: any) => r?.[column]).filter(Boolean) as string[]
      return [...new Set(arr)].sort()
    } catch {
      return null
    }
  }

  // CARGA DE DATOS
  const fetchData = async () => {
    setLoading(true)
    let query = supabase.from("leads").select("*").order("created_at", { ascending: false }).limit(2500)

    if (dateFrom) query = query.gte("created_at", `${dateFrom}T00:00:00`)
    if (dateTo) query = query.lte("created_at", `${dateTo}T23:59:59`)

    const { data, error } = await query

    if (!error && data) {
      setLeads(data)

      const uniqueAgents = [...new Set(data.map((l: any) => l.agent_name))].filter(Boolean) as string[]
      const uniqueStatuses = [...new Set(data.map((l: any) => l.status))].filter(Boolean) as string[]
      const uniqueSources = [...new Set(data.map((l: any) => l.source))].filter(Boolean) as string[]
      const uniqueLossReasons = [...new Set(data.map((l: any) => l.loss_reason))].filter(Boolean) as string[]

      setAgentsList(uniqueAgents.sort())
      setStatusList(uniqueStatuses.sort())

      const [srcFromDb, lossFromDb] = await Promise.all([
        tryFetchSimpleList("lead_sources", "name")
          .then((x) => x ?? tryFetchSimpleList("sources", "name"))
          .then((x) => x ?? tryFetchSimpleList("lead_sources", "source"))
          .then((x) => x ?? null),
        tryFetchSimpleList("lead_loss_reasons", "name")
          .then((x) => x ?? tryFetchSimpleList("loss_reasons", "name"))
          .then((x) => x ?? tryFetchSimpleList("lead_loss_reasons", "reason"))
          .then((x) => x ?? null),
      ])

      setSourceList(((srcFromDb && srcFromDb.length > 0 ? srcFromDb : uniqueSources.sort()) as string[]).filter(Boolean))
      setLossReasonsList((lossFromDb && lossFromDb.length > 0 ? lossFromDb : uniqueLossReasons.sort()) as string[])
    }

    setLoading(false)
  }

  useEffect(() => {
    fetchData()
    const channel = supabase
      .channel("db_realtime_v2")
      .on("postgres_changes", { event: "*", schema: "public", table: "leads" }, () => fetchData())
      .subscribe()

    const storedDate = localStorage.getItem("last_db_export")
    if (storedDate) setLastExport(storedDate)

    return () => {
      supabase.removeChannel(channel)
    }
  }, [dateFrom, dateTo])

  // LÓGICA DE FILTRADO
  const filteredData = useMemo(() => {
    return leads.filter((item) => {
      const matchesSearch =
        (item.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
        (item.phone?.toLowerCase() || "").includes(searchTerm.toLowerCase())

      const matchesAgent = filterAgent === "all" || item.agent_name === filterAgent
      const matchesStatus = filterStatus === "all" || item.status === filterStatus
      const matchesSource = filterSource === "all" || item.source === filterSource
      const matchesLoss = filterLossReason === "all" || item.loss_reason === filterLossReason

      return matchesSearch && matchesAgent && matchesStatus && matchesSource && matchesLoss
    })
  }, [leads, searchTerm, filterAgent, filterStatus, filterSource, filterLossReason])

  // SELECCIÓN MASIVA
  const handleSelectAll = (checked: boolean) => {
    if (checked) setSelectedIds(filteredData.map((l: any) => l.id))
    else setSelectedIds([])
  }

  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) setSelectedIds((prev) => [...prev, id])
    else setSelectedIds((prev) => prev.filter((x) => x !== id))
  }

  const executeReassign = async () => {
    if (selectedIds.length === 0 || !targetAgent) return

    const { error } = await supabase
      .from("leads")
      .update({
        agent_name: targetAgent,
        last_update: new Date().toISOString(),
      })
      .in("id", selectedIds)

    if (!error) {
      alert(`✅ ${selectedIds.length} leads reasignados a ${targetAgent}.`)
      setSelectedIds([])
      setTargetAgent("")
      fetchData()
    } else {
      alert("Error al reasignar.")
    }
  }

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return
    const { error } = await supabase.from("leads").delete().in("id", selectedIds)
    if (!error) {
      setBulkDeleteOpen(false)
      setSelectedIds([])
      fetchData()
    } else {
      alert("Error al eliminar en masa.")
    }
  }

  // EXPORTACIÓN
  const handleExport = () => {
    if (filteredData.length === 0) return alert("No hay datos visibles para exportar.")

    const headers = ["ID", "Fecha", "Nombre", "Telefono", "Fuente", "Agente", "Estado", "Motivo Perdida", "Prepaga", "Precio", "Notas"]
    const csvRows = [
      headers.join(","),
      ...filteredData.map((row: any) =>
        [
          row.id,
          `"${new Date(row.created_at).toLocaleDateString()}"`,
          `"${row.name || ""}"`,
          `"${row.phone || ""}"`,
          `"${row.source || ""}"`,
          `"${row.agent_name || ""}"`,
          `"${row.status || ""}"`,
          `"${row.loss_reason || ""}"`,
          `"${row.operator || row.prepaga || ""}"`,
          row.price || 0,
          `"${(row.notes || "").replace(/"/g, '""')}"`,
        ].join(",")
      ),
    ].join("\n")

    const blob = new Blob([csvRows], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.setAttribute("href", url)
    a.setAttribute("download", `Base_Filtrada_${new Date().toISOString().split("T")[0]}.csv`)
    a.click()

    const now = new Date().toLocaleString()
    setLastExport(now)
    localStorage.setItem("last_db_export", now)
  }

  // ELIMINACIÓN
  const confirmDelete = async () => {
    if (!deleteId) return
    const { error } = await supabase.from("leads").delete().eq("id", deleteId)
    if (!error) {
      fetchData()
      setDeleteId(null)
    } else {
      alert("Error al eliminar.")
    }
  }

  // MODAL PREMIUM: lógica
  const openLead = async (id: string) => {
    setOpenLeadId(id)
    setDetailLoading(true)
    setLeadDetail(null)
    setWebhookEvents([])
    setStatusLogs([])
    setNotes([])

    try {
      const { data: lead, error: leadErr } = await supabase.from("leads").select("*").eq("id", id).single()
      if (!leadErr && lead) {
        setLeadDetail(lead)
        setModalAgent(lead.agent_name || "")
        setModalStatus(lead.status || "")
        setModalLossReason(lead.loss_reason || "")
      }

      // Webhook history
      const webhookAttempts = ["lead_webhook_logs", "webhook_logs", "lead_events"]
      for (const t of webhookAttempts) {
        const { data: ev, error } = await supabase.from(t).select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(200)
        if (!error && ev) {
          setWebhookEvents(ev as any)
          break
        }
      }

      // Fallback webhook synthetic
      try {
        const keys = ["webhook_payload", "webhook_body", "payload", "raw_payload", "raw", "meta", "incoming_payload", "wati_payload", "request_body"]
        let found: any = null
        for (const k of keys) {
          const v = (lead as any)?.[k]
          if (v && (typeof v === "object" || String(v).length > 0)) { found = { key: k, value: v }; break }
        }
        if (found) {
          setWebhookEvents([
            {
              id: `lead_${id}_payload`,
              lead_id: id,
              type: `lead.${found.key}`,
              payload: found.value,
              created_at: (lead as any)?.created_at || new Date().toISOString(),
            } as any,
          ])
        }
      } catch {}

      // Status logs
      const statusAttempts = ["lead_status_logs", "status_logs", "lead_logs"]
      for (const t of statusAttempts) {
        const { data: lg, error } = await supabase.from(t).select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(300)
        if (!error && lg) {
          setStatusLogs(lg as any)
          break
        }
      }

      // Notes
      const notesAttempts = ["lead_notes", "notes", "lead_notes_logs"]
      for (const t of notesAttempts) {
        const { data: nt, error } = await supabase.from(t).select("*").eq("lead_id", id).order("created_at", { ascending: false }).limit(300)
        if (!error && nt) {
          setNotes(nt as any)
          break
        }
      }
    } finally {
      setDetailLoading(false)
    }
  }

  const closeLead = () => {
    setOpenLeadId(null)
    setLeadDetail(null)
    setWebhookEvents([])
    setStatusLogs([])
    setNotes([])
    setModalAgent("")
    setModalStatus("")
    setModalLossReason("")
    setModalNote("")
    setSavingModal(false)
    setClearingNotes(false)
  }

  const noneToNull = (v: string) => {
    const vv = (v || "").trim()
    if (!vv || vv === "__none__") return null
    return vv
  }

  const saveModalChanges = async () => {
    if (!openLeadId) return
    setSavingModal(true)

    const payload: any = {
      agent_name: noneToNull(modalAgent) ,
      status: (modalStatus || "").trim() || null,
      last_update: new Date().toISOString(),
    }

    if ((modalStatus || "").toLowerCase() !== "perdido") payload.loss_reason = null
    else payload.loss_reason = noneToNull(modalLossReason)

    const { error } = await supabase.from("leads").update(payload).eq("id", openLeadId)

    if (error) {
      alert("Error al guardar cambios.")
      setSavingModal(false)
      return
    }

    if (modalNote.trim()) {
      const notePayload = {
        lead_id: openLeadId,
        note: modalNote.trim(),
        created_at: new Date().toISOString(),
      }
      const noteTables = ["lead_notes", "notes", "lead_notes_logs"]
      for (const t of noteTables) {
        const { error: nerr } = await supabase.from(t).insert(notePayload as any)
        if (!nerr) break
      }
    }

    setModalNote("")
    setSavingModal(false)
    fetchData()
    await openLead(openLeadId)
  }

  const clearNotes = async () => {
    if (!openLeadId) return
    setClearingNotes(true)
    await supabase.from("leads").update({ notes: null, last_update: new Date().toISOString() }).eq("id", openLeadId)
    const noteTables = ["lead_notes", "notes", "lead_notes_logs"]
    for (const t of noteTables) {
      const { error } = await supabase.from(t).delete().eq("lead_id", openLeadId)
      if (!error) break
    }
    setClearingNotes(false)
    fetchData()
    await openLead(openLeadId)
  }

  const reactivateAsNew = async () => {
    if (!openLeadId) return
    setSavingModal(true)
    const { error } = await supabase
      .from("leads")
      .update({
        status: "nuevo",
        loss_reason: null,
        last_update: new Date().toISOString(),
        agent_name: noneToNull(modalAgent) ,
      })
      .eq("id", openLeadId)

    if (error) {
      alert("Error al reactivar.")
      setSavingModal(false)
      return
    }
    setSavingModal(false)
    fetchData()
    await openLead(openLeadId)
  }

  const getStatusColor = (status: string) => {
    const s = status?.toLowerCase() || ""
    if (["vendido", "cumplidas"].includes(s)) return "bg-green-500 hover:bg-green-600"
    if (["perdido", "baja", "rechazado"].includes(s)) return "bg-red-500 hover:bg-red-600"
    if (s === "cotizacion") return "bg-yellow-500 hover:bg-yellow-600"
    return "bg-blue-500 hover:bg-blue-600"
  }

  const formatDT = (d: string) => {
    try {
      return new Date(d).toLocaleString()
    } catch {
      return d
    }
  }

  return (
    <div className="p-6 h-full overflow-y-auto max-w-[1600px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Database className="h-8 w-8 text-slate-600" /> Base Maestra
            {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />}
          </h2>
          <p className="text-slate-500">Gestión inteligente de base de datos.</p>
        </div>
        <div className="text-right flex flex-col items-end gap-2">
          <p className="text-xs text-slate-400 flex items-center gap-1">
            <Calendar className="h-3 w-3" /> Última exportación: {lastExport}
          </p>
          <Button onClick={handleExport} className="bg-green-600 hover:bg-green-700 text-white font-bold shadow-md">
            <Download className="mr-2 h-4 w-4" /> DESCARGAR FILTRADO
          </Button>
        </div>
      </div>

      <Card className="border-t-4 border-t-slate-600 shadow-xl">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-white dark:from-slate-950/40 dark:to-slate-950/10 border-b p-4 space-y-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-slate-500" />
              <span className="font-bold text-slate-700 dark:text-slate-200">{filteredData.length} Registros encontrados</span>
            </div>
            <div className="flex gap-2 w-full md:w-auto">
              <div className="relative w-full md:w-80">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-slate-400" />
                <Input placeholder="Buscar por nombre o teléfono..." className="pl-8 bg-white" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
              </div>
              <Button variant={showFilters ? "secondary" : "outline"} onClick={() => setShowFilters(!showFilters)} className="gap-2">
                <Filter className="h-4 w-4" /> Filtros Avanzados
              </Button>
            </div>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 pt-2 animate-in slide-in-from-top-2 bg-white dark:bg-slate-900 p-4 rounded-lg border shadow-sm">
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-slate-500 font-bold uppercase">Rango de Fecha</Label>
                <div className="flex gap-2">
                  <Input type="date" className="text-xs" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                  <Input type="date" className="text-xs" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 font-bold uppercase">Vendedor</Label>
                <Select value={filterAgent} onValueChange={setFilterAgent}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {agentsList.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 font-bold uppercase">Estado</Label>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {statusList.map((s) => (<SelectItem key={s} value={s}>{String(s).toUpperCase()}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-slate-500 font-bold uppercase">Fuente</Label>
                <Select value={filterSource} onValueChange={setFilterSource}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas</SelectItem>
                    {sourceList.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1 md:col-span-2">
                <Label className="text-xs text-slate-500 font-bold uppercase">Motivo Pérdida</Label>
                <Select value={filterLossReason} onValueChange={setFilterLossReason}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    {lossReasonsList.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                  </SelectContent>
                </Select>
              </div>
              <div className="md:col-span-5 flex justify-end pt-2 border-t mt-2">
                <Button variant="ghost" size="sm" onClick={() => {
                    setFilterAgent("all"); setFilterStatus("all"); setFilterSource("all"); setFilterLossReason("all"); setSearchTerm(""); setDateFrom(""); setDateTo("")
                  }} className="text-xs text-red-500">
                  <X className="h-3 w-3 mr-1" /> Limpiar Todo
                </Button>
              </div>
            </div>
          )}

          {selectedIds.length > 0 && (
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 bg-blue-50 border border-blue-200 p-2 rounded-lg animate-in fade-in slide-in-from-top-2">
              <span className="text-sm font-bold text-blue-800 ml-2">{selectedIds.length} leads seleccionados</span>
              <div className="flex flex-col md:flex-row gap-2 items-stretch md:items-center">
                <Select value={targetAgent} onValueChange={setTargetAgent}>
                  <SelectTrigger className="w-full md:w-[220px] h-8 bg-white border-blue-200"><SelectValue placeholder="Reasignar a..." /></SelectTrigger>
                  <SelectContent>{agentsList.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}</SelectContent>
                </Select>
                <Button size="sm" className="h-8 bg-blue-600 hover:bg-blue-700" onClick={executeReassign}><UserCheck className="h-4 w-4 mr-2" /> Aplicar</Button>
                <Button size="sm" variant="destructive" className="h-8" onClick={() => setBulkDeleteOpen(true)}><Trash2 className="h-4 w-4 mr-2" /> Borrar Selección</Button>
              </div>
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[600px] overflow-y-auto">
            <Table>
              <TableHeader className="sticky top-0 bg-slate-100 dark:bg-slate-900 z-10 shadow-sm">
                <TableRow>
                  <TableHead className="w-[40px]">
                    <Checkbox checked={filteredData.length > 0 && selectedIds.length === filteredData.length} onCheckedChange={(c) => handleSelectAll(c as boolean)} />
                  </TableHead>
                  <TableHead className="w-[100px]">Fecha</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Fuente</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Detalle / Pérdida</TableHead>
                  <TableHead className="text-right">Acción</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredData.map((row: any) => (
                  <TableRow key={row.id} className="hover:bg-slate-50 transition-colors">
                    <TableCell onClick={(e) => e.stopPropagation()}><Checkbox checked={selectedIds.includes(row.id)} onCheckedChange={(c) => handleSelectOne(row.id, c as boolean)} /></TableCell>
                    <TableCell className="font-mono text-xs text-slate-500 cursor-pointer" onClick={() => openLead(row.id)}>{new Date(row.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="cursor-pointer" onClick={() => openLead(row.id)}><div className="font-bold text-sm flex items-center gap-2">{row.name}</div><div className="text-xs text-slate-400 font-mono">{row.phone}</div></TableCell>
                    <TableCell className="cursor-pointer" onClick={() => openLead(row.id)}><Badge variant="outline">{row.source || "-"}</Badge></TableCell>
                    <TableCell className="font-medium text-xs cursor-pointer" onClick={() => openLead(row.id)}>{row.agent_name || "Sin Asignar"}</TableCell>
                    <TableCell className="cursor-pointer" onClick={() => openLead(row.id)}><Badge className={`${getStatusColor(row.status)} text-white border-0 capitalize shadow-sm`}>{row.status}</Badge></TableCell>
                    <TableCell className="text-xs text-slate-500 max-w-[200px] truncate cursor-pointer" onClick={() => openLead(row.id)}>{row.loss_reason ? <span className="text-red-500 font-bold">{row.loss_reason}</span> : row.operator || row.prepaga || "-"}</TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-slate-100 text-slate-500" onClick={() => openLead(row.id)} title="Ver detalle"><Eye className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-red-50 text-slate-300 hover:text-red-600" onClick={() => setDeleteId(row.id)} title="Eliminar"><Trash2 className="h-4 w-4" /></Button>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && !loading && (
                  <TableRow><TableCell colSpan={8} className="text-center py-10 text-slate-400">Sin resultados con los filtros actuales.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* DIÁLOGOS DE BORRADO (UNO Y MASIVO) */}
      <Dialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> Confirmar Eliminación</DialogTitle>
            <DialogDescription>¿Estás seguro? <b>Esto es irreversible.</b> El dato se borrará permanentemente.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmDelete}>Sí, Eliminar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600"><AlertTriangle className="h-5 w-5" /> Confirmar Eliminación Masiva</DialogTitle>
            <DialogDescription>Vas a borrar <b>{selectedIds.length}</b> leads. Esto es irreversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={confirmBulkDelete}>Sí, borrar todo</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL PREMIUM: DETALLE LEAD (CON SCROLL NATIVO) */}
      <Dialog open={!!openLeadId} onOpenChange={(o) => (!o ? closeLead() : null)}>
        <DialogContent className="sm:max-w-[1100px] w-full max-h-[85vh] p-0 overflow-hidden border-0 shadow-2xl flex flex-col rounded-xl">
          {/* HEADER FIJO */}
          <div className="sticky top-0 z-20 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 text-white border-b border-white/10 px-6 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="flex items-center gap-2 text-white">
                <Database className="h-5 w-5 text-emerald-300" /> Detalle del Lead
                {detailLoading && <RefreshCw className="h-4 w-4 animate-spin text-white/70" />}
              </DialogTitle>
              <DialogDescription className="text-slate-200/80">Vista premium con datos, historial y acciones.</DialogDescription>
            </DialogHeader>
          </div>

          {/* CONTENIDO SCROLLABLE (Reemplazado ScrollArea por overflow-y-auto) */}
          <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950/30">
            <div className="px-6 py-5">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                {/* COLUMNA IZQUIERDA */}
                <div className="lg:col-span-4 space-y-3">
                  <Card className="border border-slate-200/70 dark:border-white/10 shadow-sm bg-white dark:bg-slate-950/30">
                    <CardHeader className="p-4 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-950/40 dark:to-slate-950/10">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-lg font-black text-slate-800 dark:text-white">{leadDetail?.name || "—"}</div>
                          <div className="text-xs text-slate-400 font-mono">{leadDetail?.phone || "—"}</div>
                        </div>
                        <Badge className={`${getStatusColor(leadDetail?.status)} text-white border-0 capitalize shadow-sm`}>{leadDetail?.status || "—"}</Badge>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">{leadDetail?.source || "Sin fuente"}</Badge>
                        <Badge variant="outline">{leadDetail?.agent_name || "Sin asignar"}</Badge>
                        {leadDetail?.loss_reason && <Badge variant="outline" className="border-red-200 text-red-600">{leadDetail.loss_reason}</Badge>}
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-2">
                      <div className="text-xs text-slate-500"><span className="font-bold">Creado:</span> {leadDetail?.created_at ? formatDT(leadDetail.created_at) : "—"}</div>
                      <div className="text-xs text-slate-500"><span className="font-bold">Última act.:</span> {leadDetail?.last_update ? formatDT(leadDetail.last_update) : "—"}</div>
                      <div className="pt-3 border-t">
                        <Label className="text-xs text-slate-500 font-bold uppercase">Acciones rápidas</Label>
                        <div className="mt-2 flex flex-col gap-2">
                          <Button variant="outline" className="justify-start" onClick={reactivateAsNew} disabled={savingModal}>
                            <BadgeCheck className="h-4 w-4 mr-2 text-slate-600" /> Reactivar como <b className="ml-1">NUEVO</b>
                          </Button>
                          <Button variant="outline" className="justify-start" onClick={clearNotes} disabled={clearingNotes}>
                            <StickyNote className="h-4 w-4 mr-2 text-slate-600" /> Limpiar notas
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="border border-slate-200/70 dark:border-white/10 shadow-sm bg-white dark:bg-slate-950/30">
                    <CardHeader className="p-4 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-950/40 dark:to-slate-950/10">
                      <div className="font-black text-slate-800 dark:text-white">Reasignación & Estado</div>
                    </CardHeader>
                    <CardContent className="p-4 space-y-3">
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500 font-bold uppercase">Vendedor</Label>
                        <Select value={modalAgent || ""} onValueChange={setModalAgent}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__none__">Sin asignar</SelectItem>
                            {agentsList.map((a) => (<SelectItem key={a} value={a}>{a}</SelectItem>))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500 font-bold uppercase">Estado</Label>
                        <Select value={modalStatus || ""} onValueChange={setModalStatus}>
                          <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                          <SelectContent>
                            {statusList.map((s) => (<SelectItem key={s} value={s}>{String(s).toUpperCase()}</SelectItem>))}
                            {!statusList.includes("nuevo") && <SelectItem value="nuevo">NUEVO</SelectItem>}
                            {!statusList.includes("perdido") && <SelectItem value="perdido">PERDIDO</SelectItem>}
                          </SelectContent>
                        </Select>
                      </div>
                      {(modalStatus || "").toLowerCase() === "perdido" && (
                        <div className="space-y-1">
                          <Label className="text-xs text-slate-500 font-bold uppercase">Motivo de pérdida</Label>
                          <Select value={modalLossReason || ""} onValueChange={setModalLossReason}>
                            <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__none__">Sin motivo</SelectItem>
                              {lossReasonsList.map((r) => (<SelectItem key={r} value={r}>{r}</SelectItem>))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      <div className="space-y-1">
                        <Label className="text-xs text-slate-500 font-bold uppercase">Nota rápida</Label>
                        <Textarea value={modalNote} onChange={(e) => setModalNote(e.target.value)} placeholder="Ej: Recontactar en 7 días..." className="min-h-[90px]" />
                      </div>
                      <Button className="bg-slate-900 hover:bg-slate-800 text-white font-bold shadow-md w-full" onClick={saveModalChanges} disabled={savingModal}>
                        {savingModal ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <UserCheck className="h-4 w-4 mr-2" />} Guardar cambios
                      </Button>
                    </CardContent>
                  </Card>
                </div>

                {/* COLUMNA DERECHA */}
                <div className="lg:col-span-8">
                  <Card className="border border-slate-200/70 dark:border-white/10 shadow-sm bg-white dark:bg-slate-950/30">
                    <CardHeader className="p-4 border-b bg-gradient-to-r from-slate-50 to-white dark:from-slate-950/40 dark:to-slate-950/10">
                      <div className="font-black text-slate-800 dark:text-white">Historial completo</div>
                    </CardHeader>
                    <CardContent className="p-4">
                      <Tabs defaultValue="webhook" className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100 dark:bg-slate-900/40 p-1 rounded-xl">
                          <TabsTrigger value="webhook" className="gap-2 rounded-lg"><Webhook className="h-4 w-4" /> Webhook</TabsTrigger>
                          <TabsTrigger value="logs" className="gap-2 rounded-lg"><History className="h-4 w-4" /> Logs</TabsTrigger>
                          <TabsTrigger value="notes" className="gap-2 rounded-lg"><StickyNote className="h-4 w-4" /> Notas</TabsTrigger>
                        </TabsList>
                        <TabsContent value="webhook" className="mt-4">
                          {webhookEvents.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">No hay historial.</div> : (
                            <div className="max-h-[420px] overflow-y-auto space-y-2">
                              {webhookEvents.map((e: any) => (
                                <div key={e.id} className="border border-slate-200/70 dark:border-white/10 rounded-xl p-3 bg-white dark:bg-slate-950/20 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{e.type || "Evento"} <span className="text-slate-400 font-normal ml-2">{formatDT(e.created_at)}</span></div>
                                    <Badge variant="outline" className="text-[10px]">{(e.provider || e.source || "webhook").toString()}</Badge>
                                  </div>
                                  <pre className="mt-2 text-[11px] text-slate-500 bg-slate-50 dark:bg-slate-900/40 p-2 rounded-md overflow-x-auto">{JSON.stringify(e.payload || e.body || e.data || e, null, 2)}</pre>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="logs" className="mt-4">
                          {statusLogs.length === 0 ? <div className="text-sm text-slate-400 py-8 text-center">No hay logs.</div> : (
                            <div className="max-h-[420px] overflow-y-auto space-y-2">
                              {statusLogs.map((l: any) => (
                                <div key={l.id} className="border border-slate-200/70 dark:border-white/10 rounded-xl p-3 bg-white dark:bg-slate-950/20 shadow-sm">
                                  <div className="flex items-center justify-between">
                                    <div className="text-xs font-bold text-slate-700 dark:text-slate-200">{(l.from_status || "—").toString().toUpperCase()} → {(l.to_status || l.status || "—").toString().toUpperCase()}</div>
                                    <div className="text-[11px] text-slate-400">{formatDT(l.created_at)}</div>
                                  </div>
                                  <div className="mt-1 text-[11px] text-slate-500"><span className="font-bold">Actor:</span> {l.actor || l.user_name || "—"}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                        <TabsContent value="notes" className="mt-4">
                          {(notes.length === 0 && !leadDetail?.notes) ? <div className="text-sm text-slate-400 py-10 text-center">No hay notas.</div> : (
                            <div className="max-h-[420px] overflow-y-auto space-y-3">
                              {leadDetail?.notes && (
                                <div className="border border-amber-200/60 dark:border-white/10 rounded-2xl p-4 bg-gradient-to-r from-amber-50/70 to-white dark:from-slate-950/30 dark:to-slate-950/10 shadow-sm">
                                  <div className="flex items-center justify-between gap-3"><div className="text-xs font-black text-slate-800 dark:text-white flex items-center gap-2"><StickyNote className="h-4 w-4 text-amber-600" /> Notas del lead</div></div>
                                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{leadDetail.notes}</div>
                                </div>
                              )}
                              {notes.map((n: any) => (
                                <div key={n.id} className="border border-slate-200/70 dark:border-white/10 rounded-2xl p-4 bg-white dark:bg-slate-950/20 shadow-sm">
                                  <div className="flex items-start justify-between gap-3">
                                    <div><div className="text-xs font-bold text-slate-800 dark:text-slate-100 truncate">{n.author || n.user_name || "Vendedora"}</div><div className="text-[11px] text-slate-400">{formatDT(n.created_at)}</div></div>
                                  </div>
                                  <div className="mt-3 text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">{n.note || n.body || ""}</div>
                                </div>
                              ))}
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </div>
          </div>

          {/* FOOTER FIJO */}
          <div className="shrink-0 bg-white/90 dark:bg-slate-950/80 backdrop-blur border-t px-6 py-3">
            <DialogFooter className="mt-0">
              <Button variant="outline" onClick={closeLead}>Cerrar</Button>
            </DialogFooter>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}