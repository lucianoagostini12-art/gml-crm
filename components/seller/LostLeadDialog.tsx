import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { useState } from "react"

interface LostLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string, notes: string) => void
}

export function LostLeadDialog({ open, onOpenChange, onConfirm }: LostLeadDialogProps) {
  const [reason, setReason] = useState<string>("")
  const [notes, setNotes] = useState<string>("")

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
            <Select onValueChange={setReason}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar motivo..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="precio">Precio / Muy caro</SelectItem>
                <SelectItem value="no_contesta">No contesta</SelectItem>
                <SelectItem value="competencia">Competencia (Otra prepaga)</SelectItem>
                <SelectItem value="requisitos">Requisitos / Edad / Salud</SelectItem>
                <SelectItem value="error">Error / No solicitó</SelectItem>
                <SelectItem value="otros">Otros</SelectItem>
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