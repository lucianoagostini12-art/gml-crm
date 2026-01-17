"use client"
import { useState, useMemo, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { UserPlus, ArrowRightLeft } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

// LISTA FIJA DE 5 COLUMNAS (El flujo operativo)
const KANBAN_COLUMNS = ['ingresado', 'precarga', 'medicas', 'legajo', 'demoras'] as const

type BoardView = "main" | "postventa"

export function OpsKanban({ operations, onSelectOp, profiles, onStatusChange }: any) {
    // ✅ Vista del tablero
    const [boardView, setBoardView] = useState<BoardView>("main")
    const supabase = createClient()
    const [postSaleOps, setPostSaleOps] = useState<any[]>([])
    const [postSaleLoading, setPostSaleLoading] = useState(false)

    // Estado para el modal de confirmación de movimiento
    const [confirmMove, setConfirmMove] = useState<{ opId: string, newStatus: string, oldStatus: string } | null>(null)

    // Helper para obtener avatar real
    const getSellerAvatar = (sellerName: string) => {
        const profile = profiles?.find((p: any) => p.full_name === sellerName || p.email === sellerName)
        return profile?.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sellerName || 'X'}`
    }

    // ✅ Helpers postventa
    const isPostSaleOp = (op: any) => {
        // Postventa real se carga desde leads (ver fetch debajo)
        return true
    }

    const getActionValue = (op: any) => {
        return (
            op?.actionStatus ||
            op?.action_status ||
            op?.accion ||
            op?.action ||
            "-"
        )
    }

    const columns = useMemo(() => {
        return boardView === "main" ? [...KANBAN_COLUMNS] : ["estado", "accion", "cumple"]
    }, [boardView])

    const operationsForView = useMemo(() => {
        if (boardView === "main") return operations || []
        return postSaleOps || []
    }, [operations, boardView, postSaleOps])


    // ✅ Cargar Postventa desde leads (como OpsPostSale) cuando cambiás la vista
    useEffect(() => {
        let alive = true
        const load = async () => {
            if (boardView !== "postventa") return
            setPostSaleLoading(true)
            const { data, error } = await supabase
                .from('leads')
                .select('*')
                .eq('status', 'cumplidas')
                .eq('billing_approved', true)
                .order('created_at', { ascending: false })

            if (!alive) return

            if (error) {
                console.warn("[OpsKanban] postventa fetch error", error)
                setPostSaleOps([])
                setPostSaleLoading(false)
                return
            }

            const mapped = (data || [])
                .map((c: any) => ({
                    ...c,
                    id: c.id,
                    clientName: c.name || "Sin Nombre",
                    dni: c.dni || "-",
                    seller: c.agent_name || c.agent || c.seller || "Desconocido",
                    prepaga: c.prepaga || c.quoted_prepaga || "Sin Asignar",
                    type: (c.type || "").toLowerCase() === "pass" ? "pass" : "alta",
                    subState: c.sub_state || c.subState || "-",
                    actionStatus: c.action_status || c.actionStatus || "-"
                }))

            setPostSaleOps(mapped)
            setPostSaleLoading(false)
        }
        load()
        return () => { alive = false }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boardView])

    // Manejador cuando soltás la tarjeta
    const onDragEnd = (result: any) => {
        const { destination, source, draggableId } = result

        // Si no hay destino o lo soltó en el mismo lugar, no hacemos nada
        if (!destination) return
        if (destination.droppableId === source.droppableId && destination.index === source.index) return

        // En vista postventa no permitimos mover estados (solo lectura/acción)
        if (boardView === "postventa") return

        // Abrimos modal de confirmación antes de mover
        setConfirmMove({
            opId: draggableId,
            newStatus: destination.droppableId,
            oldStatus: source.droppableId
        })
    }

    const executeMove = () => {
        if (confirmMove) {
            onStatusChange(confirmMove.opId, confirmMove.newStatus)
            setConfirmMove(null)
        }
    }

    return (
        <>
            {/* ✅ Selector de vista (no cambia estética del kanban) */}
            <div className="px-2 pb-2 flex items-center gap-2">
                <Select value={boardView} onValueChange={(v: BoardView) => setBoardView(v)}>
                    <SelectTrigger className="h-7 w-[190px] text-xs bg-white border-slate-200">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="main">Tablero principal</SelectItem>
                        <SelectItem value="postventa">Post-venta</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            <DragDropContext onDragEnd={onDragEnd}>
                <div className="h-full w-full overflow-x-auto overflow-y-hidden custom-scrollbar pb-2">
                    <div className="flex gap-3 min-w-max px-2 h-full items-start">

                        {columns.map((status: any) => {
                            // Filtramos las operaciones de esta columna
                            const columnOps =
                                boardView === "main"
                                    ? (operationsForView || []).filter((o: any) => o.status === status)
                                    : (() => {
                                        const all = operationsForView || []
                                        const today = new Date()
                                        const mm = String(today.getMonth() + 1).padStart(2, '0')
                                        const dd = String(today.getDate()).padStart(2, '0')

                                        const isBirthdayToday = (op: any) => {
                                            const bd = op?.birth_date || op?.birthDate || op?.fecha_nacimiento || op?.fechaNacimiento
                                            if (!bd) return false
                                            const s = String(bd)
                                            // soporta 'YYYY-MM-DD' o ISO
                                            const m = s.slice(5, 7)
                                            const d = s.slice(8, 10)
                                            return m === mm && d === dd
                                        }

                                        const estadoVal = (op: any) => String(op?.financial_status || op?.financialStatus || op?.estado || '').trim().toUpperCase()
                                        const accionVal = (op: any) => String(getActionValue(op) || '').trim().toUpperCase()

                                        // Prioridad para que NO se dupliquen tarjetas:
                                        // 1) Cumpleanos hoy -> columna Cumple
                                        // 2) Accion != OK -> columna Accion
                                        // 3) Estado != SIN MORA -> columna Estado
                                        const inCumple = (op: any) => isBirthdayToday(op)
                                        const inAccion = (op: any) => !inCumple(op) && accionVal(op) !== 'OK' && accionVal(op) !== '' && accionVal(op) !== '-'
                                        const inEstado = (op: any) => estadoVal(op) !== 'SIN MORA'

                                        if (status === 'cumple') return all.filter(inCumple)
                                        if (status === 'accion') return all.filter(inAccion)
                                        return all.filter(inEstado)
                                    })()

                            const headerLabel = boardView === "main" ? status : (status === 'estado' ? 'estado' : (status === 'accion' ? 'accion' : 'cumpleaños'))

                            return (
                                <div key={status} className="w-[260px] flex flex-col bg-slate-100/50 rounded-lg border border-slate-200/60 h-full shrink-0 shadow-sm">

                                    {/* Header Columna Compacto */}
                                    <div className="p-2 border-b border-slate-200 bg-white/50 rounded-t-lg flex justify-between items-center sticky top-0 backdrop-blur-sm z-10 h-10">
                                        <h3 className="font-black text-[11px] uppercase tracking-widest text-slate-600 truncate mr-2 flex items-center gap-1.5">
                                            <span className={`h-2 w-2 rounded-full ${boardView === 'postventa' ? (status === 'cumple' ? 'bg-pink-400' : (status === 'accion' ? 'bg-amber-400' : 'bg-emerald-400')) : (status === 'demoras' ? 'bg-red-400' : 'bg-blue-400')}`}></span>
                                            {headerLabel}
                                        </h3>
                                        <Badge variant="secondary" className="text-[9px] h-4 px-1.5 bg-slate-200 text-slate-700 font-bold border border-slate-300">
                                            {columnOps.length}
                                        </Badge>
                                    </div>

                                    {/* Contenido Droppable */}
                                    <Droppable droppableId={boardView === "main" ? status : status}>
                                        {(provided, snapshot) => (
                                            <div 
                                                {...provided.droppableProps}
                                                ref={provided.innerRef}
                                                className={`flex-1 w-full min-h-0 flex flex-col ${snapshot.isDraggingOver ? 'bg-blue-50/30 transition-colors' : ''}`}
                                            >
                                                <ScrollArea className="flex-1 w-full h-full">
                                                    <div className="p-1.5 flex flex-col gap-1.5 pb-10"> {/* Espaciado reducido */}
                                                        {columnOps.map((op: any, index: number) => (
                                                            <Draggable key={op.id} draggableId={op.id} index={index}>
                                                                {(provided, snapshot) => (
                                                                    <div
                                                                        ref={provided.innerRef}
                                                                        {...provided.draggableProps}
                                                                        {...provided.dragHandleProps}
                                                                        onClick={() => onSelectOp(op)}
                                                                        style={{ ...provided.draggableProps.style }}
                                                                        className={`bg-white p-2 rounded-md border shadow-sm cursor-grab active:cursor-grabbing group relative transition-all overflow-hidden
                                                                            ${snapshot.isDragging ? 'shadow-xl scale-105 border-blue-400 z-50' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}
                                                                        `}
                                                                    >
                                                                        {/* Barra lateral de color más delgada */}
                                                                        <div className={`absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r-full ${op.type === 'alta' ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>

                                                                        <div className="pl-2 flex flex-col gap-1"> {/* Padding izquierdo y gap reducido */}

                                                                            {/* 1. HEADER: Nombre + Icono */}
                                                                            <div className="flex justify-between items-start gap-1.5 min-w-0">
                                                                                {/* ✅ Fix overflow/solapado: min-w-0 para que truncate funcione siempre */}
                                                                                <span className="font-bold text-xs text-slate-800 leading-tight uppercase break-words whitespace-normal" title={op.clientName}>{op.clientName}</span>
                                                                                <div className={`h-4 w-4 shrink-0 rounded flex items-center justify-center text-white text-[8px] shadow-sm ${op.type === 'alta' ? 'bg-emerald-500' : 'bg-purple-600'}`} title={op.type === 'alta' ? 'Alta Nueva' : 'Pass / Traspaso'}>
                                                                                    {op.type === 'alta' ? <UserPlus size={9}/> : <ArrowRightLeft size={9}/>}
                                                                                </div>
                                                                            </div>

                                                                            {/* 2. DATOS: Vendedor + DNI */}
                                                                            <div className="flex justify-between items-center mt-0.5">
                                                                                <div className="flex items-center gap-1 min-w-0">
                                                                                    <Avatar className="h-4 w-4 border border-slate-100 shrink-0">
                                                                                        <AvatarImage src={getSellerAvatar(op.seller)} className="object-cover"/>
                                                                                        <AvatarFallback className="text-[7px] bg-slate-800 text-white">{op.seller?.[0]}</AvatarFallback>
                                                                                    </Avatar>
                                                                                    <span className="text-[9px] font-bold text-slate-500 truncate max-w-[80px] min-w-0">{op.seller || 'S/A'}</span>
                                                                                </div>
                                                                                <Badge variant="outline" className="text-[9px] font-mono text-slate-400 bg-slate-50 h-4 px-1 border-slate-100">
                                                                                    {op.dni}
                                                                                </Badge>
                                                                            </div>

                                                                            {/* 3. FOOTER: Prepaga + Subestado/Acción */}
                                                                            <div className="pt-1.5 border-t border-slate-50 flex justify-between items-center text-[9px] mt-0.5">
                                                                                <span className="font-black text-blue-600 truncate max-w-[90px]">{op.prepaga}</span>

                                                                                {boardView === "main" ? (
                                                                                    <span className="font-medium text-slate-400 truncate max-w-[90px]">{op.subState || '-'}</span>
                                                                                ) : (
                                                                                    status === 'cumple' ? (
                                                                                        <span className="font-medium text-slate-600 truncate max-w-[120px]">🎂 Hoy</span>
                                                                                    ) : status === 'accion' ? (
                                                                                        <span className="font-medium text-slate-600 truncate max-w-[120px]">{getActionValue(op)}</span>
                                                                                    ) : (
                                                                                        <span className="font-medium text-slate-600 truncate max-w-[120px]">{String(op?.financial_status || op?.financialStatus || op?.estado || '-')}</span>
                                                                                    )
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </Draggable>
                                                        ))}
                                                        {provided.placeholder}
                                                        {columnOps.length === 0 && !snapshot.isDraggingOver && (
                                                            <div className="text-center py-6 opacity-30 text-[10px] italic border-2 border-dashed border-slate-100 rounded-md m-1">Sin casos</div>
                                                        )}
                                                    </div>
                                                </ScrollArea>
                                            </div>
                                        )}
                                    </Droppable>
                                </div>
                            )
                        })}
                    </div>
                </div>
            </DragDropContext>

            {/* MODAL DE CONFIRMACIÓN AL ARRASTRAR (solo tablero principal) */}
            <Dialog open={!!confirmMove} onOpenChange={(open) => !open && setConfirmMove(null)}>
                <DialogContent className="sm:max-w-sm text-center p-6">
                    <DialogHeader>
                        <div className="mx-auto bg-blue-100 p-3 rounded-full mb-4 w-fit">
                            <ArrowRightLeft className="h-6 w-6 text-blue-600"/>
                        </div>
                        <DialogTitle className="text-xl font-black text-slate-800">¿Mover Operación?</DialogTitle>
                        <DialogDescription className="mt-2 text-slate-600">
                            Estás moviendo el caso de <br/>
                            <span className="font-bold text-slate-800 uppercase bg-slate-100 px-2 py-0.5 rounded text-xs">{confirmMove?.oldStatus}</span> ➝ <span className="font-bold text-blue-600 uppercase bg-blue-50 px-2 py-0.5 rounded text-xs">{confirmMove?.newStatus}</span>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="sm:justify-center gap-2 mt-4">
                        <Button variant="ghost" onClick={() => setConfirmMove(null)}>Cancelar</Button>
                        <Button onClick={executeMove} className="bg-blue-600 hover:bg-blue-700 font-bold px-8">Confirmar Mover</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )
}
