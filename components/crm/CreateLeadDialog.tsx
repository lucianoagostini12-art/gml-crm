"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertCircle, Loader2, CheckCircle2 } from "lucide-react"
// 1. CORRECCIÓN: Importamos la función constructora
import { createClient } from "@/lib/supabase"

interface CreateLeadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: (data: any) => void
}

export function CreateLeadDialog({ open, onOpenChange, onConfirm }: CreateLeadDialogProps) {
  // 2. CORRECCIÓN: Inicializamos el cliente de Supabase
  const supabase = createClient()

  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [source, setSource] = useState("Llamador")
  const [prepaga, setPrepaga] = useState("DoctoRed")
  
  const [duplicateError, setDuplicateError] = useState<string | null>(null)
  const [isChecking, setIsChecking] = useState(false)
  const [isSafe, setIsSafe] = useState(false)

  useEffect(() => {
      if (open) {
          setName("")
          setPhone("")
          setDuplicateError(null)
          setIsChecking(false)
          setIsSafe(false)
      }
  }, [open])

  useEffect(() => {
      const checkDuplicate = async () => {
          const inputClean = phone.replace(/\D/g, '') // Solo números
          if (inputClean.length < 6) {
              setDuplicateError(null)
              setIsSafe(false)
              return 
          }
          
          setIsChecking(true)
          setDuplicateError(null)
          setIsSafe(false)

          // TRAEMOS TODOS LOS LEADS (Solo id, phone, agent, status para ser rápido)
          const { data } = await supabase.from('leads').select('phone, agent_name, status')
          
          if (data) {
              // Buscamos coincidencia exacta de los últimos 6 dígitos (evita prefijos 0, 15, +54)
              const match = data.find(lead => {
                  const dbPhone = lead.phone.replace(/\D/g, '')
                  return dbPhone.includes(inputClean) || inputClean.includes(dbPhone)
              })

              if (match) {
                  setDuplicateError(`⚠️ ¡ALERTA! Ya existe con ${match.agent_name} (${match.status.toUpperCase()}).`)
                  setIsSafe(false)
              } else {
                  setDuplicateError(null)
                  setIsSafe(true)
              }
          }
          setIsChecking(false)
      }

      const timeoutId = setTimeout(() => {
          if (phone) checkDuplicate()
      }, 600)

      return () => clearTimeout(timeoutId)
  }, [phone])

  const handleSubmit = () => {
    if (name && phone && !duplicateError) {
      onConfirm({ name, phone, source, prepaga })
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px] bg-white dark:bg-[#18191A] border-slate-200 dark:border-slate-800">
        <DialogHeader>
          <DialogTitle className="dark:text-white">Nuevo Dato</DialogTitle>
          <DialogDescription className="dark:text-slate-400">
            Ingresá los datos. El sistema verifica duplicados automáticamente.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="name" className="dark:text-slate-200">Nombre y Apellido</Label>
            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Juan Perez" className="dark:bg-[#242526] dark:border-slate-700 dark:text-white" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone" className="dark:text-slate-200">Teléfono</Label>
            <div className="relative">
                <Input 
                    id="phone" 
                    value={phone} 
                    onChange={(e) => setPhone(e.target.value)} 
                    placeholder="Ej: 2235559999" 
                    className={`dark:bg-[#242526] dark:border-slate-700 dark:text-white pr-10 ${duplicateError ? "border-red-500 bg-red-50 dark:bg-red-900/20" : isSafe ? "border-green-500 bg-green-50 dark:bg-green-900/20" : ""}`}
                />
                <div className="absolute right-3 top-2.5">
                    {isChecking && <Loader2 className="h-4 w-4 animate-spin text-blue-500" />}
                    {!isChecking && isSafe && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                    {!isChecking && duplicateError && <AlertCircle className="h-4 w-4 text-red-600" />}
                </div>
            </div>
            {duplicateError && <div className="text-xs font-bold text-red-600 dark:text-red-400 mt-1">{duplicateError}</div>}
          </div>
          <div className="space-y-2">
            <Label className="dark:text-slate-200">Origen</Label>
            <Select value={source} onValueChange={setSource}>
                <SelectTrigger className="dark:bg-[#242526] dark:border-slate-700 dark:text-white"><SelectValue /></SelectTrigger>
                <SelectContent className="dark:bg-[#242526] dark:border-slate-700">
                    <SelectItem value="Llamador">Llamador</SelectItem>
                    <SelectItem value="Referido">Referido</SelectItem>
                    <SelectItem value="Referido Personal">Referido Personal</SelectItem>
                </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="dark:border-slate-700 dark:text-slate-300">Cancelar</Button>
          <Button onClick={handleSubmit} disabled={!name || !phone || !!duplicateError || isChecking} className="bg-blue-600 hover:bg-blue-700 text-white">Crear Ficha</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}