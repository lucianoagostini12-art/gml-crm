"use client"

import { useState, useEffect, useMemo } from "react"
import { createClient } from "@/lib/supabase"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Layers, Recycle, RefreshCw, ExternalLink, Flame, Snowflake, Lock, Zap, Skull } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"

// --- CONFIGURACIÓN DE TIEMPOS DE CONGELAMIENTO (DÍAS) ---
const FREEZE_CONFIG: Record<string, number> = {
    fantasmas: 30,  // "No contesta"
    precio: 60,     // "Caro"
    interes: 45,    // "Lo pienso"
    quemados: 45,   // "+7 llamados"
    zombies: 0,     // ✅ AGREGADO: Los Zombies ya vienen "muertos" por tiempo, se pueden reciclar al instante
    basural: 365    // Datos malos
}

type Lead = {
  id: string
  created_at: string
  name?: string | null
  phone?: string | null
  phone_norm?: string | null
  email?: string | null
  source?: string | null
  status?: string | null
  agent_name?: string | null
  last_update?: string | null
  loss_reason?: string | null
  calls?: number
}

const normPhone = (v?: string | null) => (v || "").replace(/\D/g, "")
const normEmail = (v?: string | null) => (v || "").trim().toLowerCase()

// Clave para detectar duplicado: primero phone_norm, si no email
const leadKey = (l: Lead) => {
  const p = (l.phone_norm && l.phone_norm.trim()) || normPhone(l.phone)
  if (p) return `p:${p}`
  const e = normEmail(l.email)
  if (e) return `e:${e}`
  return null
}

export function AdminLeadFactory() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // ESTADOS DE DATOS
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([])
  const [redistributionList, setRedistributionList] = useState<Lead[]>([])
  const [drawerLeads, setDrawerLeads] = useState<Lead[]>([])

  // SELECCIÓN
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [targetAgent, setTargetAgent] = useState("")
  
  // AUTOMATIZACIÓN (ROUND ROBIN)
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false)
  const [nextAgentIdx, setNextAgentIdx] = useState(0) // Índice del vendedor al que le toca

  // LISTA DE VENDEDORES (Idealmente vendría de la tabla profiles)
  const AGENTS = ["Maca", "Gonza", "Sofi", "Lucas", "Brenda", "Cami"]

  // FILTROS REDISTRIBUCIÓN
  const [sourceAgent, setSourceAgent] = useState("")
  const [filterDateLimit, setFilterDateLimit] = useState("")
  const [filterStage, setFilterStage] = useState("all")
  const [filterSource, setFilterSource] = useState("all")

  // ESTADOS CEMENTERIO (ESTADÍSTICAS)
  const [graveyardStats, setGraveyardStats] = useState({
    fantasmas: 0,
    precio: 0,
    interes: 0,
    quemados: 0,
    zombies: 0, // ✅ AGREGADO: Contador para zombies
    basural: 0,
  })
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null)

  // DEDUPE MAP: lead_id -> originalLead
  const [dupMap, setDupMap] = useState<Record<string, Lead>>({})
  const [dupLoading, setDupLoading] = useState(false)

  // MODAL
  const [dupModalOpen, setDupModalOpen] = useState(false)
  const [dupLead, setDupLead] = useState<Lead | null>(null)
  const [origLead, setOrigLead] = useState<Lead | null>(null)

  // CARGA INICIAL
  useEffect(() => {
    fetchInbox()
    fetchGraveyardStats()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --- 🤖 MOTOR DE ASIGNACIÓN AUTOMÁTICA (ROUND ROBIN) ---
  useEffect(() => {
    let timeout: NodeJS.Timeout

    const processAutoAssign = async () => {
        // Solo corre si está activado, hay leads libres y no estamos cargando
        if (autoAssignEnabled && unassignedLeads.length > 0 && !loading) {
            
            const leadToAssign = unassignedLeads[0] // Tomamos el primero de la pila
            const agentToAssign = AGENTS[nextAgentIdx] // El vendedor de turno

            // 1. Actualización Optimista (Visual inmediata)
            const remainingLeads = unassignedLeads.slice(1)
            setUnassignedLeads(remainingLeads)
            
            // 2. Rotar el turno para el siguiente
            setNextAgentIdx((prev) => (prev + 1) % AGENTS.length)

            // 3. Guardar en Supabase
            // Nota: No esperamos el await para no bloquear la UI, se hace en background
            await supabase.from('leads').update({
                agent_name: agentToAssign,
                status: 'nuevo', // Aseguramos que entre como nuevo
                last_update: new Date().toISOString()
            }).eq('id', leadToAssign.id)

            // Si quedan leads, el useEffect se volverá a disparar automáticamente 
            // porque 'unassignedLeads' cambió de tamaño.
        }
    }

    if (autoAssignEnabled && unassignedLeads.length > 0) {
        // Pequeño delay de 1.5s para que se vea el proceso y no sature la base
        timeout = setTimeout(processAutoAssign, 1500)
    }

    return () => clearTimeout(timeout)
  }, [autoAssignEnabled, unassignedLeads, nextAgentIdx, loading])


  // --- LÓGICA DE CONGELAMIENTO (NUEVA) ---
  const checkFreezeStatus = (lead: Lead, drawerType: string) => {
      if (!lead.last_update) return { isFrozen: false, remainingDays: 0 }
      
      const lostDate = new Date(lead.last_update)
      const now = new Date()
      // Diferencia en días
      const daysPassed = Math.floor((now.getTime() - lostDate.getTime()) / (1000 * 60 * 60 * 24))
      const requiredDays = FREEZE_CONFIG[drawerType] || 0
      
      if (daysPassed < requiredDays) {
          return { isFrozen: true, remainingDays: requiredDays - daysPassed }
      }
      return { isFrozen: false, remainingDays: 0 }
  }

  // --- 1. BANDEJA DE ENTRADA (SIN DUEÑO) + DETECCIÓN DUPLICADOS ---
  const fetchInbox = async () => {
    setLoading(true)
    setDupLoading(true)

    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .or("agent_name.is.null,agent_name.eq.Sin Asignar")
      .order("created_at", { ascending: false })

    if (error) {
      console.error(error)
      setUnassignedLeads([])
      setDupMap({})
      setLoading(false)
      setDupLoading(false)
      return
    }

    const inbox = (data || []) as Lead[]
    setUnassignedLeads(inbox)

    // armamos listas para lookup de "originales"
    const phones = Array.from(
      new Set(
        inbox
          .map((l) => (l.phone_norm && l.phone_norm.trim()) || normPhone(l.phone))
          .filter(Boolean)
      )
    )
    const emails = Array.from(new Set(inbox.map((l) => normEmail(l.email)).filter(Boolean)))

    // Si no hay identificadores, no hay dedupe
    if (phones.length === 0 && emails.length === 0) {
      setDupMap({})
      setLoading(false)
      setDupLoading(false)
      return
    }

    // Traemos candidatos "originales" (ya asignados)
    const candidates: Lead[] = []

    if (phones.length > 0) {
      const { data: pData, error: pErr } = await supabase
        .from("leads")
        .select("id,created_at,name,phone,phone_norm,email,source,status,agent_name,last_update,loss_reason")
        .in("phone_norm", phones as any)
        .not("agent_name", "is", null)
        .neq("agent_name", "Sin Asignar")

      if (pErr) console.error(pErr)
      if (pData) candidates.push(...(pData as Lead[]))
    }

    if (emails.length > 0) {
      const { data: eData, error: eErr } = await supabase
        .from("leads")
        .select("id,created_at,name,phone,phone_norm,email,source,status,agent_name,last_update,loss_reason")
        .in("email", emails as any)
        .not("agent_name", "is", null)
        .neq("agent_name", "Sin Asignar")

      if (eErr) console.error(eErr)
      if (eData) candidates.push(...(eData as Lead[]))
    }

    // elegimos "original" como el más viejo por key
    const byKey: Record<string, Lead> = {}
    for (const c of candidates) {
      const k = leadKey(c)
      if (!k) continue
      const prev = byKey[k]
      if (!prev) byKey[k] = c
      else {
        const prevT = new Date(prev.created_at).getTime()
        const curT = new Date(c.created_at).getTime()
        if (curT < prevT) byKey[k] = c
      }
    }

    // mapeamos cada lead de bandeja a su original (si existe)
    const mapByLeadId: Record<string, Lead> = {}
    for (const l of inbox) {
      const k = leadKey(l)
      if (!k) continue
      const original = byKey[k]
      if (original && original.id !== l.id) mapByLeadId[l.id] = original
    }

    setDupMap(mapByLeadId)
    setLoading(false)
    setDupLoading(false)
  }

  // --- 2. REDISTRIBUCIÓN (BUSCAR LEADS DE OTROS) ---
  const fetchRedistributionData = async () => {
    if (!sourceAgent) return
    setLoading(true)

    let query = supabase.from("leads").select("*").eq("agent_name", sourceAgent)

    if (filterStage !== "all") query = query.eq("status", filterStage.toLowerCase())
    if (filterDateLimit) query = query.lt("created_at", `${filterDateLimit}T23:59:59`)

    const { data, error } = await query
    if (error) console.error(error)
    if (data) setRedistributionList(data as Lead[])
    setLoading(false)
  }

  // --- 3. CEMENTERIO (ESTADÍSTICAS REALES) ---
  const fetchGraveyardStats = async () => {
    // Buscamos leads 'perdidos' o asignados a 'Zombie 🧟'
    const { data, error } = await supabase
      .from("leads")
      .select("agent_name, loss_reason, status")
      .or("status.eq.perdido,agent_name.eq.Zombie 🧟,agent_name.eq.Recupero")

    if (error) console.error(error)

    if (data) {
      const stats = { fantasmas: 0, precio: 0, interes: 0, quemados: 0, zombies: 0, basural: 0 }
      ;(data as any[]).forEach((l: any) => {
        const agent = l.agent_name || ""
        const reason = l.loss_reason?.toLowerCase() || ""
        
        // ✅ PRIORIDAD: Si es Zombie/Recupero, va al cajón Zombie
        if (agent === "Zombie 🧟" || agent === "Recupero") {
            stats.zombies++
        } 
        else if (reason.includes("quemado") || reason.includes("7 llamados")) stats.quemados++
        else if (reason.includes("no contesta") || reason.includes("fantasma")) stats.fantasmas++
        else if (reason.includes("precio") || reason.includes("caro")) stats.precio++
        else if (reason.includes("interes") || reason.includes("no quiere")) stats.interes++
        else stats.basural++
      })
      setGraveyardStats(stats)
    }
  }

  const fetchDrawerLeads = async (category: string) => {
    // ✅ NUEVO CAJÓN ZOMBIE: Busca por agente, no por status
    if (category === "zombies") {
        const { data, error } = await supabase
            .from("leads")
            .select("*")
            .or("agent_name.eq.Zombie 🧟,agent_name.eq.Recupero")
            .limit(100)
        
        if (error) console.error(error)
        if (data) setDrawerLeads(data as Lead[])
        return
    }

    // CAJONES CLÁSICOS (Status = Perdido)
    let reasonFilter = ""
    let query = supabase.from("leads").select("*").eq("status", "perdido").limit(100)

    if (category === "quemados") {
        query = query.ilike('loss_reason', '%quemado%')
    } else if (category === "fantasmas") {
        reasonFilter = "no contesta"
        query = query.ilike('loss_reason', `%${reasonFilter}%`)
    } else if (category === "precio") {
        reasonFilter = "precio"
        query = query.ilike('loss_reason', `%${reasonFilter}%`)
    } else if (category === "interes") {
        reasonFilter = "interes"
        query = query.ilike('loss_reason', `%${reasonFilter}%`)
    } else if (category === "basural") {
        query = query.not('loss_reason', 'ilike', '%quemado%').not('loss_reason', 'ilike', '%precio%').not('loss_reason', 'ilike', '%no contesta%').not('loss_reason', 'ilike', '%interes%')
    }

    const { data, error } = await query
    if (error) console.error(error)
    if (data) setDrawerLeads(data as Lead[])
  }

  // --- ACCIONES DE ASIGNACIÓN (UPDATE REAL) ---
  const executeAssign = async (origin: "inbox" | "redistribucion" | "cementerio") => {
    if (selectedLeads.length === 0 || !targetAgent) return alert("Seleccioná leads y un destino.")

    if (origin === "inbox") {
      const dupSelected = selectedLeads.filter((id) => !!dupMap[id])
      if (dupSelected.length > 0) {
        const ok = confirm(
          `⚠️ Ojo: seleccionaste ${dupSelected.length} lead(s) duplicado(s).\n\nRecomendado: abrir "Ver original" para reasignar bien.\n\n¿Querés asignarlos igual?`
        )
        if (!ok) return
      }
    }

    setLoading(true)

    const updates: any = {
      agent_name: targetAgent,
      last_update: new Date().toISOString(),
    }

    if (origin === "cementerio") {
      updates.status = "nuevo"
      updates.loss_reason = null
      updates.warning_sent = false // Limpiamos alertas de zombie si las tenía
      updates.warning_date = null
      updates.calls = 0 
    }

    const { error } = await supabase.from("leads").update(updates).in("id", selectedLeads)

    if (!error) {
      alert(`✅ ÉXITO: Se asignaron ${selectedLeads.length} leads a ${targetAgent}.`)
      setSelectedLeads([])

      if (origin === "inbox") fetchInbox()
      if (origin === "redistribucion") fetchRedistributionData()
      if (origin === "cementerio") {
        setActiveDrawer(null)
        fetchGraveyardStats()
      }
    } else {
      alert("Error al asignar.")
      console.error(error)
    }

    setLoading(false)
  }

  // --- MODAL DUPLICADOS ---
  const openDupModal = async (lead: Lead) => {
    const original = dupMap[lead.id] || null
    setDupLead(lead)
    setOrigLead(original)
    setDupModalOpen(true)

    if (original?.id) {
      const { data, error } = await supabase.from("leads").select("*").eq("id", original.id).maybeSingle()
      if (error) console.error(error)
      if (data) setOrigLead(data as Lead)
    }
  }

  const reassignOriginalToTarget = async () => {
    if (!origLead?.id) return
    if (!targetAgent) return alert("Elegí un destino arriba (Asignar a...).")

    setLoading(true)
    const { error } = await supabase
      .from("leads")
      .update({ agent_name: targetAgent, last_update: new Date().toISOString() })
      .eq("id", origLead.id)

    setLoading(false)

    if (error) {
      console.error(error)
      return alert("No se pudo reasignar el ORIGINAL.")
    }

    alert(`✅ ORIGINAL reasignado a ${targetAgent}.`)
    setDupModalOpen(false)
    fetchInbox()
  }

  const assignDuplicateToTarget = async () => {
    if (!dupLead?.id) return
    if (!targetAgent) return alert("Elegí un destino arriba (Asignar a...).")

    setLoading(true)
    const { error } = await supabase
      .from("leads")
      .update({ agent_name: targetAgent, last_update: new Date().toISOString() })
      .eq("id", dupLead.id)

    setLoading(false)

    if (error) {
      console.error(error)
      return alert("No se pudo asignar el DUPLICADO.")
    }

    alert(`✅ DUPLICADO asignado a ${targetAgent}.`)
    setDupModalOpen(false)
    fetchInbox()
  }

  const assignDuplicateToSameOwner = async () => {
    if (!dupLead?.id) return
    if (!origLead?.agent_name) return alert("El original no tiene dueño claro para copiar.")

    setLoading(true)
    const { error } = await supabase
      .from("leads")
      .update({ agent_name: origLead.agent_name, last_update: new Date().toISOString() })
      .eq("id", dupLead.id)

    setLoading(false)

    if (error) {
      console.error(error)
      return alert("No se pudo asignar el duplicado al mismo dueño.")
    }

    alert(`✅ DUPLICADO enviado al mismo dueño del original (${origLead.agent_name}).`)
    setDupModalOpen(false)
    fetchInbox()
  }

  // --- HELPERS UI ---
  const handleSelectAll = (list: Lead[], checked: boolean) => {
    if(activeDrawer) {
        // Bloquear selección de congelados
        const available = list.filter(l => !checkFreezeStatus(l, activeDrawer).isFrozen)
        if (checked) setSelectedLeads(available.map((l) => l.id))
        else setSelectedLeads([])
    } else {
        if (checked) setSelectedLeads(list.map((l) => l.id))
        else setSelectedLeads([])
    }
  }
  
  const handleSelectOne = (id: string, checked: boolean) => {
    if (checked) setSelectedLeads((prev) => [...prev, id])
    else setSelectedLeads((prev) => prev.filter((l) => l !== id))
  }
  
  const openDrawer = (category: string) => {
    setActiveDrawer(category)
    fetchDrawerLeads(category)
  }

  const inboxDupCount = useMemo(() => Object.keys(dupMap).length, [dupMap])

  return (
    <div className="p-6 h-full overflow-y-auto max-w-7xl mx-auto space-y-6">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-800 dark:text-white flex items-center gap-2">
            <Layers className="h-8 w-8 text-orange-500" /> LEADS FACTORY
            {loading && <RefreshCw className="h-5 w-5 animate-spin text-slate-400" />}
          </h2>
          <p className="text-slate-500">
            Gestión de flujo, redistribución y reciclaje.
            {inboxDupCount > 0 && <span className="ml-2 text-xs text-red-600 font-bold">⚠️ {inboxDupCount} duplicados en bandeja</span>}
          </p>
        </div>

        <div
          className={`flex items-center gap-4 px-6 py-3 rounded-full border-2 transition-colors ${
            autoAssignEnabled ? "bg-green-50 border-green-500" : "bg-slate-50 border-slate-300"
          }`}
        >
          <div className="flex flex-col">
            <Label
              htmlFor="auto-mode"
              className={`font-black text-sm uppercase ${autoAssignEnabled ? "text-green-700" : "text-slate-500"}`}
            >
              {autoAssignEnabled ? "⚡ Round Robin ACTIVO" : "💤 Asignación Manual"}
            </Label>
            <span className="text-[10px] text-slate-500">
              {autoAssignEnabled ? (
                  <span className="flex items-center gap-1"><Zap size={10} className="fill-yellow-500 text-yellow-500"/> Repartiendo a: {AGENTS[nextAgentIdx]}</span>
              ) : "Los leads esperan en Bandeja."}
            </span>
          </div>
          <Switch id="auto-mode" checked={autoAssignEnabled} onCheckedChange={setAutoAssignEnabled} />
        </div>
      </div>

      <Tabs defaultValue="inbox" className="w-full">
        <TabsList className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-1 h-12 mb-6 w-full justify-start overflow-x-auto">
          <TabsTrigger
            value="inbox"
            className="h-10 px-6 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 font-bold shrink-0"
          >
            📥 Bandeja ({unassignedLeads.length})
          </TabsTrigger>
          <TabsTrigger
            value="redistribute"
            className="h-10 px-6 data-[state=active]:bg-purple-50 data-[state=active]:text-purple-700 font-bold shrink-0"
          >
            🔄 Redistribución (Gestión)
          </TabsTrigger>
          <TabsTrigger
            value="graveyard"
            className="h-10 px-6 data-[state=active]:bg-slate-100 data-[state=active]:text-slate-700 font-bold shrink-0"
          >
            ⚰️ Cementerio Inteligente
          </TabsTrigger>
        </TabsList>

        {/* --- 1. BANDEJA DE ENTRADA --- */}
        <TabsContent value="inbox">
          <Card>
            <CardHeader className="pb-3 border-b bg-slate-50 flex flex-row justify-between items-center">
              <CardTitle>Leads Frescos (Sin Dueño)</CardTitle>
              <div className="flex gap-2">
                <Select value={targetAgent} onValueChange={setTargetAgent}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Asignar a..." />
                  </SelectTrigger>
                  <SelectContent>
                    {AGENTS.map((a) => (
                      <SelectItem key={a} value={a}>
                        {a}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button onClick={() => executeAssign("inbox")} disabled={selectedLeads.length === 0} className="bg-blue-600">
                  Confirmar ({selectedLeads.length})
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <Checkbox
                        checked={unassignedLeads.length > 0 && selectedLeads.length === unassignedLeads.length}
                        onCheckedChange={(c) => handleSelectAll(unassignedLeads, c as boolean)}
                      />
                    </TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>Fuente</TableHead>
                    <TableHead>Duplicado</TableHead>
                  </TableRow>
                </TableHeader>

                <TableBody>
                  {unassignedLeads.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-slate-400">
                        Bandeja vacía. Todo asignado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    unassignedLeads.map((l) => {
                      const original = dupMap[l.id]
                      return (
                        <TableRow key={l.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLeads.includes(l.id)}
                              onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)}
                            />
                          </TableCell>

                          <TableCell>{new Date(l.created_at).toLocaleDateString()}</TableCell>
                          <TableCell className="font-bold">{l.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{l.source || "N/A"}</Badge>
                          </TableCell>

                          <TableCell>
                            {original ? (
                              <div className="flex items-center gap-2">
                                <Badge className="bg-red-100 text-red-700 border border-red-200" variant="outline">
                                  ♻️ Ya asignado a {original.agent_name || "alguien"}
                                </Badge>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7"
                                  onClick={() => openDupModal(l)}
                                >
                                  <ExternalLink className="h-4 w-4 mr-1" />
                                  Ver original
                                </Button>
                              </div>
                            ) : (
                              <Badge variant="outline" className="text-slate-400">
                                OK
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- 2. REDISTRIBUCIÓN --- */}
        <TabsContent value="redistribute">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <Card className="md:col-span-1 h-fit">
              <CardHeader>
                <CardTitle className="text-sm">🔍 Filtros de Cartera</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Vendedor Origen</Label>
                  <Select
                    value={sourceAgent}
                    onValueChange={(v) => {
                      setSourceAgent(v)
                      setRedistributionList([])
                      setSelectedLeads([])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Elegir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENTS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Asignados Antes De:</Label>
                  <Input
                    type="date"
                    value={filterDateLimit}
                    onChange={(e) => setFilterDateLimit(e.target.value)}
                    className="text-sm"
                  />
                  <p className="text-[10px] text-slate-400">Para limpiar leads viejos.</p>
                </div>

                <div className="space-y-2">
                  <Label>Etapa (Kanban)</Label>
                  <Select value={filterStage} onValueChange={setFilterStage}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="nuevo">Nuevo</SelectItem>
                      <SelectItem value="contactado">Contactado</SelectItem>
                      <SelectItem value="cotizacion">Cotizado</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button className="w-full bg-purple-600 hover:bg-purple-700 mt-2" onClick={fetchRedistributionData} disabled={!sourceAgent}>
                  Buscar Leads
                </Button>
              </CardContent>
            </Card>

            <Card className="md:col-span-3">
              <CardHeader className="pb-3 border-b flex flex-row justify-between items-center">
                <div>
                  <CardTitle>Resultados</CardTitle>
                  <CardDescription>{redistributionList.length} leads encontrados</CardDescription>
                </div>
                <div className="flex gap-2 items-center">
                  <span className="text-xs text-slate-500 mr-2">Mover a:</span>
                  <Select value={targetAgent} onValueChange={setTargetAgent}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Destino" />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENTS.filter((a) => a !== sourceAgent).map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => executeAssign("redistribucion")} disabled={selectedLeads.length === 0}>
                    Mover
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox />
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Etapa</TableHead>
                      <TableHead>Origen</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {redistributionList.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-10 text-slate-400">
                          Usá los filtros para buscar leads.
                        </TableCell>
                      </TableRow>
                    ) : (
                      redistributionList.map((l) => (
                        <TableRow key={l.id}>
                          <TableCell>
                            <Checkbox
                              checked={selectedLeads.includes(l.id)}
                              onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)}
                            />
                          </TableCell>
                          <TableCell className="font-bold">{l.name}</TableCell>
                          <TableCell className="font-mono text-xs">{new Date(l.created_at).toLocaleDateString()}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{l.status}</Badge>
                          </TableCell>
                          <TableCell className="text-xs">{l.source || "-"}</TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- 3. CEMENTERIO --- */}
        <TabsContent value="graveyard" className="space-y-6">
          {!activeDrawer ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
              
              {/* ✅ 1. CAJÓN ZOMBIE (NUEVO) */}
              <Card className="hover:border-purple-500 cursor-pointer group border-l-4 border-l-purple-600 shadow-md bg-purple-50/20" onClick={() => { setActiveDrawer("zombies"); fetchDrawerLeads("zombies"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-purple-700 uppercase tracking-widest group-hover:text-purple-800 flex items-center gap-2">
                    <Skull className="h-4 w-4"/> Fosa Zombie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.zombies}</span>
                    <Badge className="bg-purple-200 text-purple-900 border-purple-300">Recuperables</Badge>
                  </div>
                  <p className="text-xs text-purple-500 mt-2 font-medium">Expirados Salud del Tubo</p>
                </CardContent>
              </Card>

              {/* ✅ 2. CAJÓN QUEMADOS */}
              <Card className="hover:border-red-500 cursor-pointer group border-l-4 border-l-red-500 shadow-md bg-red-50/20" onClick={() => { setActiveDrawer("quemados"); fetchDrawerLeads("quemados"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-red-600 uppercase tracking-widest group-hover:text-red-700 flex items-center gap-2">
                    <Flame className="h-4 w-4 animate-pulse"/> Datos Quemados
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.quemados}</span>
                    <Badge className="bg-red-200 text-red-800 hover:bg-red-300">Reciclar</Badge>
                  </div>
                  <p className="text-xs text-red-400 mt-2 font-medium">+7 Llamados s/c</p>
                </CardContent>
              </Card>

              <Card className="hover:border-blue-400 cursor-pointer group" onClick={() => { setActiveDrawer("fantasmas"); fetchDrawerLeads("fantasmas"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-blue-600">
                    Fantasmas
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.fantasmas}</span>
                    <Badge className="bg-blue-100 text-blue-700">Recuperables</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">No contestan</p>
                </CardContent>
              </Card>

              <Card className="hover:border-green-400 cursor-pointer group" onClick={() => { setActiveDrawer("precio"); fetchDrawerLeads("precio"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-green-600">
                    Precio / Fríos
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.precio}</span>
                    <Badge className="bg-green-100 text-green-700">Recuperables</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Muy caros</p>
                </CardContent>
              </Card>

              <Card className="hover:border-orange-400 cursor-pointer group" onClick={() => { setActiveDrawer("interes"); fetchDrawerLeads("interes"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-orange-600">
                    Interés Caído
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.interes}</span>
                    <Badge className="bg-orange-100 text-orange-700">Recuperables</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Lo pensará</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card className="border-t-4 border-t-slate-500 shadow-xl animate-in slide-in-from-bottom-4">
              <CardHeader className="pb-3 border-b bg-slate-50 flex flex-row justify-between items-center">
                <div>
                  <Button variant="ghost" size="sm" className="mb-2 -ml-2 text-slate-500" onClick={() => setActiveDrawer(null)}>
                    ← Volver
                  </Button>
                  <CardTitle className="capitalize flex items-center gap-2">
                    {/* ✅ ÍCONOS DINÁMICOS */}
                    {activeDrawer === 'zombies' ? <Skull className="h-5 w-5 text-purple-600"/> :
                     activeDrawer === 'quemados' ? <Flame className="h-5 w-5 text-red-500 animate-pulse"/> : 
                     <Recycle className="h-5 w-5" />} 
                    Cajón: {activeDrawer}
                  </CardTitle>
                </div>
                <div className="flex gap-2 items-center bg-white p-2 rounded-lg border">
                  <span className="text-xs font-bold mr-2">Revivir y asignar a:</span>
                  <Select value={targetAgent} onValueChange={setTargetAgent}>
                    <SelectTrigger className="w-[150px]">
                      <SelectValue placeholder="Elegir..." />
                    </SelectTrigger>
                    <SelectContent>
                      {AGENTS.map((a) => (
                        <SelectItem key={a} value={a}>
                          {a}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={() => executeAssign("cementerio")} className="bg-green-600 hover:bg-green-700">
                    Reciclar ({selectedLeads.length})
                  </Button>
                </div>
              </CardHeader>

              <CardContent className="p-0 max-h-[500px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[50px]">
                        <Checkbox
                          checked={drawerLeads.length > 0 && selectedLeads.length === drawerLeads.length}
                          onCheckedChange={(c) => handleSelectAll(drawerLeads, c as boolean)}
                        />
                      </TableHead>
                      <TableHead>Nombre</TableHead>
                      {/* ✅ COLUMNA EXTRA DE ESTADO CONGELADO */}
                      <TableHead>Disponibilidad</TableHead>
                      <TableHead>Motivo Muerte</TableHead>
                      <TableHead>Último Dueño</TableHead>
                    </TableRow>
                  </TableHeader>

                  <TableBody>
                    {drawerLeads.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          No hay leads en este cajón.
                        </TableCell>
                      </TableRow>
                    ) : (
                      drawerLeads.map((l) => {
                        // ✅ CHEQUEO DE TIEMPO
                        const { isFrozen, remainingDays } = checkFreezeStatus(l, activeDrawer || "")
                        
                        return (
                          <TableRow key={l.id} className={isFrozen ? "bg-slate-50 opacity-60" : ""}>
                            <TableCell>
                              {isFrozen ? (
                                <Lock className="h-4 w-4 text-slate-300" />
                              ) : (
                                <Checkbox
                                  checked={selectedLeads.includes(l.id)}
                                  onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)}
                                />
                              )}
                            </TableCell>
                            <TableCell className="font-bold">{l.name}</TableCell>
                            <TableCell>
                                {isFrozen ? (
                                    <Badge variant="outline" className="border-blue-200 text-blue-400 bg-blue-50">
                                        <Snowflake size={10} className="mr-1"/> Faltan {remainingDays} días
                                    </Badge>
                                ) : (
                                    <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">
                                        Disponible
                                    </Badge>
                                )}
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                  activeDrawer === 'quemados' ? 'text-red-600 border-red-200 bg-red-50' : 
                                  activeDrawer === 'zombies' ? 'text-purple-600 border-purple-200 bg-purple-50' : ''
                              }>
                                  {l.loss_reason || (activeDrawer === 'zombies' ? 'Inactividad' : "Desconocido")}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{l.agent_name === 'Zombie 🧟' ? 'Sistema' : l.agent_name}</TableCell>
                          </TableRow>
                        )
                      })
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* MODAL DUPLICADOS */}
      <Dialog open={dupModalOpen} onOpenChange={setDupModalOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>♻️ Duplicado detectado</DialogTitle>
            <DialogDescription>
              Podés ver el original y elegir la acción más práctica para que no se pisen entre vendedoras.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-lg border p-3">
              <div className="text-xs font-black text-slate-500 uppercase mb-2">Este lead (duplicado en bandeja)</div>
              <div className="font-bold">{dupLead?.name || "-"}</div>
              <div className="text-sm text-slate-600 mt-1">📞 {dupLead?.phone || "-"}</div>
              <div className="text-sm text-slate-600">📎 phone_norm: {dupLead?.phone_norm || "-"}</div>
              <div className="text-sm text-slate-600">✉️ {dupLead?.email || "-"}</div>
              <div className="text-xs text-slate-500 mt-2">
                Creado: {dupLead?.created_at ? new Date(dupLead.created_at).toLocaleString() : "-"}
              </div>
              <div className="text-xs text-slate-500">Fuente: {dupLead?.source || "-"}</div>
            </div>

            <div className="rounded-lg border p-3">
              <div className="text-xs font-black text-slate-500 uppercase mb-2">Original (ya asignado)</div>
              <div className="font-bold">{origLead?.name || "—"}</div>
              <div className="text-sm text-slate-600 mt-1">📞 {origLead?.phone || "-"}</div>
              <div className="text-sm text-slate-600">📎 phone_norm: {origLead?.phone_norm || "-"}</div>
              <div className="text-sm text-slate-600">✉️ {origLead?.email || "-"}</div>

              <div className="text-xs text-slate-500 mt-2">
                Dueño actual: <span className="font-bold text-slate-700">{origLead?.agent_name || "—"}</span>
              </div>
              <div className="text-xs text-slate-500">
                Creado: {origLead?.created_at ? new Date(origLead.created_at).toLocaleString() : "—"}
              </div>
              <div className="text-xs text-slate-500">Estado: {origLead?.status || "—"}</div>
            </div>
          </div>

          <DialogFooter className="flex flex-col md:flex-row gap-2 md:justify-between md:items-center">
            <div className="text-xs text-slate-500">
              Tip: si querés reasignar, elegí arriba “Asignar a…” y apretá el botón correspondiente.
            </div>

            <div className="flex flex-wrap gap-2 justify-end">
              <Button variant="outline" onClick={() => setDupModalOpen(false)}>
                Cerrar
              </Button>

              <Button
                variant="outline"
                onClick={assignDuplicateToSameOwner}
                disabled={!dupLead?.id || !origLead?.agent_name}
              >
                Mandar duplicado al mismo dueño ({origLead?.agent_name || "—"})
              </Button>

              <Button
                variant="outline"
                onClick={reassignOriginalToTarget}
                disabled={!origLead?.id || !targetAgent}
              >
                Reasignar ORIGINAL a {targetAgent || "…"}
              </Button>

              <Button onClick={assignDuplicateToTarget} disabled={!dupLead?.id || !targetAgent}>
                Asignar DUPLICADO a {targetAgent || "…"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}