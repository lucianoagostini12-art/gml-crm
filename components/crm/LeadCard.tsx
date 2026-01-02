import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { MoreHorizontal, Flame, Skull, Headset, CalendarClock, Phone, MessageCircle } from "lucide-react"
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
        case "Prevención Salud": return "bg-pink-50 dark:bg-[#3A3B3C] border-pink-100 dark:border-pink-900/50 text-pink-800 dark:text-pink-300"
        case "DoctoRed": return "bg-violet-50 dark:bg-[#3A3B3C] border-violet-100 dark:border-violet-900/50 text-violet-800 dark:text-violet-300"
        case "Avalian": return "bg-green-50 dark:bg-[#3A3B3C] border-green-100 dark:border-green-900/50 text-green-800 dark:text-green-300"
        case "Swiss Medical": return "bg-red-50 dark:bg-[#3A3B3C] border-red-100 dark:border-red-900/50 text-red-800 dark:text-red-300"
        case "Galeno": return "bg-blue-50 dark:bg-[#3A3B3C] border-blue-100 dark:border-blue-900/50 text-blue-800 dark:text-blue-300"
        case "AMPF": return "bg-sky-50 dark:bg-[#3A3B3C] border-sky-100 dark:border-sky-900/50 text-sky-800 dark:text-sky-300"
        default: return "bg-slate-50 border-slate-100 dark:bg-[#3A3B3C] dark:border-[#3E4042] text-slate-800 dark:text-[#E4E6EB]"
    }
}

interface LeadCardProps {
  lead: Lead
  onCallIncrement?: (e: React.MouseEvent) => void
  onOmniClick?: (e: React.MouseEvent) => void
}

export function LeadCard({ lead, onCallIncrement, onOmniClick }: LeadCardProps) {
  
  let callColor = "text-slate-600 dark:text-[#B0B3B8] hover:bg-slate-100 dark:hover:bg-[#4E4F50] border-slate-200 dark:border-[#3E4042]"
  let callIcon = <Phone className="h-3 w-3 mr-1" />
  let isBurned = false

  if (lead.calls >= 4 && lead.calls < 7) {
    callColor = "text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-[#3A3B3C] border-orange-200 dark:border-orange-900/50 bg-orange-50/50 dark:bg-orange-900/10"
    callIcon = <Flame className="h-3 w-3 mr-1" />
  } else if (lead.calls >= 7) {
    callColor = "text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-[#3A3B3C] border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-900/10"
    callIcon = <Skull className="h-3 w-3 mr-1" />
    isBurned = true
  }

  const priceFormatter = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 })

  const sendWpp = (type: 'no_contesta' | 'no_contesta_24' | 'cotizacion' | 'seguimiento' | 'vacio') => {
    const cleanPhone = lead.phone.replace(/[^0-9]/g, '')
    let text = ""

    if (type === 'no_contesta') {
        text = `Hola, ¿cómo estás? 👋🏼\n\nMi nombre es *${lead.agent}* y me comunico desde *GML Salud*.\nTe contacto porque recibimos tu consulta sobre planes de ${lead.quoted_prepaga || 'cobertura médica'} y estoy para asesorarte de manera personalizada.\n\n¿Preferís que te pase la info por acá o coordinamos una llamada rápida?`
    } else if (type === 'no_contesta_24') {
        text = `Hola, ${lead.name}.\n\nMe gustaría saber si seguís interesado en recibir información sobre los planes de salud.\n\nTe pido que me avises así podemos continuar con la asesoría o desestimar tu consulta.\n\nMuchas gracias! 😊`
    } else if (type === 'cotizacion') {
        text = `¡Te dejo la cotización ${lead.name}! 🙌🏼\n\nRecordá que en este momento estamos con actualizaciones en promociones, las condiciones que te paso tienen validez por 72hs.\n\nSi tenés alguna duda, estoy a disposición para ayudarte.`
    } else if (type === 'seguimiento') {
        text = `Hola ${lead.name}. 👋🏼\nTe escribo para no ser insistente. Como no tuvimos respuesta, asumo que el tema de la cobertura no es prioridad hoy o ya lo resolviste.\n\n¿Te parece si cierro tu ficha por ahora para liberar el cupo promocional o querés que revisemos algo?\n\n¡Saludos!`
    }
    // Si es 'vacio', text queda "" y abre el chat limpio.

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

  const quoteStyle = getQuoteStyles(lead.quoted_prepaga)

  return (
    <Card className={`
        mb-3 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group relative
        ${intentColors[lead.intent]}
        ${isBurned ? 'opacity-70 grayscale-[0.3]' : ''}
        bg-white dark:bg-[#242526] border-slate-200 dark:border-[#3E4042]
        ${isScheduled ? 'mt-5' : ''}
    `}>
      {isScheduled && (
          <div className="absolute -top-4 right-2 bg-blue-600 shadow-md text-white text-xs font-bold px-3 py-1 rounded-full flex items-center z-10 animate-in fade-in slide-in-from-bottom-2">
              <CalendarClock className="h-3.5 w-3.5 mr-1.5" /> {scheduleDisplay}
          </div>
      )}

      <CardHeader className="p-3 pb-0 flex flex-col items-start space-y-0">
        <div className="flex justify-between w-full items-center mb-1.5">
            <span className="text-[11px] font-bold text-slate-400 dark:text-[#B0B3B8] uppercase tracking-wide">
                Ingreso: {lead.createdAt}
            </span>
            <Button variant="ghost" size="icon" className="h-4 w-4 -mr-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <MoreHorizontal className="h-3 w-3 text-slate-400 dark:text-[#B0B3B8]" />
            </Button>
        </div>

        <div className="w-full">
          <h4 className="font-bold text-[15px] text-slate-800 dark:text-[#E4E6EB] truncate">{lead.name}</h4>
          <div className="flex items-center mt-1.5 gap-2">
             <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-medium bg-slate-100 dark:bg-[#3A3B3C] text-slate-600 dark:text-[#E4E6EB] hover:bg-slate-200 dark:hover:bg-[#4E4F50]">{lead.source}</Badge>
             <span className="text-xs text-slate-600 dark:text-[#B0B3B8] font-mono font-semibold">{lead.phone}</span>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-3 pt-3 space-y-3">
        {lead.quoted_price && lead.quoted_price > 0 && (
            <div className={`${quoteStyle} border rounded-md p-2 shadow-sm`}>
                <div className="flex justify-between items-center mb-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider opacity-80">{lead.quoted_prepaga}</span>
                    <span className="text-xs font-black bg-white/50 dark:bg-black/20 px-1 rounded">
                        {priceFormatter.format(lead.quoted_price)}
                    </span>
                </div>
                {lead.quoted_plan && (
                    <div className="text-[10px] font-medium truncate opacity-90">
                        Plan: {lead.quoted_plan}
                    </div>
                )}
            </div>
        )}

        <div className="grid grid-cols-3 gap-1">
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button size="sm" variant="outline" className="h-8 text-xs px-0 text-white border-green-600 bg-[#25D366] hover:bg-[#20bd5a] dark:border-green-800">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                        </svg>
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                    <DropdownMenuLabel>Respuestas Rápidas</DropdownMenuLabel>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('no_contesta')}}>👋 No Contesta (1er toque)</DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('no_contesta_24')}}>⏳ No Contesta (24hs)</DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('cotizacion')}}>💲 Enviar Cotización</DropdownMenuItem>
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('vacio')}}>💬 Chat Vacío</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={(e) => {e.stopPropagation(); sendWpp('seguimiento')}} className="text-red-600 font-bold focus:text-red-700">🛑 ULTIMATUM</DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            <Button size="sm" variant="outline" className="h-8 text-xs px-0 text-indigo-600 border-indigo-200 bg-indigo-50/50 hover:bg-indigo-100 dark:bg-[#3A3B3C] dark:border-[#3E4042] dark:text-indigo-400 dark:hover:bg-[#4E4F50]" 
                onClick={(e) => { e.stopPropagation(); if(onOmniClick) onOmniClick(e); }}>
                <Headset className="h-3 w-3" />
            </Button>
            <Button size="sm" variant="outline" className={`h-8 text-xs px-1 ${callColor}`} onClick={(e) => { e.stopPropagation(); if(onCallIncrement) onCallIncrement(e); }}>
                {callIcon} <span className="ml-1">{lead.calls > 0 ? lead.calls : ''}</span>
            </Button>
        </div>

        <div className="flex justify-end items-center pt-1">
             <div className="flex items-center gap-1">
                <Avatar className="h-4 w-4">
                    <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${lead.agent}`} />
                    <AvatarFallback>{lead.agent[0]}</AvatarFallback>
                </Avatar>
                <span className="text-[9px] text-slate-400 dark:text-[#B0B3B8]">{lead.agent}</span>
             </div>
        </div>
      </CardContent>
    </Card>
  )
}