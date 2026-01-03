"use client"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserPlus, ArrowRightLeft, Clock } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
// BORRADO SUB_STATES del import
import { getPrepagaStyles, getSubStateStyle } from "./data"

export function OpsList({ operations, onSelectOp, updateOp, globalConfig }: any) {
    return (
        <div className="space-y-4">
            {operations.length === 0 ? (
                <div className="text-center py-10 text-slate-400">No hay operaciones en esta vista.</div>
            ) : operations.map((op: any) => {
                const styles = getPrepagaStyles(op.prepaga || 'Generica');
                const borderColorClass = styles.split(' ').find((c:string) => c.startsWith('border-l-')) || 'border-l-slate-400';
                
                // CORRECCIÓN: Usamos la config global en lugar de la constante borrada
                const subStateOptions = globalConfig?.subStates?.[op.status] || [];

                return (
                    <div 
                        key={op.id} 
                        onClick={() => onSelectOp(op)} 
                        className={`bg-white rounded-xl border border-slate-200 border-l-[8px] ${borderColorClass} p-5 hover:shadow-lg transition-all flex items-center justify-between group cursor-pointer relative`}
                    >
                        {/* 1. DATOS PRINCIPALES */}
                        <div className="flex items-center gap-4 w-[40%]">
                            <div className={`h-12 w-12 rounded-xl flex items-center justify-center font-black text-white shadow-sm shrink-0 ${op.type === 'alta' ? 'bg-green-500' : 'bg-purple-600'}`}>
                                {op.type === 'alta' ? <UserPlus size={20} /> : <ArrowRightLeft size={20} />}
                            </div>
                            <div className="overflow-hidden">
                                <h3 className="font-black text-slate-800 text-lg leading-tight truncate">{op.clientName}</h3>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className="text-xs text-slate-500 font-medium">DNI: {op.dni}</span>
                                    <div className="flex items-center gap-1 pl-2 border-l border-slate-200">
                                        <Avatar className="h-5 w-5 border border-slate-200">
                                            <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${op.seller || 'X'}`}/>
                                            <AvatarFallback className="text-[8px]">{op.seller?.substring(0,2)}</AvatarFallback>
                                        </Avatar>
                                        <span className="text-xs font-bold text-slate-500 truncate">{op.seller || 'Sin Asignar'}</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* 2. PREPAGA Y PLAN */}
                        <div className="w-[25%] border-l pl-4 border-slate-100 flex flex-col justify-center">
                            <Badge className={`text-[10px] px-2 py-0.5 font-bold uppercase mb-1 border w-fit ${styles.replace(/border-l-\S+/g, '')}`}>
                                {op.prepaga || 'Sin Dato'}
                            </Badge>
                            <p className="text-xs text-slate-500 font-bold">Plan: <span className="text-slate-800">{op.plan || '-'}</span></p>
                        </div>

                        {/* 3. ESTADOS Y ACCIONES */}
                        <div className="w-[35%] flex items-center justify-end gap-4 pl-4 border-l border-slate-100">
                            <div className="flex flex-col items-end w-full gap-1">
                                <div className="flex items-center justify-end w-full gap-2">
                                    <Badge variant="outline" className="uppercase text-[10px] font-black tracking-widest bg-slate-50 border-slate-200 text-slate-500">
                                        {op.status}
                                    </Badge>
                                    <div className="flex items-center gap-1 text-[10px] font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                                        <Clock size={10} className="text-slate-400"/>
                                        <span>{op.daysInStatus || 0}d</span>
                                    </div>
                                </div>

                                <div onClick={(e) => e.stopPropagation()}>
                                    <Select 
                                        value={op.subState || ""} 
                                        onValueChange={(val) => {
                                            updateOp({...op, subState: val})
                                        }}
                                    >
                                        <SelectTrigger className={`h-8 w-[200px] text-xs font-bold focus:ring-0 transition-colors ${getSubStateStyle(op.subState)}`}>
                                            <SelectValue placeholder="Seleccionar Estado..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {subStateOptions.length > 0 ? (
                                                subStateOptions.map((sub: string) => (
                                                    <SelectItem key={sub} value={sub} className="text-xs font-medium">
                                                        {sub}
                                                    </SelectItem>
                                                ))
                                            ) : (
                                                <div className="p-2 text-[10px] text-slate-400 text-center">Sin sub-estados</div>
                                            )}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
    )
}