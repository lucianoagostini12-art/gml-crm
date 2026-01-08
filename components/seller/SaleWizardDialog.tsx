"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { UploadCloud, Users, CreditCard, FileText, User, DollarSign, PartyPopper, Loader2, Trash2, ShieldCheck } from "lucide-react"

interface SaleWizardDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    onConfirm: (data: any) => void
}

export function SaleWizardDialog({ open, onOpenChange, onConfirm }: SaleWizardDialogProps) {
    const supabase = createClient()
    const [step, setStep] = useState(1)
    const [showSuccess, setShowSuccess] = useState(false)
    const [isSubmitting, setIsSubmitting] = useState(false)
    
    // Estado para Prepagas (desde DB)
    const [prepagasList, setPrepagasList] = useState<any[]>([])

    const [formData, setFormData] = useState<any>({
        // Parte 1: Titular
        nombre: '', cuit: '', nacimiento: '', email: '',
        domicilio: '', provincia: '', localidad: '', cp: '',
        celular: '', esMismoCelular: 'si', otroCelular: '',
        // Parte 2: Grupo
        tipoGrupo: 'individual', matrimonioNombre: '', matrimonioDni: '',
        hijos: 'no', cantHijos: '0', hijosData: [],
        // Parte 3: Laboral
        origen: 'obligatorio', condicion: 'empleado',
        cuitEmpleador: '', catMonotributo: '', claveFiscal: '',
        // Parte 4: Pago
        tipoPago: 'cbu', bancoEmisor: '', numeroTarjeta: '', vencimientoTarjeta: '', cbuNumero: '',
        // Parte 5: Archivos
        archivos: [],
        // Parte 6: Valores
        fullPrice: '', aportes: '', descuento: '', total_a_pagar: '',
        // Parte 7: Producto y Obs (NUEVO)
        prepaga: '', plan: '', obs_venta: ''
    })

    // --- CARGAR PREPAGAS DESDE SUPABASE ---
    useEffect(() => {
        if (open) {
            const fetchConfig = async () => {
                const { data } = await supabase.from('system_config').select('value').eq('key', 'prepagas_plans').single()
                if (data?.value) setPrepagasList(data.value)
            }
            fetchConfig()
        }
    }, [open])

    // --- NAVEGACIÓN ---
    const nextStep = () => setStep(prev => prev + 1)
    const prevStep = () => setStep(prev => prev - 1)

    // --- ARCHIVOS ---
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const newFiles = Array.from(e.target.files)
            setFormData((prev: any) => ({
                ...prev,
                archivos: [...(prev.archivos || []), ...newFiles]
            }))
        }
    }

    const removeFile = (indexToRemove: number) => {
        setFormData((prev: any) => ({
            ...prev,
            archivos: prev.archivos.filter((_: any, index: number) => index !== indexToRemove)
        }))
    }

    // --- FINALIZAR ---
    const handleFinish = () => {
        setIsSubmitting(true)
        setTimeout(() => {
            setShowSuccess(true)
            setIsSubmitting(false)
        }, 500)
    }

    const closeFinal = () => {
        onConfirm(formData)
        setShowSuccess(false)
        onOpenChange(false)
        setStep(1)
        // Reset form
        setFormData({
            nombre: '', cuit: '', nacimiento: '', email: '',
            domicilio: '', provincia: '', localidad: '', cp: '',
            celular: '', esMismoCelular: 'si', otroCelular: '',
            tipoGrupo: 'individual', matrimonioNombre: '', matrimonioDni: '',
            hijos: 'no', cantHijos: '0', hijosData: [],
            origen: 'obligatorio', condicion: 'empleado',
            cuitEmpleador: '', catMonotributo: '', claveFiscal: '',
            tipoPago: 'cbu', bancoEmisor: '', numeroTarjeta: '', vencimientoTarjeta: '', cbuNumero: '',
            archivos: [],
            fullPrice: '', aportes: '', descuento: '', total_a_pagar: '',
            prepaga: '', plan: '', obs_venta: ''
        })
    }

    const updateForm = (field: string, value: any) => {
        setFormData((prev: any) => ({ ...prev, [field]: value }))
    }

    // PANTALLA FESTEJO
    if (showSuccess) {
        return (
            <Dialog open={open} onOpenChange={() => {}}>
                <DialogContent className="sm:max-w-md bg-white border-0 shadow-2xl text-center p-10 flex flex-col items-center justify-center animate-in zoom-in-95 duration-300">
                    <div className="h-24 w-24 bg-green-100 rounded-full flex items-center justify-center mb-6 animate-bounce">
                        <PartyPopper className="h-12 w-12 text-green-600"/>
                    </div>
                    <DialogTitle className="text-3xl font-black text-slate-800 mb-2">¡FELICITACIONES!</DialogTitle>
                    <p className="text-slate-500 mb-8 text-lg">La venta se cargó correctamente.<br/>¡Excelente trabajo!</p>
                    <Button onClick={closeFinal} className="bg-green-600 hover:bg-green-700 w-full text-lg h-12 font-bold shadow-lg shadow-green-500/30">
                        Cerrar y Seguir Vendiendo 🚀
                    </Button>
                </DialogContent>
            </Dialog>
        )
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[650px] bg-white dark:bg-[#18191A] border-slate-200 dark:border-slate-800">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 dark:text-white">
                        {step === 1 && <User className="h-5 w-5 text-blue-500"/>}
                        {step === 2 && <Users className="h-5 w-5 text-purple-500"/>}
                        {step === 3 && <FileText className="h-5 w-5 text-green-500"/>}
                        {step === 4 && <CreditCard className="h-5 w-5 text-pink-500"/>}
                        {step === 5 && <UploadCloud className="h-5 w-5 text-orange-500"/>}
                        {step === 6 && <DollarSign className="h-5 w-5 text-emerald-500"/>}
                        {step === 7 && <ShieldCheck className="h-5 w-5 text-indigo-500"/>}
                        Carga de Venta - Paso {step}/7
                    </DialogTitle>
                    <div className="w-full bg-slate-100 h-1.5 mt-2 rounded-full overflow-hidden">
                        <div className="bg-blue-600 h-full transition-all duration-300" style={{width: `${(step / 7) * 100}%`}}></div>
                    </div>
                </DialogHeader>

                <div className="py-4 space-y-4 max-h-[450px] overflow-y-auto px-1 custom-scrollbar">
                    
                    {/* PASO 1: DATOS TITULAR */}
                    {step === 1 && (
                        <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-right-4">
                            <div className="col-span-2 space-y-1"><Label>Nombre Completo</Label><Input value={formData.nombre} onChange={e => updateForm('nombre', e.target.value)}/></div>
                            <div className="space-y-1"><Label>CUIL/CUIT</Label><Input value={formData.cuit} onChange={e => updateForm('cuit', e.target.value)}/></div>
                            <div className="space-y-1"><Label>Fecha Nacimiento</Label><Input type="date" value={formData.nacimiento} onChange={e => updateForm('nacimiento', e.target.value)}/></div>
                            <div className="col-span-2 space-y-2 border p-3 rounded bg-slate-50 dark:bg-slate-900">
                                <Label>¿Es el mismo celular que usamos para llamar?</Label>
                                <Select value={formData.esMismoCelular} onValueChange={val => updateForm('esMismoCelular', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="si">Sí</SelectItem><SelectItem value="no">No, es otro</SelectItem></SelectContent>
                                </Select>
                                {formData.esMismoCelular === 'si' && <div className="space-y-1 mt-2"><Label>Celular Actual</Label><Input value={formData.celular} onChange={e => updateForm('celular', e.target.value)}/></div>}
                                {formData.esMismoCelular === 'no' && <div className="space-y-1 mt-2"><Label>Ingresar Otro Celular</Label><Input value={formData.otroCelular} onChange={e => updateForm('otroCelular', e.target.value)}/></div>}
                            </div>
                            <div className="col-span-2 space-y-1"><Label>Email</Label><Input type="email" value={formData.email} onChange={e => updateForm('email', e.target.value)}/></div>
                            <div className="col-span-2 space-y-1"><Label>Domicilio</Label><Input value={formData.domicilio} onChange={e => updateForm('domicilio', e.target.value)}/></div>
                            <div className="space-y-1"><Label>Provincia</Label><Input value={formData.provincia} onChange={e => updateForm('provincia', e.target.value)}/></div>
                            <div className="space-y-1"><Label>Localidad</Label><Input value={formData.localidad} onChange={e => updateForm('localidad', e.target.value)}/></div>
                            <div className="space-y-1"><Label>C.P.</Label><Input value={formData.cp} onChange={e => updateForm('cp', e.target.value)}/></div>
                        </div>
                    )}

                    {/* PASO 2: GRUPO FAMILIAR */}
                    {step === 2 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-1">
                                <Label>Tipo de Afiliación</Label>
                                <Select value={formData.tipoGrupo} onValueChange={val => updateForm('tipoGrupo', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="individual">Individual</SelectItem><SelectItem value="matrimonio">Matrimonio / Grupo</SelectItem></SelectContent>
                                </Select>
                            </div>
                            {formData.tipoGrupo === 'matrimonio' && (
                                <div className="border p-3 rounded bg-purple-50 dark:bg-purple-900/10 space-y-3">
                                    <h4 className="font-bold text-purple-700 dark:text-purple-400">Datos Cónyuge</h4>
                                    <Input placeholder="Nombre Completo" value={formData.matrimonioNombre} onChange={e => updateForm('matrimonioNombre', e.target.value)}/>
                                    <Input placeholder="DNI" value={formData.matrimonioDni} onChange={e => updateForm('matrimonioDni', e.target.value)}/>
                                </div>
                            )}
                            <div className="space-y-1">
                                <Label>¿Tiene Hijos?</Label>
                                <Select value={formData.hijos} onValueChange={val => updateForm('hijos', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="no">No</SelectItem><SelectItem value="si">Sí</SelectItem></SelectContent>
                                </Select>
                            </div>
                            {formData.hijos === 'si' && (
                                <div className="space-y-3">
                                    <Label>Cantidad de Hijos</Label>
                                    <Select value={formData.cantHijos} onValueChange={val => {
                                        updateForm('cantHijos', val);
                                        const count = parseInt(val);
                                        updateForm('hijosData', Array.from({ length: count }, () => ({ nombre: '', dni: '' })))
                                    }}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent>
                                            {[1,2,3,4,5].map(n => <SelectItem key={n} value={n.toString()}>{n}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                    {formData.hijosData && formData.hijosData.map((hijo: any, i: number) => (
                                        <div key={i} className="flex gap-2 border-l-2 border-blue-500 pl-3">
                                            <Input placeholder={`Nombre Hijo ${i+1}`} value={hijo.nombre} onChange={(e) => { const newHijos = [...formData.hijosData]; newHijos[i] = { ...newHijos[i], nombre: e.target.value }; updateForm('hijosData', newHijos) }} />
                                            <Input placeholder="DNI" className="w-28" value={hijo.dni} onChange={(e) => { const newHijos = [...formData.hijosData]; newHijos[i] = { ...newHijos[i], dni: e.target.value }; updateForm('hijosData', newHijos) }} />
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 3: ORIGEN DE FONDOS */}
                    {step === 3 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-1">
                                <Label>Origen de Aportes</Label>
                                <Select value={formData.origen} onValueChange={val => updateForm('origen', val)}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent><SelectItem value="obligatorio">Obligatorio (Recibo/Mono)</SelectItem><SelectItem value="voluntario">Voluntario (Particular)</SelectItem></SelectContent>
                                </Select>
                            </div>
                            {formData.origen === 'obligatorio' && (
                                <div className="space-y-3 border p-3 rounded bg-green-50 dark:bg-green-900/10">
                                    <Label>Condición Laboral</Label>
                                    <Select value={formData.condicion} onValueChange={val => updateForm('condicion', val)}>
                                        <SelectTrigger><SelectValue /></SelectTrigger>
                                        <SelectContent><SelectItem value="empleado">Relación de Dependencia</SelectItem><SelectItem value="monotributo">Monotributista</SelectItem></SelectContent>
                                    </Select>
                                    {formData.condicion === 'empleado' ? (
                                        <div className="space-y-1"><Label>CUIT Empleador</Label><Input value={formData.cuitEmpleador} onChange={e => updateForm('cuitEmpleador', e.target.value)}/></div>
                                    ) : (
                                        <div className="space-y-1"><Label>Categoría Monotributo</Label><Input value={formData.catMonotributo} onChange={e => updateForm('catMonotributo', e.target.value)}/></div>
                                    )}
                                    <div className="space-y-1">
                                        <Label className="text-red-600 font-bold">CLAVE FISCAL (Obligatorio)</Label>
                                        <Input value={formData.claveFiscal} onChange={e => updateForm('claveFiscal', e.target.value)} className="border-red-200 bg-red-50 dark:bg-red-900/20 dark:border-red-900" />
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 4: DATOS DE COBRO */}
                    {step === 4 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="space-y-2">
                                <Label>Método de Débito Automático</Label>
                                <Select value={formData.tipoPago} onValueChange={val => updateForm('tipoPago', val)}>
                                    <SelectTrigger className="h-12 text-lg"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="tarjeta">💳 Tarjeta de Crédito</SelectItem>
                                        <SelectItem value="cbu">🏦 CBU (Cuenta Bancaria)</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            {formData.tipoPago === 'tarjeta' ? (
                                <div className="space-y-3 border-2 border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                                    <div className="space-y-1"><Label>Banco Emisor</Label><Input placeholder="Ej: Galicia, Santander..." value={formData.bancoEmisor} onChange={e => updateForm('bancoEmisor', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Número de Tarjeta (16 dígitos)</Label><Input placeholder="xxxx xxxx xxxx xxxx" maxLength={19} value={formData.numeroTarjeta} onChange={e => updateForm('numeroTarjeta', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>Vencimiento (MM/AA)</Label><Input placeholder="00/00" maxLength={5} className="w-24" value={formData.vencimientoTarjeta} onChange={e => updateForm('vencimientoTarjeta', e.target.value)}/></div>
                                </div>
                            ) : (
                                <div className="space-y-3 border-2 border-slate-200 dark:border-slate-700 p-4 rounded-xl">
                                    <div className="space-y-1"><Label>Banco</Label><Input placeholder="Ej: Banco Provincia..." value={formData.bancoEmisor} onChange={e => updateForm('bancoEmisor', e.target.value)}/></div>
                                    <div className="space-y-1"><Label>CBU (22 dígitos)</Label><Input placeholder="Ingrese los 22 dígitos..." maxLength={22} value={formData.cbuNumero} onChange={e => updateForm('cbuNumero', e.target.value)}/></div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 5: ARCHIVOS */}
                    {step === 5 && (
                        <div className="text-center py-6 space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-xl p-10 hover:bg-slate-50 dark:hover:bg-slate-900 relative transition-colors">
                                <UploadCloud className="h-12 w-12 mx-auto text-blue-500 mb-3"/>
                                <p className="font-bold text-slate-700 dark:text-slate-200 text-lg">Subir Documentación</p>
                                <div className="relative">
                                    <Button variant="outline" size="sm" className="pointer-events-none">Examinar Archivos</Button>
                                    <Input type="file" multiple className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" onChange={handleFileSelect} />
                                </div>
                            </div>
                            {formData.archivos && formData.archivos.length > 0 && (
                                <div className="space-y-2 mt-4 text-left">
                                    <Label className="text-xs text-slate-500 uppercase font-bold">Archivos seleccionados</Label>
                                    {formData.archivos.map((file: File, index: number) => (
                                        <div key={index} className="flex items-center justify-between bg-white border rounded-lg p-3 shadow-sm animate-in slide-in-from-bottom-2">
                                            <div className="flex items-center gap-3 overflow-hidden">
                                                <div className="h-8 w-8 bg-blue-50 rounded flex items-center justify-center text-blue-600"><FileText size={16}/></div>
                                                <p className="text-sm truncate max-w-[200px] font-medium text-slate-700">{file.name}</p>
                                            </div>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-500 hover:bg-red-50" onClick={() => removeFile(index)}><Trash2 size={16}/></Button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    {/* PASO 6: VALORES */}
                    {step === 6 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                            <div className="bg-emerald-50 dark:bg-emerald-900/10 p-4 rounded-xl border border-emerald-100 dark:border-emerald-800 mb-4">
                                <h4 className="font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2 mb-1"><DollarSign className="h-5 w-5"/> Valores de la Venta</h4>
                            </div>
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-1"><Label>Full Price</Label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span><Input type="number" placeholder="0.00" className="pl-8 text-lg font-bold" value={formData.fullPrice} onChange={e => updateForm('fullPrice', e.target.value)}/></div></div>
                                <div className="space-y-1"><Label>Aportes</Label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span><Input type="number" placeholder="0.00" className="pl-8" value={formData.aportes} onChange={e => updateForm('aportes', e.target.value)}/></div></div>
                                <div className="space-y-1"><Label>Descuento</Label><div className="relative"><span className="absolute left-3 top-2.5 text-slate-500 font-bold">$</span><Input type="number" placeholder="0.00" className="pl-8" value={formData.descuento} onChange={e => updateForm('descuento', e.target.value)}/></div></div>
                                <div className="space-y-1 pt-2"><Label className="text-blue-600 font-bold uppercase tracking-wide">Total A Pagar</Label><div className="relative shadow-sm"><span className="absolute left-3 top-2.5 text-blue-600 font-black">$</span><Input type="number" placeholder="0.00" className="pl-8 text-xl font-black bg-blue-50/50 border-blue-200 text-blue-800 focus-visible:ring-blue-500" value={formData.total_a_pagar} onChange={e => updateForm('total_a_pagar', e.target.value)}/></div></div>
                            </div>
                        </div>
                    )}

                    {/* ✅ PASO 7: PREPAGA Y PLAN (NUEVO) */}
                    {step === 7 && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-right-4">
                             <div className="bg-indigo-50 dark:bg-indigo-900/10 p-4 rounded-xl border border-indigo-100 dark:border-indigo-800 mb-4">
                                <h4 className="font-bold text-indigo-800 dark:text-indigo-400 flex items-center gap-2 mb-1">
                                    <ShieldCheck className="h-5 w-5"/> Producto y Detalles
                                </h4>
                                <p className="text-xs text-indigo-600 dark:text-indigo-500">Definí el plan vendido y agregá observaciones.</p>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1 col-span-1">
                                    <Label>Prepaga</Label>
                                    <Select value={formData.prepaga} onValueChange={(val) => { updateForm('prepaga', val); updateForm('plan', ''); }}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                        <SelectContent>
                                            {prepagasList.map((p:any) => <SelectItem key={p.name} value={p.name}>{p.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1 col-span-1">
                                    <Label>Plan</Label>
                                    <Select value={formData.plan} onValueChange={(val) => updateForm('plan', val)} disabled={!formData.prepaga}>
                                        <SelectTrigger><SelectValue placeholder="Seleccionar..."/></SelectTrigger>
                                        <SelectContent>
                                            {prepagasList.find((p:any) => p.name === formData.prepaga)?.plans.map((plan:string) => (
                                                <SelectItem key={plan} value={plan}>{plan}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-1 col-span-2">
                                    <Label>Observaciones de Venta</Label>
                                    <Textarea 
                                        placeholder="Detalles importantes para administración..." 
                                        className="resize-none min-h-[100px] bg-slate-50"
                                        value={formData.obs_venta}
                                        onChange={(e) => updateForm('obs_venta', e.target.value)}
                                    />
                                    <p className="text-[10px] text-slate-400">* Esto aparecerá en las notas de OpsModal.</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between sm:justify-between w-full mt-4">
                    {step > 1 ? <Button variant="outline" onClick={prevStep}>Atrás</Button> : <div></div>}
                    {step < 7 ? (
                        <Button onClick={nextStep} className="bg-blue-600 hover:bg-blue-700">Siguiente</Button>
                    ) : (
                        <Button onClick={handleFinish} disabled={isSubmitting} className="bg-green-600 hover:bg-green-700 w-full sm:w-auto font-bold shadow-lg shadow-green-500/20">
                            {isSubmitting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin"/> Guardando...</> : "Finalizar Carga 🎉"}
                        </Button>
                    )}
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}