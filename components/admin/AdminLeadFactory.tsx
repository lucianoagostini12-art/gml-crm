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
import { Layers, Recycle, RefreshCw, ExternalLink, Flame, Snowflake, Lock, Zap, Skull, Clock, Tag, MessageCircle, Eye, XCircle, DollarSign, ThumbsDown, Trash2, ShieldAlert, Activity, HelpCircle, Archive, Ban, User } from "lucide-react"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"

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
    recontactar: 90, // ✅ NUEVO: Competencia / Otros (3 meses)
    basural: 365    // ✅ NUEVO: Error / Salud (1 año)
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
  prepaga?: string | null // ✅ Agregado para detectar colores
  chat?: any[] // ✅ Agregado para el chat
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

// --- 1) TUS COLORES DE PREPAGAS ---
const getPrepagaBadgeColor = (prepaga?: string | null) => {
    if (!prepaga) return "bg-slate-100 text-slate-600 border-slate-200"
    
    const p = prepaga

    if (p.includes("Prevención") || p.includes("Prevencion")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
    if (p.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
    if (p.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
    if (p.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
    if (p.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
    if (p.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"
    
    return "bg-slate-100 text-slate-800 border-slate-200"
}

// --- 2) CÁLCULO DE TIEMPO TRANSCURRIDO ---
const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHrs = Math.floor(diffMins / 60)
    
    if (diffMins < 1) return "Ahora"
    if (diffMins < 60) return `${diffMins} min`
    if (diffHrs < 24) return `${diffHrs} hs`
    return `${Math.floor(diffHrs / 24)} d`
}

export function AdminLeadFactory() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)

  // ESTADOS DE DATOS
  const [unassignedLeads, setUnassignedLeads] = useState<Lead[]>([])
  const [redistributionList, setRedistributionList] = useState<Lead[]>([])
  const [drawerLeads, setDrawerLeads] = useState<Lead[]>([])

  // ✅ LISTA DE VENDEDORES (Objetos completos para fotos)
  const [agentsList, setAgentsList] = useState<{name: string, avatar: string}[]>([])
  // ✅ ESTADO PARA MONITOR DIARIO
  const [dailyAssignments, setDailyAssignments] = useState<Record<string, number>>({})

  // SELECCIÓN
  const [selectedLeads, setSelectedLeads] = useState<string[]>([])
  const [targetAgent, setTargetAgent] = useState("")
  
  // AUTOMATIZACIÓN (ROUND ROBIN)
  const [autoAssignEnabled, setAutoAssignEnabled] = useState(false)
  const [nextAgentIdx, setNextAgentIdx] = useState(0)

  // FILTROS REDISTRIBUCIÓN
  const [sourceAgent, setSourceAgent] = useState("")
  const [filterDateLimit, setFilterDateLimit] = useState("")
  const [filterStage, setFilterStage] = useState("all")
  const [filterSource, setFilterSource] = useState("all")

  // ESTADOS CEMENTERIO (ESTADÍSTICAS)
  const [graveyardStats, setGraveyardStats] = useState({
    fantasmas: 0, precio: 0, interes: 0, quemados: 0, zombies: 0, recontactar: 0, basural: 0 // ✅ NUEVOS CAMPOS
  })
  const [activeDrawer, setActiveDrawer] = useState<string | null>(null)

  // DEDUPE MAP
  const [dupMap, setDupMap] = useState<Record<string, Lead>>({})
  const [dupLoading, setDupLoading] = useState(false)

  // MODALES
  const [dupModalOpen, setDupModalOpen] = useState(false)
  const [dupLead, setDupLead] = useState<Lead | null>(null)
  const [origLead, setOrigLead] = useState<Lead | null>(null)
  const [triageModalOpen, setTriageModalOpen] = useState(false)
  const [leadToTriage, setLeadToTriage] = useState<Lead | null>(null)

  // CARGA INICIAL
  useEffect(() => {
    fetchInbox()
    fetchGraveyardStats()
    fetchRealAgents() // ✅ CARGA REAL
    fetchDailyStats() // ✅ Carga inicial de contadores

    // ✅ SUSCRIPCIÓN REALTIME MEJORADA (Escucha TODO cambio en leads y en historial)
    // Escuchamos 'lead_status_history' para actualizar el contador al instante
    const historyChannel = supabase.channel('factory_history_listener')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'lead_status_history' }, () => {
            fetchDailyStats() 
        })
        .subscribe()

    // Escuchamos 'leads' para actualizar la bandeja
    const leadsChannel = supabase.channel('factory_leads_listener')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
            fetchInbox()
            fetchGraveyardStats()
            if (activeDrawer) {
                // fetchDrawerLeads(activeDrawer) -> Opcional
            }
        })
        .subscribe()

    return () => { 
        supabase.removeChannel(historyChannel) 
        supabase.removeChannel(leadsChannel) 
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ✅ 1. TRAER SOLO SELLERS REALES CON FOTO
  const fetchRealAgents = async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, avatar_url, email, role') 
        .or('role.eq.seller,role.eq.gestor') // ✅ FILTRO POR ROL

      if (data && data.length > 0) {
          const formatted = data.map((p: any) => ({
              name: p.full_name || p.email,
              avatar: p.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.email}`
          })).sort((a,b) => a.name.localeCompare(b.name))
          
          setAgentsList(formatted)
      } else {
          console.error("No se encontraron sellers en la base.", error)
          setAgentsList([]) 
      }
  }

  // ✅ 2. CONTADORES DE ASIGNACIÓN DIARIA (LOGICA CRUCE TABLAS)
  const fetchDailyStats = async () => {
      const startOfDay = new Date()
      startOfDay.setHours(0,0,0,0)

      // ✅ SOLO BANDEJA: contamos asignaciones de HOY que vienen desde la bandeja (from_status = 'inbox')
      // Para que esto funcione, cuando asignamos desde Bandeja guardamos en historial:
      // from_status: 'inbox'  | to_status: 'nuevo' | agent_name: <vendedora destino>
      const { data: historyData, error } = await supabase
          .from('lead_status_history')
          .select('agent_name')
          .gte('changed_at', startOfDay.toISOString())
          .eq('to_status', 'nuevo')
          .eq('from_status', 'inbox')
          .not('agent_name', 'is', null)

      if (error) {
          console.error(error)
          setDailyAssignments({})
          return
      }

      const counts: Record<string, number> = {}

      if (historyData && historyData.length > 0) {
          historyData.forEach((h: any) => {
              const name = h.agent_name
              if (!name) return
              counts[name] = (counts[name] || 0) + 1
          })
      }

      setDailyAssignments(counts)
  }

  // --- 🤖 MOTOR DE ASIGNACIÓN AUTOMÁTICA (ROUND ROBIN) ---
  useEffect(() => {
    let timeout: NodeJS.Timeout

    const processAutoAssign = async () => {
        if (autoAssignEnabled && unassignedLeads.length > 0 && !loading && agentsList.length > 0) {
            
            const leadToAssign = unassignedLeads[0]
            const agentToAssign = agentsList[nextAgentIdx].name // ✅ Usamos el objeto

            // Optimistic Update local
            const remainingLeads = unassignedLeads.slice(1)
            setUnassignedLeads(remainingLeads)
            setNextAgentIdx((prev) => (prev + 1) % agentsList.length)

            await supabase.from('leads').update({
                agent_name: agentToAssign,
                status: 'nuevo',
                last_update: new Date().toISOString()
            }).eq('id', leadToAssign.id)
            
            // Forzamos la creación de historial para que el contador lo detecte
            await supabase.from('lead_status_history').insert({
                lead_id: leadToAssign.id,
                from_status: 'inbox',
                to_status: 'nuevo',
                agent_name: agentToAssign,
                changed_at: new Date().toISOString()
            })
        }
    }

    if (autoAssignEnabled && unassignedLeads.length > 0) {
        timeout = setTimeout(processAutoAssign, 1500)
    }

    return () => clearTimeout(timeout)
  }, [autoAssignEnabled, unassignedLeads, nextAgentIdx, loading, agentsList])


  // --- LÓGICA DE CONGELAMIENTO (INTACTA) ---
  const checkFreezeStatus = (lead: Lead, drawerType: string) => {
      if (!lead.last_update) return { isFrozen: false, remainingDays: 0 }
      const lostDate = new Date(lead.last_update)
      const now = new Date()
      const daysPassed = Math.floor((now.getTime() - lostDate.getTime()) / (1000 * 60 * 60 * 24))
      const requiredDays = FREEZE_CONFIG[drawerType] || 0
      if (daysPassed < requiredDays) {
          return { isFrozen: true, remainingDays: requiredDays - daysPassed }
      }
      return { isFrozen: false, remainingDays: 0 }
  }

  // --- 1. BANDEJA DE ENTRADA (SIN DUEÑO) ---
  const fetchInbox = async () => {
    setLoading(true)
    setDupLoading(true)

    // ✅ FIX CRÍTICO: Excluimos 'perdido' para que al descartar desaparezca
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .or("agent_name.is.null,agent_name.eq.Sin Asignar")
      .neq('status', 'perdido') // 🔥 ESTO HACE LA MAGIA: Si está perdido, NO lo muestra en bandeja
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

    // LÓGICA DEDUPE (INTACTA)
    const phones = Array.from(
      new Set(
        inbox
          .map((l) => (l.phone_norm && l.phone_norm.trim()) || normPhone(l.phone))
          .filter(Boolean)
      )
    )
    const emails = Array.from(new Set(inbox.map((l) => normEmail(l.email)).filter(Boolean)))

    if (phones.length === 0 && emails.length === 0) {
      setDupMap({})
      setLoading(false)
      setDupLoading(false)
      return
    }

    const candidates: Lead[] = []

    if (phones.length > 0) {
      const { data: pData } = await supabase.from("leads").select("*").in("phone_norm", phones as any).not("agent_name", "is", null).neq("agent_name", "Sin Asignar")
      if (pData) candidates.push(...(pData as Lead[]))
    }

    if (emails.length > 0) {
      const { data: eData } = await supabase.from("leads").select("*").in("email", emails as any).not("agent_name", "is", null).neq("agent_name", "Sin Asignar")
      if (eData) candidates.push(...(eData as Lead[]))
    }

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

  // --- 2. REDISTRIBUCIÓN ---
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

  // --- 3. CEMENTERIO ---
  const fetchGraveyardStats = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("agent_name, loss_reason, status")
      .or("status.eq.perdido,agent_name.eq.Zombie 🧟,agent_name.eq.Recupero")

    if (error) console.error(error)

    if (data) {
      const stats = { fantasmas: 0, precio: 0, interes: 0, quemados: 0, zombies: 0, recontactar: 0, basural: 0 }
      ;(data as any[]).forEach((l: any) => {
        const agent = l.agent_name || ""
        const reason = l.loss_reason?.toLowerCase() || ""
        
        if (agent === "Zombie 🧟" || agent === "Recupero") {
            stats.zombies++
        } 
        else if (reason.includes("quemado") || reason.includes("7 llamados")) stats.quemados++
        else if (reason.includes("no contesta") || reason.includes("fantasma")) stats.fantasmas++
        else if (reason.includes("precio") || reason.includes("caro")) stats.precio++
        else if (reason.includes("interes") || reason.includes("no quiere")) stats.interes++
        // ✅ CLASIFICACIÓN NUEVA
        else if (reason.includes("competencia") || reason.includes("otros")) stats.recontactar++
        else if (reason.includes("error") || reason.includes("requisitos") || reason.includes("salud")) stats.basural++
        
        else stats.basural++ // Default a basural por si acaso
      })
      setGraveyardStats(stats)
    }
  }

  const fetchDrawerLeads = async (category: string) => {
    if (category === "zombies") {
        const { data } = await supabase
            .from("leads")
            .select("*")
            .or("agent_name.eq.Zombie 🧟,agent_name.eq.Recupero")
            .limit(100)
        
        if (error) console.error(error)
        if (data) setDrawerLeads(data as Lead[])
        return
    }

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
    } 
    // ✅ NUEVOS FILTROS
    else if (category === "recontactar") {
        query = query.or("loss_reason.ilike.%competencia%,loss_reason.ilike.%otros%")
    } else if (category === "basural") {
        query = query.or("loss_reason.ilike.%error%,loss_reason.ilike.%requisitos%,loss_reason.ilike.%salud%")
    }

    const { data, error } = await query
    if (error) console.error(error)
    if (data) setDrawerLeads(data as Lead[])
  }

  // --- ACCIONES DE ASIGNACIÓN ---
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
      updates.warning_sent = false
      updates.warning_date = null
      updates.calls = 0 
    }

    const { error } = await supabase.from("leads").update(updates).in("id", selectedLeads)

    if (!error) {
      // ✅ IMPORTANTE: CREAR HISTORIAL MANUALMENTE PARA EL CONTADOR
      // Si el trigger de la base de datos no lo hace, lo hacemos aquí para asegurar que 'fetchDailyStats' lo vea.
      const historyEntries = selectedLeads.map(id => ({
          lead_id: id,
          from_status: origin === 'inbox' ? 'inbox' : (origin === 'cementerio' ? 'perdido' : 'ingresado'), 
          to_status: 'nuevo',
          agent_name: origin === 'inbox' ? targetAgent : 'Admin', // El "Actor" del cambio
          changed_at: new Date().toISOString()
      }))
      
      // Intentamos insertar, si falla no es crítico para la asignación, pero sí para el contador
      await supabase.from('lead_status_history').insert(historyEntries)

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

  // --- 🚀 ACCIONES DE TRIAJE (ALINEADAS CON VENDEDORES) ---
  const handleMoveToGraveyard = async (leadId: string, reason: string) => {
      setLoading(true)
      let updates: any = { status: 'perdido', last_update: new Date().toISOString(), loss_reason: reason }
      
      // Caso especial Zombie
      if(reason === 'Zombie') {
          updates.agent_name = 'Zombie 🧟'
          // No cambiamos loss_reason, queda marcado como zombie por el agente
      }

      await supabase.from('leads').update(updates).eq('id', leadId)
      
      setTriageModalOpen(false)
      setLoading(false)
      fetchInbox()
      fetchGraveyardStats()
  }

  const handleAssignFromTriage = async (leadId: string) => {
      if(!targetAgent) return alert("Seleccioná un vendedor primero")
      setLoading(true)
      
      await supabase.from('leads').update({
          agent_name: targetAgent,
          status: 'nuevo',
          last_update: new Date().toISOString()
      }).eq('id', leadId)

      // Historial manual para el contador
      await supabase.from('lead_status_history').insert({
          lead_id: leadId,
          from_status: 'inbox',
          to_status: 'nuevo',
          agent_name: targetAgent,
          changed_at: new Date().toISOString()
      })
      
      setTriageModalOpen(false)
      setLoading(false)
      fetchInbox()
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
    await supabase.from("leads").update({ agent_name: targetAgent, last_update: new Date().toISOString() }).eq("id", origLead.id)
    
    // Historial
    await supabase.from('lead_status_history').insert({
        lead_id: origLead.id, from_status: origLead.status, to_status: 'nuevo', agent_name: 'Admin', changed_at: new Date().toISOString()
    })

    setLoading(false)
    setDupModalOpen(false)
    fetchInbox()
  }

  const assignDuplicateToTarget = async () => {
    if (!dupLead?.id) return
    if (!targetAgent) return alert("Elegí un destino arriba (Asignar a...).")

    setLoading(true)
    await supabase.from("leads").update({ agent_name: targetAgent, last_update: new Date().toISOString() }).eq("id", dupLead.id)
    
    // Historial
    await supabase.from('lead_status_history').insert({
        lead_id: dupLead.id, from_status: dupLead.status, to_status: 'nuevo', agent_name: 'Admin', changed_at: new Date().toISOString()
    })

    setLoading(false)
    setDupModalOpen(false)
    fetchInbox()
  }

  const assignDuplicateToSameOwner = async () => {
    if (!dupLead?.id) return
    if (!origLead?.agent_name) return alert("El original no tiene dueño claro para copiar.")

    setLoading(true)
    await supabase.from("leads").update({ agent_name: origLead.agent_name, last_update: new Date().toISOString() }).eq("id", dupLead.id)
    
    // Historial
    await supabase.from('lead_status_history').insert({
        lead_id: dupLead.id, from_status: dupLead.status, to_status: 'nuevo', agent_name: 'Admin', changed_at: new Date().toISOString()
    })

    setLoading(false)
    setDupModalOpen(false)
    fetchInbox()
  }

  // --- HELPERS UI ---
  const handleSelectAll = (list: Lead[], checked: boolean) => {
    if(activeDrawer) {
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
                  // ✅ Muestra el usuario REAL
                  <span className="flex items-center gap-1"><Zap size={10} className="fill-yellow-500 text-yellow-500"/> Repartiendo a: {agentsList[nextAgentIdx]?.name}</span>
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
          
          {/* ✅ NUEVO: MONITOR DE DISTRIBUCIÓN DIARIA (Estilo Semáforo ACUMULATIVO) */}
          {agentsList.length > 0 && (
              <div className="mb-4 bg-white p-4 rounded-xl border shadow-sm animate-in fade-in slide-in-from-top-4">
                  <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Activity className="h-4 w-4"/> Asignaciones Totales de Hoy
                  </h4>
                  <div className="flex flex-wrap gap-4">
                      {agentsList.map((agent) => (
                          <div key={agent.name} className="flex flex-col items-center gap-2 bg-slate-50 px-3 py-2 rounded-xl border border-slate-100 min-w-[80px]">
                              <div className="relative">
                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                    <AvatarImage src={agent.avatar} />
                                    <AvatarFallback>{agent.name[0]}</AvatarFallback>
                                </Avatar>
                                {/* Fueguito si tiene más de 5 leads asignados hoy */}
                                {dailyAssignments[agent.name] > 5 && (
                                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 rounded-full border border-white animate-pulse">🔥</div>
                                )}
                              </div>
                              
                              <div className="text-center">
                                  <span className="text-[10px] font-bold text-slate-600 block truncate max-w-[80px]">{agent.name.split(' ')[0]}</span>
                                  <div className={`mt-1 text-xs font-black px-2 py-0.5 rounded-full ${dailyAssignments[agent.name] > 0 ? 'bg-green-100 text-green-700' : 'bg-slate-200 text-slate-500'}`}>
                                      {dailyAssignments[agent.name] || 0}
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          )}

          <Card>
            <CardHeader className="pb-3 border-b bg-slate-50 flex flex-row justify-between items-center">
              <CardTitle>Leads Frescos (Sin Dueño)</CardTitle>
              <div className="flex gap-2">
                {/* ✅ SELECTOR DINÁMICO */}
                <Select value={targetAgent} onValueChange={setTargetAgent}>
                  <SelectTrigger className="w-[180px] bg-white">
                    <SelectValue placeholder="Asignar a..." />
                  </SelectTrigger>
                  <SelectContent>
                    {agentsList.map((a) => (
                      <SelectItem key={a.name} value={a.name}>
                        {a.name}
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
                    <TableHead>Datos (Interés + Fuente)</TableHead>
                    <TableHead>Acción</TableHead>
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
                        <TableRow key={l.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => { setLeadToTriage(l); setTriageModalOpen(true) }}>
                          <TableCell onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={selectedLeads.includes(l.id)}
                              onCheckedChange={(c) => handleSelectOne(l.id, c as boolean)}
                            />
                          </TableCell>

                          {/* ✅ 2) FECHA MEJORADA */}
                          <TableCell>
                            <div className="flex flex-col">
                                <span className="font-bold text-slate-700">
                                    {new Date(l.created_at).toLocaleString('es-AR', {
                                        day: '2-digit', month: '2-digit', year: 'numeric',
                                        hour: '2-digit', minute: '2-digit'
                                    })}
                                </span>
                                <span className="text-[10px] text-blue-500 font-medium flex items-center gap-1">
                                    <Clock size={10}/> {formatTimeAgo(l.created_at)}
                                </span>
                            </div>
                          </TableCell>
                          
                          <TableCell className="font-bold text-base">{l.name}</TableCell>
                          
                          {/* ✅ 1) COLORES Y FUENTE */}
                          <TableCell>
                             <div className="flex flex-col gap-1 items-start">
                                {l.prepaga ? (
                                    <Badge variant="outline" className={getPrepagaBadgeColor(l.prepaga)}>
                                        {l.prepaga}
                                    </Badge>
                                ) : (
                                    <span className="text-[10px] text-slate-300">--</span>
                                )}
                                <div className="flex items-center gap-1 text-[11px] text-slate-500">
                                    <Tag size={10}/> {l.source || "N/A"}
                                </div>
                            </div>
                          </TableCell>

                          <TableCell>
                            {original ? (
                              <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                                <Badge className="bg-red-100 text-red-700 border border-red-200" variant="outline">
                                  ♻️ Tiene {original.agent_name}
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
                              <Button size="sm" variant="ghost" className="text-blue-600 hover:bg-blue-50">
                                <Eye className="h-4 w-4 mr-2"/> Analizar
                              </Button>
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
                    {/* ✅ SELECTOR DINÁMICO */}
                    <SelectContent>
                      {agentsList.map((a) => (
                        <SelectItem key={a.name} value={a.name}>
                          {a.name}
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
                    {/* ✅ SELECTOR DINÁMICO (FILTRADO) */}
                    <SelectContent>
                      {agentsList.filter((a) => a.name !== sourceAgent).map((a) => (
                        <SelectItem key={a.name} value={a.name}>
                          {a.name}
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

              {/* ✅ NUEVO CAJÓN: RECONTACTAR */}
              <Card className="hover:border-slate-400 cursor-pointer group" onClick={() => { setActiveDrawer("recontactar"); fetchDrawerLeads("recontactar"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-slate-500 uppercase tracking-widest group-hover:text-slate-700 flex items-center gap-2">
                    <Archive className="h-4 w-4"/> Recontactar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.recontactar}</span>
                    <Badge className="bg-slate-100 text-slate-700">90 días</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Competencia / Otros</p>
                </CardContent>
              </Card>

              {/* ✅ NUEVO CAJÓN: BASURAL */}
              <Card className="hover:border-red-800 cursor-pointer group border-l-4 border-l-slate-800 shadow-md bg-slate-50" onClick={() => { setActiveDrawer("basural"); fetchDrawerLeads("basural"); }}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                    <Ban className="h-4 w-4 text-red-600"/> Basural
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between items-end">
                    <span className="text-4xl font-black text-slate-800 dark:text-white">{graveyardStats.basural}</span>
                    <Badge variant="destructive">365 días</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-2">Error / Salud</p>
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
                    {/* ✅ SELECTOR DINÁMICO */}
                    <SelectContent>
                      {agentsList.map((a) => (
                        <SelectItem key={a.name} value={a.name}>
                          {a.name}
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
                          <TableRow key={l.id} className={checkFreezeStatus(l, activeDrawer || "").isFrozen ? "opacity-60" : ""}>
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

      {/* --- 🚀 MODAL TRIAJE / CHAT (AJUSTE FINAL: ANCHO Y SCROLL) --- */}
      <Dialog open={triageModalOpen} onOpenChange={setTriageModalOpen}>
        <DialogContent style={{ maxWidth: '1200px', width: '95%', height: '90vh' }} className="flex flex-col p-0 gap-0 overflow-hidden">
          <DialogHeader className="p-4 border-b bg-slate-50/50">
            <DialogTitle className="flex items-center gap-2">
                🕵️ Triaje de Lead: <span className="text-blue-600">{leadToTriage?.name}</span>
                {leadToTriage?.prepaga && <Badge className={getPrepagaBadgeColor(leadToTriage.prepaga)}>{leadToTriage.prepaga}</Badge>}
            </DialogTitle>
            <DialogDescription>Revisá el chat y decidí el destino del lead.</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-3 flex-1 overflow-hidden">
            {/* COLUMNA IZQUIERDA: DATOS */}
            <div className="bg-slate-50 p-6 border-r space-y-6 h-full overflow-y-auto">
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Teléfono</Label>
                    <div className="font-mono text-lg font-black text-slate-700">{leadToTriage?.phone}</div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Origen</Label>
                    <div className="font-bold text-slate-700 flex items-center gap-2"><Tag size={14}/> {leadToTriage?.source}</div>
                </div>
                <div className="space-y-1">
                    <Label className="text-xs text-slate-500 uppercase font-bold tracking-wider">Ingreso</Label>
                    <div className="text-sm font-medium text-slate-600">{leadToTriage?.created_at && new Date(leadToTriage.created_at).toLocaleString()}</div>
                </div>
                
                <div className="pt-6 border-t border-slate-200">
                    <Label className="text-xs text-slate-500 uppercase mb-3 block font-bold">Asignar Manualmente</Label>
                    <div className="flex gap-2">
                        <Select value={targetAgent} onValueChange={setTargetAgent}>
                            <SelectTrigger className="bg-white"><SelectValue placeholder="Elegir Vendedor..." /></SelectTrigger>
                            <SelectContent>
                                {agentsList.map((a) => (<SelectItem key={a.name} value={a.name}>{a.name}</SelectItem>))}
                            </SelectContent>
                        </Select>
                        <Button size="icon" onClick={() => leadToTriage && handleAssignFromTriage(leadToTriage.id)} disabled={!targetAgent} className="bg-blue-600 hover:bg-blue-700 shadow-md shrink-0"><Zap className="h-4 w-4"/></Button>
                    </div>
                </div>
            </div>

            {/* COLUMNA CENTRAL: CHAT CON SCROLL INTELIGENTE */}
            <div className="md:col-span-2 bg-white flex flex-col h-full overflow-hidden">
                <div className="bg-slate-50 p-3 border-b flex items-center gap-2 shrink-0">
                    <MessageCircle className="h-4 w-4 text-slate-500"/> <span className="font-bold text-sm text-slate-700">Historial de Chat</span>
                </div>
                
                <div className="flex-1 overflow-hidden relative bg-slate-50/30">
                    <ScrollArea className="h-full w-full p-6">
                        <div className="space-y-4 pb-4">
                            {leadToTriage?.chat && Array.isArray(leadToTriage.chat) && leadToTriage.chat.length > 0 ? (
                                leadToTriage.chat.map((msg: any, i: number) => (
                                    <div key={i} className={`flex ${msg.isMe || msg.user === 'Bot' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] px-4 py-2.5 rounded-2xl text-sm shadow-sm ${msg.isMe || msg.user === 'Bot' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white border text-slate-700 rounded-tl-none'}`}>
                                            <p>{msg.text}</p>
                                            <span className={`text-[10px] block text-right mt-1 font-medium ${msg.isMe ? 'text-blue-200' : 'text-slate-400'}`}>{msg.time}</span>
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="text-center py-20 text-slate-400 italic">
                                    <MessageCircle className="h-10 w-10 mx-auto mb-2 opacity-20"/>
                                    No hay historial de chat disponible.
                                    <br/><span className="text-xs">Este lead entró sin conversación previa o antes de la integración.</span>
                                </div>
                            )}
                        </div>
                    </ScrollArea>
                </div>
                
                {/* BOTONERA DE CEMENTERIO */}
                <div className="p-4 bg-white border-t grid grid-cols-3 gap-3 shrink-0 shadow-[0_-5px_15px_-5px_rgba(0,0,0,0.05)] z-10">
                    <Button variant="outline" className="text-xs border-green-200 hover:bg-green-50 text-green-700 flex flex-col h-auto py-3 font-bold" onClick={() => leadToTriage && handleMoveToGraveyard(leadToTriage.id, 'precio')}>
                        <DollarSign className="h-4 w-4 mb-1"/> Precio / Muy caro
                    </Button>
                    <Button variant="outline" className="text-xs border-blue-200 hover:bg-blue-50 text-blue-700 flex flex-col h-auto py-3 font-bold" onClick={() => leadToTriage && handleMoveToGraveyard(leadToTriage.id, 'no_contesta')}>
                        <XCircle className="h-4 w-4 mb-1"/> No contesta
                    </Button>
                    <Button variant="outline" className="text-xs border-orange-200 hover:bg-orange-50 text-orange-700 flex flex-col h-auto py-3 font-bold" onClick={() => leadToTriage && handleMoveToGraveyard(leadToTriage.id, 'competencia')}>
                        <ShieldAlert className="h-4 w-4 mb-1"/> Competencia
                    </Button>
                    <Button variant="outline" className="text-xs border-purple-200 hover:bg-purple-50 text-purple-700 flex flex-col h-auto py-3 font-bold" onClick={() => leadToTriage && handleMoveToGraveyard(leadToTriage.id, 'requisitos')}>
                        <Activity className="h-4 w-4 mb-1"/> Requisitos / Salud
                    </Button>
                    <Button variant="outline" className="text-xs border-red-200 hover:bg-red-50 text-red-700 flex flex-col h-auto py-3 font-bold" onClick={() => leadToTriage && handleMoveToGraveyard(leadToTriage.id, 'error')}>
                        <Trash2 className="h-4 w-4 mb-1"/> Error / No solicitó
                    </Button>
                    <Button variant="outline" className="text-xs border-slate-200 hover:bg-slate-50 text-slate-700 flex flex-col h-auto py-3 font-bold" onClick={() => leadToTriage && handleMoveToGraveyard(leadToTriage.id, 'otros')}>
                        <HelpCircle className="h-4 w-4 mb-1"/> Otros
                    </Button>
                </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL DUPLICADOS (INTACTO) */}
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