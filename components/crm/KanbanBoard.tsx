"use client"

import { useEffect, useState, useRef } from "react"
import { createClient } from "@/lib/supabase"
import {
  DndContext,
  DragOverlay,
  pointerWithin,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  useDroppable,
  closestCorners,
  rectIntersection,
} from "@dnd-kit/core"
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { ArchiveX, Trophy, BellRing, AlertOctagon, MessageCircle } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

// --- COMPONENTES ---
import { Lead, LeadCard } from "./LeadCard"
import { LeadDetail } from "./LeadDetail"
import { DocConfirmDialog } from "./DocConfirmDialog"
import { LostLeadDialog } from "@/components/seller/LostLeadDialog"
import { WonLeadDialog } from "@/components/seller/WonLeadDialog"
import { QuotationDialog } from "@/components/seller/QuotationDialog"
import { SaleWizardDialog } from "@/components/seller/SaleWizardDialog"

const ALARM_SOUND = "https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"

const ACTIVE_COLUMNS = [
  { id: "nuevo", title: "Sin Trabajar 📥", color: "bg-slate-100 dark:bg-[#18191A] border dark:border-[#3E4042]" },
  { id: "contactado", title: "En Contacto 📞", color: "bg-blue-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
  { id: "cotizacion", title: "Cotizando 💲", color: "bg-yellow-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
  { id: "documentacion", title: "Documentación 📂", color: "bg-purple-50 dark:bg-[#18191A] border dark:border-[#3E4042]" },
]

// ✅ Estados permitidos en el Kanban (blindaje)
const ACTIVE_STATUSES = ACTIVE_COLUMNS.map((c) => c.id)

const sortLeadsLogic = (a: Lead, b: Lead) => {
  const now = new Date().getTime()
  const aSched = a.scheduled_for ? new Date(a.scheduled_for).getTime() : null
  const bSched = b.scheduled_for ? new Date(b.scheduled_for).getTime() : null
  if (aSched && bSched) return aSched - bSched
  if (aSched && aSched <= now) return -1
  if (bSched && bSched <= now) return 1
  return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
}

const isLeadOverdue = (lastUpdateStr: string, status: string) => {
  if (!["cotizacion", "contactado"].includes(status)) return false
  const lastUpdate = new Date(lastUpdateStr)
  const now = new Date()
  const diffHours = Math.ceil(Math.abs(now.getTime() - lastUpdate.getTime()) / (1000 * 60 * 60))
  return diffHours > 72
}

function SortableItem({ lead, removing, onClick, onCallIncrement, onOmniClick, onResolveAgenda }: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    scale: isDragging ? 1.05 : 1,
  }
  const isUrgent = lead.scheduled_for && new Date(lead.scheduled_for) <= new Date()
  const isOverdue = isLeadOverdue(lead.lastUpdate, lead.status)

  return (
    <div
      id={`lead-${lead.id}`}
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={`rounded-xl relative transition-all duration-300 ease-in-out origin-top
            ${removing ? "opacity-0 scale-75 -translate-y-2 pointer-events-none" : ""}
            ${isUrgent ? "ring-2 ring-red-500 shadow-[0_0_20px_rgba(239,68,68,0.5)] animate-pulse" : ""}
            ${isOverdue ? "ring-2 ring-yellow-400 border-yellow-200" : ""}`}
    >
      {isUrgent && (
        <div
          onClick={(e) => {
            e.stopPropagation()
            onResolveAgenda(lead)
          }}
          className="absolute -top-3 -left-3 bg-red-600 text-white p-1.5 rounded-full z-50 shadow-xl border-2 border-white animate-bounce cursor-pointer"
        >
          <BellRing className="h-4 w-4" />
        </div>
      )}
      {isOverdue && (
        <div className="absolute -top-3 -right-3 bg-yellow-500 text-white p-1 rounded-full z-50 shadow-lg border-2 border-white animate-bounce">
          <AlertOctagon className="h-4 w-4" />
        </div>
      )}

      {/* ✅ NO tocamos el shape del lead para no romper LeadCard */}
      <LeadCard
        lead={lead}
        onCallIncrement={() => onCallIncrement(lead.id)}
        onOmniClick={() => onOmniClick?.(lead.id)}
      />
    </div>
  )
}

function KanbanColumn({ col, leads, removingIds, onClickLead, onCallIncrement, onOmniClick, onResolveAgenda }: any) {
  const { setNodeRef } = useDroppable({ id: col.id })

  return (
    <div ref={setNodeRef} className={`min-w-[300px] w-[300px] flex flex-col rounded-xl ${col.color} p-4 min-h-full h-fit`}>
      <div className="flex justify-between items-center mb-4 px-1 text-slate-700 sticky top-0 z-10 py-1 bg-inherit">
        <h3 className="font-black text-xs uppercase tracking-wider">{col.title}</h3>
        <span className="bg-white text-[10px] font-black px-2 py-1 rounded-full shadow-sm border">{leads.length}</span>
      </div>
      <div className="flex-1">
        <SortableContext items={leads.map((l: any) => l.id)} strategy={verticalListSortingStrategy}>
          <div className="flex flex-col gap-5 pt-4 pb-10">
            {leads.map((lead: any) => (
              <SortableItem
                key={lead.id}
                lead={lead}
                removing={removingIds?.includes?.(lead.id)}
                onClick={() => onClickLead(lead)}
                onCallIncrement={onCallIncrement}
                onOmniClick={onOmniClick}
                onResolveAgenda={onResolveAgenda}
              />
            ))}
          </div>
        </SortableContext>
      </div>
    </div>
  )
}

function DropZone({ id, children, className }: any) {
  const { setNodeRef, isOver } = useDroppable({ id })
  return (
    <div
      ref={setNodeRef}
      className={`${className} transition-all duration-300 ${
        isOver ? "scale-110 ring-4 ring-white shadow-2xl opacity-100" : "opacity-80"
      }`}
    >
      {children}
    </div>
  )
}

export function KanbanBoard({ userName }: { userName?: string }) {
  const supabase = createClient()
  const [leads, setLeads] = useState<Lead[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [alarmLead, setAlarmLead] = useState<Lead | null>(null)
  const [showConfirmCall, setShowConfirmCall] = useState<Lead | null>(null)
  const [leadProcessingId, setLeadProcessingId] = useState<string | null>(null)
  const [isLostDialogOpen, setIsLostDialogOpen] = useState(false)
  const [isWonDialogOpen, setIsWonDialogOpen] = useState(false)
  const [isQuoteDialogOpen, setIsQuoteDialogOpen] = useState(false)
  const [isDocConfirmOpen, setIsDocConfirmOpen] = useState(false)
  const [overdueLead, setOverdueLead] = useState<Lead | null>(null)

  // ✅ NUEVO: Wizard venta
  const [isSaleWizardOpen, setIsSaleWizardOpen] = useState(false)

  const audioRef = useRef<HTMLAudioElement | null>(null)
  const CURRENT_USER = userName || "Maca"

  // ✅ animación de salida + revert documentación
  const [removingIds, setRemovingIds] = useState<string[]>([])
  const [docPrevStatus, setDocPrevStatus] = useState<string | null>(null)

  const animateRemove = (id: string, removeFn: () => void) => {
    setRemovingIds((prev) => (prev.includes(id) ? prev : [...prev, id]))
    window.setTimeout(() => {
      removeFn()
      setRemovingIds((prev) => prev.filter((x) => x !== id))
    }, 280)
  }

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  // ✅ Mantengo tu mapping completo (así LeadCard no explota)
  const mapLeads = (data: any[]) =>
    data.map((item: any) => ({
      id: item.id,
      name: item.name,
      phone: item.phone,
      source: item.source,
      status: (item.status ?? "").toLowerCase(),
      lastUpdate: item.last_update || item.created_at,
      createdAt: item.created_at,
      agent: item.agent_name,
      calls: item.calls || 0,
      quoted_prepaga: item.quoted_prepaga,
      quoted_plan: item.quoted_plan,
      quoted_price: item.quoted_price,
      notes: item.notes || "",
      scheduled_for: item.scheduled_for,
      intent: item.intent || "medium",
      prepaga: item.prepaga,
      observations: item.observations,
      capitas: item.capitas,
    }))

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("agent_name", CURRENT_USER)
      .in("status", ACTIVE_STATUSES)

    if (error) {
      console.error("fetchLeads error:", error)
      return
    }

    if (data) {
      const mapped = mapLeads(data).filter((l) => ACTIVE_STATUSES.includes((l.status ?? "").toLowerCase()))
      setLeads(mapped)
    }
  }

  const customCollisionDetection = (args: any) => {
    const pointerCollisions = pointerWithin(args)
    if (pointerCollisions.length > 0) return pointerCollisions
    const intersections = rectIntersection(args)
    if (intersections.length > 0) {
      const overId = intersections[0].id
      if (leads.some((l) => l.id === overId)) {
        const lead = leads.find((l) => l.id === overId)
        if (lead) return [{ id: lead.status }]
      }
    }
    return closestCorners(args)
  }

  useEffect(() => {
    fetchLeads()

    const channel = supabase
      .channel("kanban_realtime_vfinal_SAFE")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leads", filter: `agent_name=eq.${CURRENT_USER}` },
        (payload) => {
          if (payload.eventType === "INSERT") {
            const newLead = mapLeads([payload.new])[0]
            const st = (newLead?.status ?? "").toLowerCase()
            if (!ACTIVE_STATUSES.includes(st)) return
            setLeads((prev) => [newLead, ...prev])
          }

          if (payload.eventType === "UPDATE") {
            const updated = mapLeads([payload.new])[0]
            const st = (updated?.status ?? "").toLowerCase()

            if (!ACTIVE_STATUSES.includes(st)) {
              setLeads((prev) => prev.filter((l) => l.id !== updated.id))
              return
            }

            setLeads((prev) => prev.map((l) => (l.id === updated.id ? updated : l)))
          }
        }
      )
      .subscribe()

    if (typeof window !== "undefined") {
      audioRef.current = new Audio(ALARM_SOUND)
      audioRef.current.loop = true
    }

    return () => {
      supabase.removeChannel(channel)
    }
  }, [CURRENT_USER])

  useEffect(() => {
    const found = leads.find((l) => isLeadOverdue(l.lastUpdate, l.status))
    if (found) setOverdueLead(found)
  }, [leads])

  const handleCallIncrement = async (leadId: string) => {
    const lead = leads.find((l) => l.id === leadId)
    if (!lead) return
    const newCallCount = lead.calls + 1
    const timestamp = new Date().toLocaleString("es-AR", { hour: "2-digit", minute: "2-digit" })
    const updatedNotes =
      (lead.notes || "") + (lead.notes ? "|||" : "") + `SEP_NOTE|${timestamp}|SISTEMA|Llamada realizada #${newCallCount}`
    let newStatus = lead.status
    const isBurned = newCallCount >= 7 && (lead.status === "nuevo" || lead.status === "contactado")
    if (isBurned) newStatus = "perdido"

    if (isBurned) {
      animateRemove(leadId, () => {
        setLeads((prev) => prev.filter((l) => l.id !== leadId))
      })
    } else {
      setLeads((prev) => prev.map((l) => (l.id === leadId ? { ...l, calls: newCallCount, notes: updatedNotes } : l)))
    }

    await supabase
      .from("leads")
      .update({
        calls: newCallCount,
        notes: updatedNotes,
        status: newStatus.toLowerCase(),
        last_update: new Date().toISOString(),
        loss_reason: isBurned ? "Dato quemado (7 llamados)" : null,
      })
      .eq("id", leadId)
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    setActiveId(null)
    if (!over) return
    const activeLead = leads.find((l) => l.id === active.id)
    if (!activeLead) return

    if (over.id === "zone-perdido") {
      setLeadProcessingId(active.id as string)
      setIsLostDialogOpen(true)
      return
    }
    if (over.id === "zone-vendido") {
      setLeadProcessingId(active.id as string)
      setIsWonDialogOpen(true)
      return
    }

    let overCol = over.id as string
    const leadTarget = leads.find((l) => l.id === overCol)
    if (leadTarget) overCol = leadTarget.status

    const colIdx = (id: string) => ACTIVE_COLUMNS.findIndex((c) => c.id === id)
    const isTryingToGoBack = colIdx(overCol) < colIdx(activeLead.status)

    if (["cotizacion", "documentacion"].includes(activeLead.status) && isTryingToGoBack) return

    if (overCol && overCol !== activeLead.status && ACTIVE_COLUMNS.some((c) => c.id === overCol)) {
      if (overCol === "cotizacion") {
        setLeadProcessingId(active.id as string)
        setIsQuoteDialogOpen(true)
        return
      }

      if (overCol === "documentacion") {
        setLeadProcessingId(active.id as string)
        setDocPrevStatus(activeLead.status)

        setLeads((prev) => prev.map((l) => (l.id === active.id ? { ...l, status: "documentacion" } : l)))

        setIsDocConfirmOpen(true)
        return
      }

      setLeads((prev) => prev.map((l) => (l.id === active.id ? { ...l, status: overCol } : l)))
      await supabase
        .from("leads")
        .update({ status: overCol.toLowerCase(), last_update: new Date().toISOString() })
        .eq("id", active.id)
    }
  }

  const sortLeads = (columnId: string) => leads.filter((l) => l.status === columnId).sort(sortLeadsLogic)

  // ✅ Guardado de venta + docs (Storage + lead_documents + sales + lead status)
  const handleConfirmSale = async (formData: any) => {
    const leadId = leadProcessingId
    if (!leadId) return

    const lead = leads.find((l) => l.id === leadId)

    const saleId =
      (globalThis.crypto && "randomUUID" in globalThis.crypto && (globalThis.crypto as any).randomUUID())
        ? (globalThis.crypto as any).randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`

    try {
      // 1) Insert en sales (mínimo, usando columnas que existen en tu tabla)
      const { error: saleErr } = await supabase.from("sales").insert({
        id: saleId,
        lead_id: leadId,
        seller_name: CURRENT_USER,
        prepaga: lead?.quoted_prepaga ?? null,
        plan: lead?.quoted_plan ?? null,
        price: lead?.quoted_price ?? null,
        approved: false,
        ops_status: "PENDIENTE",
        created_at: new Date().toISOString(),
      })

      if (saleErr) console.error("sales insert error:", saleErr)

      // 2) Update lead con datos del wizard (solo columnas que existen en tu schema)
      await supabase
        .from("leads")
        .update({
          status: "vendido",
          last_update: new Date().toISOString(),
          cuit: formData.cuit || null,
          email: formData.email || null,
          province: formData.provincia || null,
          zip: formData.cp || null,
          dob: formData.nacimiento || null,
          address_street: formData.domicilio || null,
          address_city: formData.localidad || null,
          address_zip: formData.cp || null,
          employer_cuit: formData.cuitEmpleador || null,
          labor_condition: formData.condicion || null,
          affiliation_type: formData.tipoGrupo || null,
          family_members: formData.hijosData || null,
          payment_method: formData.tipoPago || null,
          cbu_card: formData.tipoPago === "cbu" ? formData.cbuNumero || null : formData.numeroTarjeta || null,
        })
        .eq("id", leadId)

      // 3) Storage: subir archivos y registrar en lead_documents
      const files: File[] = formData?.archivos ? Array.from(formData.archivos as FileList) : []
      if (files.length > 0) {
        // ⚠️ BUCKET: cambiá este nombre si tu bucket se llama distinto
        const bucket = "lead-documents"

        for (const file of files) {
          const safeName = file.name.replace(/[^\w.\-]+/g, "_")
          const path = `${leadId}/${saleId}/${Date.now()}_${safeName}`

          const { error: upErr } = await supabase.storage.from(bucket).upload(path, file, { upsert: false })
          if (upErr) {
            console.error("upload error:", upErr)
            continue
          }

          // Registro DB (tabla existente en tu schema)
          const { error: docErr } = await supabase.from("lead_documents").insert({
            id: (globalThis.crypto && "randomUUID" in globalThis.crypto && (globalThis.crypto as any).randomUUID())
              ? (globalThis.crypto as any).randomUUID()
              : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
            lead_id: leadId,
            type: "venta",
            file_path: path,
            uploaded_at: new Date().toISOString(),
            status: "subido",
          })

          if (docErr) console.error("lead_documents insert error:", docErr)
        }
      }

      // 4) Sacar del kanban con anim
      animateRemove(leadId, () => {
        setLeads((prev) => prev.filter((l) => l.id !== leadId))
      })
    } catch (e) {
      console.error("handleConfirmSale error:", e)
      // si algo falla, re-sincronizamos
      fetchLeads()
    } finally {
      setIsSaleWizardOpen(false)
      setIsWonDialogOpen(false)
      setLeadProcessingId(null)
    }
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-slate-50/50">
      <DndContext
        sensors={sensors}
        collisionDetection={customCollisionDetection}
        onDragStart={(e) => setActiveId(e.active.id as string)}
        onDragEnd={handleDragEnd}
      >
        <div className="flex-1 flex gap-6 overflow-x-auto p-8 h-full items-start">
          {ACTIVE_COLUMNS.map((col) => (
            <KanbanColumn
              key={col.id}
              col={col}
              leads={sortLeads(col.id)}
              removingIds={removingIds}
              onClickLead={(l: any) => setSelectedLead(l)}
              onCallIncrement={handleCallIncrement}
              onOmniClick={() => {}}
              onResolveAgenda={(l: Lead) => setShowConfirmCall(l)}
            />
          ))}
        </div>

        {activeId && (
          <div className="fixed bottom-10 left-0 right-0 flex justify-center gap-12 z-[100] pointer-events-none animate-in fade-in slide-in-from-bottom-10 px-4">
            <DropZone
              id="zone-perdido"
              className="pointer-events-auto flex flex-col items-center justify-center w-64 h-32 rounded-3xl bg-white/90 backdrop-blur-md border-4 border-red-200 shadow-2xl"
            >
              <ArchiveX className="h-10 w-10 text-red-600 mb-2" />
              <span className="font-black uppercase tracking-tighter text-red-600">Perdido</span>
            </DropZone>
            <DropZone
              id="zone-vendido"
              className="pointer-events-auto flex flex-col items-center justify-center w-64 h-32 rounded-3xl bg-white/90 backdrop-blur-md border-4 border-emerald-200 shadow-2xl"
            >
              <Trophy className="h-10 w-10 text-emerald-600 mb-2" />
              <span className="font-black uppercase tracking-tighter text-emerald-600">¡Venta Lograda! 🚀</span>
            </DropZone>
          </div>
        )}

        <DragOverlay>
          {activeId ? (
            <div className="cursor-grabbing rotate-3 scale-105 transition-transform duration-200 shadow-2xl opacity-90">
              <LeadCard lead={leads.find((l) => l.id === activeId)!} />
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      <LeadDetail lead={selectedLead} open={!!selectedLead} onOpenChange={(o: any) => !o && setSelectedLead(null)} />

      <LostLeadDialog
        open={isLostDialogOpen}
        onOpenChange={setIsLostDialogOpen}
        onConfirm={async (r) => {
          const id = leadProcessingId
          if (!id) return

          animateRemove(id, () => {
            setLeads((prev) => prev.filter((l) => l.id !== id))
          })

          const { error } = await supabase
            .from("leads")
            .update({ status: "perdido", loss_reason: r, last_update: new Date().toISOString() })
            .eq("id", id)

          if (error) {
            console.error("LostLead update error:", error)
            fetchLeads()
          }

          setIsLostDialogOpen(false)
          setLeadProcessingId(null)
        }}
      />

      {/* ✅ 1) Confirmás intención de venta... */}
      <WonLeadDialog
        open={isWonDialogOpen}
        onOpenChange={setIsWonDialogOpen}
        onConfirm={async () => {
          const id = leadProcessingId
          if (!id) return
          // ...y abrimos el wizard para cargar datos + docs
          setIsSaleWizardOpen(true)
        }}
      />

      {/* ✅ 2) Wizard: carga venta + sube documentación y recién ahí se marca vendido */}
      <SaleWizardDialog
        open={isSaleWizardOpen}
        onOpenChange={(val) => {
          setIsSaleWizardOpen(val)
          // si lo cerró sin terminar, no hacemos nada
        }}
        onConfirm={handleConfirmSale}
      />

      <QuotationDialog
        open={isQuoteDialogOpen}
        onOpenChange={setIsQuoteDialogOpen}
        onConfirm={(data: any) => {
          const id = leadProcessingId
          if (!id) return

          setLeads((prev) =>
            prev.map((l) =>
              l.id === id ? { ...l, status: "cotizacion", quoted_prepaga: data.prepaga, quoted_plan: data.plan, quoted_price: data.price } : l
            )
          )

          supabase
            .from("leads")
            .update({
              status: "cotizacion",
              quoted_prepaga: data.prepaga,
              quoted_plan: data.plan,
              quoted_price: data.price,
              last_update: new Date().toISOString(),
            })
            .eq("id", id)

          setIsQuoteDialogOpen(false)
          setLeadProcessingId(null)
        }}
        onCancel={() => setIsQuoteDialogOpen(false)}
      />

      <DocConfirmDialog
        open={isDocConfirmOpen}
        onOpenChange={setIsDocConfirmOpen}
        onConfirm={async () => {
          const id = leadProcessingId
          if (!id) return

          await supabase
            .from("leads")
            .update({ status: "documentacion", last_update: new Date().toISOString() })
            .eq("id", id)

          setIsDocConfirmOpen(false)
          setLeadProcessingId(null)
          setDocPrevStatus(null)
        }}
        onCancel={async () => {
          const id = leadProcessingId
          if (!id) return

          const backTo = (docPrevStatus ?? "cotizacion").toLowerCase()

          setLeads((prev) => prev.map((l) => (l.id === id ? { ...l, status: backTo } : l)))

          await supabase
            .from("leads")
            .update({ status: backTo, last_update: new Date().toISOString() })
            .eq("id", id)

          setIsDocConfirmOpen(false)
          setLeadProcessingId(null)
          setDocPrevStatus(null)
        }}
      />

      <Dialog open={!!overdueLead} onOpenChange={() => setOverdueLead(null)}>
        <DialogContent
          className="border-4 border-yellow-400 max-w-md shadow-2xl animate-in zoom-in duration-300"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogHeader className="text-center">
            <div className="mx-auto bg-yellow-100 p-4 rounded-full mb-4 w-fit border-2 border-yellow-400">
              <AlertOctagon className="h-10 w-10 text-yellow-600 animate-pulse" />
            </div>
            <DialogTitle className="text-2xl font-black text-slate-800 uppercase tracking-tight">
              ¡COTIZACIÓN VENCIDA!
            </DialogTitle>
            <DialogDescription className="text-base text-slate-600 mt-2 font-medium">
              Pasaron más de 72 horas sin novedades con <br />
              <span className="text-xl font-bold text-slate-900 bg-yellow-200 px-2 rounded">{overdueLead?.name}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-3 mt-4">
            <Button
              className="w-full h-12 bg-green-500 hover:bg-green-600 text-white font-bold text-lg gap-2"
              onClick={() => window.open(`https://wa.me/${overdueLead?.phone}?text=Hola`, "_blank")}
            >
              <MessageCircle size={24} fill="currentColor" /> Enviar WhatsApp Ya
            </Button>
            <Button variant="outline" className="w-full h-12 border-2 border-slate-200" onClick={() => setOverdueLead(null)}>
              Ignorar por ahora
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={!!alarmLead} onOpenChange={() => setAlarmLead(null)}>
        <DialogContent
          className="max-w-sm bg-[#020617] border-none text-white p-0 overflow-hidden shadow-2xl"
          onPointerDownOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <div className="bg-red-600 h-1.5 w-full animate-pulse"></div>
          <div className="p-8 text-center">
            <BellRing className="h-12 w-12 text-red-500 mx-auto mb-4 animate-bounce" />
            <h1 className="text-2xl font-black uppercase mb-1 leading-none tracking-tighter text-blue-400">Es hora de llamar</h1>
            <h2 className="text-3xl font-black text-white tracking-tight mb-6 truncate">{alarmLead?.name}</h2>
            <Button
              onClick={() => setAlarmLead(null)}
              className="w-full h-14 text-lg font-black bg-blue-600 hover:bg-blue-500 rounded-2xl shadow-lg"
            >
              IR AL DATO 📞
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
