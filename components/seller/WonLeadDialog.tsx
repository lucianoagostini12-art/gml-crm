"use client"

import { useState } from "react"
import { SaleWizardDialog } from "./SaleWizardDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { UserPlus, ArrowRightLeft, UploadCloud, CreditCard, User, Phone, FileText } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
    dni: "",
    phone: "",
    prepaga: "",
    plan: "",
    observations: "",
    files: null as FileList | null
  })

  // Reiniciar estado al cerrar
  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        setSaleType(null)
        setPassData({ fullName: "", dni: "", phone: "", prepaga: "", plan: "", observations: "", files: null })
      }, 300)
    }
    onOpenChange(isOpen)
  }

  const handleConfirmPass = () => {
    if (!passData.fullName || !passData.dni || !passData.prepaga) {
      return alert("Por favor, completá Nombre, DNI y Prepaga como mínimo.")
    }
    
    // TRADUCTOR PASS
    onConfirm({
      type: 'pass',
      name: passData.fullName,
      dni: passData.dni,
      phone: passData.phone,
      prepaga: passData.prepaga,
      plan: passData.plan,
      notes: passData.observations,
      status: 'ingresado',          
      sub_state: 'auditoria_pass',
      files: passData.files         
    })
    handleOpenChange(false)
  }

  // SI ELIGIÓ ALTA -> Mostramos el Wizard
  if (saleType === 'alta') {
    return (
      <SaleWizardDialog 
        open={open} 
        onOpenChange={handleOpenChange} 
        onConfirm={(wizardData: any) => {
          
          // --- 1. FUNCIONES DE LIMPIEZA (ESTO EVITA EL ERROR 400) ---
          // Convierte "" en 0 para campos numéricos
          const cleanNum = (val: any) => {
             if (!val || val === "") return 0;
             const parsed = parseFloat(val);
             return isNaN(parsed) ? 0 : parsed;
          };
          
          // Convierte "" en null para campos de fecha
          const cleanDate = (val: any) => (val && val !== "") ? val : null;

          // --- 2. EL GRAN TRADUCTOR (MAPEO EXACTO A TU BASE DE DATOS) ---
          const dbData = {
            // Campos de sistema
            type: 'alta',
            status: 'ingresado', // Clave para que aparezca en Ops
            sub_state: 'ingresado',
            last_update: new Date().toISOString(),
            
            // Datos Personales
            name: wizardData.nombre,
            dni: wizardData.cuit, 
            cuit: wizardData.cuit,
            dob: cleanDate(wizardData.nacimiento), // FECHA LIMPIA
            email: wizardData.email,
            phone: wizardData.celular,
            
            // Dirección
            address_street: wizardData.domicilio,
            address_city: wizardData.localidad,
            address_zip: wizardData.cp,
            province: wizardData.provincia,
            
            // Datos Familiares (Usando tus nombres de columna reales)
            affiliation_type: wizardData.tipoGrupo, 
            family_members: wizardData.tipoGrupo === 'matrimonio' ? { c: wizardData.matrimonioNombre, d: wizardData.matrimonioDni } : null,
            hijos: wizardData.hijosData, 
            capitas: 1 + (wizardData.tipoGrupo === 'matrimonio' ? 1 : 0) + (parseInt(wizardData.cantHijos) || 0),

            // Datos Laborales
            source: wizardData.origen, 
            labor_condition: wizardData.condicion, 
            employer_cuit: wizardData.cuitEmpleador,
            
            // Notas concatenadas
            notes: `Clave Fiscal: ${wizardData.claveFiscal} | Cat: ${wizardData.catMonotributo} | Banco: ${wizardData.bancoEmisor}`,

            // Datos de Pago
            payment_method: wizardData.tipoPago, 
            cbu_card: wizardData.tipoPago === 'tarjeta' 
                ? `${wizardData.bancoEmisor || ''} - ${wizardData.numeroTarjeta} (Vto: ${wizardData.vencimientoTarjeta})`
                : `${wizardData.bancoEmisor || ''} - ${wizardData.cbuNumero}`,
            
            // Valores Económicos (NÚMEROS LIMPIOS)
            full_price: cleanNum(wizardData.fullPrice),
            aportes: cleanNum(wizardData.aportes),
            descuento: cleanNum(wizardData.descuento),
            price: cleanNum(wizardData.aPagar), 
            
            // Archivos (Se pasan aparte)
            files: wizardData.archivos
          }

          onConfirm(dbData)
          handleOpenChange(false)
        }} 
      />
    )
  }

  // SI ELIGIÓ PASS -> Formulario
  if (saleType === 'pass') {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 font-black text-xl">
              <ArrowRightLeft className="h-6 w-6"/> Registrar Traspaso (PASS)
            </DialogTitle>
            <DialogDescription>
              Ingresá los datos del titular para la auditoría de traspaso.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre Completo</Label>
                <Input value={passData.fullName} onChange={(e) => setPassData({...passData, fullName: e.target.value})}/>
              </div>
              <div className="grid gap-2">
                <Label>DNI</Label>
                <Input value={passData.dni} onChange={(e) => setPassData({...passData, dni: e.target.value})}/>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={passData.phone} onChange={(e) => setPassData({...passData, phone: e.target.value})}/>
              </div>
              <div className="grid gap-2">
                <Label>Prepaga Destino</Label>
                <Select onValueChange={(v) => setPassData({...passData, prepaga: v})}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Prevención Salud">Prevención Salud</SelectItem>
                    <SelectItem value="Sancor Salud">Sancor Salud</SelectItem>
                    <SelectItem value="Avalian">Avalian</SelectItem>
                    <SelectItem value="Swiss Medical">Swiss Medical</SelectItem>
                    <SelectItem value="Galeno">Galeno</SelectItem>
                    <SelectItem value="Omint">Omint</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2"><Label>Plan</Label><Input value={passData.plan} onChange={(e) => setPassData({...passData, plan: e.target.value})}/></div>
            <div className="grid gap-2"><Label>Observaciones</Label><Textarea className="resize-none h-20" value={passData.observations} onChange={(e) => setPassData({...passData, observations: e.target.value})}/></div>
            <div className="grid gap-2"><Label>Adjuntar Archivos</Label><Input type="file" multiple onChange={(e) => setPassData({...passData, files: e.target.files})}/></div>
          </div>
          <DialogFooter><Button variant="ghost" onClick={() => setSaleType(null)}>Volver</Button><Button onClick={handleConfirmPass}>Confirmar</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader><DialogTitle className="text-center">¡Venta Cerrada! 🚀</DialogTitle><DialogDescription className="text-center">Seleccioná el tipo de gestión.</DialogDescription></DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          <button onClick={() => setSaleType('alta')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group bg-white">
            <div className="bg-green-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform"><UserPlus className="h-8 w-8 text-green-600"/></div>
            <span className="font-bold text-slate-700">ALTA NUEVA</span>
          </button>
          <button onClick={() => setSaleType('pass')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group bg-white">
            <div className="bg-blue-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform"><ArrowRightLeft className="h-8 w-8 text-blue-600"/></div>
            <span className="font-bold text-slate-700">TRASPASO</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}