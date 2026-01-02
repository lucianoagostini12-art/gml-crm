"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { 
  LayoutDashboard, Contact, CalendarDays, BarChart3, Megaphone, 
  Trophy, Settings, BookOpen, Target, Menu, Bell, PlusCircle, AlertTriangle, DollarSign, LogOut, MessageSquare
} from "lucide-react"

// --- TUS VISTAS ---
import { KanbanBoard } from "@/components/crm/KanbanBoard"
import { ContactsView } from "@/components/crm/ContactsView"
import { AgendasView } from "@/components/crm/AgendasView"
import { CreateLeadDialog } from "@/components/crm/CreateLeadDialog"
// Asegurate que LeadDetail esté en esta ruta, si no ajustalo
import { LeadDetail } from "@/components/crm/LeadDetail" 

import { DashboardView } from "@/components/shared/DashboardView" 
import { AnnouncementsView } from "@/components/shared/AnnouncementsView"
import { RankingsView } from "@/components/shared/RankingsView"
import { SettingsView } from "@/components/shared/SettingsView"
import { WikiView } from "@/components/shared/WikiView" 
import { FocusModeView } from "@/components/shared/FocusModeView"
import { MySalesView } from "@/components/seller/MySalesView"

export function SellerManager({ userName, onLogout }: { userName: string | null, onLogout: () => void }) {
  // Usamos userName o "Vendedor" si viene nulo
  const currentUser = userName || "Vendedor"
  
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [currentView, setCurrentView] = useState<'board' | 'contacts' | 'agenda' | 'stats' | 'announcements' | 'rankings' | 'settings' | 'wiki' | 'focus' | 'mysales'>('board')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [announcements, setAnnouncements] = useState<any[]>([])
  
  // Alertas & Notificaciones
  const [expiredTasks, setExpiredTasks] = useState<any[]>([])
  const [totalUnreadMessages, setTotalUnreadMessages] = useState(0) 
  const [unreadNotifications, setUnreadNotifications] = useState<any[]>([])

  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null)
  const [selectedLeadData, setSelectedLeadData] = useState<any>(null)

  useEffect(() => {
    // Mantenemos tu lógica de Mock Data y notificaciones
    const initData = async () => {
        const mockUnreadCount = 2 
        const mockNotifications = [
            { id: 1, type: 'chat', title: 'Mensaje de Admin', desc: 'En venta: Roberto Gómez', time: 'Hace 5 min' },
            { id: 2, type: 'chat', title: 'Venta Rechazada', desc: 'Lucía Pérez - Falta DNI', time: 'Hace 10 min' }
        ]
        setTotalUnreadMessages(mockUnreadCount)
        setUnreadNotifications(mockNotifications)
    }

    initData()
    // El intervalo sigue igual
    const interval = setInterval(initData, 30000)
    return () => clearInterval(interval)
  }, [currentUser])

  const handleOpenLead = (lead: any) => {
      const mappedLead = { 
          ...lead, 
          lastUpdate: new Date().toLocaleDateString(), 
          createdAt: new Date().toLocaleDateString(), 
          agent: currentUser 
      }
      setSelectedLeadData(mappedLead)
      setSelectedLeadId(lead.id)
  }

  const handleNotificationClick = (notif: any) => {
      if (notif.type === 'chat') {
          setCurrentView('mysales')
      }
  }

  const handleCreateConfirm = async (data: any) => {
      window.location.reload()
  }

  return (
    <div className="flex h-screen w-full bg-white dark:bg-slate-950 overflow-hidden text-slate-900 dark:text-slate-100 transition-colors">
      
      {/* --- TU SIDEBAR ORIGINAL (AZUL) --- */}
      <aside className={`h-full bg-slate-50/50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 ease-in-out z-20 flex flex-col ${isSidebarOpen ? 'w-[260px] min-w-[260px]' : 'w-0 min-w-0 opacity-0 overflow-hidden'}`}>
        <div className="p-6 h-16 flex items-center border-b border-slate-200 dark:border-slate-800 shrink-0">
          <div className="flex items-center gap-2 text-[#1e3a8a] dark:text-blue-400 font-black text-xl tracking-tighter whitespace-nowrap">
            GML <span className="font-light text-slate-600 dark:text-slate-400">SALES</span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto overflow-x-hidden">
          <Button variant={currentView === 'board' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('board')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <LayoutDashboard className="h-4 w-4 shrink-0" /> Tablero
          </Button>
          <Button variant={currentView === 'agenda' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('agenda')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <CalendarDays className="h-4 w-4 shrink-0" /> Agenda
          </Button>
          <Button variant={currentView === 'contacts' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('contacts')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <Contact className="h-4 w-4 shrink-0" /> Contactos
          </Button>

          <p className="text-xs font-semibold text-slate-400 px-4 mb-2 mt-4 uppercase tracking-wider shrink-0">Gestión</p>
          
          <Button variant={currentView === 'mysales' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('mysales')} className="w-full justify-between gap-3 mb-1 shadow-none relative group">
            <div className="flex items-center gap-3">
                <DollarSign className="h-4 w-4 shrink-0 text-green-600" /> Mis Ventas
            </div>
            {totalUnreadMessages > 0 && (
                <span className="bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse shadow-sm">
                    {totalUnreadMessages}
                </span>
            )}
          </Button>

          <Button variant={currentView === 'stats' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('stats')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <BarChart3 className="h-4 w-4 shrink-0" /> Métricas
          </Button>
          <Button variant={currentView === 'rankings' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('rankings')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <Trophy className="h-4 w-4 shrink-0 text-yellow-500" /> Ranking
          </Button>
          
          <p className="text-xs font-semibold text-slate-400 px-4 mb-2 mt-4 uppercase tracking-wider shrink-0">Herramientas</p>
          
          <Button variant={currentView === 'wiki' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('wiki')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <BookOpen className="h-4 w-4 shrink-0 text-purple-500" /> Wiki
          </Button>
          <Button variant={currentView === 'focus' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('focus')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <Target className="h-4 w-4 shrink-0 text-red-500" /> Modo Foco
          </Button>
          <Button variant={currentView === 'announcements' ? 'secondary' : 'ghost'} onClick={() => setCurrentView('announcements')} className="w-full justify-start gap-3 mb-1 shadow-none">
            <Megaphone className="h-4 w-4 shrink-0" /> Novedades
          </Button>
        </nav>

        <div className="p-4 border-t border-slate-200 dark:border-slate-800 shrink-0">
          <Button variant="ghost" className="w-full justify-start gap-3 mb-2 text-slate-500 hover:text-slate-800 dark:hover:text-white" onClick={() => setCurrentView('settings')}>
            <Settings className="h-4 w-4" /> Config
          </Button>
          <div className="flex items-center gap-3 justify-between">
            <div className="flex items-center gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${currentUser}`} />
                  <AvatarFallback>{currentUser[0]}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-200 truncate">{currentUser}</span>
                  <span className="text-[10px] text-slate-500 uppercase">Vendedor</span>
                </div>
            </div>
            <Button variant="ghost" size="icon" onClick={onLogout} title="Cerrar Sesión">
                <LogOut className="h-4 w-4 text-red-400"/>
            </Button>
          </div>
        </div>
      </aside>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <main className="flex-1 flex flex-col h-full min-w-0 relative">
        <header className="h-16 shrink-0 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white dark:bg-slate-950 z-10 transition-colors">
          <div className="flex items-center gap-4">
             <Button variant="ghost" size="icon" onClick={() => setIsSidebarOpen(!isSidebarOpen)}>
                <Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" />
             </Button>
             <div className="flex flex-col">
                <h1 className="text-lg font-bold text-slate-800 dark:text-white leading-none">
                    {currentView === 'board' ? 'Tablero Principal' : 
                     currentView === 'agenda' ? 'Agenda de Llamados' :
                     currentView === 'mysales' ? 'Mis Ventas Mensuales' :
                     currentView === 'stats' ? 'Mis Métricas' : 
                     currentView === 'rankings' ? 'Ranking de Ventas' :
                     currentView === 'settings' ? 'Configuración' :
                     currentView === 'wiki' ? 'Wiki de Ventas' :
                     currentView === 'focus' ? 'Modo Foco 🎯' :
                     currentView === 'announcements' ? 'Novedades' : 'Base de Contactos'}
                </h1>
                <span className="text-[10px] text-slate-500">GML Sales CRM</span>
             </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="text-amber-500 hover:bg-amber-50 relative" title="Agendas Vencidas">
                        <AlertTriangle className="h-5 w-5" />
                        {expiredTasks.length > 0 && <span className="absolute top-2 right-2 h-2.5 w-2.5 bg-red-600 rounded-full border border-white animate-pulse"></span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                   {/* ... Contenido del Popover de Vencidos ... */}
                   <div className="p-3 border-b flex justify-between items-center"><h4 className="font-bold text-sm">Vencidos</h4></div>
                   <div className="p-4 text-xs text-slate-500">Todo al día.</div>
                </PopoverContent>
            </Popover>

            <Popover>
                <PopoverTrigger asChild>
                    <Button variant="outline" size="icon" className="relative dark:border-slate-700 dark:bg-slate-900">
                        <Bell className="h-4 w-4 text-slate-600 dark:text-slate-300" />
                        {(announcements.length > 0 || unreadNotifications.length > 0) && <span className="absolute top-0 right-0 h-2.5 w-2.5 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900"></span>}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                    {/* ... Contenido del Popover de Notificaciones ... */}
                    <div className="p-4 border-b flex justify-between items-center"><h4 className="font-bold">Notificaciones</h4></div>
                    <div className="p-4 text-sm text-slate-500 text-center">Sin novedades.</div>
                </PopoverContent>
            </Popover>

            <Button onClick={() => setIsCreateOpen(true)} className="bg-[#1e3a8a] hover:bg-blue-900 text-white gap-2 h-9 shadow-sm">
              <PlusCircle className="h-4 w-4" /> <span className="hidden sm:inline">Nuevo Dato</span>
            </Button>
          </div>
        </header>

        <div className="flex-1 overflow-hidden bg-slate-50 dark:bg-slate-950/50 relative transition-colors">
            {/* AQUÍ PASAMOS EL userName PARA QUE FILTRE BIEN LOS DATOS */}
            {currentView === 'board' && <KanbanBoard userName={currentUser} />}
            {currentView === 'contacts' && <ContactsView userName={currentUser} />}
            {currentView === 'agenda' && <AgendasView userName={currentUser} />}
            {currentView === 'stats' && <DashboardView />}
            {currentView === 'announcements' && <AnnouncementsView />}
            {currentView === 'rankings' && <RankingsView />}
            {currentView === 'settings' && <SettingsView />}
            {currentView === 'wiki' && <WikiView />}
            {currentView === 'focus' && <FocusModeView />}
            {currentView === 'mysales' && <MySalesView />}
        </div>
      </main>

      <CreateLeadDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onConfirm={handleCreateConfirm} />
      
      {selectedLeadData && (
          <LeadDetail 
            lead={selectedLeadData} 
            open={!!selectedLeadId} 
            onOpenChange={(open) => {
                if(!open) { setSelectedLeadId(null); setSelectedLeadData(null) }
            }} 
          />
      )}
    </div>
  )
}