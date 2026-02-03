"use client"

import { useState, useEffect, type MouseEvent } from "react"
import { createClient } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
// AGREGADO: Importamos MessageCircle y Paperclip para reemplazar los emojis
import { UserPlus, ArrowRightLeft, Clock, ShieldCheck, Copy, MessageCircle, Paperclip } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// AGREGADO: Importamos getStatusColor para mantener consistencia con el Modal
import { getPrepagaStyles, getSubStateStyle, getStatusColor } from "./data"

// --- NUEVO HELPER PARA COLORES DE PREPAGA (TU PEDIDO) ---
const getPrepagaBadgeColor = (prepagaRaw: string) => {
  const p = prepagaRaw || ""
  // Usamos includes para ser más robustos con los nombres
  if (p.includes("Prevención")) return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
  if (p.includes("DoctoRed")) return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
  if (p.includes("Avalian")) return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
  if (p.includes("Swiss")) return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
  if (p.includes("Galeno")) return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
  if (p.includes("AMPF")) return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"

  // Default
  return "bg-slate-50 border-slate-100 text-slate-800"
}

export function OpsList({ operations, onSelectOp, updateOp, globalConfig, unreadByLead }: any) {
  const supabase = createClient()

  // ✅ Copiar CUIT/DNI sin abrir el modal (no rompe el onClick de la tarjeta)
  const handleCopyCuit = async (e: MouseEvent, value: any) => {
    e.stopPropagation()
    try {
      const text = String(value ?? "").trim()
      if (!text) return
      await navigator.clipboard.writeText(text)
    } catch {
      // Silencioso: no queremos romper nada operativo si el browser bloquea el clipboard
    }
  }

  // ✅ Estado para guardar las fotos reales de los vendedores
  const [avatarsMap, setAvatarsMap] = useState<Record<string, string>>({})

  // ✅ Efecto para buscar las fotos de los vendedores que aparecen en la lista
  useEffect(() => {
    const fetchAvatars = async () => {
      // Obtenemos lista única de vendedores
      const sellerNames = Array.from(new Set(operations.map((op: any) => op.seller))).filter(Boolean) as string[]

      if (sellerNames.length === 0) return

      // Buscamos sus fotos en la tabla profiles
      const { data } = await supabase.from("profiles").select("full_name, avatar_url").in("full_name", sellerNames)

      // Creamos el mapa { "Nombre": "URL" }
      const map: Record<string, string> = {}
      data?.forEach((p: any) => {
        if (p.avatar_url) map[p.full_name] = p.avatar_url
      })
      setAvatarsMap(map)
    }

    fetchAvatars()
  }, [operations]) // Se recalcula si cambian las operaciones

  return (
    <div className="space-y-3">
      {operations.length === 0 ? (
        <div className="text-center py-10 text-slate-400">No hay operaciones en esta vista.</div>
      ) : (
        operations.map((op: any) => {
          const styles = getPrepagaStyles(op.prepaga || "Generica")
          const unreadChat = unreadByLead?.[op.id]?.chat || 0
          const unreadDocs = unreadByLead?.[op.id]?.docs || 0
          // Extraemos solo el borde izquierdo para la tarjeta
          const borderColorClass =
            styles.split(" ").find((c: string) => c.startsWith("border-l-")) || "border-l-slate-400"
          const subStateOptions = globalConfig?.subStates?.[op.status] || []

          // Obtenemos los colores del estado principal (Igual que en OpsModal)
          const statusStyle = getStatusColor(op.status)

          // ✅ LOGICA ROBUSTA PARA DETECTAR PASS
          const isPass = op.type === "pass" || op.subState === "auditoria_pass" || op.source === "pass"

          return (
            <div
              key={op.id}
              onClick={() => onSelectOp(op)}
              className={`bg-white rounded-xl border border-slate-200 border-l-[6px] ${borderColorClass} p-4 hover:shadow-lg transition-all flex items-center justify-between group cursor-pointer relative overflow-hidden`}
            >

              {/* ❌ ELIMINADO: El bloque absoluto antiguo que tapaba los botones */}

              {/* 1. DATOS PRINCIPALES */}
              <div className="flex items-center gap-4 w-[40%]">
                {/* ✅ ICONO DINÁMICO: PASS vs ALTA (Estilo unificado con Modal) */}
                <div
                  className={`h-10 w-10 rounded-lg flex items-center justify-center font-black shadow-sm shrink-0 ${isPass ? "bg-purple-100 text-purple-600" : "bg-green-100 text-green-600"
                    }`}
                >
                  {isPass ? <ArrowRightLeft size={18} /> : <UserPlus size={18} />}
                </div>

                <div className="overflow-hidden min-w-0">
                  <h3 className="font-black text-slate-800 text-base leading-tight truncate">{op.clientName}</h3>

                  <div className="flex items-center gap-2 mt-1 text-xs text-slate-500">
                    {/* CUIT + copiar DNI rápido (sin abrir OpsModal) */}
                    <div className="flex items-center gap-1">
                      <span className="font-mono bg-slate-50 px-1.5 rounded border border-slate-100">{op.cuit || op.dni}</span>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          // Extrae DNI del CUIT y lo copia
                          let textToCopy = op.dni || ""
                          if (op.cuit) {
                            const digits = String(op.cuit).replace(/\D/g, "")
                            if (digits.length === 11) textToCopy = digits.substring(2, 10)
                            else if (digits.length === 10) textToCopy = digits.substring(2)
                            else textToCopy = digits || op.dni || ""
                          }
                          navigator.clipboard.writeText(textToCopy)
                        }}
                        className="p-1 rounded-md border border-transparent hover:border-slate-200 hover:bg-slate-50 text-slate-400 hover:text-slate-700 transition-all"
                        title="Copiar DNI (extraído del CUIT)"
                        aria-label="Copiar DNI"
                      >
                        <Copy size={14} />
                      </button>
                    </div>

                    <div className="w-px h-3 bg-slate-200"></div>

                    <div className="flex items-center gap-1.5 overflow-hidden">
                      <Avatar className="h-4 w-4 border border-slate-200">
                        {/* ✅ AQUI ESTA EL CAMBIO: Usamos avatarsMap */}
                        <AvatarImage
                          src={
                            avatarsMap[op.seller] ||
                            `https://api.dicebear.com/7.x/avataaars/svg?seed=${op.seller || "X"}`
                          }
                        />
                        <AvatarFallback className="text-[6px]">{op.seller?.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate font-medium">{op.seller || "Sin Asignar"}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. PREPAGA Y PLAN */}
              <div className="w-[20%] flex flex-col justify-center border-l border-slate-100 pl-4">
                {/* APLICAMOS EL COLOR DE PREPAGA AQUÍ */}
                <div
                  className={`text-[10px] px-2 py-0.5 font-black uppercase mb-1 border rounded-md w-fit ${getPrepagaBadgeColor(
                    op.prepaga
                  )}`}
                >
                  {op.prepaga || "Sin Dato"}
                </div>
                <p className="text-xs text-slate-500 font-bold truncate">
                  Plan: <span className="text-slate-900">{op.plan || "-"}</span>
                </p>
              </div>

              {/* 3. ESTADOS Y ACCIONES (Premium Layout) */}
              <div className="w-[40%] flex flex-col items-end gap-2 pl-4 border-l border-slate-100">
                {/* Fila Superior: Badge Estado + Operador + NOTIFICACIONES */}
                <div className="flex items-center justify-end gap-2 w-full h-7">

                  {/* ✨ NUEVO: Badges de Notificación integrados y sutiles (No tapan nada) */}
                  {(unreadChat > 0 || unreadDocs > 0) && (
                    <div className="flex items-center gap-1.5 mr-auto animate-in fade-in zoom-in duration-300">
                      {unreadChat > 0 && (
                        <div
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-rose-50 text-rose-600 border border-rose-100 rounded-md text-[10px] font-bold shadow-sm"
                          title={`${unreadChat} mensajes nuevos`}
                        >
                          <MessageCircle size={11} className="stroke-[2.5]" />
                          <span>{unreadChat}</span>
                        </div>
                      )}
                      {unreadDocs > 0 && (
                        <div
                          className="flex items-center gap-1 px-1.5 py-0.5 bg-orange-50 text-orange-600 border border-orange-100 rounded-md text-[10px] font-bold shadow-sm"
                          title={`${unreadDocs} documentos nuevos`}
                        >
                          <Paperclip size={11} className="stroke-[2.5]" />
                          <span>{unreadDocs}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {op.operator && (
                    <div
                      className="flex items-center gap-1 text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200"
                      title={`Tomado por ${op.operator}`}
                    >
                      <ShieldCheck size={10} className="text-blue-600" />
                      <span className="truncate max-w-[100px]">{op.operator.split(" ")[0]}</span>
                    </div>
                  )}

                  {/* Estado Principal */}
                  <div
                    className={`px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest border shadow-sm text-center min-w-[90px] ${statusStyle}`}
                  >
                    {op.status}
                  </div>
                </div>

                {/* Fila Inferior: Subestado + Antigüedad */}
                <div className="flex items-center justify-end gap-2 w-full">
                  <div
                    className="flex items-center gap-1 text-[9px] font-bold text-slate-400"
                    title="Días en esta etapa"
                  >
                    <Clock size={10} />
                    <span>{op.daysInStatus || 0}d</span>
                  </div>

                  <div onClick={(e) => e.stopPropagation()} className="min-w-[140px]">
                    <Select value={op.subState || ""} onValueChange={(val) => updateOp({ ...op, subState: val })}>
                      <SelectTrigger
                        className={`h-7 text-[10px] font-bold focus:ring-0 transition-all shadow-sm ${getSubStateStyle(
                          op.subState
                        )}`}
                      >
                        <SelectValue placeholder="Estado..." />
                      </SelectTrigger>

                      <SelectContent align="end">
                        {subStateOptions.length > 0 ? (
                          subStateOptions.map((sub: string) => (
                            <SelectItem key={sub} value={sub} className="text-xs">
                              {sub}
                            </SelectItem>
                          ))
                        ) : (
                          <div className="p-2 text-[10px] text-slate-400 text-center">Sin opciones</div>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            </div>
          )
        })
      )}
    </div>
  )
}