"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import { format, subDays, startOfMonth, endOfMonth, differenceInDays, parseISO, subMonths } from "date-fns";
import { es } from "date-fns/locale";
import { DateRange } from "react-day-picker";
import {
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Flame,
  MessageSquare,
  RefreshCcw,
  RefreshCw,
  Calendar as CalendarIcon,
  Search,
  User,
  ArrowUpRight,
  Download,
  DollarSign,
  StickyNote
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

// --- TIPOS ---
interface SellerProfile {
  id: string;
  full_name: string;
  avatar_url?: string;
  email?: string;
}

interface ReportLead {
  id: string;
  created_at: string;
  name: string;
  phone: string;
  status: string;
  quoted_prepaga: string | null;
  quoted_plan: string | null;
  quoted_price: number | null;
  source: string | null;
  last_update: string;
  agent_name: string | null;
  notes?: string;
  audited: boolean;

  // Datos enriquecidos
  seller_avatar?: string;
  messages?: {
    content: string;
    created_at: string;
    sender: string;
  }[];
}

export default function AdminReports() {
  const supabase = createClient();

  // --- ESTADOS ---
  const [leads, setLeads] = useState<ReportLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [sellers, setSellers] = useState<SellerProfile[]>([]);

  // Filtros
  const [selectedSellerName, setSelectedSellerName] = useState<string>("all");

  // ESTADO CALENDARIO
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  });
  const [isCalendarOpen, setIsCalendarOpen] = useState(false);
  // ✅ Filtro de verificación
  const [filterAudited, setFilterAudited] = useState<string>("all");

  // Modal de Reasignación
  const [reassignOpen, setReassignOpen] = useState(false);
  const [selectedLead, setSelectedLead] = useState<ReportLead | null>(null);
  const [targetStatus, setTargetStatus] = useState<string>("contactado");
  const [targetAgent, setTargetAgent] = useState<string>("");

  // --- EFECTOS ---
  useEffect(() => {
    fetchSellers();
  }, []);

  useEffect(() => {
    if (date?.from) {
      fetchReportData();
    }
  }, [selectedSellerName, date, sellers, filterAudited]);

  // --- CARGA DE DATOS ---
  const fetchSellers = async () => {
    const { data } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email, role")
      .or('role.eq.seller,role.eq.gestor,role.eq.admin_common')
      .order('full_name');

    if (data) setSellers(data);
  };

  const fetchReportData = async () => {
    setLoading(true);

    // 1. Query Básica
    let query = supabase
      .from("leads")
      .select(`*`)
      .or('quoted_price.gt.0,status.eq.cotizacion')
      .order("last_update", { ascending: false });

    // 2. Filtros
    if (selectedSellerName !== "all") {
      query = query.eq("agent_name", selectedSellerName);
    }

    if (date?.from) {
      const fromISO = date.from.toISOString();
      // Si solo hay fecha de inicio, la usamos como fin también para la query inicial
      const toDate = date.to ? new Date(date.to) : new Date(date.from);
      toDate.setHours(23, 59, 59, 999);
      // ✅ Filtrar por fecha de CREACIÓN de la cotización (no last_update)
      query = query
        .gte("created_at", fromISO)
        .lte("created_at", toDate.toISOString());
    }

    const { data: leadsData, error: leadsError } = await query;

    if (leadsError) {
      console.error("Error fetching report:", leadsError);
      toast.error("Error cargando datos: " + leadsError.message);
      setLoading(false);
      return;
    }

    // 3. Enriquecer datos (Mensajes)
    const leadIds = leadsData?.map(l => l.id) || [];
    let messagesMap: Record<string, any[]> = {};

    if (leadIds.length > 0) {
      const { data: msgs } = await supabase
        .from("lead_messages")
        .select("lead_id, text, created_at, sender")
        .in("lead_id", leadIds)
        .order("created_at", { ascending: false });

      msgs?.forEach((m: any) => {
        if (!messagesMap[m.lead_id]) messagesMap[m.lead_id] = [];
        if (messagesMap[m.lead_id].length < 5) {
          messagesMap[m.lead_id].push({
            content: m.text,
            created_at: m.created_at,
            sender: m.sender
          });
        }
      });
    }

    // 4. Mapeo Final
    let processed: ReportLead[] = (leadsData || []).map((lead: any) => {
      const sellerProfile = sellers.find(s => s.full_name === lead.agent_name);
      return {
        ...lead,
        seller_avatar: sellerProfile?.avatar_url,
        messages: messagesMap[lead.id] || [],
        audited: lead.audited || false
      };
    });

    // ✅ 5. Filtrar por estado de verificación
    if (filterAudited === 'verified') {
      processed = processed.filter(l => l.audited === true)
    } else if (filterAudited === 'pending') {
      processed = processed.filter(l => l.audited !== true)
    }

    setLeads(processed);
    setLoading(false);
  };

  // --- ACCIONES ---

  // 1. Marcar como Revisado (Persistente)
  const toggleAudited = async (leadId: string, currentStatus: boolean) => {
    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, audited: !currentStatus } : l));

    const { error } = await supabase
      .from('leads')
      .update({ audited: !currentStatus })
      .eq('id', leadId);

    if (error) {
      toast.error("Error guardando revisión");
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, audited: currentStatus } : l));
    }
  };

  // 2. Preparar Reasignación
  const handleOpenReassign = (lead: ReportLead) => {
    setSelectedLead(lead);
    setTargetStatus("contactado");
    setTargetAgent(lead.agent_name || "");
    setReassignOpen(true);
  };

  // 3. Guardar Reasignación
  const handleSaveReassign = async () => {
    if (!selectedLead) return;

    const { error } = await supabase.from('leads').update({
      status: targetStatus,
      agent_name: targetAgent,
      last_update: new Date().toISOString(),
      loss_reason: null
    }).eq('id', selectedLead.id);

    if (error) {
      toast.error("Error al reasignar lead");
    } else {
      toast.success("Lead reasignado y actualizado");
      setReassignOpen(false);
      fetchReportData();
    }
  };

  // PRESETS CALENDARIO
  const handlePresetSelect = (preset: string) => {
    const today = new Date();
    let from = today;
    let to = today;

    switch (preset) {
      case 'today':
        break;
      case 'yesterday':
        from = subDays(today, 1);
        to = subDays(today, 1);
        break;
      case 'week':
        from = subDays(today, 7);
        break;
      case 'thisMonth':
        from = startOfMonth(today);
        to = endOfMonth(today);
        break;
      case 'lastMonth':
        from = startOfMonth(subMonths(today, 1));
        to = endOfMonth(subMonths(today, 1));
        break;
    }
    setDate({ from, to });
  };

  // KPIs
  const totalCotizado = leads.reduce((acc, curr) => acc + (curr.quoted_price || 0), 0);
  const totalAudited = leads.filter(l => l.audited).length;

  return (
    <div className="space-y-6 pb-20 p-6 max-w-[1800px] mx-auto animate-in fade-in duration-700">

      {/* MODAL DE REASIGNACIÓN */}
      <Dialog open={reassignOpen} onOpenChange={setReassignOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Revivir o Reasignar Lead</DialogTitle>
            <DialogDescription>
              Modificá el estado y la vendedora asignada para este dato.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Estado de Destino</Label>
              <Select value={targetStatus} onValueChange={setTargetStatus}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nuevo">Nuevo (Sin trabajar)</SelectItem>
                  <SelectItem value="contactado">En Contacto</SelectItem>
                  <SelectItem value="cotizacion">Cotizado</SelectItem>
                  <SelectItem value="documentacion">Cierre (Documentación)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Vendedora Asignada</Label>
              <Select value={targetAgent} onValueChange={setTargetAgent}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {sellers.map(s => (
                    <SelectItem key={s.id} value={s.full_name}>{s.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReassignOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveReassign} className="bg-blue-600 hover:bg-blue-700">Confirmar Cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-800 dark:text-white flex items-center gap-2">
            <DollarSign className="h-8 w-8 text-blue-600" /> Auditoría de Cotizaciones
          </h1>
          <p className="text-slate-500 mt-1 font-medium">Control semanal de propuestas enviadas y seguimiento.</p>
        </div>

        {/* BARRA DE HERRAMIENTAS */}
        <div className="flex flex-wrap items-center gap-3 bg-white p-2 rounded-xl border shadow-sm dark:bg-slate-900 z-50">

          {/* SELECTOR VENDEDOR */}
          <Select value={selectedSellerName} onValueChange={setSelectedSellerName}>
            <SelectTrigger className="w-[220px] h-10 border-0 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <SelectValue placeholder="Vendedora" />
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all" className="font-bold">🌍 Todas</SelectItem>
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.full_name}>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-5 w-5">
                      <AvatarImage src={s.avatar_url} />
                      <AvatarFallback className="text-[9px]">{s.full_name.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                    <span>{s.full_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* ✅ Filtro de Verificación */}
          <Select value={filterAudited} onValueChange={setFilterAudited}>
            <SelectTrigger className="w-[160px] h-10 border-0 bg-slate-50 hover:bg-slate-100 font-bold text-slate-700">
              <SelectValue placeholder="Revisión" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">📋 Todos</SelectItem>
              <SelectItem value="verified">✅ Verificados</SelectItem>
              <SelectItem value="pending">⏳ Pendientes</SelectItem>
            </SelectContent>
          </Select>

          <div className="w-px h-6 bg-slate-200 mx-1"></div>

          {/* DATE PICKER ARREGLADO */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={"ghost"}
                className={cn(
                  "w-[260px] justify-start text-left font-bold h-10 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-transparent hover:border-slate-200",
                  !date && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4 text-slate-500" />
                {date?.from ? (
                  date.to ? (
                    <>
                      {format(date.from, "dd MMM", { locale: es })} -{" "}
                      {format(date.to, "dd MMM, yyyy", { locale: es })}
                    </>
                  ) : (
                    format(date.from, "dd MMMM, yyyy", { locale: es })
                  )
                ) : (
                  <span>Seleccionar fechas</span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
              {/* CONTENEDOR FLEX QUE NO SE APLASTA */}
              <div className="flex h-full min-h-[350px]">
                {/* COLUMNA IZQUIERDA: PRESETS */}
                <div className="flex flex-col gap-1 p-3 border-r border-slate-100 bg-slate-50 w-[150px] shrink-0">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 px-2">Rango Rápido</span>
                  <Button variant="ghost" className="justify-start h-8 text-xs font-medium" onClick={() => handlePresetSelect('today')}>Hoy</Button>
                  <Button variant="ghost" className="justify-start h-8 text-xs font-medium" onClick={() => handlePresetSelect('yesterday')}>Ayer</Button>
                  <Button variant="ghost" className="justify-start h-8 text-xs font-medium" onClick={() => handlePresetSelect('week')}>Últimos 7 días</Button>
                  <Button variant="ghost" className="justify-start h-8 text-xs font-medium" onClick={() => handlePresetSelect('thisMonth')}>Este Mes</Button>
                  <Button variant="ghost" className="justify-start h-8 text-xs font-medium" onClick={() => handlePresetSelect('lastMonth')}>Mes Pasado</Button>
                </div>

                {/* COLUMNA DERECHA: CALENDARIO (ANCHO FIJO PARA NO APLASTARSE) */}
                <div className="p-3 w-[600px]">
                  <Calendar
                    initialFocus
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                    locale={es}
                    // Pintar el tramo entre FROM y TO (franja completa)
                    modifiersClassNames={{
                      range_start: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white rounded-l-md",
                      range_end: "bg-blue-600 text-white hover:bg-blue-600 hover:text-white rounded-r-md",
                      range_middle: "bg-blue-50 text-slate-900",
                    }}
                    // Pintar el tramo entre FROM y TO ("la línea" del rango)
                    classNames={{
                      // La "línea" del rango se pinta en la CELDA para que quede continua
                      cell:
                        "h-9 w-9 p-0 relative text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-blue-50 [&:has([aria-selected].day-range-start)]:rounded-l-md [&:has([aria-selected].day-range-end)]:rounded-r-md",
                      day: "h-9 w-9 p-0 font-normal aria-selected:opacity-100",
                      day_selected:
                        "bg-blue-600 text-white hover:bg-blue-600 hover:text-white focus:bg-blue-600 focus:text-white",

                      // día dentro del rango (entre inicio y fin)
                      day_range_middle:
                        "day-range-middle bg-blue-50 text-slate-900",
                      // extremos del rango
                      day_range_start:
                        "day-range-start aria-selected:bg-blue-600 aria-selected:text-white",
                      day_range_end:
                        "day-range-end aria-selected:bg-blue-600 aria-selected:text-white",
                    }}
                  />
                  <div className="flex justify-end mt-4 pt-3 border-t border-slate-100">
                    <Button size="sm" onClick={() => setIsCalendarOpen(false)}>Aplicar Rango</Button>
                  </div>
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Button size="icon" className="h-10 w-10 ml-2 bg-blue-600 hover:bg-blue-700 shadow-md transition-all active:scale-95" onClick={fetchReportData}>
            <RefreshCw className={cn("h-4 w-4 text-white", loading && "animate-spin")} />
          </Button>
        </div>
      </div>

      {/* KPI STATS */}
      <div className="grid gap-6 md:grid-cols-4">
        <Card className="border-0 shadow-md bg-slate-900 text-white overflow-hidden relative group">
          <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
            <Download className="h-20 w-20 text-white" />
          </div>
          <CardHeader className="pb-2 relative z-10">
            <CardDescription className="text-slate-400 font-bold uppercase text-xs">Total Cotizado (Est.)</CardDescription>
            <CardTitle className="text-3xl font-black tracking-tight text-green-400">
              {new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(totalCotizado)}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <p className="text-xs text-slate-400">Suma de propuestas activas</p>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500 shadow-sm bg-white">
          <CardHeader className="pb-2">
            <CardDescription className="font-bold text-slate-400 text-xs uppercase">Cotizaciones</CardDescription>
            <CardTitle className="text-3xl font-black text-slate-800">{leads.length}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center text-xs text-blue-600 font-bold">
              <ArrowUpRight className="h-3 w-3 mr-1" /> En el periodo
            </div>
          </CardContent>
        </Card>

        <Card className="border shadow-sm bg-white col-span-2 flex flex-col justify-center">
          <CardContent className="py-4">
            <div className="flex justify-between items-end mb-2">
              <div>
                <CardTitle className="text-xl font-bold text-slate-700">Progreso de Revisión</CardTitle>
                <CardDescription className="text-xs">Guardado en base de datos</CardDescription>
              </div>
              <div className="text-3xl font-black text-slate-800">
                {totalAudited} <span className="text-lg text-slate-300 font-bold">/ {leads.length}</span>
              </div>
            </div>
            <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className="h-full bg-blue-600 transition-all duration-500 ease-out shadow-[0_0_10px_rgba(37,99,235,0.5)]"
                style={{ width: `${leads.length > 0 ? (totalAudited / leads.length) * 100 : 0}%` }}
              ></div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* TABLA PRINCIPAL */}
      <Card className="border shadow-lg overflow-hidden bg-white dark:bg-slate-950">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-slate-50 border-b border-slate-200">
                <TableHead className="w-[50px]"></TableHead>
                <TableHead className="font-black text-xs uppercase text-slate-500 tracking-wider">Estado Actual</TableHead>
                <TableHead className="font-black text-xs uppercase text-slate-500 tracking-wider">Últ. Movimiento</TableHead>
                <TableHead className="font-black text-xs uppercase text-slate-500 tracking-wider">Cliente / Origen</TableHead>
                <TableHead className="font-black text-xs uppercase text-slate-500 tracking-wider">Propuesta</TableHead>
                <TableHead className="font-black text-xs uppercase text-slate-500 tracking-wider">Vendedor</TableHead>
                <TableHead className="font-black text-xs uppercase text-slate-500 tracking-wider text-center">Alertas</TableHead>
                <TableHead className="text-right font-black text-xs uppercase text-slate-500 tracking-wider pr-6">Revisión</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-32 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-400 gap-2">
                      <RefreshCcw className="animate-spin h-6 w-6" />
                      <span className="text-xs font-medium">Buscando cotizaciones...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : leads.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="h-40 text-center">
                    <div className="flex flex-col items-center justify-center text-slate-300 gap-2">
                      <Search className="h-10 w-10 opacity-50" />
                      <span className="font-bold text-sm">No se encontraron cotizaciones.</span>
                      <span className="text-xs">Prueba ampliando el rango de fechas.</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                leads.map((lead) => (
                  <ReportRow
                    key={lead.id}
                    lead={lead}
                    onToggleReview={() => toggleAudited(lead.id, lead.audited)}
                    onOpenReassign={() => handleOpenReassign(lead)}
                  />
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// --- SUBCOMPONENTE FILA ---
function ReportRow({ lead, onToggleReview, onOpenReassign }: { lead: ReportLead, onToggleReview: () => void, onOpenReassign: () => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const supabase = createClient();
  const [note, setNote] = useState("");
  const [isSending, setIsSending] = useState(false);

  // --- NOTAS (LEGACY) ---
  // Formatos soportados:
  // A) "texto libre" (una sola nota)
  // B) Separadas por: |||SEP_NOTE|
  //    y dentro de cada bloque: "fecha|autor|texto" (el texto puede contener '|')
  type ParsedNote = { atLabel?: string; author?: string; text: string };

  const parseNotes = (raw?: string): ParsedNote[] => {
    const s = (raw || "").trim();
    if (!s) return [];

    // Si trae separador legacy
    if (s.includes("|||SEP_NOTE|")) {
      const blocks = s
        .split("|||SEP_NOTE|")
        .map((x) => x.trim())
        .filter(Boolean);

      return blocks.map((b) => {
        // Intento formato "fecha|autor|texto"
        const parts = b.split("|").map((p) => p.trim()).filter((p) => p.length > 0);

        if (parts.length >= 3) {
          const atLabel = parts[0];
          const author = parts[1];
          const text = parts.slice(2).join(" | ");
          return { atLabel, author, text };
        }

        // Si no matchea, lo mostramos como texto simple
        return { text: b };
      });
    }

    // Caso simple
    return [{ text: s }];
  };

  const parsedNotes = parseNotes(lead.notes);

  const daysSinceUpdate = differenceInDays(new Date(), new Date(lead.last_update));

  // Lógica Alertas
  const isForgotten = (lead.status === "cotizacion" || lead.status === "contactado") && daysSinceUpdate > 3;
  const isHot = (lead.messages?.length || 0) > 2 && daysSinceUpdate < 2;

  const getStatusBadge = (status: string) => {
    const s = status.toLowerCase();
    if (s === 'vendido' || s === 'cumplidas') return <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0 font-bold">VENDIDO</Badge>
    if (s === 'perdido' || s === 'rechazado') return <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0 font-bold">PERDIDO</Badge>
    if (s === 'cotizacion') return <Badge className="bg-yellow-100 text-yellow-700 hover:bg-yellow-200 border-0 font-bold">COTIZANDO</Badge>
    return <Badge variant="outline" className="text-slate-500 font-bold uppercase text-[10px]">{s}</Badge>
  }

  const sendQuickNote = async () => {
    if (!note.trim()) return;
    setIsSending(true);

    const { error } = await supabase.from("lead_messages").insert({
      lead_id: lead.id,
      text: `👮 AUDITORÍA: ${note}`,
      sender: "Administración",
      target_role: "seller"
    });

    if (!error) {
      toast.success("Feedback enviado al chat de la venta");
      setNote("");
    } else {
      toast.error("Error enviando nota");
    }
    setIsSending(false);
  };

  return (
    <>
      <TableRow
        className={cn(
          "group transition-all border-b border-slate-100 cursor-pointer",
          lead.audited ? "bg-emerald-50/60 hover:bg-emerald-100/50" : "hover:bg-slate-50",
          isOpen && "bg-slate-50 border-b-0"
        )}
        onClick={() => setIsOpen(!isOpen)}
      >
        <TableCell>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-full hover:bg-slate-200 text-slate-400">
            {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </Button>
        </TableCell>

        <TableCell>{getStatusBadge(lead.status)}</TableCell>

        <TableCell>
          <div className="flex flex-col">
            <span className={cn("text-xs font-bold", isForgotten ? "text-red-500" : "text-slate-700")}>
              {format(parseISO(lead.last_update), "dd MMM, HH:mm", { locale: es })}
            </span>
            <span className="text-[10px] text-slate-400 font-medium">Hace {daysSinceUpdate} días</span>
          </div>
        </TableCell>

        <TableCell>
          <div className="flex flex-col">
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="font-bold text-slate-800 text-sm truncate max-w-[150px] text-left hover:underline"
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Ver nombre completo y teléfono de ${lead.name}`}
                >
                  {lead.name}
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="start"
                side="top"
                className="w-80 p-3"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="space-y-2">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Cliente</div>
                    <div className="text-sm font-black text-slate-900 break-words">{lead.name || "-"}</div>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-wider text-slate-400">Teléfono</div>
                    <div className="text-sm font-bold text-slate-800 break-words">{lead.phone || "-"}</div>
                  </div>
                </div>
              </PopoverContent>
            </Popover>
            {lead.source && (
              <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded w-fit mt-1 border border-slate-200">
                {lead.source}
              </span>
            )}
          </div>
        </TableCell>

        <TableCell>
          <div className="flex flex-col gap-0.5">
            <span className="font-black text-sm text-green-700">
              {lead.quoted_price ? new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(lead.quoted_price) : "-"}
            </span>
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">
              {lead.quoted_prepaga || "S/D"} {lead.quoted_plan}
            </span>
          </div>
        </TableCell>

        <TableCell>
          <div className="flex items-center gap-2">
            <Avatar className="h-7 w-7 border border-slate-200">
              <AvatarImage src={lead.seller_avatar} />
              <AvatarFallback className="bg-slate-100 text-[9px] font-bold text-slate-500">
                {lead.agent_name?.charAt(0) || "?"}
              </AvatarFallback>
            </Avatar>
            <span className="text-xs font-bold text-slate-700 truncate max-w-[100px]">{lead.agent_name}</span>
          </div>
        </TableCell>

        <TableCell className="text-center">
          <div className="flex justify-center gap-1">
            {isForgotten && (
              <div className="bg-amber-100 p-1 rounded text-amber-600" title="Olvido: +3 días sin gestión">
                <AlertCircle className="h-4 w-4" />
              </div>
            )}
            {isHot && (
              <div className="bg-orange-100 p-1 rounded text-orange-600" title="Hot: Gestión reciente">
                <Flame className="h-4 w-4" />
              </div>
            )}
          </div>
        </TableCell>

        <TableCell className="text-right pr-6">
          <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>

            {/* Botón REVIVIR/REASIGNAR - ABRE MODAL */}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 text-blue-500 border-blue-200 hover:bg-blue-50"
              onClick={(e) => { e.stopPropagation(); onOpenReassign(); }}
              title="Cambiar Estado / Asignar (Revivir)"
            >
              <RefreshCcw className="h-4 w-4" />
            </Button>

            {/* CHECK MARK PERSISTENTE */}
            <Button
              variant={lead.audited ? "default" : "outline"}
              size="icon"
              className={cn(
                "h-8 w-8 transition-all",
                lead.audited
                  ? "bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600 shadow-sm"
                  : "hover:border-emerald-500 hover:text-emerald-500 text-slate-300 border-slate-200"
              )}
              onClick={(e) => { e.stopPropagation(); onToggleReview(); }}
              title={lead.audited ? "Marcar como pendiente" : "Marcar como auditado (Guardar)"}
            >
              <CheckCircle2 className="h-5 w-5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>

      {/* FILA DE CONTENIDO: NOTAS DEL DATO + CHAT */}
      <TableRow className="border-0 hover:bg-transparent">
        <TableCell colSpan={8} className="p-0 border-0">
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleContent className="overflow-hidden data-[state=closed]:animate-collapsible-up data-[state=open]:animate-collapsible-down">
              <div className={cn("p-6 grid md:grid-cols-3 gap-6 border-b shadow-inner", lead.audited ? "bg-emerald-50/30" : "bg-slate-50/50")}>

                {/* COL 1: NOTAS ORIGINALES DEL DATO */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <StickyNote className="h-3 w-3" /> Notas del Dato
                  </h4>
                  <div className="bg-yellow-50/50 border border-yellow-100 p-3 rounded-lg min-h-[100px] shadow-sm">
                    {parsedNotes.length > 0 ? (
                      <div className="space-y-2 max-h-[180px] overflow-y-auto pr-2 overscroll-contain">
                        {parsedNotes.map((n, idx) => (
                          <div
                            key={idx}
                            className="bg-white/80 border border-yellow-100 rounded-xl p-3 shadow-sm"
                            onWheel={(e) => e.stopPropagation()}
                          >
                            {(n.author || n.atLabel) && (
                              <div className="flex items-center justify-between gap-3 mb-1">
                                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                  {n.author || "Nota"}
                                </span>
                                {n.atLabel && (
                                  <span className="text-[9px] text-slate-400 font-bold">{n.atLabel}</span>
                                )}
                              </div>
                            )}
                            <p className="text-sm text-slate-700 italic whitespace-pre-wrap leading-relaxed">{n.text}</p>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-700 italic whitespace-pre-wrap">Sin notas iniciales.</p>
                    )}
                  </div>
                </div>

                {/* COL 2: HISTORIAL CHAT */}
                <div className="space-y-3">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400 flex items-center gap-2 border-b border-slate-200 pb-2">
                    <MessageSquare className="h-3 w-3" /> Chat Reciente
                  </h4>
                  <div
                    className="space-y-2 pl-1 max-h-[180px] overflow-y-auto custom-scrollbar pr-2 overscroll-contain pointer-events-auto"
                    onWheel={(e) => e.stopPropagation()}
                  >
                    {lead.messages && lead.messages.length > 0 ? (
                      lead.messages.map((msg, i) => (
                        <div key={i} className="text-xs p-2.5 rounded-lg border bg-white border-slate-100 shadow-sm relative">
                          <div className="flex justify-between mb-1">
                            <span className="font-bold text-slate-700 text-[10px] uppercase">{msg.sender || 'Usuario'}</span>
                            <span className="text-[9px] text-slate-400">{format(parseISO(msg.created_at), "dd/MM HH:mm")}</span>
                          </div>
                          <p className="text-slate-600 leading-relaxed">{msg.content}</p>
                        </div>
                      ))
                    ) : (
                      <p className="text-xs text-slate-400 italic py-4 text-center">No hay mensajes recientes.</p>
                    )}
                  </div>
                </div>

                {/* COL 3: FEEDBACK INPUT */}
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-3 h-fit">
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                    Feedback a {lead.agent_name}
                  </h4>
                  <Textarea
                    placeholder="Escribí una observación sobre esta cotización..."
                    className="min-h-[80px] text-sm resize-none bg-slate-50 border-slate-200 focus:bg-white transition-colors"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                  />
                  <div className="flex justify-end">
                    <Button
                      size="sm"
                      onClick={sendQuickNote}
                      disabled={!note.trim() || isSending}
                      className="bg-slate-900 text-white hover:bg-slate-800 text-xs h-8"
                    >
                      {isSending ? "Enviando..." : "Enviar al Chat"}
                    </Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>
        </TableCell>
      </TableRow>
    </>
  );
}