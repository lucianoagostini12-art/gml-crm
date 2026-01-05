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
    
    // TRADUCTOR PASS: Mapeamos los datos manuales a las columnas de Supabase
    onConfirm({
      type: 'pass',
      name: passData.fullName,
      dni: passData.dni,
      phone: passData.phone,
      prepaga: passData.prepaga,
      plan: passData.plan,
      notes: passData.observations, // Se guarda en 'notes' para historial
      status: 'ingresado',          // IMPORTANTE: Para que aparezca en Ops
      sub_state: 'auditoria_pass',
      files: passData.files         // Archivos crudos para el uploader
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
          
          // --- FUNCIONES DE LIMPIEZA (EVITAN ERROR 400) ---
          // Convierte "" en 0 para campos numéricos
          const cleanNumber = (val: any) => (val && val !== "" && !isNaN(Number(val))) ? parseFloat(val) : 0;
          // Convierte "" en null para campos de fecha
          const cleanDate = (val: any) => (val && val !== "") ? val : null;

          // --- EL GRAN TRADUCTOR ---
          // Aquí convertimos el formato del Wizard (JS) al formato de Supabase (SQL)
          
          const dbData = {
            // Campos obligatorios de sistema
            type: 'alta',
            status: 'ingresado', // Entra en la primera columna de Ops
            sub_state: 'ingresado',
            
            // Datos Personales
            name: wizardData.nombre,
            dni: wizardData.cuit, 
            cuit: wizardData.cuit,
            dob: cleanDate(wizardData.nacimiento), // SANITIZADO
            email: wizardData.email,
            phone: wizardData.celular,
            
            // Dirección
            address_street: wizardData.domicilio,
            address_city: wizardData.localidad,
            address_zip: wizardData.cp,
            province: wizardData.provincia,
            
            // Datos Familiares
            affiliation_type: wizardData.tipoGrupo, 
            family_members: wizardData.tipoGrupo === 'matrimonio' ? { c: wizardData.matrimonioNombre, d: wizardData.matrimonioDni } : null,
            hijos: wizardData.hijosData, // Array de hijos
            capitas: 1 + (wizardData.tipoGrupo === 'matrimonio' ? 1 : 0) + (parseInt(wizardData.cantHijos) || 0),

            // Datos Laborales (Nombres de columna corregidos según tu SQL)
            source: wizardData.origen, 
            labor_condition: wizardData.condicion, 
            employer_cuit: wizardData.cuitEmpleador,
            
            // Nota: catMonotributo y claveFiscal van a notas
            notes: `Clave Fiscal: ${wizardData.claveFiscal} | Cat: ${wizardData.catMonotributo} | Banco: ${wizardData.bancoEmisor}`,

            // Datos de Pago
            payment_method: wizardData.tipoPago, 
            // Concatenamos Banco - Numero para el campo cbu_card
            cbu_card: wizardData.tipoPago === 'tarjeta' 
                ? `${wizardData.bancoEmisor || ''} - ${wizardData.numeroTarjeta} (Vto: ${wizardData.vencimientoTarjeta})`
                : `${wizardData.bancoEmisor || ''} - ${wizardData.cbuNumero}`,
            
            // Valores Económicos (SANITIZADOS)
            full_price: cleanNumber(wizardData.fullPrice),
            aportes: cleanNumber(wizardData.aportes),
            descuento: cleanNumber(wizardData.descuento),
            price: cleanNumber(wizardData.aPagar), // Mapeamos 'A Pagar' a 'price'
            
            // Archivos (Se pasan aparte para que KanbanBoard los suba)
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
            {/* DATOS PERSONALES */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="fullname" className="font-bold flex gap-2 items-center"><User size={14}/> Nombre Completo</Label>
                <Input 
                  id="fullname" 
                  placeholder="Ej: Juan Perez" 
                  value={passData.fullName}
                  onChange={(e) => setPassData({...passData, fullName: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dni" className="font-bold flex gap-2 items-center"><FileText size={14}/> DNI / CUIL</Label>
                <Input 
                  id="dni" 
                  placeholder="Sin puntos" 
                  value={passData.dni}
                  onChange={(e) => setPassData({...passData, dni: e.target.value})}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="phone" className="font-bold flex gap-2 items-center"><Phone size={14}/> Teléfono</Label>
                <Input 
                  id="phone" 
                  placeholder="11 1234 5678" 
                  value={passData.phone}
                  onChange={(e) => setPassData({...passData, phone: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="prepaga" className="font-bold flex gap-2 items-center"><CreditCard size={14}/> Prepaga Destino</Label>
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

            <div className="grid gap-2">
               <Label htmlFor="plan" className="font-bold">Plan Elegido</Label>
               <Input 
                  id="plan" 
                  placeholder="Ej: A2, 210, 4000..." 
                  value={passData.plan}
                  onChange={(e) => setPassData({...passData, plan: e.target.value})}
                />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="obs" className="font-bold">Observaciones</Label>
              <Textarea 
                id="obs" 
                placeholder="Detalles adicionales para administración..." 
                className="resize-none h-20"
                value={passData.observations}
                onChange={(e) => setPassData({...passData, observations: e.target.value})}
              />
            </div>

            <div className="grid gap-2">
              <Label className="font-bold">Adjuntar Documentación (DNI, Recibos)</Label>
              <div className="border-2 border-dashed border-slate-300 rounded-lg p-6 flex flex-col items-center justify-center text-center hover:bg-slate-50 transition-colors cursor-pointer relative bg-slate-50/50">
                <input 
                  type="file" 
                  multiple 
                  className="absolute inset-0 opacity-0 cursor-pointer"
                  onChange={(e) => setPassData({...passData, files: e.target.files})}
                />
                <UploadCloud className="h-8 w-8 text-blue-500 mb-2"/>
                <p className="text-sm text-slate-600 font-medium">
                  {passData.files && passData.files.length > 0 
                    ? `✅ ${passData.files.length} archivos listos` 
                    : "Click para subir archivos"}
                </p>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => setSaleType(null)}>Volver</Button>
            <Button className="bg-blue-600 hover:bg-blue-700 font-bold text-white" onClick={handleConfirmPass}>
              CONFIRMAR PASS 🚀
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // PANTALLA INICIAL
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="text-center text-xl font-black text-slate-800 dark:text-white">¡Venta Cerrada! 🚀</DialogTitle>
          <DialogDescription className="text-center text-slate-500">
            Seleccioná el tipo de gestión para continuar.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4 py-6">
          <button 
            onClick={() => setSaleType('alta')}
            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all group bg-white"
          >
            <div className="bg-green-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <UserPlus className="h-8 w-8 text-green-600"/>
            </div>
            <span className="font-bold text-slate-700 group-hover:text-green-700">ALTA NUEVA</span>
            <span className="text-xs text-slate-400 mt-1">Cliente nuevo</span>
          </button>

          <button 
            onClick={() => setSaleType('pass')}
            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all group bg-white"
          >
            <div className="bg-blue-100 p-4 rounded-full mb-3 group-hover:scale-110 transition-transform">
              <ArrowRightLeft className="h-8 w-8 text-blue-600"/>
            </div>
            <span className="font-bold text-slate-700 group-hover:text-blue-700">TRASPASO (PASS)</span>
            <span className="text-xs text-slate-400 mt-1">Cambio de productor</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}