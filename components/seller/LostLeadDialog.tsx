import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useEffect, useMemo, useState } from "react"
import { createClient } from "@/lib/supabase"

interface LostLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string, notes: string) => void
}

type LossReasonRow = {
  id: number
  code?: string | null
  reason?: string | null
  is_active?: boolean | null
}

const FALLBACK_REASONS: Array<{ code: string; label: string }> = [
  { code: "precio", label: "Precio / Muy caro" },
  { code: "no_contesta", label: "No contesta" },
  { code: "competencia", label: "Competencia (Otra prepaga)" },
  { code: "requisitos", label: "Requisitos / Edad / Salud" },
  { code: "error", label: "Error / No solicitó" },
  { code: "otros", label: "Otros" },
]

export function LostLeadDialog({ open, onOpenChange, onConfirm }: LostLeadDialogProps) {
  const supabase = createClient()
  const [reason, setReason] = useState<string>("")
  const [notes, setNotes] = useState<string>("")
  const [loadingReasons, setLoadingReasons] = useState(false)
  const [reasons, setReasons] = useState<LossReasonRow[]>([])

  // Traemos catálogo de Supabase (code/label) para mantener métricas estables.
  useEffect(() => {
    if (!open) return

    let alive = true
    ;(async () => {
      setLoadingReasons(true)
      try {
        const { data, error } = await supabase
          .from("loss_reasons")
          .select("id, code, reason, is_active")
          .eq("is_active", true)
          .order("reason", { ascending: true })

        if (!alive) return
        if (!error && data) setReasons(data as any)
        else setReasons([])
      } catch {
        if (!alive) return
        setReasons([])
      } finally {
        if (!alive) return
        setLoadingReasons(false)
      }
    })()

    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectOptions = useMemo(() => {
    const normalized = (reasons || [])
      .filter((r) => r && (r.is_active ?? true) !== false)
      .map((r) => {
        const code = (r.code || "").toString().trim()
        const label = (r.reason || "").toString().trim()
        if (!code || !label) return null
        return { code, label }
      })
      .filter(Boolean) as Array<{ code: string; label: string }>

    // Fallback seguro: si no hay catálogo, mantenemos hardcode para no romper.
    return normalized.length > 0 ? normalized : FALLBACK_REASONS
  }, [reasons])

  const handleConfirm = () => {
    if (reason) {
      onConfirm(reason, notes)
      setReason("")
      setNotes("")
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Marcar como Perdido 🗑️</DialogTitle>
          <DialogDescription>
            El dato desaparecerá del tablero principal. Podés recuperarlo desde el buscador.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="reason">Motivo de pérdida</Label>
            <Select value={reason} onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo..." />
              </SelectTrigger>
              <SelectContent>
                {loadingReasons ? (
                  <div className="px-3 py-2 text-xs text-slate-500">Cargando motivos…</div>
                ) : (
                  selectOptions.map((opt) => (
                    <SelectItem key={opt.code} value={opt.code}>
                      {opt.label}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Observación corta</Label>
            <Textarea 
              id="notes" 
              placeholder="Ej: Dijo que quizás el mes que viene..." 
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!reason}>Confirmar Pérdida</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}