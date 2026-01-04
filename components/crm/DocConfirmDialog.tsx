import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { AlertTriangle } from "lucide-react"

interface DocConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  onCancel: () => void
}

export function DocConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
  onCancel,
}: DocConfirmDialogProps) {
  return (
    <Dialog
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val)
        if (!val) {
          onCancel()
        }
      }}
    >
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-purple-700">
            <AlertTriangle className="h-5 w-5" />
            ¿Pasar a Documentación?
          </DialogTitle>
          <DialogDescription className="pt-2">
            Esta es la etapa final. Una vez aquí, el dato{" "}
            <strong>solo podrá moverse a VENTA o PERDIDO</strong>.
            <br />
            <br />
            ¿Estás segura de que el cliente ya envió los papeles?
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-4">
          <Button variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button
            className="bg-purple-600 hover:bg-purple-700 text-white"
            onClick={onConfirm}
          >
            Sí, confirmar paso
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
