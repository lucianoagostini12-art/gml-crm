"use client"

import { useEffect, useState, useRef } from "react"
// 1. CORRECCIÓN: Importamos la función correcta
import { createClient } from "@/lib/supabase"
import { 
  DndContext, DragOverlay, pointerWithin, KeyboardSensor, PointerSensor, 
  useSensor, useSensors, DragStartEvent, DragOverEvent, DragEndEvent, useDroppable 
} from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArchiveX, Trophy, BellRing, AlertOctagon, Phone, MessageCircle, Clock } from "lucide-react" 
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { differenceInHours } from "date-fns" 

// --- COMPONENTES ---
import { Lead, LeadCard } from "./LeadCard"
import { LeadDetail } from "./LeadDetail"
import { DocConfirmDialog } from "./DocConfirmDialog"
import { LostLeadDialog } from "@/components/seller/LostLeadDialog"
import { WonLeadDialog } from "@/components/seller/WonLeadDialog"
import { QuotationDialog } from "@/components/seller/QuotationDialog"

const ALARM_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"

const ACTIVE_COLUMNS = [
  { id: "nuevo", title: "Sin Trabajar 📥", color: "bg-slate-100 dark:bg-[#18191A] border dark:border-[#3E4042]" }, 
  { id: "contactado", title: "En Contacto 📞", color: "bg-blue-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
  { id: "cotizacion", title: "Cotizando 💲", color: "bg-yellow-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
  { id: "documentacion", title: "Documentación 📂", color: "bg-purple-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
]

// --- HELPER: Detectar Vencimiento (+72hs) ---
const isLeadOverdue = (lastUpdateStr: string, status: string) => {
    if (!['cotizacion', 'contactado'].includes(status)) return false;
    const lastUpdate = new Date(lastUpdateStr);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - lastUpdate.getTime());
    const diffHours = Math.ceil(diffTime / (1000 * 60 * 60)); 
    return diffHours > 72; 
}

function SortableItem({ lead, onClick, onCallIncrement, onOmniClick }: { lead: Lead, onClick: () => void, onCallIncrement: (e: any) => void, onOmniClick: (e: any) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0 : 1 }
  const isUrgent = lead.scheduled_for && new Date(lead.scheduled_for) <= new Date()
  const isOverdue = isLeadOverdue(lead.lastUpdate, lead.status) 

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners} onClick={onClick} className={`${isUrgent ? "animate-pulse ring-2 ring-red-400" : isOverdue ? "ring-2 ring-yellow-400 bg-yellow-50" : ""} rounded-lg relative`}>
      {isOverdue && <span className="absolute -top-2 -right-2 bg-yellow-500 text-white text-[10px] px-1.5 py-0.5 rounded-full z-10 font-bold shadow-sm animate-bounce">!</span>}
      <LeadCard lead={lead} onCallIncrement={onCallIncrement} onOmniClick={onOmniClick} />
    </div>
  )
}

function KanbanColumn({ col, leads, onClickLead, onCallIncrement, onOmniClick }: { col: any, leads: Lead[], onClickLead: (l:Lead) => void, onCallIncrement: (id: string) => void, onOmniClick: (id: string) => void }) {
  const { setNodeRef } = useDroppable({ id: col.id })
  return (
    <div ref={setNodeRef} className={`min-w-[280px] w-[280px] flex flex-col rounded-xl ${col.color} p-3 transition-colors h-[calc(100vh-160px)]`}>
      <div className="flex justify-between items-center mb-3 px-1 shrink-0">
        <h3 className="font-bold text-slate-700 dark:text-[#E4E6EB] text-sm">{col.title}</h3>
        <span className="bg-white dark:bg-[#3A3B3C] dark:text-[#E4E6EB] text-slate-500 text-xs px-2 py-1 rounded-full shadow-sm border dark:border-[#3E4042]">{leads.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 pr-1 pb-4 custom-scrollbar">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-2">
                {leads.map((lead) => (
                <SortableItem key={lead.id} lead={lead} onClick={() => onClickLead(lead)} onCallIncrement={() => onCallIncrement(lead.id)} onOmniClick={() => onOmniClick(lead.id)} />
                ))}
            </div>
        </SortableContext>
      </div>
    </div>
  )
}

function DropZone({ id, children, className }: { id: string, children: React.ReactNode, className?: string }) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div ref={setNodeRef} className={`${className} ${isOver ? 'scale-110 ring-4 ring-offset-2 ring-blue-500' : ''}`}>
      {children}
    </div>
  )
}

// 2. Aceptamos userName como prop
export function KanbanBoard({ userName }: { userName?: string }) {
  // 3. Inicializamos Supabase
  const supabase = createClient()

  const [leads, setLeads] = useState<Lead[]>([])
  const leadsRef = useRef<Lead[]>([]) 
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  
  // MODALES
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false)
  const [isWonDialogOpen, setIsWonDialogOpen] = useState(false)
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false)
  const [isDocConfirmOpen, setIsDocConfirmOpen] = useState(false)
  
  // ALARMAS
  const [alarmLead, setAlarmLead] = useState<Lead | null>(null) 
  const [overdueLead, setOverdueLead] = useState<Lead | null>(null) 
  
  const [copySuccess, setCopySuccess] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const [leadProcessingId, setLeadProcessingId] = useState<string | null>(null)
  
  // Usamos el nombre real o fallback
  const CURRENT_USER = userName || "Maca"

  useEffect(() => { leadsRef.current = leads }, [leads])

  useEffect(() => { 
      fetchLeads()
      if (typeof window !== 'undefined') { audioRef.current = new Audio(ALARM_SOUND) }
  }, [CURRENT_USER]) // Se recarga si cambia el usuario
  
  useEffect(() => {
      if (leads.length > 0 && !overdueLead) {
          const found = leads.find(l => isLeadOverdue(l.lastUpdate, l.status));
          if (found) {
              setOverdueLead(found); 
          }
      }
  }, [leads]); 

  useEffect(() => {
    if (copySuccess) { const timer = setTimeout(() => setCopySuccess(null), 3000); return () => clearTimeout(timer) }
  }, [copySuccess])

  useEffect(() => {
    const interval = setInterval(() => {
        const now = new Date()
        leadsRef.current.forEach(lead => {
            if (lead.scheduled_for) {
                const scheduleTime = new Date(lead.scheduled_for)
                if (now.getDate() === scheduleTime.getDate() && now.getHours() === scheduleTime.getHours() && now.getMinutes() === scheduleTime.getMinutes()) {
                    setAlarmLead(prev => { if (prev?.id === lead.id) return prev; audioRef.current?.play().catch(() => {}); return lead })
                }
            }
        })
    }, 15000) 
    return () => clearInterval(interval)
  }, []) 

  async function fetchLeads() {
    const { data, error } = await supabase.from('leads').select('*').eq('agent_name', CURRENT_USER).not('status', 'in', '("perdido","vendido")')
    
    if (data) {
        setLeads(mapLeads(data))
    } else {
        console.log("No se encontraron leads o hubo error", error)
    }
  }

  const mapLeads = (data: any[]) => data.map((item: any) => ({
    id: item.id, name: item.name, phone: item.phone, source: item.source, status: item.status.toLowerCase(), intent: item.intent,
    lastUpdate: item.last_update || item.created_at, 
    createdAt: new Date(item.created_at).toLocaleDateString(), agent: item.agent_name || 'Sin asignar',
    calls: item.calls || 0, quoted_prepaga: item.quoted_prepaga, quoted_plan: item.quoted_plan, quoted_price: item.quoted_price, notes: item.notes || '',
    scheduled_for: item.scheduled_for, prepaga: item.prepaga, observations: item.observations, capitas: item.capitas
  }))

  const getSortedLeads = (columnId: string) => {
    return leads.filter(l => l.status === columnId).sort((a, b) => new Date(b.lastUpdate).getTime() - new Date(a.lastUpdate).getTime())
  }

  const logAction = async (leadId: string, action: string, details: string = "") => {
      try { await supabase.from('audit_logs').insert({ lead_id: leadId, user_name: CURRENT_USER, action: action, details: details }) } catch (e) {}
  }

  async function updateLeadStatus(leadId: string, newStatus: string, extraData?: any) {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus, ...extraData } : l))
    await supabase.from('leads').update({ status: newStatus, last_update: new Date().toISOString(), ...extraData }).eq('id', leadId)
    logAction(leadId, `Movido a ${newStatus}`)
    fetchLeads()
  }

  const handleOmniClick = async (id: string) => {
      const lead = leads.find(l => l.id === id)
      if (!lead) return
      navigator.clipboard.writeText(lead.phone.replace(/[^0-9]/g, ''))
      const omniUrl = localStorage.getItem("omni_url")
      if (omniUrl) window.open(omniUrl, '_blank')
      setCopySuccess(`Número copiado!`)
  }

  const handleCallIncrement = async (id: string) => {
      const lead = leads.find(l => l.id === id)
      if (!lead) return
      const newCount = lead.calls + 1
      const newNotes = (lead.notes || "") + `\n[Llamada #${newCount}] - ${new Date().toLocaleTimeString()}`
      setLeads(prev => prev.map(l => l.id === id ? { ...l, calls: newCount, notes: newNotes, lastUpdate: new Date().toISOString() } : l))
      if (overdueLead?.id === id) setOverdueLead(null)
      await supabase.from('leads').update({ calls: newCount, notes: newNotes, last_update: new Date().toISOString() }).eq('id', id)
      logAction(id, "Llamada Saliente", `Manual (Intento #${newCount})`)
  }
  
  const handleWhatsappAction = (phone: string, name: string) => {
      const message = `Hola ${name}, ¿cómo estás? Te escribo para retomar el tema de tu cobertura médica.`
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank')
      if (overdueLead) {
          updateLeadStatus(overdueLead.id, overdueLead.status, { last_update: new Date().toISOString() })
          setOverdueLead(null)
      }
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  function handleDragStart(event: DragStartEvent) { setActiveId(event.active.id as string) }
  function handleDragOver(event: DragOverEvent) {}
  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event; setActiveId(null); if (!over) return
    const activeId = active.id as string; const overId = over.id as string; const activeLead = leads.find(l => l.id === activeId); if(!activeLead) return
    if (overId === 'zone-vendido') { setLeadProcessingId(activeId); setIsWonDialogOpen(true); return }
    if (overId === 'zone-perdido') { setLeadProcessingId(activeId); setIsLostDialogOpen(true); return }
    let overContainer = ACTIVE_COLUMNS.find(c => c.id === overId)?.id
    if (!overContainer) { const overItem = leads.find(l => l.id === overId); if (overItem) overContainer = overItem.status }
    if (!overContainer) return
    if (activeLead.status === 'cotizacion' && !['documentacion', 'cotizacion'].includes(overContainer)) return 
    if (activeLead.status === 'documentacion' && overContainer !== 'documentacion') return
    if (overContainer !== activeLead.status) {
        if (overContainer === 'cotizacion') { setLeadProcessingId(activeId); setIsQuoteDialogOpen(true); return }
        if (overContainer === 'documentacion') { setLeadProcessingId(activeId); setIsDocConfirmOpen(true); return }
        updateLeadStatus(activeId, overContainer)
    }
  }

  const confirmQuote = (data: any) => { if (leadProcessingId) { updateLeadStatus(leadProcessingId, 'cotizacion', { quoted_prepaga: data.prepaga, quoted_plan: data.plan, quoted_price: parseFloat(data.price) }); setLeadProcessingId(null); setIsQuoteDialogOpen(false) } }
  const cancelQuote = () => { setLeadProcessingId(null); setIsQuoteDialogOpen(false) }
  const confirmLoss = async (reason: string, notes: string) => { 
      const currentId = leadProcessingId
      if (currentId) { 
          setLeads(prev => prev.filter(l => l.id !== currentId))
          setLeadProcessingId(null); setIsLostDialogOpen(false)
          const lead = leads.find(l => l.id === currentId)
          const newHistory = (lead?.notes || "") + `\n[PERDIDO] Motivo: ${reason}. Nota: ${notes}`
          await supabase.from('leads').update({ status: 'perdido', loss_reason: reason, notes: newHistory, last_update: new Date().toISOString() }).eq('id', currentId)
          logAction(currentId, "Marcado Perdido", reason);
      } 
  }
  const confirmWin = async (data: any) => { 
      const currentId = leadProcessingId
      if (currentId) { 
          setLeads(prev => prev.filter(l => l.id !== currentId))
          setLeadProcessingId(null); setIsWonDialogOpen(false)
          const lead = leads.find(l => l.id === currentId)
          const newHistory = (lead?.notes || "") + `\n[VENTA]`
          await supabase.from('leads').update({ status: 'vendido', value: 0, capitas: 1, notes: newHistory, last_update: new Date().toISOString() }).eq('id', currentId)
          logAction(currentId, "VENTA CERRADA", "");
      } 
  }
  const confirmDoc = () => { if (leadProcessingId) { updateLeadStatus(leadProcessingId, 'documentacion'); setLeadProcessingId(null); setIsDocConfirmOpen(false) } }
  const cancelDoc = () => { setLeadProcessingId(null); setIsDocConfirmOpen(false) }

  return (
    <div className="flex flex-col h-full relative">
      {copySuccess && <div className="fixed top-20 left-1/2 transform -translate-x-1/2 bg-[#242526] text-[#E4E6EB] px-6 py-3 rounded-full text-sm font-bold shadow-xl z-[100] animate-in fade-in slide-in-from-top-4 border border-[#3E4042]">✅ {copySuccess}</div>}
      <DndContext sensors={sensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragOver={handleDragOver} onDragEnd={handleDragEnd}>
        <div className="flex-1 flex gap-4 overflow-x-auto p-4 h-full"> 
          {ACTIVE_COLUMNS.map((col) => <KanbanColumn key={col.id} col={col} leads={getSortedLeads(col.id)} onClickLead={(l) => { if (!activeId) setSelectedLead(l) }} onCallIncrement={handleCallIncrement} onOmniClick={handleOmniClick} />)}
        </div>
        {activeId && (
            <div className="fixed bottom-6 left-0 right-0 flex justify-center gap-8 z-50 pointer-events-none pb-4 px-4">
                <DropZone id="zone-perdido" className="pointer-events-auto flex flex-col items-center justify-center w-48 h-28 rounded-2xl bg-white/80 dark:bg-red-900/50 backdrop-blur-md border-2 border-red-200 dark:border-red-900 shadow-xl transition-all transform hover:scale-105"><div className="bg-red-100 dark:bg-red-900 p-2 rounded-full mb-2"><ArchiveX className="h-6 w-6 text-red-600 dark:text-red-300" /></div><span className="font-bold text-slate-700 dark:text-white text-sm">PERDIDO 🗑️</span></DropZone>
                <DropZone id="zone-vendido" className="pointer-events-auto flex flex-col items-center justify-center w-48 h-28 rounded-2xl bg-white/80 dark:bg-green-900/50 backdrop-blur-md border-2 border-green-200 dark:border-green-900 shadow-xl transition-all transform hover:scale-105"><div className="bg-green-100 dark:bg-green-900 p-2 rounded-full mb-2"><Trophy className="h-6 w-6 text-green-600 dark:text-green-300" /></div><span className="font-bold text-slate-700 dark:text-white text-sm">VENTA 🚀</span></DropZone>
            </div>
        )}
        <DragOverlay>{activeId ? (<div className="transform rotate-3 scale-105 cursor-grabbing shadow-2xl opacity-90 pointer-events-none"><LeadCard lead={leads.find(l => l.id === activeId)!} /></div>) : null}</DragOverlay>
      </DndContext>
      <LeadDetail lead={selectedLead} open={!!selectedLead} onOpenChange={(open) => !open && setSelectedLead(null)} />
      <LostLeadDialog open={isLostDialogOpen} onOpenChange={setIsLostDialogOpen} onConfirm={confirmLoss} />
      <WonLeadDialog open={isWonDialogOpen} onOpenChange={setIsWonDialogOpen} onConfirm={confirmWin} />
      <QuotationDialog open={isQuoteDialogOpen} onOpenChange={setIsQuoteDialogOpen} onConfirm={confirmQuote} onCancel={() => setIsQuoteDialogOpen(false)} />
      <DocConfirmDialog open={isDocConfirmOpen} onOpenChange={setIsDocConfirmOpen} onConfirm={confirmDoc} onCancel={() => setIsDocConfirmOpen(false)} />
      <Dialog open={!!alarmLead} onOpenChange={(val) => !val && setAlarmLead(null)}><DialogContent><DialogHeader><DialogTitle className="flex items-center gap-2 text-red-600"><BellRing className="h-6 w-6 animate-bounce" /> ¡Llamada Programada!</DialogTitle><DialogDescription className="text-lg text-slate-900 font-medium">Contactar a: <span className="text-2xl font-bold">{alarmLead?.name}</span></DialogDescription></DialogHeader><DialogFooter><Button onClick={() => setAlarmLead(null)} className="w-full h-12 text-lg">Entendido 📞</Button></DialogFooter></DialogContent></Dialog>
      
      {/* --- NUEVO MODAL: ALERTA DE VENCIMIENTO 72HS (INTRUSIVO) --- */}
      <Dialog open={!!overdueLead} onOpenChange={() => {}}>
          <DialogContent className="border-4 border-yellow-400 max-w-md shadow-2xl animate-in zoom-in duration-300">
              <DialogHeader className="text-center">
                  <div className="mx-auto bg-yellow-100 p-4 rounded-full mb-4 w-fit border-2 border-yellow-400">
                      <AlertOctagon className="h-10 w-10 text-yellow-600 animate-pulse"/>
                  </div>
                  <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">
                      ¡COTIZACIÓN VENCIDA!
                  </DialogTitle>
                  <DialogDescription className="text-base text-slate-600 mt-2 font-medium">
                      Pasaron más de 72 horas sin novedades con <br/>
                      <span className="text-xl font-bold text-slate-900 bg-yellow-200 px-2 rounded">{overdueLead?.name}</span>
                  </DialogDescription>
                  <p className="text-xs text-slate-400 mt-4 italic">No podés cerrar esto hasta que gestiones al cliente.</p>
              </DialogHeader>
              <div className="flex flex-col gap-3 mt-4">
                  <Button 
                      className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold text-lg gap-2 shadow-md transform hover:scale-[1.02] transition-transform"
                      onClick={() => handleWhatsappAction(overdueLead?.phone || '', overdueLead?.name || '')}
                  >
                      <MessageCircle size={24} fill="currentColor"/> Enviar WhatsApp Ya
                  </Button>
                  
                  <div className="relative flex items-center gap-2 py-2">
                      <div className="h-px bg-slate-200 flex-1"></div>
                      <span className="text-xs text-slate-400 font-bold uppercase">O llamar</span>
                      <div className="h-px bg-slate-200 flex-1"></div>
                  </div>

                  <Button 
                      variant="outline"
                      className="w-full h-12 border-2 border-slate-200 text-slate-700 font-bold text-lg gap-2 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-700"
                      onClick={() => handleCallIncrement(overdueLead?.id || '')}
                  >
                      <Phone size={20}/> Registrar Llamada
                  </Button>
              </div>
          </DialogContent>
      </Dialog>
    </div>
  )
}