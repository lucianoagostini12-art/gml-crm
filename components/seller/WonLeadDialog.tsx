"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase"
import { SaleWizardDialog } from "./SaleWizardDialog"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { UserPlus, ArrowRightLeft, FileText, Trash2, UploadCloud, Loader2 } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface WonLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: any) => void
  leadId: string // ✅ necesitamos el leadId para subir a Storage/lead_documents
}

export function WonLeadDialog({ open, onOpenChange, onConfirm, leadId }: WonLeadDialogProps) {
  const supabase = createClient()

  const [saleType, setSaleType] = useState<"alta" | "pass" | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [passData, setPassData] = useState<{
    fullName: string
    dni: string
    phone: string
    prepaga: string
    plan: string
    observations: string
    files: File[]
  }>({
    fullName: "",
    dni: "",
    phone: "",
    prepaga: "Prevención Salud",
    plan: "",
    observations: "",
    files: [],
  })

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setTimeout(() => {
        setSaleType(null)
        setPassData({
          fullName: "",
          dni: "",
          phone: "",
          prepaga: "Prevención Salud",
          plan: "",
          observations: "",
          files: [],
        })
      }, 300)
    }
    onOpenChange(isOpen)
  }

  // --- MANEJO DE ARCHIVOS PASS ---
  const handlePassFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files)
      setPassData((prev) => ({ ...prev, files: [...prev.files, ...newFiles] }))
    }
  }

  const removePassFile = (indexToRemove: number) => {
    setPassData((prev) => ({
      ...prev,
      files: prev.files.filter((_, index) => index !== indexToRemove),
    }))
  }

  // --- LIMPIEZAS ---
  const cleanNum = (val: any) => {
    if (val === null || val === undefined || val === "") return 0
    const parsed = parseFloat(val)
    return isNaN(parsed) ? 0 : parsed
  }

  const cleanStr = (val: any) => {
    if (!val || typeof val !== "string") return null
    const trimmed = val.trim()
    return trimmed === "" ? null : trimmed
  }

  const cleanDigits = (val: any) => {
    if (!val) return null
    const str = val.toString().replace(/[^0-9]/g, "")
    return str === "" ? null : str
  }

  const cleanDate = (val: any) => (val && val !== "" ? val : null)

  // ✅ evita romper visor de notas (OpsModal parsea con '|')
  const cleanTextForNotes = (val: string) => {
    if (!val) return ""
    return val.replace(/\|/g, "-")
  }

  // ✅ mapeo tipo afiliación a lo que usa OpsModal
  const mapTipoAfiliacion = (tipoGrupoRaw: any) => {
    const t = String(tipoGrupoRaw || "").toLowerCase()
    if (t === "matrimonio" || t.includes("matri")) return "Matrimonio / Grupo"
    return "Individual"
  }

  // ✅ método de pago (OpsModal: "CBU" | "Tarjeta")
  const mapMetodoPago = (tipoPagoRaw: any) => {
    const t = String(tipoPagoRaw || "").toLowerCase()
    if (t === "tarjeta") return "Tarjeta"
    return "CBU"
  }

  // ✅ UPLOAD REAL (igual que OpsModal): Storage + lead_documents
  const uploadFilesToLeadDocuments = async (files: File[], uploadedBy: string) => {
    if (!files || files.length === 0) return
    if (!leadId) throw new Error("Falta leadId para subir archivos")

    const bucket = "lead-documents"

    for (const file of Array.from(files)) {
      const safeName = file.name.replace(/[^\w.\-]+/g, "_")
      const path = `${leadId}/${Date.now()}_${safeName}`

      const { error: upErr } = await supabase.storage.from(bucket).upload(path, file)
      if (upErr) throw upErr

      const { error: insErr } = await supabase.from("lead_documents").insert({
        lead_id: leadId,
        type: file.type.includes("image") ? "IMG" : "PDF",
        file_path: path,
        name: file.name,
        uploaded_at: new Date().toISOString(),
        status: "uploaded",
        uploaded_by: uploadedBy || "Seller",
      })
      if (insErr) throw insErr
    }
  }

  // --- CONFIRMACIÓN PASS ---
  const handleConfirmPass = async () => {
    if (!passData.fullName || !passData.dni) {
      return alert("Por favor, completá Nombre y DNI como mínimo.")
    }

    try {
      setIsUploading(true)

      const obsLimpia = cleanTextForNotes(passData.observations)

      // ✅ subimos archivos reales
      await uploadFilesToLeadDocuments(passData.files, "Seller")

      // ✅ ALINEADO A OPSMODAL
      // ✅ FIX QUIRÚRGICO: evitar pisar el teléfono con null cuando viene vacío
      const passPhoneDigits = cleanDigits(passData.phone)

      const dbData = {
        type: "pass",
        source: "pass", // ✅ clave para que OpsModal lo detecte como PASS
        status: "ingresado",
        sub_state: "auditoria_pass",
        last_update: new Date().toISOString(),

        name: cleanStr(passData.fullName),
        dni: cleanDigits(passData.dni),
        ...(passPhoneDigits ? { phone: passPhoneDigits } : {}),

        prepaga: cleanStr(passData.prepaga),
        plan: cleanStr(passData.plan),

        // notas sin pipes
        notes: obsLimpia ? `[PASS - OBS]: ${obsLimpia}` : null,
      }

      onConfirm(dbData)
      handleOpenChange(false)
    } catch (e: any) {
      console.error("Error subiendo PASS:", e)
      alert(`Error al subir documentación: ${e?.message || "desconocido"}`)
    } finally {
      setIsUploading(false)
    }
  }

  // --- ALTA (Wizard) ---
  if (saleType === "alta") {
    return (
      <SaleWizardDialog
        leadId={leadId}
        open={open}
        onOpenChange={handleOpenChange}
        onConfirm={async (wizardData: any) => {
          try {
            setIsUploading(true)

            const obsVentaLimpia = cleanTextForNotes(wizardData.obs_venta)

            // ✅ FIX QUIRÚRGICO: evitar pisar el teléfono con null cuando viene vacío
            const phoneDigits = cleanDigits(wizardData.celular)

            // ✅ subimos archivos reales (wizardData.archivos es File[])
            await uploadFilesToLeadDocuments((wizardData.archivos || []) as File[], "Seller")

            // ✅ Construimos HIJOS como usa OpsModal (array de {nombre, dni})
            const hijos: any[] = []

            // cónyuge si corresponde
            if (String(wizardData.tipoGrupo || "") === "matrimonio") {
              const conyNombre = cleanStr(wizardData.matrimonioNombre)
              const conyDni = cleanDigits(wizardData.matrimonioDni)
              if (conyNombre || conyDni) hijos.push({ nombre: conyNombre || "", dni: conyDni || "" })
            }

            // hijosData
            if (Array.isArray(wizardData.hijosData)) {
              wizardData.hijosData.forEach((h: any) => {
                const hn = cleanStr(h?.nombre)
                const hd = cleanDigits(h?.dni)
                if (hn || hd) hijos.push({ nombre: hn || "", dni: hd || "" })
              })
            }

            // ✅ nota “laboral” alineada a OpsModal
            const claveFiscal = cleanStr(wizardData.claveFiscal)
            const catMono = cleanStr(wizardData.catMonotributo)
            const banco = cleanStr(wizardData.bancoEmisor)

            // ✅ NUEVO (quirúrgico): Guardar condición fiscal (empleado/monotributo) y categoría en columnas reales
            // - labor_condition: "empleado" | "monotributo"
            // - monotributo_category: "A".."K" (solo si es monotributo)
            const laborConditionRaw = cleanStr(wizardData.condicion)
            const laborCondition = laborConditionRaw ? laborConditionRaw.toLowerCase() : null

            const notesBase =
              `Clave Fiscal: ${claveFiscal || "-"} - Cat: ${catMono || "-"} - Banco: ${banco || "-"}` +
              (obsVentaLimpia ? `\n\n[OBS VENTA]: ${obsVentaLimpia}` : "")

            // ✅ ALINEADO A OPSMODAL
            const dbData = {
              type: "alta",
              status: "ingresado",
              sub_state: "ingresado",
              last_update: new Date().toISOString(),

              // titular
              name: cleanStr(wizardData.nombre),
              dni: cleanDigits(wizardData.cuit), // en tu wizard “cuit” se usa también como documento
              cuit: cleanDigits(wizardData.cuit),
              dob: cleanDate(wizardData.nacimiento),
              email: cleanStr(wizardData.email),
              ...(phoneDigits ? { phone: phoneDigits } : {}),

              // domicilio (OpsModal usa address_*)
              address_street: cleanStr(wizardData.domicilio),
              address_city: cleanStr(wizardData.localidad),
              address_zip: cleanStr(wizardData.cp),
              province: cleanStr(wizardData.provincia),

              // producto
              prepaga: cleanStr(wizardData.prepaga),
              plan: cleanStr(wizardData.plan),

              // ✅ grupo familiar (OpsModal)
              tipo_afiliacion: mapTipoAfiliacion(wizardData.tipoGrupo),
              hijos: hijos, // ✅ OpsModal edita localOp.hijos
              capitas:
                1 +
                (String(wizardData.tipoGrupo || "") === "matrimonio" ? 1 : 0) +
                (parseInt(wizardData.cantHijos) || 0),

              // ✅ laboral (OpsModal)
              condicion_laboral: String(wizardData.origen || "") === "voluntario" ? "Voluntario" : "Obligatorio",
              cuit_empleador: cleanDigits(wizardData.cuitEmpleador),
              clave_fiscal: cleanStr(wizardData.claveFiscal),

              // ✅ condición fiscal (SaleWizardDialog) -> columnas reales en Supabase
              ...(laborCondition ? { labor_condition: laborCondition } : {}),
              ...(laborCondition === "monotributo" && catMono ? { monotributo_category: catMono } : {}),

              // ✅ pago (OpsModal)
              metodo_pago: mapMetodoPago(wizardData.tipoPago),
              cbu_tarjeta:
                String(wizardData.tipoPago || "") === "tarjeta"
                  ? `${wizardData.bancoEmisor || ""} - ${wizardData.numeroTarjeta} (Vto: ${wizardData.vencimientoTarjeta})`
                  : `${wizardData.bancoEmisor || ""} - ${wizardData.cbuNumero}`,

              // ✅ montos (OpsModal)
              full_price: cleanNum(wizardData.fullPrice),
              aportes: cleanNum(wizardData.aportes),
              descuento: cleanNum(wizardData.descuento),
              total_a_pagar: cleanNum(wizardData.total_a_pagar),

              // ✅ notas (sin pipes)
              notes: cleanTextForNotes(notesBase),
            }

            onConfirm(dbData)
            handleOpenChange(false)
          } catch (e: any) {
            console.error("Error subiendo ALTA:", e)
            alert(`Error al subir documentación: ${e?.message || "desconocido"}`)
          } finally {
            setIsUploading(false)
          }
        }}
      />
    )
  }

  // --- PASS UI ---
  if (saleType === "pass") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="sm:max-w-[600px] bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-blue-600 font-black text-xl">
              <ArrowRightLeft className="h-6 w-6" /> Registrar Traspaso (PASS)
            </DialogTitle>
            <DialogDescription>Ingresá los datos del titular para gestionar el traspaso.</DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4 max-h-[60vh] overflow-y-auto px-1">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nombre Completo</Label>
                <Input value={passData.fullName} onChange={(e) => setPassData({ ...passData, fullName: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>DNI</Label>
                <Input value={passData.dni} onChange={(e) => setPassData({ ...passData, dni: e.target.value })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Teléfono</Label>
                <Input value={passData.phone} onChange={(e) => setPassData({ ...passData, phone: e.target.value })} />
              </div>

              <div className="grid gap-2">
                <Label>Prepaga Destino</Label>
                <Select value={passData.prepaga} onValueChange={(v) => setPassData({ ...passData, prepaga: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
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

            <div className="grid gap-2">
              <Label>Plan</Label>
              <Input value={passData.plan} onChange={(e) => setPassData({ ...passData, plan: e.target.value })} />
            </div>

            <div className="grid gap-2">
              <Label>Observaciones</Label>
              <Textarea
                className="resize-none h-20 bg-yellow-50/50 border-yellow-200 focus:ring-yellow-400"
                placeholder="Detalles importantes para administración..."
                value={passData.observations}
                onChange={(e) => setPassData({ ...passData, observations: e.target.value })}
              />
            </div>

            <div className="grid gap-2 border-t pt-4 mt-2">
              <Label className="flex items-center gap-2">
                <UploadCloud size={16} /> Adjuntar Documentación
              </Label>

              <div className="border-2 border-dashed border-slate-200 rounded-lg p-6 text-center hover:bg-slate-50 transition relative">
                <p className="text-sm text-slate-500 font-medium mb-1">Click para subir archivos</p>
                <Input type="file" multiple className="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onChange={handlePassFileSelect} />
              </div>

              {passData.files.length > 0 && (
                <div className="space-y-2 mt-2">
                  {passData.files.map((file, index) => (
                    <div key={index} className="flex items-center justify-between bg-slate-50 p-2 rounded border border-slate-200 text-sm">
                      <div className="flex items-center gap-2 overflow-hidden">
                        <FileText size={14} className="text-blue-500 shrink-0" />
                        <span className="truncate max-w-[200px] text-slate-700 font-medium">{file.name}</span>
                      </div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 text-slate-400 hover:text-red-500"
                        onClick={() => removePassFile(index)}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setSaleType(null)} disabled={isUploading}>
              Volver
            </Button>
            <Button onClick={handleConfirmPass} className="bg-blue-600 hover:bg-blue-700 text-white font-bold" disabled={isUploading}>
              {isUploading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Subiendo...
                </>
              ) : (
                "Confirmar PASS"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

  // --- selector de tipo ---
  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle className="text-center">¡Venta Cerrada! 🚀</DialogTitle>
          <DialogDescription className="text-center">Seleccioná el tipo de gestión.</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4 py-6">
          <button
            onClick={() => setSaleType("alta")}
            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-green-500 hover:bg-green-50 transition-all"
          >
            <UserPlus className="h-8 w-8 text-green-600 mb-2" />
            <span className="font-bold text-slate-700">ALTA NUEVA</span>
          </button>
          <button
            onClick={() => setSaleType("pass")}
            className="flex flex-col items-center justify-center p-6 border-2 border-slate-100 rounded-xl hover:border-blue-500 hover:bg-blue-50 transition-all"
          >
            <ArrowRightLeft className="h-8 w-8 text-blue-600 mb-2" />
            <span className="font-bold text-slate-700">PASS</span>
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
