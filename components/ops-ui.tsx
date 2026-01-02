import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Search, FileText, ImageIcon, Paperclip } from "lucide-react"

// --- TARJETA DE FLUJO (ARRIBA) ---
export function FlowCard({ label, count, color, icon, active, onClick }: any) {
    const colors: any = { slate: "border-slate-400", blue: "border-blue-500", purple: "border-purple-500", yellow: "border-yellow-500", indigo: "border-indigo-500" }
    return (
        <Card onClick={onClick} className={`w-40 h-32 border-t-4 ${colors[color]} cursor-pointer flex flex-col items-center justify-center shrink-0 transition-all ${active ? 'ring-2 ring-slate-900 bg-slate-50 shadow-inner' : 'bg-white shadow-sm'}`}>
            <div className="mb-3 transform scale-110 opacity-70">{icon}</div>
            <span className="text-4xl font-black text-slate-800 tracking-tighter">{count}</span>
            <span className="text-[10px] font-bold text-slate-500 uppercase mt-1 tracking-widest">{label}</span>
        </Card>
    )
}

// --- TARJETA DE ESTADO GRANDE (TOTALES) ---
export function BigStatusCard({ label, count, color, icon, onClick, active }: any) {
    const bg = color === 'green' ? 'bg-emerald-500' : 'bg-red-500'
    return (
        <div onClick={onClick} className={`${bg} w-48 h-32 rounded-xl flex flex-col items-center justify-center text-white shrink-0 shadow-lg cursor-pointer hover:scale-105 transition-transform ${active ? 'ring-4 ring-white/50' : ''}`}>
            <div className="mb-2 transform scale-125 opacity-80">{icon}</div>
            <span className="text-5xl font-black tracking-tighter">{count}</span>
            <span className="text-xs font-bold uppercase opacity-90 mt-1 tracking-widest">{label}</span>
        </div>
    )
}

// --- FILA DE INFORMACIÓN ---
export function InfoRow({ label, value, size = "md", bold, color, icon }: any) {
    return (
        <div className="flex justify-between items-center border-b border-slate-100 pb-2 last:border-0 last:pb-0 text-slate-900">
            <span className="text-[10px] font-black text-slate-400 uppercase flex items-center gap-2 tracking-widest">{icon} {label}</span>
            <span className={`${size === "lg" ? "text-xl" : "text-sm"} text-right ${bold ? "font-black" : "font-medium"} ${color || "text-slate-800"}`}>{value || "-"}</span>
        </div>
    )
}

// --- TARJETA DE ARCHIVO ---
export function FileCard({ name, type, size, onClick }: any) {
    return (
        <div onClick={onClick} className="bg-white border border-slate-200 rounded-xl p-3 flex items-center gap-3 hover:shadow-md cursor-pointer transition-all group">
            <div className="h-10 w-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold text-[10px] shrink-0">{type}</div>
            <div className="overflow-hidden flex-1"><p className="text-xs font-bold truncate text-slate-700 group-hover:text-blue-600">{name}</p><p className="text-[10px] text-slate-400">{size}</p></div>
            <Search size={14} className="text-slate-300 group-hover:text-blue-500" />
        </div>
    )
}

// --- BURBUJA DE CHAT ---
export function ChatBubble({ user, text, time, isMe, file, onFileClick }: any) {
    return (
        <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} mb-4 animate-in slide-in-from-bottom-2`}>
            <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-[13px] ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-white border text-slate-700 rounded-bl-none shadow-sm'}`}>
                {!isMe && <p className="text-[10px] font-black text-blue-500 uppercase mb-1 tracking-tighter">{user}</p>}
                {text}
                {file && (
                    <div onClick={() => onFileClick(file)} className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2 cursor-pointer hover:bg-black/20 border border-white/20">
                        {file.type === 'IMG' ? <ImageIcon size={14}/> : <FileText size={14}/>}
                        <span className="text-[10px] font-bold truncate max-w-[150px]">{file.name}</span>
                    </div>
                )}
            </div>
            <span className="text-[9px] text-slate-400 mt-1 px-1 font-bold">{time}</span>
        </div>
    )
}

// --- BOTÓN SIDEBAR ---
export function SidebarBtn({ open, active, onClick, icon, label, badge }: any) {
    return (
        <button onClick={onClick} className={`w-full flex items-center ${open ? 'justify-start px-4' : 'justify-center'} py-3 rounded-lg text-sm font-medium transition-all ${active ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
            {icon} {open && <span className="ml-3 flex-1 text-left">{label}</span>}
            {open && badge && <span className="bg-slate-700 text-white text-[10px] px-2 py-0.5 rounded-full">{badge}</span>}
        </button>
    )
}