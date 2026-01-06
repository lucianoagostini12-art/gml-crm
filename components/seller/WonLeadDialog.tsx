"use client"

import { useState } from "react"
import { SaleWizardDialog } from "./SaleWizardDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { UserPlus, ArrowRightLeft, FileText, Trash2, UploadCloud } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WonLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: any) => void
}

export function WonLeadDialog({ open, onOpenChange, onConfirm }: WonLeadDialogProps) {
  const [saleType, setSaleType] = useState<'alta' | 'pass' | null>(null)

  // Estados para el formulario PASS
  const [passData, setPassData] = useState<{
    fullName: string,
    dni: string,
    phone: string,
    prepaga: string,
    plan: string,
    observations: string,
    files: File[]
  }>({
    fullName: "",
    dni: "",
    phone: "",
    prepaga: "Prevención Salud",
    plan: "",
    observations: "",
    files: []
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        setSaleType(null)
        setPassData({ fullName: "", dni: "", phone: "", prepaga: "Prevención Salud", plan: "", observations: "", files: [] })
      }, 300)
    }
    onOpenChange(isOpen)
  }

  // --- MANEJO DE ARCHIVOS PASS ---
  const handlePassFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setPassData(prev => ({ ...prev, files: [...prev.files, ...newFiles] }))
    }
  }

  const removePassFile = (indexToRemove: number) => {
    setPassData(prev => ({
      ...prev,
      files: prev.files.filter((_, index) => index !== indexToRemove)
    }))
  }

  // --- CONFIRMACIÓN PASS ---
  const handleConfirmPass = () => {
    if (!passData.fullName || !passData.dni) {
      return alert("Por favor, completá Nombre y DNI como mínimo.")
    }
    
    // TRADUCTOR PASS -> DB FORMAT
    onConfirm({
      type: 'pass',
      status: 'ingresado', 
      sub_state: 'auditoria_pass',
      last_update: new Date().toISOString(),

      name: passData.fullName.trim(),
      dni: passData.dni.trim(),
      phone: passData.phone.trim(),
      prepaga: passData.prepaga,
      plan: passData.plan,
      
      notes: passData.observations ? `[PASS - OBS]: ${passData.observations}` : null,
    })
    handleOpenChange(false)
  }

  // SI ELIGIÓ ALTA -> Mostramos el Wizard (ALTA NUEVA)
  if (saleType === 'alta') {
    return (
      <SaleWizardDialog 
        open={open} 
        onOpenChange={handleOpenChange} 
        onConfirm={(wizardData: any) => {
          
          const cleanNum = (val: any) => {
             if (!val || val === "") return 0;
             const parsed = parseFloat(val);
             return isNaN(parsed) ? 0 : parsed;
          };
          const cleanStr = (val: any) => (val && val.trim() !== "") ? val.trim() : null;
          const cleanDate = (val: any) => (val && val !== "") ? val : null;

          // Mapeo ALTA -> DB
          // ✅ CORREGIDO: Usamos los nombres en INGLÉS para que Supabase los acepte
          const dbData = {
            type: 'alta',
            status: 'ingresado', 
            sub_state: 'ingresado',
            last_update: new Date().toISOString(),
            
            name: cleanStr(wizardData.nombre),
            dni: cleanStr(wizardData.cuit), 
            cuit: cleanStr(wizardData.cuit),
            dob: cleanDate(wizardData.nacimiento),
            email: cleanStr(wizardData.email),
            phone: cleanStr(wizardData.celular),
            
            address_street: cleanStr(wizardData.domicilio),
            address_city: cleanStr(wizardData.localidad),
            address_zip: cleanStr(wizardData.cp),
            province: cleanStr(wizardData.provincia),
            
            // CORRECCIÓN 1: Usamos 'affiliation_type' (nombre real en DB)
            affiliation_type: cleanStr(wizardData.tipoGrupo), 
            
            // CORRECCIÓN 2: Usamos 'family_members' (nombre real en DB)
            family_members: wizardData.tipoGrupo === 'matrimonio' 
                ? [{ nombre: wizardData.matrimonioNombre, dni: wizardData.matrimonioDni, rol: 'conyuge' }, ...(wizardData.hijosData || [])] 
                : (wizardData.hijosData || []),
                
            capitas: 1 + (wizardData.tipoGrupo === 'matrimonio' ? 1 : 0) + (parseInt(wizardData.cantHijos) || 0),

            source: cleanStr(wizardData.origen), 
            
            // CORRECCIÓN 3: Usamos 'labor_condition' (nombre real en DB)
            labor_condition: cleanStr(wizardData.condicion), 
            
            // CORRECCIÓN 4: Usamos 'employer_cuit' (nombre real en DB)
            employer_cuit: cleanStr(wizardData.cuitEmpleador), 
            
            notes: `Clave Fiscal: ${wizardData.claveFiscal} | Cat: ${wizardData.catMonotributo} | Banco: ${wizardData.bancoEmisor}` + (wizardData.notes ? `\n\n[OBS]: ${wizardData.notes}` : ''),

            payment_method: cleanStr(wizardData.tipoPago), 
            cbu_card: wizardData.tipoPago === 'tarjeta' 
                ? `${wizardData.bancoEmisor || ''} - ${wizardData.numeroTarjeta} (Vto: ${wizardData.vencimientoTarjeta})`
                : `${wizardData.bancoEmisor || ''} - ${wizardData.cbuNumero}`,
            
            full_price: cleanNum(wizardData.fullPrice),
            aportes: cleanNum(wizardData.aportes),
            descuento: cleanNum(wizardData.descuento),
            total_a_pagar: cleanNum(wizardData.total_a_pagar),
          }

          onConfirm(dbData)
          handleOpenChange(false)
        }} 
      />
    )
  }

  // SI ELIGIÓ PASS -> Formulario Simple
  if (saleType === 'pass') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 font-black text-xl">
              <ArrowRightLeft className="h-6 w-6"/> Registrar Traspaso (PASS)
            </DialogTitle>
            <DialogDescription>
              Ingresá los datos del titular para gestionar el traspaso.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Nombre Completo</Label><Input value={passData.fullName} onChange={(e) => setPassData({...passData, fullName: e.target.value})}/></div>
              <div className="grid gap-2"><Label>DNI</Label><Input value={passData.dni} onChange={(e) => setPassData({...passData, dni: e.target.value})}/></div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Teléfono</Label><Input value={passData.phone} onChange={(e) => setPassData({...passData, phone: e.target.value})}/></div>
              <div className="grid gap-2"><Label>Prepaga Destino</Label>
                <Select value={passData.prepaga} onValueChange={(v) => setPassData({...passData, prepaga: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prevención Salud">Prevención Salud</SelectItem>
                    <SelectItem value="Sancor Salud">Sancor Salud</SelectItem>
                    <SelectItem value="Avalian">Avalian</SelectItem>
                    <SelectItem value="Swiss Medical">Swiss Medical</SelectItem>
                    <SelectItem value="Galeno">Galeno</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div className="grid gap-2"><Label>Plan</Label><Input value={passData.plan} onChange={(e) => setPassData({...passData, plan: e.target.value})}/></div>
            
            <div className="grid gap-2">
                <Label>Observaciones</Label>
                <Textarea 
                    className="resize-none h-20 bg-yellow-50/50 border-yellow-200 focus:ring-yellow-400" 
                    placeholder="Detalles importantes para administración..."
                    value={passData.observations} 
                    onChange={(e) => setPassData({...passData, observations: e.target.value})}
                />
            </div>
            
            <div className="grid gap-2 border-t pt-4 mt-2">
                <Label className="flex items-center gap-2"><UploadCloud size={16}/> Adjuntar Documentación</Label>
                
                <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition relative">
                    <p className="text-sm text-slate-500 font-medium mb-1">Click para subir archivos</p>
                    <Input 
                        type="file" 
                        multiple 
                        className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                        onChange={handlePassFileSelect}
                    />
                </div>

                {passData.files.length > 0 && (
                    <div className="space-y-2 mt-2">
                        {passData.files.map((file, index) => (
                            <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                                <div className="flex items-center gap-2 overflow-hidden">
                                    <FileText size={14} className="text-blue-500 shrink-0"/>
                                    <span className="truncate max-w-[200px] text-slate-700 font-medium">{file.name}</span>
                                </div>
                                <Button 
                                    size="icon" 
                                    variant="ghost" 
                                    className="h-6 w-6 text-slate-400 hover:text-red-500"
                                    onClick={() => removePassFile(index)}
                                >
                                    <Trash2 size={14}/>
                                </Button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
          </div>
          
          <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setSaleType(null)}>Volver</Button>
              <Button onClick={handleConfirmPass} className="bg-blue-600 hover:bg-blue-700 text-white font-bold">Confirmar PASS</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader><DialogTitle className="text-center">¡Venta Cerrada! 🚀</DialogTitle><DialogDescription className="text-center">Seleccioná el tipo de gestión.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          <button onClick={() => setSaleType('alta')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"><UserPlus className="h-8 w-8 text-green-600 mb-2"/><span className="font-bold text-slate-700">ALTA NUEVA</span></button>
          <button onClick={() => setSaleType('pass')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"><ArrowRightLeft className="h-8 w-8 text-blue-600 mb-2"/><span className="font-bold text-slate-700">PASS</span></button>
        </div>
      </DialogContent>
    </Dialog>
  )
}