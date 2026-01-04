"use client"

import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal, Flame, Skull, Headset, CalendarClock, Phone, MessageCircle, Activity } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

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
}

const intentColors = {
  high: "border-l-4 border-l-emerald-500",
  medium: "border-l-4 border-l-yellow-500",
  low: "border-l-4 border-l-red-500",
}

const getQuoteStyles = (prepaga?: string) => {
    switch (prepaga) {
        case "Prevención Salud": return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 text-pink-800"
        case "DoctoRed": return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 text-violet-800"
        case "Avalian": return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 text-green-800"
        case "Swiss Medical": return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 text-red-800"
        case "Galeno": return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 text-blue-800"
        case "AMPF": return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 text-sky-800"
        default: return "bg-slate-50 border-slate-100 text-slate-800"
    }
}

interface LeadCardProps {
  lead: Lead
  onCallIncrement?: (e: React.MouseEvent) => void
  onOmniClick?: (e: React.MouseEvent) => void
}

export function LeadCard({ lead, onCallIncrement, onOmniClick }: LeadCardProps) {
  
  let callColor = "text-slate-600 dark:text-[#B0B3B8] hover:bg-slate-100 border-slate-200"
  let callIcon = <Phone className="h-3 w-3 mr-1" />
  let isBurned = false

  if (lead.calls >= 4 && lead.calls < 7) {
    callColor = "text-orange-600 dark:text-orange-400 hover:bg-orange-50 border-orange-200 bg-orange-50/50"
    callIcon = <Flame className="h-3 w-3 mr-1" />
  } else if (lead.calls >= 7) {
    callColor = "text-red-600 dark:text-red-400 hover:bg-red-50 border-red-200 bg-red-50/50"
    callIcon = <Skull className="h-3 w-3 mr-1" />
    isBurned = true
  }

  const priceFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

  const sendWpp = (type: string) => {
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '')
    let text = ""
    if (type === 'no_contesta') text = "Hola..."; // Lógica de texto simplificada para brevedad
    const url = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`
    window.open(url, '_blank')
  }

  const isScheduled = lead.scheduled_for && new Date(lead.scheduled_for) > new Date()
  let scheduleDisplay = ''
  if (lead.scheduled_for) {
      const date = new Date(lead.scheduled_for)
      const day = date.toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric' })
      const time = date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', hour12: false })
      scheduleDisplay = `${day}, ${time}hs`
  }

  const compactDate = new Date(lead.createdAt).toLocaleDateString('es-AR', {
    day: '2-digit', month: '2-digit', year: '2-digit'
  });

  const quoteStyle = getQuoteStyles(lead.quoted_prepaga)

  return (
    <Card className={`
        mb-1.5 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative
        ${intentColors[lead.intent]}
        ${isBurned ? 'opacity-70 grayscale-[0.2]' : ''}
        bg-white dark:bg-[#242526] border-slate-200 dark:border-[#3E4042]
        ${isScheduled ? 'mt-4' : ''}
    `}>
      {isScheduled && (
          <div className="absolute -top-3.5 right-1.5 bg-blue-600 shadow-sm text-white text-[9px] font-black px-2 py-0.5 rounded-full flex items-center z-10 border border-white">
              <CalendarClock className="h-2.5 w-2.5 mr-1" /> {scheduleDisplay}
          </div>
      )}

      <CardHeader className="p-2.5 pb-0 flex flex-col items-start space-y-0">
        <div className="flex justify-between w-full items-center mb-0.5">
            <span className="text-[9px] font-bold text-slate-400 dark:text-[#B0B3B8] uppercase">
                Ingreso: {compactDate}
            </span>
            <MoreHorizontal className="h-3 w-3 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity" />
        </div>

        <div className="w-full">
          <h4 className="font-bold text-[14px] text-slate-800 dark:text-[#E4E6EB] truncate leading-tight">{lead.name}</h4>
          <div className="flex flex-wrap items-center mt-1 gap-1">
             <Badge variant="secondary" className="text-[8px] h-3.5 px-1 font-bold uppercase bg-slate-100 text-slate-500 border-none italic leading-none">{lead.source}</Badge>
             {lead.prepaga && (
                <Badge variant="outline" className="text-[8px] h-3.5 px-1 font-bold border-blue-100 text-blue-600 leading-none">
                    <Activity className="h-2 w-2 mr-0.5" /> {lead.prepaga}
                </Badge>
             )}
          </div>
          <div className="mt-0.5 text-[11px] text-blue-700 dark:text-[#B0B3B8] font-mono font-bold leading-none">{lead.phone}</div>
        </div>
      </CardHeader>
      
      <CardContent className={`p-2.5 space-y-2 ${!lead.quoted_price ? 'pt-1' : 'pt-2'}`}>
        {lead.quoted_price && lead.quoted_price > 0 && (
            <div className={`${quoteStyle} border rounded p-1.5 shadow-sm`}>
                <div className="flex justify-between items-center leading-none">
                    <span className="text-[8px] font-black uppercase tracking-tighter opacity-80 truncate mr-1">{lead.quoted_prepaga}</span>
                    <span className="text-[10px] font-black bg-white/40 px-1 rounded whitespace-nowrap">
                        {priceFormatter.format(lead.quoted_price)}
                    </span>
                </div>
                {lead.quoted_plan && (
                    <div className="text-[8px] font-medium truncate opacity-90 uppercase mt-0.5 italic">
                        {lead.quoted_plan}
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-3 gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7.5 border-green-600 bg-[#25D366] hover:bg-[#20bd5a] text-white p-0">
                        <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="text-xs font-bold">
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('no_contesta')}}>👋 No Contesta</DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('cotizacion')}}>💲 Cotización</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('seguimiento')}} className="text-red-600">🛑 Ultimátum</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" className="h-7.5 text-indigo-600 border-indigo-200 bg-indigo-50/50 p-0" 
                onClick={(e) => { e.stopPropagation(); if(onOmniClick) onOmniClick(e); }}>
                <Headset className="h-3.5 w-3.5" />
            </Button>
            <Button size="sm" variant="outline" className={`h-7.5 font-black p-0 ${callColor}`} onClick={(e) => { e.stopPropagation(); if(onCallIncrement) onCallIncrement(e); }}>
                {callIcon} <span className="text-[10px]">{lead.calls > 0 ? lead.calls : ''}</span>
            </Button>
        </div>

        <div className="flex justify-end items-center pt-0.5">
             <div className="flex items-center gap-1">
                <Avatar className="h-3.5 w-3.5">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.agent}`} />
                    <AvatarFallback className="text-[6px]">{lead.agent[0]}</AvatarFallback>
                </Avatar>
                <span className="text-[8px] text-slate-400 font-bold uppercase tracking-tighter">{lead.agent}</span>
             </div>
        </div>
      </CardContent>
    </Card>
  )
}