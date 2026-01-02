"use client"

import { useState } from "react"
import { SaleWizardDialog } from "./SaleWizardDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { UserPlus, ArrowRightLeft, UploadCloud } from "lucide-react"

interface WonLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: any) => void
}

export function WonLeadDialog({ open, onOpenChange, onConfirm }: WonLeadDialogProps) {
  const [saleType, setSaleType] = useState<'alta' | 'pass' | null>(null)

  // Estados para el formulario PASS
  const [passData, setPassData] = useState({
    fullName: "",
    observations: "",
    files: null as FileList | null
  })

  // Reiniciar estado al cerrar
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        setSaleType(null)
        setPassData({ fullName: "", observations: "", files: null })
      }, 300)
    }
    onOpenChange(isOpen)
  }

  const handleConfirmPass = () => {
    if (!passData.fullName) return alert("Por favor, ingresá el nombre completo.")
    
    // Acá confirmamos con los datos del PASS
    onConfirm({
      type: 'pass',
      ...passData,
      // Simulamos carga de archivos (en una app real iría a Storage)
      fileCount: passData.files?.length || 0
    })
    handleOpenChange(false)
  }

  // SI ELIGIÓ ALTA -> Mostramos el Wizard Original (NO TOCAMOS NADA)
  if (saleType === 'alta') {
    return (
      <SaleWizardDialog 
        open={open} 
        onOpenChange={handleOpenChange} 
        onConfirm={(data) => {
          onConfirm({ type: 'alta', ...data }) // Le avisamos que fue ALTA
          handleOpenChange(false)
        }} 
      />
    )
  }

  // SI ELIGIÓ PASS -> Mostramos el Formulario Nuevo
  if (saleType === 'pass') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600">
              <ArrowRightLeft className="h-5 w-5"/> Registrar Traspaso (PASS)
            </DialogTitle>
            <DialogDescription>
              Completá los datos obligatorios para procesar el cambio.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="fullname" className="font-bold">Nombre Completo del Titular</Label>
              <Input 
                id="fullname" 
                placeholder="Ej: Juan Carlos Perez" 
                value={passData.fullName}
                onChange={(e) => setPassData({...passData, fullName: e.target.value})}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="obs" className="font-bold">Observaciones / Motivo</Label>
              <Textarea 
                id="obs" 
                placeholder="Ej: No tiene contacto con la persona que le vendió" 
                className="resize-none h-24"
                value={passData.observations}
                onChange={(e) => setPassData({...passData, observations: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label className="font-bold">Adjuntar Documentación</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative">
                <input 
                  type="file" 
                  multiple 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => setPassData({...passData, files: e.target.files})}
                />
                <UploadCloud className="h-8 w-8 text-slate-400 mb-2"/>
                <p className="text-sm text-slate-600 font-medium">
                  {passData.files && passData.files.length > 0 
                    ? `✅ ${passData.files.length} archivos seleccionados` 
                    : "Click para subir archivos (DNI, Recibos)"}
                </p>
                <p className="text-xs text-slate-400 mt-1">Soporta PDF, JPG, PNG</p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSaleType(null)}>Volver</Button>
            <Button className="bg-blue-600 hover:bg-blue-700" onClick={handleConfirmPass}>
              Confirmar PASS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // PANTALLA INICIAL: SELECCIÓN (ALTA vs PASS)
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-black">¡Felicitaciones! 🎉</DialogTitle>
          <DialogDescription className="text-center">
            ¿Qué tipo de venta acabás de cerrar?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-6">
          <button 
            onClick={() => setSaleType('alta')}
            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group"
          >
            <div className="bg-green-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <UserPlus className="h-8 w-8 text-green-600"/>
            </div>
            <span className="font-bold text-slate-700 group-hover:text-green-700">ALTA NUEVA</span>
            <span className="text-xs text-slate-400 mt-1">Cliente nuevo</span>
          </button>

          <button 
            onClick={() => setSaleType('pass')}
            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group"
          >
            <div className="bg-blue-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="h-8 w-8 text-blue-600"/>
            </div>
            <span className="font-bold text-slate-700 group-hover:text-blue-700">TRASPASO (PASS)</span>
            <span className="text-xs text-slate-400 mt-1">Cambio de Productor - Prevención Salud</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}