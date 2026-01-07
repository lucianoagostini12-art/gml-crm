"use client"

import React, { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase" // ✅ Conexión agregada
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal, Flame, Skull, Headset, CalendarClock, Phone, Activity, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

// --- TIPOS ---
export type Lead = {
  id: string
  name: string
  phone: string
  source: string
  status: string
  intent: 'high' | 'medium' | 'low'
  lastUpdate: string
  createdAt: string
  agent: string
  calls: number
  notes?: string
  quoted_prepaga?: string
  quoted_plan?: string
  quoted_price?: number
  scheduled_for?: string
  observations?: string
  prepaga?: string
  capitas?: number
  [key: string]: any
}

// --- ICONO WHATSAPP (SVG) ---
const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.008-.57-.008-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
)

// --- ESTILOS VISUALES ---
const intentStyles = {
  high: "border-l-[3px] border-l-emerald-500 hover:ring-1 hover:ring-emerald-500/20",
  medium: "border-l-[3px] border-l-amber-500 hover:ring-1 hover:ring-amber-500/20",
  low: "border-l-[3px] border-l-rose-500 hover:ring-1 hover:ring-rose-500/20",
}

const getQuoteStyles = (prepaga?: string) => {
    const base = "border text-slate-800 dark:text-slate-200 bg-slate-50/50 dark:bg-slate-800/50"
    const p = prepaga || ""
    if (p.includes("Prevención")) return `${base} border-pink-100 dark:border-pink-900/30 text-pink-800 dark:text-pink-300`
    if (p.includes("DoctoRed")) return `${base} border-violet-100 dark:border-violet-900/30 text-violet-800 dark:text-violet-300`
    if (p.includes("Avalian")) return `${base} border-green-100 dark:border-green-900/30 text-green-800 dark:text-green-300`
    if (p.includes("Swiss")) return `${base} border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-300`
    if (p.includes("Galeno")) return `${base} border-blue-100 dark:border-blue-900/30 text-blue-800 dark:text-blue-300`
    if (p.includes("AMPF")) return `${base} border-sky-100 dark:border-sky-900/30 text-sky-800 dark:text-sky-300`
    return `${base} border-slate-100 dark:border-slate-800`
}

interface LeadCardProps {
  lead: Lead
  onCallIncrement?: (e: React.MouseEvent) => void
  onOmniClick?: (e: React.MouseEvent) => void
}

export function LeadCard({ lead, onCallIncrement, onOmniClick }: LeadCardProps) {
  const supabase = createClient()
  
  // ✅ ESTADO LOCAL PARA LAS PLANTILLAS DE WPP
  const [wppTemplates, setWppTemplates] = useState<any[]>([])

  // ✅ CARGAR PLANTILLAS REALES DE SUPABASE
  useEffect(() => {
    const fetchTemplates = async () => {
        // Obtenemos las plantillas que configuraste en AdminConfig
        const { data } = await supabase.from('whatsapp_templates').select('*').order('id', { ascending: true })
        if(data) setWppTemplates(data)
    }
    fetchTemplates()
  }, []) // Solo al montar el componente

  // Lógica de "Dato Quemado"
  let callColor = "text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-slate-200 dark:border-slate-700 dark:text-slate-400"
  let callIcon = <Phone className="h-3.5 w-3.5 mr-1.5" />
  let isBurned = false

  if (lead.calls >= 4 && lead.calls < 7) {
    callColor = "text-orange-600 border-orange-200 bg-orange-50 hover:bg-orange-100 dark:bg-orange-900/10 dark:border-orange-800 dark:text-orange-400"
    callIcon = <Flame className="h-3.5 w-3.5 mr-1.5 fill-orange-600 dark:fill-orange-400" />
  } else if (lead.calls >= 7) {
    callColor = "text-red-600 border-red-200 bg-red-50 hover:bg-red-100 dark:bg-red-900/10 dark:border-red-800 dark:text-red-400"
    callIcon = <Skull className="h-3.5 w-3.5 mr-1.5 fill-red-600 dark:fill-red-400" />
    isBurned = true
  }

  const priceFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

  // ✅ FUNCIÓN DE ENVÍO DINÁMICA
  const sendWpp = (templateId: string) => {
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '')
    
    // Buscar la plantilla seleccionada en la memoria
    const template = wppTemplates.find(t => t.id === templateId)
    const text = template?.message || "" // Si está vacía o no existe, manda cadena vacía

    // Construir URL (si hay texto agrega ?text=, sino abre el chat limpio)
    let url = `https://wa.me/${cleanPhone}`
    if(text) url += `?text=${encodeURIComponent(text)}`
    
    window.open(url, '_blank')
  }

  const isScheduled = lead.scheduled_for && new Date(lead.scheduled_for) > new Date()
  let scheduleDisplay = ''
  if (lead.scheduled_for) {
      const date = new Date(lead.scheduled_for)
      const day = date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
      const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
      scheduleDisplay = `${day}, ${time}`
  }

  const compactDate = new Date(lead.createdAt).toLocaleDateString('es-AR', { day: '2-digit', month: 'short' });
  const quoteStyle = getQuoteStyles(lead.quoted_prepaga)

  return (
    <Card className={`
        mb-1.5 transition-all duration-200 ease-in-out cursor-pointer group relative
        bg-white dark:bg-slate-900 shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-0.5
        border border-slate-200/80 dark:border-slate-800
        ${intentStyles[lead.intent]}
        ${isBurned ? 'opacity-60 grayscale-[0.5]' : ''}
        ${isScheduled ? 'mt-5 ring-1 ring-offset-1 ring-blue-500/30' : ''}
        rounded-lg overflow-visible
    `}>
      
      {isScheduled && (
          <div className="absolute -top-2.5 left-2 bg-blue-600 shadow-sm text-white text-[8px] font-bold px-2 py-0.5 rounded-sm flex items-center z-20 tracking-wider border border-white dark:border-slate-900">
              <CalendarClock className="h-2.5 w-2.5 mr-1" /> {scheduleDisplay}
          </div>
      )}

      <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10">
         <Button variant="ghost" className="h-5 w-5 p-0 text-slate-300 hover:text-slate-500 rounded-full hover:bg-slate-100">
            <MoreHorizontal className="h-3.5 w-3.5" />
         </Button>
      </div>

      <CardHeader className="p-2 pb-0 flex flex-col items-start space-y-0 relative">
        <div className="flex items-center gap-1.5 mb-1 w-full pr-4">
            <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold uppercase bg-slate-50 dark:bg-slate-800 text-slate-500 border border-slate-200 dark:border-slate-700 rounded-[4px] tracking-wider shadow-sm">
                {lead.source}
            </Badge>
            <span className="text-[10px] font-semibold text-slate-400 flex items-center bg-slate-50 px-1.5 rounded-sm">
                <Clock className="h-2.5 w-2.5 mr-1" />
                {compactDate}
            </span>
        </div>

        <div className="w-full">
          <h4 className="font-black text-[15px] text-slate-800 dark:text-slate-100 truncate tracking-tight leading-snug mb-1">
            {lead.name}
          </h4>
          
          <div className="flex justify-between items-center">
             <div className="text-[12px] text-slate-600 dark:text-slate-300 font-bold font-mono tracking-tight bg-slate-100/50 px-1.5 py-0.5 rounded border border-slate-200/50 inline-block shadow-sm">
                {lead.phone}
             </div>
             
             {lead.prepaga && (
                <div className="flex items-center text-[8px] font-bold text-blue-600 bg-blue-50/50 dark:bg-blue-900/20 px-1.5 py-px rounded-sm border border-blue-100 dark:border-blue-800">
                    <Activity className="h-2 w-2 mr-0.5" /> {lead.prepaga}
                </div>
             )}
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-2 pt-2 space-y-2">
        
        {lead.quoted_price && lead.quoted_price > 0 && (
            <div className={`${quoteStyle} border rounded-[4px] px-2 py-1 relative overflow-hidden transition-all`}>
                <div className="flex justify-between items-center relative z-10">
                    <div className="flex flex-col leading-none">
                        <span className="text-[7px] font-black uppercase tracking-wider opacity-60">Propuesta</span>
                        <span className="text-[10px] font-bold flex items-center gap-1 truncate">
                            {lead.quoted_prepaga} <span className="opacity-40">|</span> {lead.quoted_plan}
                        </span>
                    </div>
                    <span className="text-[12px] font-black bg-white/80 dark:bg-black/20 px-1.5 rounded-sm shadow-sm ml-2">
                        {priceFormatter.format(lead.quoted_price)}
                    </span>
                </div>
            </div>
        )}

        <div className="h-px w-full bg-slate-100 dark:bg-slate-800" />

        <div className="flex items-center justify-between gap-1.5">
            
            {/* ✅ MENÚ WHATSAPP DINÁMICO */}
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button 
                        size="sm" 
                        className="flex-1 h-7 bg-[#25D366] hover:bg-[#20ba5a] text-white border-0 shadow-sm transition-all rounded-[4px] px-2"
                    >
                        <WhatsAppIcon className="h-3.5 w-3.5 mr-1 fill-current" />
                        <span className="text-[10px] font-bold">WhatsApp</span>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-48 font-medium text-xs">
                    {/* Si no cargaron plantillas aun */}
                    {wppTemplates.length === 0 && (
                        <DropdownMenuItem disabled>Cargando opciones...</DropdownMenuItem>
                    )}
                    
                    {/* Renderizado dinámico de los botones configurados en Admin */}
                    {wppTemplates.map((tpl) => (
                        <DropdownMenuItem 
                            key={tpl.id} 
                            onClick={(e) => { e.stopPropagation(); sendWpp(tpl.id) }}
                            // Si es seguimiento/ultimatum, le ponemos color rojo de alerta
                            className={tpl.id.includes('seguimiento') || tpl.id.includes('baja') ? "text-red-600 font-bold" : ""}
                        >
                            {tpl.label}
                        </DropdownMenuItem>
                    ))}
                </DropdownMenuContent>
            </DropdownMenu>

            <Button size="icon" variant="outline" className="h-7 w-7 text-indigo-600 border-indigo-100 bg-indigo-50/50 hover:bg-indigo-100 rounded-[4px] shadow-sm" 
                onClick={(e) => { e.stopPropagation(); if(onOmniClick) onOmniClick(e); }} title="Abrir OmniLeads">
                <Headset className="h-3.5 w-3.5" />
            </Button>

            <Button size="sm" variant="outline" className={`h-7 px-2 font-bold rounded-[4px] shadow-sm transition-all ${callColor}`} 
                onClick={(e) => { e.stopPropagation(); if(onCallIncrement) onCallIncrement(e); }}>
                {callIcon} 
                <span className="text-[10px]">{lead.calls > 0 ? `${lead.calls}` : 'Llamar'}</span>
            </Button>
        </div>

        <div className="flex justify-end pt-0.5">
             <div className="flex items-center gap-1 opacity-40 hover:opacity-100 transition-opacity">
                <span className="text-[7px] text-slate-400 font-black uppercase tracking-wider">{lead.agent}</span>
                <Avatar className="h-3 w-3 border border-slate-100">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.agent}`} />
                    <AvatarFallback className="text-[4px] bg-slate-50">{lead.agent[0]}</AvatarFallback>
                </Avatar>
             </div>
        </div>
      </CardContent>
    </Card>
  )
}