"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import { 
  Bot, User, Send, Sliders, MessageSquare, PauseCircle, Search, BrainCircuit, 
  Sparkles, AlertCircle, CheckCircle2, Clock, MapPin, Zap, X, Archive, Tag, 
  Flame, Filter, ChevronDown, Plus, Edit2, Trash2, Save, FolderOpen, Star,
  Bell, CalendarClock, UserPlus, MoreVertical, ExternalLink, RefreshCw,
  StickyNote, CheckSquare, Square, FileText, History, Briefcase
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { toast } from "sonner"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

// --- TIPOS ---
type Lead = {
  id: string
  name: string
  phone: string
  province?: string | null
  prepaga?: string | null
  status: string
  source: string
  chat: any[]
  ai_status: 'active' | 'paused' | 'disabled'
  ai_mood?: string
  ai_summary?: string
  last_update: string
  notes?: string
  agent_name?: string
  assigned_to?: string
  comments?: Comment[]
  reminders?: Reminder[]
  tags?: string[]
  priority?: 'normal' | 'high'
  archived?: boolean
  inbox_status?: InboxStatus
  unread_count?: number
  last_message_from?: 'client' | 'agent' | 'ai'
  loss_reason?: string | null
  ai_labels?: string[]
}


type Comment = {
  text: string
  author: string
  timestamp: string
}

type Reminder = {
  task: string
  status: 'pending' | 'done'
  due_date?: string
  assigned_to?: string
  created_at: string
}

type InboxStatus = 'unread' | 'pending' | 'intervention' | 'snoozed' | 'archived' | 'blocked' | 'hot'

type OfficeHours = {
  enabled: boolean
  tz: string
  days: number[]
  start: string
  end: string
}

type QuickReplyFolder = {
  name: string
  replies: QuickReply[]
}

type QuickReply = {
  id: string
  text: string
  favorite?: boolean
}

type Profile = {
  id: string
  full_name: string
  email: string
  role: string
}

// --- UTILS ---
const nowInTzParts = (tz: string) => {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
  const parts = fmt.formatToParts(new Date())
  const byType = (t: string) => parts.find((p) => p.type === t)?.value
  const weekday = byType("weekday") || "Mon"
  const hour = parseInt(byType("hour") || "0", 10)
  const minute = parseInt(byType("minute") || "0", 10)
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
  return { dow: weekdayMap[weekday] ?? 1, hour, minute }
}

const hhmmToMinutes = (hhmm: string) => {
  const [h, m] = String(hhmm || "").split(":")
  const hh = parseInt(h || "0", 10)
  const mm = parseInt(m || "0", 10)
  return hh * 60 + mm
}

const isWithinOfficeHours = (cfg: OfficeHours) => {
  if (!cfg.enabled) return true
  const { dow, hour, minute } = nowInTzParts(cfg.tz)
  if (!cfg.days.includes(dow)) return false
  const nowM = hour * 60 + minute
  const startM = hhmmToMinutes(cfg.start)
  const endM = hhmmToMinutes(cfg.end)
  return nowM >= startM && nowM <= endM
}

const replaceVariables = (text: string, lead: Lead) => {
  return text
    .replace(/\{nombre\}/g, lead.name || '')
    .replace(/\{prepaga\}/g, lead.prepaga || 'N/D')
    .replace(/\{zona\}/g, lead.province || 'N/D')
    .replace(/\{edad\}/g, lead.dob ? String(new Date().getFullYear() - new Date(lead.dob).getFullYear()) : 'N/D')
}

// --- CAMPAÑAS UTILS (UI sin WhatsApp API aún) ---
const buildCampaignRecipients = (
  leads: any[],
  campaignLoss: string,
  campaignStatus: string,
  includeArchived: boolean
) => {
  const loss = String(campaignLoss || "all")
  const st = String(campaignStatus || "all")

  return (leads || [])
    .filter((l: any) => {
      if (!includeArchived && !!l.archived) return false
      if (loss !== "all") {
        if (String(l.loss_reason || "") !== loss) return false
      }
      if (st !== "all") {
        if (String(l.status || "") !== st) return false
      }
      // Sólo contactos con teléfono
      if (!String(l.phone || "").trim()) return false
      return true
    })
    .sort((a: any, b: any) => new Date(b.last_update || 0).getTime() - new Date(a.last_update || 0).getTime())
}

const safeCsv = (v: any) => {
  const s = String(v ?? "")
  // Escape comillas dobles para CSV estándar
  const escaped = s.replace(/"/g, '""')
  return `"${escaped}"`
}

const downloadTextFile = (content: string, filename: string, mime = "text/plain;charset=utf-8;") => {
  try {
    const blob = new Blob([content], { type: mime })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.error("downloadTextFile error", e)
  }
}

export default function AdminIABrain() {
  const supabase = createClient()
  
  // --- ESTADOS PRINCIPALES ---
  const [leads, setLeads] = useState<Lead[]>([])
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [currentUser, setCurrentUser] = useState<Profile | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  
  // --- FILTROS Y BÚSQUEDA ---
  const [inboxFilter, setInboxFilter] = useState<'all' | InboxStatus>('all')
  const [searchQuery, setSearchQuery] = useState("")
  const [filterAgent, setFilterAgent] = useState<string>("all")
  const [filterStatus, setFilterStatus] = useState<string>("all")
  const [filterSource, setFilterSource] = useState<string>("all")
  const [filterLossReason, setFilterLossReason] = useState<string>("all")
  const [filterTags, setFilterTags] = useState<string[]>([])
  const [showFilters, setShowFilters] = useState(false)
  
  // --- CONFIG GLOBAL ---
  const [systemPrompt, setSystemPrompt] = useState("")
  const [savedSystemPrompt, setSavedSystemPrompt] = useState("")
  const [promptSourceKey, setPromptSourceKey] = useState<'sofia_system_prompt' | 'system_prompt'>('sofia_system_prompt')
  const [leadDetailOpen, setLeadDetailOpen] = useState(false)
  const [initialSystemPrompt, setInitialSystemPrompt] = useState("")
  const [promptAppend, setPromptAppend] = useState("")
  const [quickReplyFolders, setQuickReplyFolders] = useState<QuickReplyFolder[]>([
    { name: "General", replies: [] },
    { name: "Prepagas", replies: [] },
    { name: "Objeciones", replies: [] }
  ])
  
  // --- HORARIOS ---
  const [officeEnabled, setOfficeEnabled] = useState(true)
  const [officeTz, setOfficeTz] = useState("America/Argentina/Buenos_Aires")
  const [officeDays, setOfficeDays] = useState<number[]>([1,2,3,4,5])
  const [officeStart, setOfficeStart] = useState("09:00")
  const [officeEnd, setOfficeEnd] = useState("18:00")
  const [offHoursMessage, setOffHoursMessage] = useState(
    "¡Hola! 🙌 Por acá te respondemos en nuestro horario de atención. Dejame tu edad y zona y te contacto apenas estemos online."
  )
  const [guardEnabled, setGuardEnabled] = useState(false)
  const [guardDays, setGuardDays] = useState<number[]>([6, 0]) // sábado/domingo por defecto
  const [guardStart, setGuardStart] = useState("10:00")
  const [guardEnd, setGuardEnd] = useState("13:00")
  
  // --- UI STATES ---
  const [activeTab, setActiveTab] = useState("chat")
  const [draft, setDraft] = useState("")
  const [showQuickRepliesModal, setShowQuickRepliesModal] = useState(false)
  const [showTaskModal, setShowTaskModal] = useState(false)
  const [showTagModal, setShowTagModal] = useState(false)
  const [newNote, setNewNote] = useState("")
  const [newTask, setNewTask] = useState("")
  const [newTaskDate, setNewTaskDate] = useState("")
  const [newTag, setNewTag] = useState("")

  // --- CAMPAÑAS (UI LISTA PARA API WPP) ---
  const [campaignLoss, setCampaignLoss] = useState<string>("all")
  const [campaignStatus, setCampaignStatus] = useState<string>("all")
  const [campaignIncludeArchived, setCampaignIncludeArchived] = useState(false)
  const [campaignMessage, setCampaignMessage] = useState("")
  const [campaignPreviewOpen, setCampaignPreviewOpen] = useState(false)

  
  const scrollRef = useRef<HTMLDivElement>(null)
  
  const officeCfg = useMemo<OfficeHours>(() => ({
    enabled: officeEnabled,
    tz: officeTz,
    days: officeDays,
    start: officeStart,
    end: officeEnd,
  }), [officeEnabled, officeTz, officeDays, officeStart, officeEnd])

  const inOfficeHours = useMemo(() => isWithinOfficeHours(officeCfg), [officeCfg])

  const guardCfg = useMemo<OfficeHours>(() => ({
    enabled: guardEnabled,
    tz: officeTz,
    days: guardDays,
    start: guardStart,
    end: guardEnd,
  }), [guardEnabled, officeTz, guardDays, guardStart, guardEnd])

  const inGuardHours = useMemo(() => isWithinOfficeHours(guardCfg), [guardCfg])

  const inServiceHours = inOfficeHours || inGuardHours


  // --- FETCH CURRENT USER ---
  const fetchCurrentUser = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      
      if (profile) setCurrentUser(profile)
    } catch (err) {
      console.error('Error fetching user:', err)
    }
  }

  // --- FETCH PROFILES ---
  const fetchProfiles = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email, role')
      .order('full_name')
    
    if (data) setAllProfiles(data)
  }

  // --- FETCH LEADS ---
  const fetchLeads = async () => {
    setLoading(true)
    try {
      let query = supabase
        .from('leads')
        .select('*')
        .not('chat', 'is', null)
        .order('last_update', { ascending: false })
        .limit(100)
      
      // Filtro por rol
      if (currentUser?.role === 'seller') {
        query = query.eq('agent_name', currentUser.full_name)
      }
      
      const { data } = await query
      
      if (data) {
        // Asegurar que tienen las nuevas columnas con defaults
        const enriched = data.map(lead => ({
          ...lead,
          tags: lead.tags || [],
          priority: lead.priority || 'normal',
          archived: lead.archived || false,
          inbox_status: lead.inbox_status || 'pending',
          unread_count: lead.unread_count || 0,
          last_message_from: lead.last_message_from || 'client',
          comments: lead.comments || [],
          reminders: lead.reminders || [],
          ai_labels: (lead as any).ai_labels || []
        }))
        setLeads(enriched)
      }
    } catch (err) {
      console.error('Error fetching leads:', err)
    }
    setLoading(false)
  }

  // --- FETCH CONFIG ---
  const fetchConfig = async () => {
    const { data } = await supabase
      .from('ai_settings')
      .select('key, value')
      .in('key', [
        'sofia_system_prompt',
        'system_prompt',
        'quick_replies_folders',
        'office_enabled',
        'office_tz',
        'office_days',
        'office_start',
        'office_end',
        'off_hours_message',
        'guard_enabled',
        'guard_days',
        'guard_start',
        'guard_end',
      ])

    const map: Record<string, any> = {}
    ;(data || []).forEach((row: any) => {
      map[row.key] = row.value
    })

    const sp = (typeof map.sofia_system_prompt === 'string' && map.sofia_system_prompt.trim())
      ? map.sofia_system_prompt
      : (typeof map.system_prompt === 'string' ? map.system_prompt : "")
    if (sp) {
      setSystemPrompt(sp)
      setInitialSystemPrompt(sp)
      setSavedSystemPrompt(sp)
      setPromptSourceKey((typeof map.sofia_system_prompt === 'string' && map.sofia_system_prompt.trim()) ? 'sofia_system_prompt' : 'system_prompt')
    }
    
    try {
      const folders = JSON.parse(map.quick_replies_folders || '{}')
      if (folders.folders && Array.isArray(folders.folders)) {
        setQuickReplyFolders(folders.folders)
      }
    } catch {}

    if (typeof map.office_enabled === 'boolean') setOfficeEnabled(map.office_enabled)
    if (typeof map.office_tz === 'string') setOfficeTz(map.office_tz)
    try {
      const days = JSON.parse(map.office_days || '[]')
      if (Array.isArray(days)) setOfficeDays(days)
    } catch {}
    if (typeof map.office_start === 'string') setOfficeStart(map.office_start)
    if (typeof map.office_end === 'string') setOfficeEnd(map.office_end)
    if (typeof map.off_hours_message === 'string') setOffHoursMessage(map.off_hours_message)
    if (typeof map.guard_enabled === 'boolean') setGuardEnabled(map.guard_enabled)
    try {
      const gdays = JSON.parse(map.guard_days || '[]')
      if (Array.isArray(gdays)) setGuardDays(gdays)
    } catch {}
    if (typeof map.guard_start === 'string') setGuardStart(map.guard_start)
    if (typeof map.guard_end === 'string') setGuardEnd(map.guard_end)
  }

  // --- SAVE CONFIG ---
  const saveConfig = async () => {
    try {
      const updates = [
        { key: 'sofia_system_prompt', value: systemPrompt },
        { key: 'system_prompt', value: systemPrompt },
        { key: 'quick_replies_folders', value: JSON.stringify({ folders: quickReplyFolders }) },
        { key: 'office_enabled', value: officeEnabled },
        { key: 'office_tz', value: officeTz },
        { key: 'office_days', value: JSON.stringify(officeDays) },
        { key: 'office_start', value: officeStart },
        { key: 'office_end', value: officeEnd },
        { key: 'off_hours_message', value: offHoursMessage },
        { key: 'guard_enabled', value: guardEnabled },
        { key: 'guard_days', value: JSON.stringify(guardDays) },
        { key: 'guard_start', value: guardStart },
        { key: 'guard_end', value: guardEnd },
      ]
      
      for (const u of updates) {
        await supabase.from('ai_settings').upsert(u, { onConflict: 'key' })
      }
      
      setSavedSystemPrompt(systemPrompt)
      toast.success('✅ Configuración guardada!')
    } catch (err: any) {
      toast.error('Error al guardar: ' + err.message)
    }
  }

  // --- LOG EVENT ---
  const logEvent = async (leadId: string, eventType: string, summary: string, payload?: any) => {
    try {
      await supabase.from('lead_events').insert({
        lead_id: leadId,
        source: 'admin_ia_brain',
        event_type: eventType,
        actor_name: currentUser?.full_name || 'Sistema',
        summary,
        payload: payload || {}
      })
    } catch (err) {
      console.error('Error logging event:', err)
    }
  }

  // --- ACCIONES SOBRE CONVERSACIONES ---
  const handleSendMessage = async (text: string) => {
    if (!selectedLead || !text.trim()) return
    
    const newMsg = { 
      role: 'user', 
      content: text.trim(), 
      timestamp: new Date().toISOString(),
      sender: currentUser?.full_name || 'Agent'
    }
    
    const updatedChat = [...(selectedLead.chat || []), newMsg]
    
    await supabase
      .from('leads')
      .update({ 
        chat: updatedChat, 
        last_update: new Date().toISOString(),
        last_message_from: 'agent',
        unread_count: 0
      })
      .eq('id', selectedLead.id)
    
    await logEvent(selectedLead.id, 'message_sent', `Mensaje enviado por ${currentUser?.full_name}`)
    
    setLeads(prev =>
      prev.map(l => (l.id === selectedLead.id ? { 
        ...l, 
        chat: updatedChat, 
        last_update: new Date().toISOString(),
        last_message_from: 'agent',
        unread_count: 0
      } : l))
    )
    setSelectedLead({ ...selectedLead, chat: updatedChat, last_message_from: 'agent', unread_count: 0 })
    toast.success('✅ Mensaje enviado')
  }

  const handleStatusChange = async (newStatus: 'active' | 'paused' | 'disabled') => {
    if (!selectedLead) return
    
    await supabase.from('leads').update({ ai_status: newStatus }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'ai_status_changed', `IA cambió a: ${newStatus}`, { new_status: newStatus })
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, ai_status: newStatus } : l)))
    setSelectedLead({ ...selectedLead, ai_status: newStatus })
    
    const labels = { active: '🟢 IA Activada', paused: '⏸️ IA Pausada', disabled: '🔴 IA Desactivada' }
    toast.success(labels[newStatus])
  }

  const handleAssign = async (agentName: string) => {
    if (!selectedLead) return
    
    await supabase.from('leads').update({ agent_name: agentName, assigned_to: agentName }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'assigned', `Conversación asignada a ${agentName}`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, agent_name: agentName, assigned_to: agentName } : l)))
    setSelectedLead({ ...selectedLead, agent_name: agentName, assigned_to: agentName })
    toast.success(`✅ Asignado a ${agentName}`)
  }

  const handlePriorityChange = async (priority: 'normal' | 'high') => {
    if (!selectedLead) return
    
    await supabase.from('leads').update({ priority }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'priority_changed', `Prioridad cambiada a: ${priority}`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, priority } : l)))
    setSelectedLead({ ...selectedLead, priority })
    toast.success(priority === 'high' ? '🔥 Marcado como prioritario' : '✅ Prioridad normal')
  }

  const handleArchive = async () => {
    if (!selectedLead) return
    
    const newArchived = !selectedLead.archived
    await supabase.from('leads').update({ archived: newArchived, inbox_status: newArchived ? 'archived' : 'pending' }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, newArchived ? 'archived' : 'unarchived', newArchived ? 'Conversación archivada' : 'Conversación restaurada')
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, archived: newArchived, inbox_status: newArchived ? 'archived' : 'pending' } : l)))
    setSelectedLead({ ...selectedLead, archived: newArchived, inbox_status: newArchived ? 'archived' : 'pending' })
    toast.success(newArchived ? '📦 Conversación archivada' : '✅ Conversación restaurada')
  }

  const handleAddTag = async () => {
    if (!selectedLead || !newTag.trim()) return
    
    const currentTags = selectedLead.tags || []
    if (currentTags.includes(newTag.trim())) {
      toast.error('⚠️ Tag ya existe')
      return
    }
    
    const updatedTags = [...currentTags, newTag.trim()]
    await supabase.from('leads').update({ tags: updatedTags }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'tag_added', `Tag agregado: ${newTag.trim()}`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, tags: updatedTags } : l)))
    setSelectedLead({ ...selectedLead, tags: updatedTags })
    setNewTag("")
    toast.success('🏷️ Tag agregado')
  }

  const handleRemoveTag = async (tag: string) => {
    if (!selectedLead) return
    
    const updatedTags = (selectedLead.tags || []).filter(t => t !== tag)
    await supabase.from('leads').update({ tags: updatedTags }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'tag_removed', `Tag removido: ${tag}`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, tags: updatedTags } : l)))
    setSelectedLead({ ...selectedLead, tags: updatedTags })
    toast.success('🗑️ Tag removido')
  }

  const handleAddNote = async () => {
    if (!selectedLead || !newNote.trim()) return
    
    const newComment: Comment = {
      text: newNote.trim(),
      author: currentUser?.full_name || 'Usuario',
      timestamp: new Date().toISOString()
    }
    
    const updatedComments = [...(selectedLead.comments || []), newComment]
    await supabase.from('leads').update({ comments: updatedComments }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'note_added', `Nota interna agregada`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, comments: updatedComments } : l)))
    setSelectedLead({ ...selectedLead, comments: updatedComments })
    setNewNote("")
    toast.success('📝 Nota agregada')
  }

  const handleAddTask = async () => {
    if (!selectedLead || !newTask.trim()) return
    
    const newReminder: Reminder = {
      task: newTask.trim(),
      status: 'pending',
      due_date: newTaskDate || undefined,
      assigned_to: currentUser?.full_name,
      created_at: new Date().toISOString()
    }
    
    const updatedReminders = [...(selectedLead.reminders || []), newReminder]
    await supabase.from('leads').update({ reminders: updatedReminders }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'task_created', `Tarea creada: ${newTask.trim()}`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, reminders: updatedReminders } : l)))
    setSelectedLead({ ...selectedLead, reminders: updatedReminders })
    setNewTask("")
    setNewTaskDate("")
    setShowTaskModal(false)
    toast.success('✅ Tarea creada')
  }

  const handleToggleTask = async (taskIndex: number) => {
    if (!selectedLead) return
    
    const updatedReminders = [...(selectedLead.reminders || [])]
    updatedReminders[taskIndex] = {
      ...updatedReminders[taskIndex],
      status: updatedReminders[taskIndex].status === 'done' ? 'pending' : 'done'
    }
    
    await supabase.from('leads').update({ reminders: updatedReminders }).eq('id', selectedLead.id)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, reminders: updatedReminders } : l)))
    setSelectedLead({ ...selectedLead, reminders: updatedReminders })
    toast.success('✅ Tarea actualizada')
  }

  const handleMarkAsRead = async () => {
    if (!selectedLead) return
    
    await supabase.from('leads').update({ unread_count: 0, inbox_status: 'pending' }).eq('id', selectedLead.id)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, unread_count: 0, inbox_status: 'pending' } : l)))
    setSelectedLead({ ...selectedLead, unread_count: 0, inbox_status: 'pending' })
    toast.success('✅ Marcado como leído')
  }

  const handleInboxStatusChange = async (status: InboxStatus) => {
    if (!selectedLead) return
    
    await supabase.from('leads').update({ inbox_status: status }).eq('id', selectedLead.id)
    await logEvent(selectedLead.id, 'inbox_status_changed', `Estado cambiado a: ${status}`)
    
    setLeads(prev => prev.map(l => (l.id === selectedLead.id ? { ...l, inbox_status: status } : l)))
    setSelectedLead({ ...selectedLead, inbox_status: status })
    toast.success('✅ Estado actualizado')
  }

  // --- FILTRADO AVANZADO ---
  const filteredLeads = useMemo(() => {
    let arr = leads

    // Filtro por inbox status
    if (inboxFilter !== 'all') {
      arr = arr.filter(l => l.inbox_status === inboxFilter)
    }

    // Filtro por búsqueda (nombre, teléfono, contenido del chat)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      arr = arr.filter(l => {
        const inName = l.name.toLowerCase().includes(q)
        const inPhone = l.phone?.includes(q)
        const inChat = (l.chat || []).some((m: any) => 
          m.content?.toLowerCase().includes(q)
        )
        return inName || inPhone || inChat
      })
    }

    // Filtro por agente
    if (filterAgent !== 'all') {
      arr = arr.filter(l => l.agent_name === filterAgent)
    }

    // Filtro por estado
    if (filterStatus !== 'all') {
      arr = arr.filter(l => l.status === filterStatus)
    }

    // Filtro por fuente
    if (filterSource !== 'all') {
      arr = arr.filter(l => l.source === filterSource)
    }

    // Filtro por motivo de pérdida
    if (filterLossReason !== 'all') {
      arr = arr.filter(l => (l.loss_reason || '').toLowerCase().includes(filterLossReason.toLowerCase()))
    }

    // Filtro por tags
    if (filterTags.length > 0) {
      arr = arr.filter(l => 
        filterTags.some(tag => (l.tags || []).includes(tag))
      )
    }

    // No mostrar archivados a menos que se filtre explícitamente
    if (inboxFilter !== 'archived') {
      arr = arr.filter(l => !l.archived)
    }

    // Ordenar: prioridad alta primero, luego por último mensaje del cliente
    return arr.sort((a, b) => {
      if (a.priority === 'high' && b.priority !== 'high') return -1
      if (a.priority !== 'high' && b.priority === 'high') return 1
      if (a.last_message_from === 'client' && b.last_message_from !== 'client') return -1
      if (a.last_message_from !== 'client' && b.last_message_from === 'client') return 1
      return new Date(b.last_update).getTime() - new Date(a.last_update).getTime()
    })
  }, [leads, inboxFilter, searchQuery, filterAgent, filterStatus, filterSource, filterLossReason, filterTags])

  // Obtener listas únicas para filtros
  const uniqueAgents = useMemo(() => 
    Array.from(new Set(leads.map(l => l.agent_name).filter(Boolean))),
    [leads]
  )
  
  const uniqueStatuses = useMemo(() => 
    Array.from(new Set(leads.map(l => l.status).filter(Boolean))),
    [leads]
  )
  
  const uniqueSources = useMemo(() => 
    Array.from(new Set(leads.map(l => l.source).filter(Boolean))),
    [leads]
  )
  

  const uniqueLossReasons = useMemo(() => 
    Array.from(new Set(leads.map((l: any) => (l as any).loss_reason).filter(Boolean))),
    [leads]
  )

  const allTags = useMemo(() => 
    Array.from(new Set(leads.flatMap(l => l.tags || []))),
    [leads]
  )

  // --- EFFECTS ---
  useEffect(() => {
    fetchCurrentUser()
    fetchProfiles()
  }, [])

  useEffect(() => {
    if (currentUser) {
      fetchLeads()
      fetchConfig()
    }
  }, [currentUser])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [selectedLead?.chat])

  // --- RENDER HELPERS ---
  const getInboxStatusBadge = (status: InboxStatus) => {
    const styles = {
      unread: 'bg-blue-100 text-blue-700 border-blue-200',
      pending: 'bg-amber-100 text-amber-700 border-amber-200',
      intervention: 'bg-red-100 text-red-700 border-red-200',
      snoozed: 'bg-purple-100 text-purple-700 border-purple-200',
      archived: 'bg-slate-100 text-slate-700 border-slate-200',
      blocked: 'bg-slate-100 text-slate-700 border-slate-200',
      hot: 'bg-orange-100 text-orange-700 border-orange-200'
    }
    
    const labels = {
      unread: 'Sin leer',
      pending: 'Pendiente',
      intervention: 'Requiere intervención',
      snoozed: 'Pospuesto',
      archived: 'Archivado',
      blocked: 'Bloqueado',
      hot: 'Prioritario'
    }
    
    return (
      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${styles[status]}`}>
        {labels[status]}
      </Badge>
    )
  
  const getLeadStageBadge = (statusRaw: string) => {
    const s = String(statusRaw || "").toLowerCase()
    let label = statusRaw || "—"
    let cls = "bg-slate-50 text-slate-700 border-slate-200"
    if (!s) {
      label = "—"
    } else if (s.includes("perdid") || s.includes("caid") || s.includes("lost")) {
      label = "Perdido"
      cls = "bg-rose-50 text-rose-700 border-rose-200"
    } else if (s.includes("sin trabajar") || s === "nuevo") {
      label = "Sin trabajar"
      cls = "bg-slate-50 text-slate-700 border-slate-200"
    } else if (s.includes("contact")) {
      label = "Contacto"
      cls = "bg-blue-50 text-blue-700 border-blue-200"
    } else if (s.includes("cotiz")) {
      label = "Cotizando"
      cls = "bg-violet-50 text-violet-700 border-violet-200"
    } else if (s.includes("document")) {
      label = "Documentación"
      cls = "bg-amber-50 text-amber-700 border-amber-200"
    } else if (s.includes("ingres") || s.includes("precarga") || s.includes("medicas") || s.includes("legajo") || s.includes("demoras") || s.includes("cumplid") || s.includes("rechaz")) {
      label = "OPS"
      cls = "bg-emerald-50 text-emerald-700 border-emerald-200"
    } else {
      label = statusRaw
    }

    return (
      <Badge variant="outline" className={`text-[10px] px-2 py-0.5 ${cls}`}>
        {label}
      </Badge>
    )
  }

}

  const statusColor = (s: string) => {
    if (s === 'active') return 'bg-emerald-500'
    if (s === 'paused') return 'bg-amber-500'
    return 'bg-slate-400'
  }

  
  const sofiaExtracted = useMemo(() => {
    const lead: any = selectedLead as any
    if (!lead) {
      return { name: "", age: null as number | null, province: "", locality: "", group: "", work: "", labels: [] as string[] }
    }

    const msgs = Array.isArray(lead.chat) ? lead.chat : []
    const clientText = msgs
      .filter((m: any) => {
        // soporta distintos formatos: isMe=true => modelo/agente; isMe=false => cliente
        if (typeof m?.isMe === "boolean") return !m.isMe
        if (typeof m?.role === "string") return m.role === "user" || m.role === "client"
        if (typeof m?.from === "string") return m.from === "client"
        return true
      })
      .map((m: any) => String(m?.content || m?.text || ""))
      .join("\n")
      .toLowerCase()

    // Edad
    let age: number | null = null
    const am =
      clientText.match(/\btengo\s+(\d{1,3})\b/) ||
      clientText.match(/\b(\d{1,3})\s*años\b/) ||
      clientText.match(/\bedad\s*[:=]?\s*(\d{1,3})\b/)
    if (am?.[1]) {
      const n = parseInt(am[1], 10)
      if (!Number.isNaN(n) && n >= 0 && n <= 120) age = n
    }

    // Localidad / Provincia (muy básico, pero útil)
    const locMatch =
      clientText.match(/\bsoy de\s+([a-záéíóúñ\s]{3,40})\b/) ||
      clientText.match(/\bvivo en\s+([a-záéíóúñ\s]{3,40})\b/) ||
      clientText.match(/\bestoy en\s+([a-záéíóúñ\s]{3,40})\b/)
    const locality = (lead.locality || (locMatch?.[1] ? String(locMatch[1]).trim() : "")) as string
    const province = (lead.province || "") as string

    // Grupo familiar
    let group = String(lead.group || lead.family_group || "").trim()
    if (!group) {
      if (/\bfamilia\b|\bhijos\b|\besposa\b|\bmarido\b|\bpareja\b/.test(clientText)) group = "Familia"
      else if (/\bsolo\b|\bpara mi\b|\bpara mí\b/.test(clientText)) group = "Solo"
    }

    // Trabajo / situación
    let work = String(lead.work || lead.work_status || lead.laboral || "").trim()
    if (!work) {
      if (/\bjubilad/.test(clientText)) work = "Jubilado/a"
      else if (/\bmonotribut/.test(clientText)) work = "Monotributo"
      else if (/\bdependencia\b|\ben blanco\b|\bempleado\b|\bsueldo\b/.test(clientText)) work = "Relación de dependencia"
      else if (/\bautonom/.test(clientText)) work = "Autónomo"
      else if (/\bvoluntari/.test(clientText)) work = "Voluntario"
    }

    const labels: string[] = []
    if (!age) labels.push("Falta: Edad")
    if (!locality && !province) labels.push("Falta: Zona")
    if (!work) labels.push("Falta: Situación laboral")
    if (!group) labels.push("Falta: Grupo familiar")
    if (/\bprecio\b|\bcu[aá]nto sale\b|\bvalor\b|\bcotiz/.test(clientText) || /\$\s*\d/.test(clientText)) labels.push("Pidió precio")
    if (/\burgente\b|\bhoy\b|\bya\b|\bllamame\b/.test(clientText)) labels.push("Intención alta")

    return {
      name: String(lead.name || ""),
      age,
      province,
      locality,
      group,
      work,
      labels,
    }
  }, [selectedLead?.id, selectedLead?.chat, (selectedLead as any)?.province, (selectedLead as any)?.locality])

  const saveAiLabels = async () => {
    if (!selectedLead) return
    try {
      const labels = sofiaExtracted.labels
      await supabase.from('leads').update({ ai_labels: labels }).eq('id', selectedLead.id)
      setSelectedLead({ ...(selectedLead as any), ai_labels: labels } as any)
      toast.success("✅ Etiquetas IA guardadas")
    } catch (e: any) {
      toast.error("Error guardando etiquetas IA: " + (e?.message || ""))
    }
  }
return (
    <div className="flex h-screen w-full bg-slate-50 overflow-hidden">
      {/* 1. SIDEBAR IZQUIERDO - BANDEJA */}
      <div className="w-96 flex-none flex flex-col min-h-0 bg-white border-r border-slate-200 shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex-none p-5 border-b border-slate-100 bg-gradient-to-br from-violet-50 to-white">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <BrainCircuit className="w-5 h-5 text-violet-600"/> Brain IA
            </h2>
            <div className="flex gap-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-violet-100"
                      onClick={() => fetchLeads()}
                    >
                      <RefreshCw className="w-4 h-4 text-violet-600"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Actualizar</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 hover:bg-violet-100"
                      onClick={() => setActiveTab(activeTab === 'chat' ? 'settings' : 'chat')}
                    >
                      <Sliders className="w-4 h-4 text-violet-600"/>
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Configuración</TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>

          {/* Búsqueda */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"/>
            <Input
              placeholder="Buscar conversación..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-10 bg-white border-slate-200 focus-visible:ring-violet-500 h-10 text-sm rounded-lg shadow-sm"
            />
          </div>

          {/* Filtros de inbox */}
          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            <Button
              variant={inboxFilter === 'all' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInboxFilter('all')}
              className={`h-7 text-xs shrink-0 ${inboxFilter === 'all' ? 'bg-violet-600 hover:bg-violet-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              Todas
            </Button>
            <Button
              variant={inboxFilter === 'unread' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInboxFilter('unread')}
              className={`h-7 text-xs shrink-0 ${inboxFilter === 'unread' ? 'bg-blue-600 hover:bg-blue-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              Sin leer
            </Button>
            <Button
              variant={inboxFilter === 'pending' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInboxFilter('pending')}
              className={`h-7 text-xs shrink-0 ${inboxFilter === 'pending' ? 'bg-amber-600 hover:bg-amber-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              Pendientes
            </Button>
            <Button
              variant={inboxFilter === 'intervention' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInboxFilter('intervention')}
              className={`h-7 text-xs shrink-0 ${inboxFilter === 'intervention' ? 'bg-red-600 hover:bg-red-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              Intervenir
            </Button>
            <Button
              variant={inboxFilter === 'hot' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setInboxFilter('hot')}
              className={`h-7 text-xs shrink-0 ${inboxFilter === 'hot' ? 'bg-orange-600 hover:bg-orange-700' : 'border-slate-200 hover:bg-slate-50'}`}
            >
              🔥 Hot
            </Button>
          </div>

          {/* Filtros avanzados */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="w-full mt-2 h-8 text-xs text-slate-600 hover:bg-slate-100"
          >
            <Filter className="w-3 h-3 mr-2"/> Filtros avanzados
            <ChevronDown className={`w-3 h-3 ml-auto transition-transform ${showFilters ? 'rotate-180' : ''}`}/>
          </Button>

          {showFilters && (
            <div className="mt-3 space-y-2 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <Select value={filterAgent} onValueChange={setFilterAgent}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Vendedora" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las vendedoras</SelectItem>
                  {uniqueAgents.map(agent => (
                    <SelectItem key={agent} value={agent}>{agent}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  {uniqueStatuses.map(status => (
                    <SelectItem key={status} value={status}>{status}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSource} onValueChange={setFilterSource}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Fuente" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las fuentes</SelectItem>
                  {uniqueSources.map(source => (
                    <SelectItem key={source} value={source}>{source}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterLossReason} onValueChange={setFilterLossReason}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="Motivo de pérdida" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los motivos</SelectItem>
                  {uniqueLossReasons.map((r: any) => (
                    <SelectItem key={String(r)} value={String(r)}>{String(r)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>


              {allTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {allTags.map(tag => (
                    <Badge
                      key={tag}
                      variant={filterTags.includes(tag) ? 'default' : 'outline'}
                      className={`text-[10px] cursor-pointer ${
                        filterTags.includes(tag) 
                          ? 'bg-violet-600 hover:bg-violet-700' 
                          : 'hover:bg-slate-100'
                      }`}
                      onClick={() => {
                        setFilterTags(prev =>
                          prev.includes(tag)
                            ? prev.filter(t => t !== tag)
                            : [...prev, tag]
                        )
                      }}
                    >
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterAgent('all')
                  setFilterStatus('all')
                  setFilterSource('all')
                  setFilterLossReason('all')
                  setFilterTags([])
                  setShowFilters(false)
                }}
                className="w-full h-7 text-xs text-red-600 hover:bg-red-50"
              >
                Limpiar filtros
              </Button>
            </div>
          )}
        </div>

        {/* Lista de conversaciones */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-2 space-y-1">
            {loading ? (
              <div className="text-center py-12 text-sm text-slate-400">Cargando...</div>
            ) : filteredLeads.length === 0 ? (
              <div className="text-center py-12 text-sm text-slate-400">No hay conversaciones</div>
            ) : (
              filteredLeads.map(lead => {
                const lastMsg = (lead.chat || []).slice(-1)[0]
                return (
                  <div
                    key={lead.id}
                    onClick={() => setSelectedLead(lead)}
                    className={`
                      p-3 rounded-xl cursor-pointer transition-all duration-200
                      ${selectedLead?.id === lead.id
                        ? 'bg-violet-50 border-2 border-violet-200 shadow-sm'
                        : 'bg-white border border-slate-100 hover:bg-slate-50 hover:border-slate-200'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative flex-none">
                        <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                          <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-500 text-white font-bold text-sm">
                            {lead.name?.[0]?.toUpperCase() || '?'}
                          </AvatarFallback>
                        </Avatar>
                        <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-white ${statusColor(lead.ai_status)}`} />
                        {lead.priority === 'high' && (
                          <div className="absolute -top-1 -right-1">
                            <Flame className="w-4 h-4 text-orange-500 fill-orange-500"/>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <h4 className="font-bold text-sm text-slate-800 truncate">{lead.name}</h4>
                          <span className="text-[10px] text-slate-400 flex-none">
                            {new Date(lead.last_update).toLocaleTimeString('es-AR', {hour: '2-digit', minute: '2-digit'})}
                          </span>
                        </div>
                        
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed mb-2">
                          {lastMsg?.content || 'Sin mensajes'}
                        </p>
                        
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {lead.inbox_status && getInboxStatusBadge(lead.inbox_status)}
                          {lead.status && getLeadStageBadge(lead.status)}
                          {lead.loss_reason && (
                            <Badge variant="outline" className="text-[10px] px-2 py-0.5 bg-rose-50 border-rose-200 text-rose-700">
                              {String(lead.loss_reason).toLowerCase().includes('precio') ? 'Precio' : String(lead.loss_reason).slice(0, 18)}
                            </Badge>
                          )}
                          
                          {(lead.unread_count || 0) > 0 && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0">
                              {lead.unread_count}
                            </Badge>
                          )}
                          
                          {lead.tags && lead.tags.slice(0, 2).map(tag => (
                            <Badge key={tag} variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 border-slate-200 text-slate-600">
                              {tag}
                            </Badge>
                          ))}
                          
                          {lead.tags && lead.tags.length > 2 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-slate-50 border-slate-200 text-slate-600">
                              +{lead.tags.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </ScrollArea>
      </div>

      {/* 2. AREA CENTRAL */}
      <div className="flex-1 flex flex-col min-h-0 bg-white min-w-0 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0 overflow-hidden">
          <TabsList className="w-full rounded-none border-b border-slate-200 bg-white h-14 p-0 justify-start px-6">
            <TabsTrigger 
              value="chat" 
              className="data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:border-b-2 data-[state=active]:border-violet-600 rounded-none h-full px-6 font-semibold"
            >
              <MessageSquare className="w-4 h-4 mr-2"/> Chat
            </TabsTrigger>
            <TabsTrigger 
              value="settings"
              className="data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:border-b-2 data-[state=active]:border-violet-600 rounded-none h-full px-6 font-semibold"
            >
              <Sliders className="w-4 h-4 mr-2"/> Configuración
            </TabsTrigger>
            <TabsTrigger 
              value="campaigns"
              className="data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:border-b-2 data-[state=active]:border-violet-600 rounded-none h-full px-6 font-semibold"
            >
              <Bell className="w-4 h-4 mr-2"/> Campañas
            </TabsTrigger>
          </TabsList>

          {/* SETTINGS TAB */}
          <TabsContent value="settings" className="flex-1 min-h-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="max-w-3xl mx-auto p-8 space-y-8">
                {/* System Prompt */}
                <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="h-10 w-10 rounded-lg bg-violet-100 flex items-center justify-center">
                      <BrainCircuit className="w-5 h-5 text-violet-600"/>
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800">Prompt del Sistema</h3>
                      <p className="text-xs text-slate-500">Instrucciones base para Sofía</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Prompt actual (guardado)</label>
                    <Textarea
                      value={initialSystemPrompt}
                      readOnly
                      rows={6}
                      className="font-mono text-xs bg-slate-100 border-slate-200 text-slate-600 resize-none"
                    />
                    <p className="text-[11px] text-slate-400">
                      Tip: usá “Agregar indicación” para sumar reglas sin pisar lo que ya funciona.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Agregar indicación (se adjunta al final)</label>
                    <Textarea
                      value={promptAppend}
                      onChange={e => setPromptAppend(e.target.value)}
                      rows={3}
                      className="text-xs bg-slate-50 border-slate-200 focus-visible:ring-violet-500 resize-none"
                      placeholder="Ej: Si el cliente pide precio dos veces, derivar a humana. Mantener tono cálido y breve..."
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        onClick={() => {
                          if (!promptAppend.trim()) return
                          const stamp = new Date().toLocaleString("es-AR")
                          setSystemPrompt(prev => `${prev}\n\n# Nueva indicación (${stamp})\n${promptAppend.trim()}`)
                          setPromptAppend("")
                          toast.success("✅ Indicación agregada al final (no se guardó aún)")
                        }}
                      >
                        <Plus className="w-3 h-3 mr-2"/> Adjuntar al prompt
                      </Button>

                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8"
                        onClick={() => {
                          setSystemPrompt(initialSystemPrompt)
                          setPromptAppend("")
                          toast.success("↩️ Volviste al prompt guardado")
                        }}
                      >
                        Restaurar
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Prompt editable (lo que se va a guardar)</label>
                    <Textarea
                      value={systemPrompt}
                      onChange={e => setSystemPrompt(e.target.value)}
                      rows={8}
                      className="font-mono text-xs bg-slate-50 border-slate-200 focus-visible:ring-violet-500 resize-none"
                      placeholder="Sos Sofía, asesora virtual de GML..."
                    />
                  </div>
                </div>

                {/* Quick Replies Manager */}
                <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="h-10 w-10 rounded-lg bg-blue-100 flex items-center justify-center">
                      <Zap className="w-5 h-5 text-blue-600"/>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">Respuestas Rápidas</h3>
                      <p className="text-xs text-slate-500">Organiza tus mensajes predefinidos por carpetas</p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => setShowQuickRepliesModal(true)}
                      className="bg-blue-600 hover:bg-blue-700 h-8"
                    >
                      <Edit2 className="w-3 h-3 mr-2"/> Gestionar
                    </Button>
                  </div>
                  
                  <div className="space-y-3">
                    {quickReplyFolders.map((folder, idx) => (
                      <div key={idx} className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                        <div className="flex items-center gap-2 mb-2">
                          <FolderOpen className="w-4 h-4 text-slate-600"/>
                          <span className="font-semibold text-sm text-slate-700">{folder.name}</span>
                          <Badge variant="outline" className="ml-auto text-[10px]">
                            {folder.replies.length} respuestas
                          </Badge>
                        </div>
                        {folder.replies.slice(0, 2).map((reply, ridx) => (
                          <div key={ridx} className="text-xs text-slate-600 truncate ml-6">
                            • {reply.text}
                          </div>
                        ))}
                        {folder.replies.length > 2 && (
                          <div className="text-xs text-slate-400 ml-6 mt-1">
                            +{folder.replies.length - 2} más
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Office Hours */}
                <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="h-10 w-10 rounded-lg bg-amber-100 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-amber-600"/>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">Horario de Atención</h3>
                      <p className="text-xs text-slate-500">Configura cuándo Sofía responde automáticamente</p>
                    </div>
                    <Switch checked={officeEnabled} onCheckedChange={setOfficeEnabled}/>
                  </div>

                  {officeEnabled && (
                    <div className="space-y-4 pt-2">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-600">Hora inicio</label>
                          <Input
                            type="time"
                            value={officeStart}
                            onChange={e => setOfficeStart(e.target.value)}
                            className="bg-slate-50 border-slate-200 focus-visible:ring-violet-500"
                          />
                        </div>
                        <div className="space-y-2">
                          <label className="text-xs font-semibold text-slate-600">Hora fin</label>
                          <Input
                            type="time"
                            value={officeEnd}
                            onChange={e => setOfficeEnd(e.target.value)}
                            className="bg-slate-50 border-slate-200 focus-visible:ring-violet-500"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Días activos</label>
                        <div className="flex gap-2">
                          {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, i) => (
                            <Button
                              key={i}
                              variant={officeDays.includes(i) ? 'default' : 'outline'}
                              size="sm"
                              onClick={() =>
                                setOfficeDays(
                                  officeDays.includes(i)
                                    ? officeDays.filter(d => d !== i)
                                    : [...officeDays, i]
                                )
                              }
                              className={`flex-1 h-9 text-xs ${
                                officeDays.includes(i)
                                  ? 'bg-violet-600 hover:bg-violet-700'
                                  : 'border-slate-200 hover:bg-slate-50'
                              }`}
                            >
                              {day}
                            </Button>
                          ))}
                        </div>
                      </div>

                      
                      <div className="p-4 rounded-2xl border border-slate-200 bg-white">
                        <div className="flex items-center justify-between">
                          <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-emerald-600"/> Guardia
                          </div>
                          <Switch checked={guardEnabled} onCheckedChange={setGuardEnabled}/>
                        </div>

                        {guardEnabled && (
                          <div className="space-y-4 pt-3">
                            <div className="space-y-2">
                              <label className="text-xs font-semibold text-slate-600">Días de guardia</label>
                              <div className="flex flex-wrap gap-2">
                                {['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'].map((day, i) => (
                                  <Button
                                    key={i}
                                    variant={guardDays.includes(i) ? 'default' : 'outline'}
                                    size="sm"
                                    onClick={() =>
                                      setGuardDays(
                                        guardDays.includes(i)
                                          ? guardDays.filter(d => d !== i)
                                          : [...guardDays, i]
                                      )
                                    }
                                    className="h-8 rounded-lg"
                                  >
                                    {day}
                                  </Button>
                                ))}
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600">Hora inicio</label>
                                <Input
                                  type="time"
                                  value={guardStart}
                                  onChange={e => setGuardStart(e.target.value)}
                                  className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500"
                                />
                              </div>
                              <div className="space-y-2">
                                <label className="text-xs font-semibold text-slate-600">Hora fin</label>
                                <Input
                                  type="time"
                                  value={guardEnd}
                                  onChange={e => setGuardEnd(e.target.value)}
                                  className="bg-slate-50 border-slate-200 focus-visible:ring-emerald-500"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

<div className="space-y-2">
                        <label className="text-xs font-semibold text-slate-600">Mensaje fuera de horario</label>
                        <Textarea
                          value={offHoursMessage}
                          onChange={e => setOffHoursMessage(e.target.value)}
                          rows={3}
                          className="bg-slate-50 border-slate-200 focus-visible:ring-violet-500 text-sm resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Save Button */}
                <Button
                  onClick={saveConfig}
                  className="w-full h-12 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-bold shadow-lg shadow-violet-200"
                >
                  <CheckCircle2 className="w-5 h-5 mr-2"/> Guardar Configuración
                </Button>
              </div>
            </ScrollArea>
          </TabsContent>

          {/* CAMPAÑAS TAB */}
          <TabsContent value="campaigns" className="flex-1 min-h-0 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="max-w-4xl mx-auto p-8 space-y-6">
                <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                  <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                    <div className="h-10 w-10 rounded-lg bg-purple-100 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-purple-600"/>
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-slate-800">Campañas</h3>
                      <p className="text-xs text-slate-500">
                        Armá segmentos por motivo de pérdida y dejá listo el envío (cuando conectemos WhatsApp API).
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[11px] bg-slate-50 border-slate-200 text-slate-600">
                      Modo borrador (sin envío)
                    </Badge>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">Motivo de pérdida</label>
                      <Select value={campaignLoss} onValueChange={setCampaignLoss}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Elegir motivo" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueLossReasons.map((r: any) => (
                            <SelectItem key={String(r)} value={String(r)}>{String(r)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">Estado del lead</label>
                      <Select value={campaignStatus} onValueChange={setCampaignStatus}>
                        <SelectTrigger className="h-10 text-sm">
                          <SelectValue placeholder="Elegir estado" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          {uniqueStatuses.map((s: any) => (
                            <SelectItem key={String(s)} value={String(s)}>{String(s)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-xs font-semibold text-slate-600">Incluir archivados</label>
                      <div className="h-10 flex items-center gap-2 px-3 rounded-lg border border-slate-200 bg-slate-50">
                        <Switch checked={campaignIncludeArchived} onCheckedChange={setCampaignIncludeArchived}/>
                        <span className="text-sm text-slate-600">Sí</span>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-semibold text-slate-600">Mensaje / template (borrador)</label>
                    <Textarea
                      value={campaignMessage}
                      onChange={e => setCampaignMessage(e.target.value)}
                      rows={5}
                      className="text-sm bg-slate-50 border-slate-200 focus-visible:ring-violet-500 resize-none"
                      placeholder="Ej: Hola {nombre} 👋 Te escribo porque la otra vez hablamos por el plan y quizás ahora te sirve una promo..."
                    />
                    <p className="text-[11px] text-slate-400">
                      Cuando conectemos WhatsApp API, este campo se transforma en selector de template + variables.
                    </p>
                  </div>

                  <CampaignSummary
                    leads={leads}
                    campaignLoss={campaignLoss}
                    campaignStatus={campaignStatus}
                    includeArchived={campaignIncludeArchived}
                  />

                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => setCampaignPreviewOpen(true)}
                    >
                      <FolderOpen className="w-4 h-4 mr-2"/> Ver destinatarios
                    </Button>

                    <Button
                      variant="outline"
                      className="h-10"
                      onClick={() => {
                        const rows = buildCampaignRecipients(leads, campaignLoss, campaignStatus, campaignIncludeArchived)
                        const header = ["id","name","phone","loss_reason","status","source","agent_name"].join(",")
                        const csv = [header, ...rows.map(r => [
                          safeCsv(r.id),
                          safeCsv(r.name),
                          safeCsv(r.phone),
                          safeCsv(r.loss_reason || ""),
                          safeCsv(r.status || ""),
                          safeCsv(r.source || ""),
                          safeCsv(r.agent_name || "")
                        ].join(","))].join("\n")
                        downloadTextFile(csv, `campaign_recipients_${Date.now()}.csv`, "text/csv;charset=utf-8;")
                        toast.success("⬇️ CSV generado")
                      }}
                    >
                      <Save className="w-4 h-4 mr-2"/> Exportar CSV
                    </Button>

                    <Button
                      className="h-10 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                      onClick={() => {
                        toast.info("🧩 Listo: cuando conectemos WhatsApp API, este botón ejecuta el envío por template.")
                      }}
                      disabled={!campaignMessage.trim()}
                    >
                      <Zap className="w-4 h-4 mr-2"/> Preparar envío
                    </Button>
                  </div>
                </div>
              </div>
            </ScrollArea>

            <Dialog open={campaignPreviewOpen} onOpenChange={setCampaignPreviewOpen}>
              <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
                <DialogHeader>
                  <DialogTitle>Destinatarios (preview)</DialogTitle>
                </DialogHeader>
                <div className="min-h-0 overflow-hidden">
                  <ScrollArea className="h-[60vh]">
                    <div className="p-2 space-y-2">
                      {buildCampaignRecipients(leads, campaignLoss, campaignStatus, campaignIncludeArchived).slice(0, 500).map((l: any) => (
                        <div key={l.id} className="p-3 rounded-xl border border-slate-200 bg-white flex items-center gap-3">
                          <Avatar className="h-9 w-9">
                            <AvatarFallback className="bg-slate-200 text-slate-700 font-bold">{(l.name || "?")[0]}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-sm text-slate-800 truncate">{l.name || "Sin nombre"}</div>
                            <div className="text-xs text-slate-500 truncate">{l.phone}</div>
                          </div>
                          <Badge variant="outline" className="text-[10px] bg-rose-50 border-rose-200 text-rose-700">
                            {l.loss_reason || "—"}
                          </Badge>
                        </div>
                      ))}
                      {buildCampaignRecipients(leads, campaignLoss, campaignStatus, campaignIncludeArchived).length > 500 && (
                        <div className="text-xs text-slate-400 p-2">
                          Mostrando 500 de {buildCampaignRecipients(leads, campaignLoss, campaignStatus, campaignIncludeArchived).length}. Exportá CSV para el total.
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCampaignPreviewOpen(false)}>Cerrar</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </TabsContent>

          {/* CHAT TAB */}
          <TabsContent value="chat" className="flex-1 min-h-0 m-0 flex flex-col overflow-hidden">
            {selectedLead ? (
              <>
                {/* Header */}
                <div className="flex-none bg-white border-b border-slate-200 px-6 py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12 border-2 border-white shadow-md">
                        <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-500 text-white font-bold">
                          {selectedLead.name?.[0]?.toUpperCase() || '?'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-bold text-slate-800 text-lg">{selectedLead.name}</h3>
                          {selectedLead.priority === 'high' && (
                            <Flame className="w-5 h-5 text-orange-500 fill-orange-500"/>
                          )}
                        </div>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <User className="w-3 h-3"/> {selectedLead.phone}
                          </span>
                          {selectedLead.province && (
                            <span className="text-xs text-slate-500 flex items-center gap-1">
                              <MapPin className="w-3 h-3"/> {selectedLead.province}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* IA Status Badge */}
                      {selectedLead.ai_status === 'active' && (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200 px-3 py-1.5 font-semibold">
                          <Sparkles className="w-3.5 h-3.5 mr-1.5"/> IA Activa
                        </Badge>
                      )}
                      {selectedLead.ai_status === 'paused' && (
                        <Badge className="bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 font-semibold">
                          <PauseCircle className="w-3.5 h-3.5 mr-1.5"/> IA Pausada
                        </Badge>
                      )}
                      {selectedLead.ai_status === 'disabled' && (
                        <Badge className="bg-slate-50 text-slate-700 border border-slate-200 px-3 py-1.5 font-semibold">
                          <X className="w-3.5 h-3.5 mr-1.5"/> IA Desactivada
                        </Badge>
                      )}

                      {/* Actions Menu */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-9">
                            <MoreVertical className="w-4 h-4"/>
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          <DropdownMenuItem onClick={() => handlePriorityChange(selectedLead.priority === 'high' ? 'normal' : 'high')}>
                            <Flame className="w-4 h-4 mr-2"/>
                            {selectedLead.priority === 'high' ? 'Quitar prioridad' : 'Marcar prioritario'}
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={handleMarkAsRead}>
                            <CheckCircle2 className="w-4 h-4 mr-2"/>
                            Marcar como leído
                          </DropdownMenuItem>
                          
                          <DropdownMenuItem onClick={handleArchive}>
                            <Archive className="w-4 h-4 mr-2"/>
                            {selectedLead.archived ? 'Desarchivar' : 'Archivar'}
                          </DropdownMenuItem>
                          
                          <DropdownMenuSeparator />
                          
                          <DropdownMenuItem onClick={() => handleInboxStatusChange('blocked')}>
                            <X className="w-4 h-4 mr-2 text-red-600"/>
                            Bloquear conversación
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Toggle IA */}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const nextStatus = selectedLead.ai_status === 'active' ? 'paused' : 'active'
                          handleStatusChange(nextStatus)
                        }}
                        className="border-slate-200 hover:bg-slate-50 h-9"
                      >
                        {selectedLead.ai_status === 'active' ? (
                          <>
                            <PauseCircle className="w-4 h-4 mr-2"/> Pausar IA
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-4 h-4 mr-2"/> Activar IA
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                </div>

                {/* Messages Area */}
                <div className="flex-1 min-h-0 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
                  <ScrollArea className="h-full">
                    <div className="px-6 py-6 space-y-4 max-w-4xl mx-auto pb-24">
                      {(selectedLead.chat || []).map((msg: any, idx: number) => {
                        const isAI = msg.role === 'assistant'
                        const isUser = msg.role === 'user'
                        const isEvent = msg.role === 'system'
                        
                        // Separador por día
                        const showDateSeparator = idx === 0 || (
                          new Date(msg.timestamp).toDateString() !== 
                          new Date((selectedLead.chat || [])[idx - 1].timestamp).toDateString()
                        )
                        
                        return (
                          <div key={idx}>
                            {showDateSeparator && (
                              <div className="flex items-center gap-3 my-6">
                                <div className="flex-1 h-px bg-slate-200"></div>
                                <span className="text-xs font-semibold text-slate-400">
                                  {new Date(msg.timestamp).toLocaleDateString('es-AR', {
                                    weekday: 'long',
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric'
                                  })}
                                </span>
                                <div className="flex-1 h-px bg-slate-200"></div>
                              </div>
                            )}
                            
                            {isEvent ? (
                              // Evento del sistema
                              <div className="flex justify-center">
                                <div className="bg-slate-100 text-slate-600 px-4 py-2 rounded-full text-xs flex items-center gap-2">
                                  <History className="w-3 h-3"/>
                                  {msg.content}
                                </div>
                              </div>
                            ) : (
                              // Mensaje normal
                              <div
                                className={`flex gap-3 animate-in slide-in-from-bottom-2 ${
                                  isUser ? 'justify-end' : 'justify-start'
                                }`}
                              >
                                {!isUser && (
                                  <Avatar className="h-9 w-9 flex-none border-2 border-white shadow-sm">
                                    <AvatarFallback className="bg-gradient-to-br from-violet-400 to-purple-500">
                                      <Bot className="w-4 h-4 text-white"/>
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                                <div
                                  className={`
                                    max-w-md px-4 py-3 rounded-2xl shadow-sm
                                    ${isUser
                                      ? 'bg-gradient-to-br from-blue-600 to-blue-500 text-white rounded-br-sm'
                                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-sm'
                                    }
                                  `}
                                >
                                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                                  <span className={`text-[10px] mt-2 block ${isUser ? 'text-blue-100' : 'text-slate-400'}`}>
                                    {new Date(msg.timestamp).toLocaleTimeString('es-AR', {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })}
                                  </span>
                                </div>
                                {isUser && (
                                  <Avatar className="h-9 w-9 flex-none border-2 border-white shadow-sm">
                                    <AvatarFallback className="bg-gradient-to-br from-slate-400 to-slate-500">
                                      <User className="w-4 h-4 text-white"/>
                                    </AvatarFallback>
                                  </Avatar>
                                )}
                              </div>
                            )}
                          </div>
                        )
                      })}
                      <div ref={scrollRef} className="h-2" />
                    </div>
                  </ScrollArea>
                </div>

                {/* Input Area */}
                <div className="flex-none bg-white border-t border-slate-200 z-10 w-full">
                  <div className="px-6 py-4 max-w-4xl mx-auto w-full space-y-3">
                    {/* Status Banners */}
                    {selectedLead.ai_status === 'active' && (
                      <div className="bg-violet-50/80 backdrop-blur-sm border border-violet-200 text-violet-700 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4 animate-pulse text-violet-500"/> 
                          Sofía responderá automáticamente
                        </span>
                        <Button 
                          size="sm" 
                          variant="ghost" 
                          className="h-7 text-xs hover:bg-violet-100 text-violet-700 px-3 rounded-lg font-semibold"
                          onClick={() => handleStatusChange('paused')}
                        >
                          Intervenir
                        </Button>
                      </div>
                    )}

                    {officeEnabled && !inServiceHours && (
                      <div className="bg-amber-50/80 backdrop-blur-sm border border-amber-200 text-amber-700 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-amber-500"/> 
                          Fuera de horario ({officeStart}–{officeEnd})
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 text-xs hover:bg-amber-100 text-amber-800 px-3 rounded-lg font-semibold"
                          onClick={() => setDraft(offHoursMessage)}
                        >
                          Usar mensaje auto
                        </Button>
                      </div>
                    )}

                    {officeEnabled && inGuardHours && !inOfficeHours && (
                      <div className="bg-emerald-50/80 backdrop-blur-sm border border-emerald-200 text-emerald-700 px-4 py-2.5 rounded-xl text-xs font-medium flex items-center justify-between">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4 text-emerald-500"/> 
                          Guardia activa ({guardStart}–{guardEnd})
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-emerald-100 border-emerald-200 text-emerald-700">
                          GUARDIA
                        </Badge>
                      </div>
                    )}


                    {/* Quick Replies */}
                    {quickReplyFolders.flatMap(f => f.replies).length > 0 && (
                      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                        {quickReplyFolders
                          .flatMap(f => f.replies)
                          .filter(r => r.favorite)
                          .slice(0, 5)
                          .map((reply) => (
                            <Button
                              key={reply.id}
                              size="sm"
                              variant="outline"
                              className="h-8 text-xs rounded-full bg-slate-50 border-slate-200 hover:bg-white hover:border-violet-300 hover:text-violet-600 shrink-0 transition-all px-4 font-medium"
                              onClick={() => setDraft(replaceVariables(reply.text, selectedLead))}
                            >
                              ⚡ {reply.text.length > 35 ? `${reply.text.slice(0, 35)}…` : reply.text}
                            </Button>
                          ))}
                      </div>
                    )}

                    {/* Input */}
                    <div className="flex gap-3">
                      <InputChat 
                        value={draft} 
                        onChange={setDraft} 
                        onSend={(t) => { 
                          handleSendMessage(t)
                          setDraft("") 
                        }} 
                        disabled={false} 
                      />
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-8 bg-gradient-to-b from-slate-50 to-white">
                <div className="bg-white p-10 rounded-3xl shadow-2xl shadow-slate-200/50">
                  <BrainCircuit className="w-20 h-20 text-violet-200" />
                </div>
                <div className="text-center max-w-md px-6">
                  <h3 className="text-xl font-bold text-slate-700 mb-2">Panel de Control Neural</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    Seleccioná una conversación a la izquierda para supervisar el razonamiento de Sofía y tomar el control cuando sea necesario.
                  </p>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* 3. SIDEBAR DERECHO - CONTEXTO Y ACCIONES */}
      {selectedLead && (
        <div className="w-80 flex-none hidden xl:flex flex-col min-h-0 bg-white border-l border-slate-200 shadow-xl overflow-hidden">
          <div className="flex-none p-5 border-b border-slate-100 bg-gradient-to-br from-violet-50 to-white">
            <h4 className="font-black text-slate-700 text-sm flex items-center gap-2 uppercase tracking-wide">
              <BrainCircuit className="w-5 h-5 text-violet-600"/> Contexto & Acciones
            </h4>
          </div>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-6">
              {/* Asignar */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Asignar a</label>
                <Select 
                  value={selectedLead.assigned_to || selectedLead.agent_name || ""}
                  onValueChange={handleAssign}
                >
                  <SelectTrigger className="h-9 text-sm bg-white border-slate-200">
                    <SelectValue placeholder="Sin asignar" />
                  </SelectTrigger>
                  <SelectContent>
                    {allProfiles
                      .filter(p => ['seller', 'admin_god', 'supervisor_god'].includes(p.role))
                      .map(profile => (
                        <SelectItem key={profile.id} value={profile.full_name}>
                          {profile.full_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator className="bg-slate-100" />

              {/* Etiquetas IA */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Etiquetas IA</label>
                <div className="flex flex-wrap gap-2">
                  {(((selectedLead as any).ai_labels || []) as any[]).length === 0 ? (
                    <span className="text-xs text-slate-400">(sin etiquetas IA)</span>
                  ) : (
                    (((selectedLead as any).ai_labels || []) as any[]).map((t: any) => (
                      <Badge key={String(t)} variant="outline" className="bg-violet-50 text-violet-700 border-violet-200 py-1 px-2 rounded-lg font-medium">
                        <Sparkles className="w-3 h-3 mr-1"/> {String(t)}
                      </Badge>
                    ))
                  )}
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Tags */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Etiquetas</label>
                <div className="flex flex-wrap gap-2">
                  {(selectedLead.tags || []).map(tag => (
                    <Badge
                      key={tag}
                      variant="outline"
                      className="bg-violet-50 text-violet-700 border-violet-200 py-1 px-2 rounded-lg font-medium group cursor-pointer hover:bg-violet-100"
                      onClick={() => handleRemoveTag(tag)}
                    >
                      {tag}
                      <X className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity"/>
                    </Badge>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Input
                    value={newTag}
                    onChange={e => setNewTag(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddTag()}
                    placeholder="Nueva etiqueta..."
                    className="h-8 text-xs bg-slate-50 border-slate-200 focus-visible:ring-violet-500"
                  />
                  <Button
                    onClick={handleAddTag}
                    size="sm"
                    variant="outline"
                    className="h-8 px-2"
                  >
                    <Plus className="w-4 h-4"/>
                  </Button>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Datos del Lead */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Datos Extraídos</label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <User className="w-4 h-4"/> Nombre
                    </span>
                    <span className="font-bold text-slate-700">{sofiaExtracted.name || "-"}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <History className="w-4 h-4"/> Edad
                    </span>
                    <span className="font-bold text-slate-700">{sofiaExtracted.age ?? "-"}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <MapPin className="w-4 h-4"/> Prov / Localidad
                    </span>
                    <span className="font-bold text-slate-700">
                      {(sofiaExtracted.province || "N/D")}{sofiaExtracted.locality ? ` / ${sofiaExtracted.locality}` : ""}
                    </span>
                  </div>

                  <div className="flex items-center justify-between text-xs p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <UserPlus className="w-4 h-4"/> Grupo
                    </span>
                    <span className="font-bold text-slate-700">{sofiaExtracted.group || "-"}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs p-3 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-100 transition-all">
                    <span className="text-slate-500 flex items-center gap-2 font-medium">
                      <Briefcase className="w-4 h-4"/> Trabajo
                    </span>
                    <span className="font-bold text-slate-700">{sofiaExtracted.work || "-"}</span>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-1">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-8 text-xs w-full"
                      onClick={saveAiLabels}
                      disabled={!selectedLead}
                    >
                      <Sparkles className="w-3.5 h-3.5 mr-2"/> Guardar etiquetas IA
                    </Button>
                  </div>
                </div>
<Separator className="bg-slate-100" />

              {/* Notas Internas */}
              <div className="space-y-3">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Notas Internas</label>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {(selectedLead.comments || []).map((comment, idx) => (
                    <div key={idx} className="p-2 bg-amber-50 border border-amber-100 rounded-lg text-xs">
                      <div className="font-semibold text-amber-800 mb-1">{comment.author}</div>
                      <div className="text-slate-700">{comment.text}</div>
                      <div className="text-[10px] text-amber-600 mt-1">
                        {new Date(comment.timestamp).toLocaleString('es-AR')}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex gap-2">
                  <Textarea
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    placeholder="Agregar nota interna..."
                    className="h-16 text-xs bg-slate-50 border-slate-200 focus-visible:ring-violet-500 resize-none"
                  />
                  <Button
                    onClick={handleAddNote}
                    size="sm"
                    variant="outline"
                    className="h-16 px-2"
                  >
                    <Plus className="w-4 h-4"/>
                  </Button>
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Tareas */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Tareas</label>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setShowTaskModal(true)}
                    className="h-6 px-2 text-xs text-violet-600 hover:bg-violet-50"
                  >
                    <Plus className="w-3 h-3 mr-1"/> Nueva
                  </Button>
                </div>
                <div className="space-y-2">
                  {(selectedLead.reminders || []).map((reminder, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 p-2 bg-slate-50 border border-slate-100 rounded-lg hover:bg-slate-100 transition-all cursor-pointer"
                      onClick={() => handleToggleTask(idx)}
                    >
                      {reminder.status === 'done' ? (
                        <CheckSquare className="w-4 h-4 text-green-600 flex-none mt-0.5"/>
                      ) : (
                        <Square className="w-4 h-4 text-slate-400 flex-none mt-0.5"/>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className={`text-xs ${reminder.status === 'done' ? 'line-through text-slate-400' : 'text-slate-700'}`}>
                          {reminder.task}
                        </div>
                        {reminder.due_date && (
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            📅 {new Date(reminder.due_date).toLocaleDateString('es-AR')}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <Separator className="bg-slate-100" />

              {/* Acciones Rápidas */}
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wide">Acciones</label>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                  onClick={() => setLeadDetailOpen(true)}
                >
                  <ExternalLink className="w-3.5 h-3.5 mr-2 text-blue-500"/> Ver ficha completa
                </Button>
                <Button
                  variant="outline"
                  className="w-full justify-start text-xs h-9 border-slate-200 bg-white hover:bg-slate-50 hover:text-slate-900 shadow-sm"
                  onClick={() => handleInboxStatusChange('snoozed')}
                >
                  <CalendarClock className="w-3.5 h-3.5 mr-2 text-purple-500"/> Posponer seguimiento
                </Button>
              </div>
            </div>
          </div>
          </ScrollArea>
        </div>
      )}

      {/* MODALS */}
      {/* Quick Replies Manager Modal */}
      <Dialog open={showQuickRepliesModal} onOpenChange={setShowQuickRepliesModal}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Gestor de Respuestas Rápidas</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {quickReplyFolders.map((folder, folderIdx) => (
              <div key={folderIdx} className="border border-slate-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="w-5 h-5 text-violet-600"/>
                    <Input
                      value={folder.name}
                      onChange={e => {
                        const updated = [...quickReplyFolders]
                        updated[folderIdx].name = e.target.value
                        setQuickReplyFolders(updated)
                      }}
                      className="font-semibold h-8 w-48 bg-transparent border-none focus-visible:ring-0 p-0"
                    />
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      const updated = [...quickReplyFolders]
                      updated[folderIdx].replies.push({
                        id: Date.now().toString(),
                        text: '',
                        favorite: false
                      })
                      setQuickReplyFolders(updated)
                    }}
                    className="h-7 text-xs"
                  >
                    <Plus className="w-3 h-3 mr-1"/> Agregar respuesta
                  </Button>
                </div>
                <div className="space-y-2">
                  {folder.replies.map((reply, replyIdx) => (
                    <div key={reply.id} className="flex gap-2 items-start">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 flex-none"
                        onClick={() => {
                          const updated = [...quickReplyFolders]
                          updated[folderIdx].replies[replyIdx].favorite = !reply.favorite
                          setQuickReplyFolders(updated)
                        }}
                      >
                        <Star className={`w-4 h-4 ${reply.favorite ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`}/>
                      </Button>
                      <Textarea
                        value={reply.text}
                        onChange={e => {
                          const updated = [...quickReplyFolders]
                          updated[folderIdx].replies[replyIdx].text = e.target.value
                          setQuickReplyFolders(updated)
                        }}
                        placeholder="Texto de la respuesta rápida..."
                        className="flex-1 text-xs min-h-[60px]"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 p-0 flex-none hover:bg-red-50 hover:text-red-600"
                        onClick={() => {
                          const updated = [...quickReplyFolders]
                          updated[folderIdx].replies.splice(replyIdx, 1)
                          setQuickReplyFolders(updated)
                        }}
                      >
                        <Trash2 className="w-4 h-4"/>
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <Button
              variant="outline"
              className="w-full"
              onClick={() => {
                setQuickReplyFolders([...quickReplyFolders, { name: 'Nueva Carpeta', replies: [] }])
              }}
            >
              <Plus className="w-4 h-4 mr-2"/> Agregar Carpeta
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => {
              saveConfig()
              setShowQuickRepliesModal(false)
            }}>
              <Save className="w-4 h-4 mr-2"/> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Task Modal */}
      <Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva Tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-semibold">Descripción</label>
              <Textarea
                value={newTask}
                onChange={e => setNewTask(e.target.value)}
                placeholder="Ej: Enviar cotización por email"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-semibold">Fecha límite (opcional)</label>
              <Input
                type="date"
                value={newTaskDate}
                onChange={e => setNewTaskDate(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTaskModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddTask}>
              <CheckCircle2 className="w-4 h-4 mr-2"/> Crear Tarea
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* LEAD DETAIL (modal interno) */}
      <Dialog open={leadDetailOpen} onOpenChange={setLeadDetailOpen}>
        <DialogContent className="max-w-3xl w-[95vw] p-0 overflow-hidden">
          <div className="p-6 border-b border-slate-100 bg-white">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-slate-800 flex items-center gap-2">
                <FileText className="w-5 h-5 text-violet-600" />
                Ficha del lead
              </DialogTitle>
            </DialogHeader>
          </div>
          <ScrollArea className="h-[70vh]">
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs text-slate-400 font-bold uppercase">Nombre</div>
                  <div className="font-semibold text-slate-800">{selectedLead?.name || "-"}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs text-slate-400 font-bold uppercase">Teléfono</div>
                  <div className="font-semibold text-slate-800">{selectedLead?.phone || "-"}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs text-slate-400 font-bold uppercase">Estado</div>
                  <div className="font-semibold text-slate-800">{selectedLead?.status || "-"}</div>
                </div>
                <div className="p-4 rounded-xl border border-slate-200 bg-white">
                  <div className="text-xs text-slate-400 font-bold uppercase">Provincia / Localidad</div>
                  <div className="font-semibold text-slate-800">
                    {(selectedLead as any)?.province || "-"}{(selectedLead as any)?.locality ? ` / ${(selectedLead as any).locality}` : ""}
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border border-slate-200 bg-white">
                <div className="text-xs text-slate-400 font-bold uppercase mb-2">Datos crudos (debug)</div>
                <pre className="text-xs font-mono whitespace-pre-wrap text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">
{JSON.stringify(selectedLead, null, 2)}
                </pre>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="p-4 border-t border-slate-100 bg-white">
            <Button variant="outline" onClick={() => setLeadDetailOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


function CampaignSummary({
  leads,
  campaignLoss,
  campaignStatus,
  includeArchived,
}: {
  leads: Lead[]
  campaignLoss: string
  campaignStatus: string
  includeArchived: boolean
}) {
  const filtered = useMemo(() => {
    const lossNorm = String(campaignLoss || "all")
    const statusNorm = String(campaignStatus || "all")

    return (leads || []).filter((l) => {
      if (!includeArchived && l.archived) return false
      if (statusNorm !== "all" && String(l.status || "").toLowerCase() !== statusNorm.toLowerCase()) return false
      if (lossNorm !== "all") {
        const lr = String(l.loss_reason || "").toLowerCase()
        // match flexible like LeadFactory categories
        if (lossNorm === "precio") return lr.includes("precio") || lr.includes("caro")
        if (lossNorm === "fantasmas") return lr.includes("no_contesta") || lr.includes("no contesta") || lr.includes("fantasma")
        if (lossNorm === "quemados") return lr.includes("quemado") || lr.includes("7 llamados")
        if (lossNorm === "interes") return lr.includes("interes") || lr.includes("no quiere")
        if (lossNorm === "recontactar") return lr.includes("competencia") || lr.includes("otros")
        if (lossNorm === "basural") return lr.includes("error") || lr.includes("requisitos") || lr.includes("salud")
        return lr.includes(lossNorm.toLowerCase())
      }
      return true
    })
  }, [leads, campaignLoss, campaignStatus, includeArchived])

  const counts = useMemo(() => {
    const byAi = { active: 0, paused: 0, disabled: 0 } as Record<string, number>
    const byPriority = { high: 0, normal: 0 } as Record<string, number>
    filtered.forEach((l) => {
      byAi[l.ai_status] = (byAi[l.ai_status] || 0) + 1
      const p = l.priority || "normal"
      byPriority[p] = (byPriority[p] || 0) + 1
    })
    return { byAi, byPriority }
  }, [filtered])

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-black text-slate-500 uppercase tracking-widest">Resumen del segmento</div>
        <Badge variant="outline" className="bg-white border-slate-200 text-slate-700">
          {filtered.length} destinatarios
        </Badge>
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">IA activa</div>
          <div className="text-lg font-black text-slate-800">{counts.byAi.active || 0}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">IA pausada</div>
          <div className="text-lg font-black text-slate-800">{counts.byAi.paused || 0}</div>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-3">
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">Prioridad alta</div>
          <div className="text-lg font-black text-slate-800">{counts.byPriority.high || 0}</div>
        </div>
      </div>

      {filtered.length > 0 && (
        <div className="mt-4">
          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-2">Preview</div>
          <div className="space-y-2">
            {filtered.slice(0, 5).map((l) => (
              <div key={l.id} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3 py-2">
                <div className="min-w-0">
                  <div className="text-xs font-bold text-slate-800 truncate">{l.name || "Sin nombre"}</div>
                  <div className="text-[10px] text-slate-500 truncate">{l.phone}</div>
                </div>
                {l.loss_reason ? (
                  <Badge variant="outline" className="text-[10px] bg-slate-50 border-slate-200 text-slate-600">
                    {String(l.loss_reason).slice(0, 22)}
                  </Badge>
                ) : (
                  <span className="text-[10px] text-slate-300">—</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}


function InputChat({
  value,
  onChange,
  onSend,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onSend: (t: string) => void
  disabled: boolean
}) {
  const handle = () => {
    if (!value.trim()) return
    onSend(value)
  }
  return (
    <div className="flex-1 flex gap-3 relative">
      <Input
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault()
            handle()
          }
        }}
        placeholder="Escribí un mensaje..."
        className="bg-slate-50 border-slate-200 focus-visible:ring-violet-500 focus-visible:ring-2 rounded-xl h-12 pl-4 pr-14 shadow-sm text-sm"
        disabled={disabled}
      />
      <div className="absolute right-1.5 top-1.5">
        <Button
          onClick={handle}
          disabled={!value.trim() || disabled}
          size="icon"
          className="h-9 w-9 rounded-lg bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          <Send className="w-4 h-4 text-white"/>
        </Button>
      </div>
    </div>
  )
}