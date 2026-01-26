"use client"
import { useState } from "react"
import { generateAIResponse } from "@/app/actions/chat-ia" // Importamos el cerebro que recién creamos
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Send, Bot, User, Trash2 } from "lucide-react"

export default function TestBotPage() {
  const [input, setInput] = useState("")
  // Mensaje inicial de fantasía para arrancar
  const [messages, setMessages] = useState<{user: string, text: string, isMe: boolean}[]>([
    { user: "Sofía", text: "¡Hola! Soy Sofía de GML. ¿En qué te puedo ayudar? 😊", isMe: true }
  ])
  const [loading, setLoading] = useState(false)

  const handleSend = async () => {
    if (!input.trim()) return

    // 1. Agregamos tu mensaje visualmente
    const userMsg = { user: "Yo", text: input, isMe: false }
    const newHistory = [...messages, userMsg]
    setMessages(newHistory)
    setInput("")
    setLoading(true)

    // 2. Llamamos al Cerebro (Server Action)
    const response = await generateAIResponse(newHistory)

    // 3. Agregamos la respuesta del Bot
    if (response.success) {
      setMessages(prev => [...prev, { user: "Sofía", text: response.text, isMe: true }])
    } else {
       alert("Error: " + response.text)
    }
    setLoading(false)
  }

  const resetChat = () => {
      setMessages([{ user: "Sofía", text: "¡Hola! Soy Sofía de GML. ¿En qué te puedo ayudar? 😊", isMe: true }])
  }

  return (
    <div className="flex flex-col h-screen max-w-md mx-auto bg-slate-50 border-x border-slate-200 font-sans">
      <header className="p-4 bg-white border-b flex items-center justify-between shadow-sm sticky top-0 z-10">
        <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-purple-600 rounded-full flex items-center justify-center text-white shadow-md">
            <Bot size={24} />
            </div>
            <div>
            <h1 className="font-bold text-slate-800 leading-tight">Simulador GML</h1>
            <p className="text-xs text-green-600 font-medium flex items-center gap-1">
                <span className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></span> Online
            </p>
            </div>
        </div>
        <Button variant="ghost" size="icon" onClick={resetChat} title="Borrar Chat">
            <Trash2 size={18} className="text-slate-400 hover:text-red-500"/>
        </Button>
      </header>

      <ScrollArea className="flex-1 p-4 bg-[#e5ddd5]">
        {messages.map((m, i) => (
          <div key={i} className={`flex mb-3 ${m.isMe ? 'justify-start' : 'justify-end'}`}>
            <div className={`max-w-[85%] px-4 py-2 rounded-xl text-sm shadow-sm ${
              m.isMe 
                ? 'bg-white text-slate-800 rounded-tl-none border border-slate-100' 
                : 'bg-[#dcf8c6] text-slate-800 rounded-tr-none border border-green-100'
            }`}>
              {!m.isMe && <p className="text-[10px] text-green-700 font-bold mb-0.5 text-right">TÚ</p>}
              <p className="leading-relaxed whitespace-pre-wrap">{m.text}</p>
            </div>
          </div>
        ))}
        {loading && (
             <div className="flex justify-start mb-4">
                 <div className="bg-white px-4 py-2 rounded-xl rounded-tl-none border border-slate-100 text-xs text-slate-500 italic flex items-center gap-2">
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-75"></span>
                    <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce delay-150"></span>
                 </div>
             </div>
        )}
      </ScrollArea>

      <div className="p-3 bg-[#f0f2f5] border-t">
        <div className="flex gap-2 items-end bg-white p-2 rounded-2xl border border-slate-200">
          <Input 
            className="border-0 focus-visible:ring-0 shadow-none py-3"
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            placeholder="Escribí un mensaje..." 
            disabled={loading}
          />
          <Button onClick={handleSend} disabled={loading} size="icon" className="bg-purple-600 rounded-xl h-10 w-10 shrink-0 mb-0.5">
            <Send size={18} />
          </Button>
        </div>
        <p className="text-[10px] text-center text-slate-400 mt-2">
            Ambiente de Pruebas • GML Sales Group
        </p>
      </div>
    </div>
  )
}