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
          
          // --- FUNCIONES DE LIMPIEZA (EL SECRETO DEL ÉXITO) ---
          
          // 1. Números: "" -> 0
          const cleanNum = (val: any) => {
             if (!val || val === "") return 0;
             const parsed = parseFloat(val);
             return isNaN(parsed) ? 0 : parsed;
          };
          
          // 2. Fechas: "" -> null
          const cleanDate = (val: any) => (val && val !== "") ? val : null;

          // 3. Textos: "" -> null (CRÍTICO PARA EVITAR ERROR 400 EN CUIT/DNI)
          const cleanStr = (val: any) => (val && val.trim() !== "") ? val.trim() : null;

          // --- EL GRAN TRADUCTOR ---
          const dbData = {
            type: 'alta',
            status: 'ingresado',
            sub_state: 'ingresado',
            last_update: new Date().toISOString(),
            
            // Datos Personales (Sanitizados)
            name: cleanStr(wizardData.nombre),
            dni: cleanStr(wizardData.cuit), 
            cuit: cleanStr(wizardData.cuit),
            dob: cleanDate(wizardData.nacimiento),
            email: cleanStr(wizardData.email),
            phone: cleanStr(wizardData.celular),
            
            // Dirección
            address_street: cleanStr(wizardData.domicilio),
            address_city: cleanStr(wizardData.localidad),
            address_zip: cleanStr(wizardData.cp),
            province: cleanStr(wizardData.provincia),
            
            // Datos Familiares
            affiliation_type: cleanStr(wizardData.tipoGrupo), 
            family_members: wizardData.tipoGrupo === 'matrimonio' ? { c: wizardData.matrimonioNombre, d: wizardData.matrimonioDni } : null,
            hijos: wizardData.hijosData, 
            capitas: 1 + (wizardData.tipoGrupo === 'matrimonio' ? 1 : 0) + (parseInt(wizardData.cantHijos) || 0),

            // Datos Laborales (Sanitizados para evitar conflictos de comillas vacías)
            source: cleanStr(wizardData.origen), 
            labor_condition: cleanStr(wizardData.condicion), 
            employer_cuit: cleanStr(wizardData.cuitEmpleador),
            
            notes: `Clave Fiscal: ${wizardData.claveFiscal} | Cat: ${wizardData.catMonotributo} | Banco: ${wizardData.bancoEmisor}`,

            // Datos de Pago
            payment_method: cleanStr(wizardData.tipoPago), 
            cbu_card: wizardData.tipoPago === 'tarjeta' 
                ? `${wizardData.bancoEmisor || ''} - ${wizardData.numeroTarjeta} (Vto: ${wizardData.vencimientoTarjeta})`
                : `${wizardData.bancoEmisor || ''} - ${wizardData.cbuNumero}`,
            
            // Valores Económicos
            full_price: cleanNum(wizardData.fullPrice),
            aportes: cleanNum(wizardData.aportes),
            descuento: cleanNum(wizardData.descuento),
            price: cleanNum(wizardData.aPagar), 
            
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
              Ingresá los datos del titular.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Nombre Completo</Label><Input value={passData.fullName} onChange={(e) => setPassData({...passData, fullName: e.target.value})}/></div>
              <div className="grid gap-2"><Label>DNI</Label><Input value={passData.dni} onChange={(e) => setPassData({...passData, dni: e.target.value})}/></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Teléfono</Label><Input value={passData.phone} onChange={(e) => setPassData({...passData, phone: e.target.value})}/></div>
              <div className="grid gap-2"><Label>Prepaga Destino</Label>
                <Select onValueChange={(v) => setPassData({...passData, prepaga: v})}><SelectTrigger><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                  <SelectContent><SelectItem value="Prevención Salud">Prevención Salud</SelectItem><SelectItem value="Sancor Salud">Sancor Salud</SelectItem><SelectItem value="Avalian">Avalian</SelectItem><SelectItem value="Swiss Medical">Swiss Medical</SelectItem><SelectItem value="Galeno">Galeno</SelectItem><SelectItem value="Omint">Omint</SelectItem></SelectContent>
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
          <button onClick={() => setSaleType('alta')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"><UserPlus className="h-8 w-8 text-green-600 mb-2"/><span className="font-bold text-slate-700">ALTA NUEVA</span></button>
          <button onClick={() => setSaleType('pass')} className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"><ArrowRightLeft className="h-8 w-8 text-blue-600 mb-2"/><span className="font-bold text-slate-700">TRASPASO</span></button>
        </div>
      </DialogContent>
    </Dialog>
  )
}