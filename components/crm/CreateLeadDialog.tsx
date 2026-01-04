"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  AlertCircle,
  Loader2,
  CheckCircle2,
  ExternalLink,
  Send,
} from "lucide-react"
import { createClient } from "@/lib/supabase"

interface CreateLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: any) => void
  userName: string
}

export function CreateLeadDialog({
  open,
  onOpenChange,
  onConfirm,
  userName,
}: CreateLeadDialogProps) {
  const supabase = createClient()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [source, setSource] = useState("")
  const [availableSources, setAvailableSources] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isSafe, setIsSafe] = useState(false)

  const [duplicateLead, setDuplicateLead] = useState<any | null>(null)
  const [requesting, setRequesting] = useState(false)

  const normalizePhone = (v: string) => v.replace(/\D/g, "")

  // Cargar orígenes
  useEffect(() => {
    if (!open) return
    const fetchOrigins = async () => {
      const { data, error } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "sales_origins")
        .single()

      if (error) {
        console.error("fetchOrigins error:", error)
        return
      }

      if (data && Array.isArray(data.value)) {
        setAvailableSources(data.value)
        setSource(data.value[0])
      }
    }
    fetchOrigins()
  }, [open, supabase])

  // Reset al abrir
  useEffect(() => {
    if (!open) return
    setName("")
    setPhone("")
    setDuplicateError(null)
    setDuplicateLead(null)
    setIsChecking(false)
    setIsSafe(false)
    setLoading(false)
    setRequesting(false)
  }, [open])

  // 🔍 Chequeo de duplicados usando phone_norm (solo dígitos)
  useEffect(() => {
    const checkDuplicate = async () => {
      const digits = normalizePhone(phone)

      if (digits.length < 8) {
        setDuplicateError(null)
        setDuplicateLead(null)
        setIsSafe(false)
        return
      }

      setIsChecking(true)

      // ✅ IMPORTANTE:
      // esto asume que ya corriste el SQL y existe leads.phone_norm (generated)
      const { data, error } = await supabase
        .from("leads")
        .select("id, name, phone, phone_norm, agent_name, status")
        .eq("phone_norm", digits)
        .limit(1)

      if (error) {
        console.error("checkDuplicate error:", error)
        // si falla el campo (por no existir aún), dejo feedback claro
        setDuplicateError("⚠️ Error verificando duplicados (phone_norm). Revisá que exista la columna en Supabase.")
        setDuplicateLead(null)
        setIsSafe(false)
        setIsChecking(false)
        return
      }

      if (data && data.length > 0) {
        const d = data[0]
        setDuplicateLead(d)

        const holder = d.agent_name || "Sin asignar"
        const st = String(d.status || "").toUpperCase()

        setDuplicateError(`⚠️ Ya existe y lo tiene ${holder} (${st})`)
        setIsSafe(false)
      } else {
        setDuplicateError(null)
        setDuplicateLead(null)
        setIsSafe(true)
      }

      setIsChecking(false)
    }

    const t = setTimeout(() => {
      if (phone) checkDuplicate()
    }, 450)

    return () => clearTimeout(t)
  }, [phone, supabase])

  // Crear lead
  const handleSubmit = async () => {
    const digits = normalizePhone(phone)
    if (!name || !digits || duplicateError || isChecking) return

    setLoading(true)

    const finalAgentName = userName || "Vendedor"

    const newLead = {
      name: name.trim(),
      phone: digits, // 👈 guardamos ya normalizado
      source,
      agent_name: finalAgentName,
      status: "nuevo",
      created_at: new Date().toISOString(),
      last_update: new Date().toISOString(),
      notes: `Ficha creada por ${finalAgentName} el ${new Date().toLocaleDateString("es-AR")}`,
    }

    const { data, error } = await supabase
      .from("leads")
      .insert([newLead])
      .select()

    if (!error && data) {
      onConfirm(data[0])
      onOpenChange(false)
    } else {
      // Si activaste UNIQUE en phone_norm, acá te puede caer duplicate key
      alert("Error: " + error?.message)
    }

    setLoading(false)
  }

  const handleViewExisting = () => {
    if (!duplicateLead?.id) return
    window.open(`/seller/kanban?focus=${duplicateLead.id}`, "_blank")
  }

  const handleRequestReassign = async () => {
    if (!duplicateLead?.id) return
    setRequesting(true)

    const requester = userName || "Vendedor"
    const holder = duplicateLead.agent_name || "Sin asignar"
    const status = String(duplicateLead.status || "").toUpperCase()

    await supabase.from("lead_messages").insert({
      lead_id: duplicateLead.id,
      sender: requester,
      text: `Pedido de reasignación: el dato ${duplicateLead.name || ""} (${duplicateLead.phone || ""}) ya existe y lo tiene ${holder} (${status}).`,
      target_role: "supervisión",
    })

    await supabase.from("audit_logs").insert({
      lead_id: duplicateLead.id,
      actor_name: requester,
      action: "Solicitud de reasignación",
      details: `Solicitado por ${requester}. Actualmente asignado a ${holder} (${status}).`,
      type: "info",
      metadata: {},
    })

    setRequesting(false)
    setDuplicateError(`✅ Solicitud enviada a supervisión.`)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Nuevo Dato</DialogTitle>
          <DialogDescription>
            Validación automática por teléfono contra la base general.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div>
            <Label>Nombre y Apellido</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div>
            <Label>Teléfono</Label>
            <div className="relative">
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={
                  duplicateError
                    ? "border-red-500 pr-10"
                    : isSafe
                    ? "border-green-500 pr-10"
                    : "pr-10"
                }
              />
              <div className="absolute right-3 top-2.5">
                {isChecking ? (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                ) : isSafe ? (
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                ) : duplicateError ? (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                ) : null}
              </div>
            </div>

            {duplicateError && (
              <div className="mt-2 space-y-2">
                <p className="text-[10px] font-bold text-red-600 uppercase">
                  {duplicateError}
                </p>

                {duplicateLead?.id && (
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      className="flex-1 h-9 text-[11px] font-black"
                      onClick={handleViewExisting}
                    >
                      <ExternalLink className="h-4 w-4 mr-2" /> VER FICHA
                    </Button>
                    <Button
                      className="flex-1 h-9 bg-blue-600 text-[11px] font-black"
                      onClick={handleRequestReassign}
                      disabled={requesting}
                    >
                      {requesting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" /> ENVIANDO…
                        </>
                      ) : (
                        <>
                          <Send className="h-4 w-4 mr-2" /> PEDIR REASIGNACIÓN
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          <div>
            <Label>Origen</Label>
            <Select value={source} onValueChange={setSource}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {availableSources.map((s, i) => (
                  <SelectItem key={i} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={handleSubmit}
            disabled={!name || !normalizePhone(phone) || !!duplicateError || isChecking || loading}
            className="w-full bg-blue-600 font-bold"
          >
            {loading ? "Sincronizando…" : "CREAR FICHA"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
