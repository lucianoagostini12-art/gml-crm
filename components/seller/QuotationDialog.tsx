import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useState } from "react"
import { Calculator } from "lucide-react"

interface QuotationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: any) => void
  onCancel: () => void
}

// BASE DE DATOS DE PLANES
const planesPorEmpresa: Record<string, string[]> = {
    "Prevención Salud": ["Plan A1", "Plan A2", "Plan A4", "Plan A5", "Plan Joven"],
    "DoctoRed": ["Plan 500", "Plan 1000", "Plan 2000", "Plan 3000"],
    "Avalian": ["Plan Cerca", "Plan Integral", "Plan Superior", "Plan Selecta", "Plan Hoy (Joven)"],
    "Swiss Medical": ["Plan S1", "Plan S2", "SMG 20", "SMG 30", "SMG 40", "SMG 50"],
    "Galeno": ["Plan Azul 200", "Plan Azul 220", "Plan Plata 300", "Plan Plata 330", "Plan Oro 440"],
    "AMPF": ["Plan Base", "Plan Familiar", "Plan PMO"]
}

export function QuotationDialog({ open, onOpenChange, onConfirm, onCancel }: QuotationDialogProps) {
  const [prepaga, setPrepaga] = useState("")
  const [plan, setPlan] = useState("")
  const [price, setPrice] = useState("")

  // Cuando cambia la prepaga, reseteamos el plan
  const handlePrepagaChange = (val: string) => {
      setPrepaga(val)
      setPlan("")
  }

  const handleConfirm = () => {
    if (prepaga && plan && price) {
      onConfirm({ prepaga, plan, price })
      setPrepaga("")
      setPlan("")
      setPrice("")
    }
  }

  const handleCancel = () => {
    onCancel()
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={(val) => !val && handleCancel()}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-yellow-600">
            <Calculator className="h-5 w-5" />
            Cargar Cotización
          </DialogTitle>
          <DialogDescription>
            Seleccioná la empresa y el plan para avanzar a la etapa de Cotización.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label>Empresa</Label>
            <Select value={prepaga} onValueChange={handlePrepagaChange}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar..." />
              </SelectTrigger>
              <SelectContent>
                {Object.keys(planesPorEmpresa).map(empresa => (
                    <SelectItem key={empresa} value={empresa}>{empresa}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label>Plan Ofrecido</Label>
            <Select value={plan} onValueChange={setPlan} disabled={!prepaga}>
              <SelectTrigger>
                <SelectValue placeholder={!prepaga ? "Primero elegí empresa" : "Seleccionar Plan..."} />
              </SelectTrigger>
              <SelectContent>
                {prepaga && planesPorEmpresa[prepaga].map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Precio Final ($)</Label>
            <Input 
                type="number" 
                placeholder="Ej: 85000" 
                value={price}
                onChange={(e) => setPrice(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={handleCancel}>Cancelar</Button>
          <Button onClick={handleConfirm} disabled={!prepaga || !plan || !price} className="bg-yellow-500 hover:bg-yellow-600 text-white">
            Guardar Cotización
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}