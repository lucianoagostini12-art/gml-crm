"use client"

import { Lead } from "./LeadCard"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { Phone, Headset, Save, Clock, Calendar, Plus, Star } from "lucide-react"
import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"

interface LeadDetailProps {
  lead: Lead | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

// LISTA OFICIAL ACTUALIZADA (Dic 2025)
const planesPorEmpresa: Record<string, string[]> = {
    "Prevención Salud": ["A1", "A1 CP", "A2 CP", "A2", "A4", "A5"],
    "DoctoRed": ["500", "1000", "2000", "3000"],
    "Avalian": ["AS100", "AS200 SC", "AS200", "AS204", "AS300", "AS500"],
    "AMPF Salud": ["Plan Superior"],
    "Swiss Medical": ["SMG20", "SMG30", "SMG40", "SMG50", "SMG60", "SMG70"],
    "Galeno": ["Plan 200", "Plan 220", "Plan 300", "Plan 330", "Plan 400", "Plan 440", "Plan 550"]
}

export function LeadDetail({ lead, open, onOpenChange }: LeadDetailProps) {
  const supabase = createClient()
  const [scheduledFor, setScheduledFor] = useState("")
  const [obs, setObs] = useState("")
  const [prepaga, setPrepaga] = useState("")
  const [quotes, setQuotes] = useState<any[]>([])
  const [newQuotePrepaga, setNewQuotePrepaga] = useState("")
  const [newQuotePlan, setNewQuotePlan] = useState("")
  const [newQuotePrice, setNewQuotePrice] = useState("")

  useEffect(() => {
    if (lead && open) {
        setObs(lead.observations || "")
        setPrepaga(lead.prepaga || "")
        if (lead.scheduled_for) {
            const date = new Date(lead.scheduled_for)
            date.setMinutes(date.getMinutes() - date.getTimezoneOffset())
            setScheduledFor(date.toISOString().slice(0, 16))
        } else {
            setScheduledFor("")
        }
        fetchQuotes()
    }
  }, [lead, open])

  const fetchQuotes = async () => {
      if(!lead) return
      const { data } = await supabase.from('quotes').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
      if(data) setQuotes(data)
  }

  const handleSaveMain = async () => {
    if(!lead) return
    await supabase.from('leads').update({
        observations: obs,
        prepaga: prepaga,
        scheduled_for: scheduledFor ? new Date(scheduledFor).toISOString() : null,
        last_update: new Date().toISOString()
    }).eq('id', lead.id)
    onOpenChange(false)
    window.location.reload()
  }

  const handleAddQuote = async () => {
      if(!lead || !newQuotePrepaga || !newQuotePlan || !newQuotePrice) return
      await supabase.from('quotes').insert({
          lead_id: lead.id,
          prepaga: newQuotePrepaga,
          plan: newQuotePlan,
          price: parseFloat(newQuotePrice),
          is_main: quotes.length === 0 
      })
      if (quotes.length === 0) {
          await supabase.from('leads').update({
              quoted_prepaga: newQuotePrepaga,
              quoted_plan: newQuotePlan,
              quoted_price: parseFloat(newQuotePrice)
          }).eq('id', lead.id)
      }
      setNewQuotePrepaga("")
      setNewQuotePlan("")
      setNewQuotePrice("")
      fetchQuotes()
  }

  const setMainQuote = async (quote: any) => {
      if(!lead) return
      await supabase.from('quotes').update({ is_main: false }).eq('lead_id', lead.id) 
      await supabase.from('quotes').update({ is_main: true }).eq('id', quote.id) 
      await supabase.from('leads').update({
          quoted_prepaga: quote.prepaga,
          quoted_plan: quote.plan,
          quoted_price: quote.price
      }).eq('id', lead.id)
      fetchQuotes()
  }

  if (!lead) return null

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-[600px] overflow-y-auto bg-white dark:bg-[#18191A] border-l dark:border-[#3E4042]">
        <SheetHeader className="mb-6 space-y-4">
          <div className="flex flex-col space-y-2 mt-4">
            <SheetTitle className="text-3xl font-black text-slate-900 dark:text-[#E4E6EB] tracking-tight">{lead.name}</SheetTitle>
            <div className="flex items-center justify-between">
                <span className="text-2xl font-bold text-blue-700 dark:text-blue-400 font-mono">{lead.phone}</span>
                <div className="flex gap-2">
                     <Button size="icon" variant="outline" className="h-9 w-9 rounded-full bg-green-50 text-green-600 border-green-200"><Phone className="h-4 w-4" /></Button>
                     <Button size="icon" variant="outline" className="h-9 w-9 rounded-full bg-indigo-50 text-indigo-600 border-indigo-200"><Headset className="h-4 w-4" /></Button>
                </div>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Clock className="h-3 w-3" /><span>Última act: {lead.lastUpdate}</span>
                <span className="text-slate-300 dark:text-slate-700">|</span><span>Fuente: {lead.source}</span>
            </div>
          </div>
          <Separator className="dark:bg-[#3E4042]" />
        </SheetHeader>

        <Tabs defaultValue="datos" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 dark:bg-[#242526]">
            <TabsTrigger value="datos">Datos y Agenda</TabsTrigger>
            <TabsTrigger value="cotizacion">Cotizaciones ({quotes.length})</TabsTrigger>
            <TabsTrigger value="historial">Historial</TabsTrigger>
          </TabsList>

          <TabsContent value="datos" className="space-y-5">
            <div className="bg-blue-50 dark:bg-blue-900/10 p-4 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-3">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-semibold text-sm"><Calendar className="h-4 w-4" />Programar Próximo Llamado</div>
                <div className="flex gap-2"><Input type="datetime-local" className="bg-white dark:bg-[#242526]" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} /></div>
            </div>
            <div className="space-y-2">
                <Label>Prepaga de Interés (Consulta)</Label>
                <Select value={prepaga} onValueChange={setPrepaga}>
                    <SelectTrigger className="dark:bg-[#242526]"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                    <SelectContent className="dark:bg-[#242526]">{Object.keys(planesPorEmpresa).map((p) => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent>
                </Select>
            </div>
            <div className="space-y-2"><Label>Observaciones</Label><Textarea placeholder="Notas..." className="min-h-[100px] dark:bg-[#242526]" value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </TabsContent>

          <TabsContent value="cotizacion" className="space-y-6">
            <div className="bg-slate-50 dark:bg-[#242526] p-4 rounded-lg border border-slate-200 dark:border-[#3E4042] space-y-3">
                <h4 className="font-bold text-sm text-slate-700 dark:text-slate-200 flex items-center gap-2"><Plus className="h-4 w-4"/> Nueva Opción</h4>
                <div className="grid grid-cols-2 gap-2">
                    <Select value={newQuotePrepaga} onValueChange={(val) => {setNewQuotePrepaga(val); setNewQuotePlan("")}}><SelectTrigger className="bg-white"><SelectValue placeholder="Empresa" /></SelectTrigger><SelectContent>{Object.keys(planesPorEmpresa).map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent></Select>
                    <Select value={newQuotePlan} onValueChange={setNewQuotePlan} disabled={!newQuotePrepaga}><SelectTrigger className="bg-white"><SelectValue placeholder="Plan" /></SelectTrigger><SelectContent>{newQuotePrepaga && planesPorEmpresa[newQuotePrepaga].map(p => (<SelectItem key={p} value={p}>{p}</SelectItem>))}</SelectContent></Select>
                </div>
                <div className="flex gap-2"><Input type="number" placeholder="Precio $" className="bg-white" value={newQuotePrice} onChange={(e) => setNewQuotePrice(e.target.value)} /><Button size="sm" onClick={handleAddQuote} disabled={!newQuotePrice || !newQuotePlan} className="bg-slate-800 text-white">Agregar</Button></div>
            </div>
            <div className="space-y-2">{quotes.map((q) => (<div key={q.id} className={`p-3 rounded-lg border flex justify-between items-center ${q.is_main ? 'bg-yellow-50 border-yellow-200' : 'bg-white border-slate-100'}`}><div><div className="flex items-center gap-2"><span className="font-bold text-sm">{q.prepaga}</span>{q.is_main && <Badge variant="secondary" className="text-[10px] bg-yellow-200 text-yellow-800">Principal</Badge>}</div><p className="text-xs text-slate-500">{q.plan} - <strong>${q.price}</strong></p></div>{!q.is_main && (<Button size="sm" variant="ghost" onClick={() => setMainQuote(q)} title="Marcar como Principal"><Star className="h-4 w-4 text-slate-300 hover:text-yellow-500" /></Button>)}</div>))}</div>
          </TabsContent>

          <TabsContent value="historial" className="space-y-4">
             <div className="space-y-3 max-h-[300px] overflow-y-auto">
                {lead.notes ? lead.notes.split('\n').reverse().map((nota, i) => (<div key={i} className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1"><p className="text-slate-700 dark:text-slate-300">{nota}</p></div>)) : <p className="text-sm text-slate-400 italic">No hay registros.</p>}
             </div>
          </TabsContent>
        </Tabs>

        <SheetFooter className="mt-8"><Button onClick={handleSaveMain} className="w-full bg-[#1e3a8a] hover:bg-blue-900 text-white h-12 text-lg"><Save className="mr-2 h-5 w-5" /> Guardar Todo</Button></SheetFooter>
      </SheetContent>
    </Sheet>
  )
}