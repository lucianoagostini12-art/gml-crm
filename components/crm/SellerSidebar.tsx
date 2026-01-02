"use client"

import { LayoutDashboard, CalendarDays, LogOut } from "lucide-react"

interface SellerSidebarProps {
    userName: string | null
    view: string
    setView: (view: string) => void
    onLogout: () => void
}

export function SellerSidebar({ userName, view, setView, onLogout }: SellerSidebarProps) {
    return (
        <aside className="w-64 bg-[#28315b] text-white flex flex-col h-screen sticky top-0 shadow-xl">
            {/* Header del Menú */}
            <div className="h-16 flex items-center px-6 font-bold text-xl tracking-tighter">
                GML <span className="text-blue-300 ml-1">Ventas</span>
            </div>

            {/* Botones de Navegación */}
            <nav className="flex-1 p-4 space-y-2">
                <div className="text-xs font-bold text-blue-300 uppercase mb-2">Mi Gestión</div>
                
                <button 
                    onClick={() => setView('kanban')} 
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                        view === 'kanban' ? 'bg-blue-600/50 text-white' : 'hover:bg-white/10 text-blue-100'
                    }`}
                >
                    <LayoutDashboard size={18}/> Mis Ventas
                </button>

                <button 
                    onClick={() => setView('agenda')} 
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded text-sm transition-colors ${
                        view === 'agenda' ? 'bg-blue-600/50 text-white' : 'hover:bg-white/10 text-blue-100'
                    }`}
                >
                    <CalendarDays size={18}/> Agenda
                </button>
            </nav>

            {/* Footer con Usuario y Salir */}
            <div className="p-4 border-t border-blue-800">
                <p className="text-xs font-bold mb-1">{userName || "Vendedor"}</p>
                <button onClick={onLogout} className="flex items-center gap-2 text-xs text-red-300 hover:text-red-200">
                    <LogOut size={12}/> Salir
                </button>
            </div>
        </aside>
    )
}