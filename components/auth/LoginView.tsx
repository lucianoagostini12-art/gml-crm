"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, Eye, EyeOff } from "lucide-react" 

const BRAND_COLOR = "#28315b"

export function LoginView() {
    const supabase = createClient()
    
    // Estados
    const [email, setEmail] = useState("")
    const [password, setPassword] = useState("")
    const [rememberMe, setRememberMe] = useState(false)
    const [showPassword, setShowPassword] = useState(false) 
    
    const [error, setError] = useState<string | null>(null)
    const [loading, setLoading] = useState(false)

    useEffect(() => {
        const savedEmail = localStorage.getItem("gml_user_email_remember")
        if (savedEmail) {
            setEmail(savedEmail)
            setRememberMe(true)
        }
    }, [])

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        if (rememberMe) {
            localStorage.setItem("gml_user_email_remember", email)
        } else {
            localStorage.removeItem("gml_user_email_remember")
        }

        try {
            // LOGIN CON SUPABASE (Sin llamar a props externas)
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password
            })

            if (authError) throw new Error("Credenciales inválidas.")
            // El observador en page.tsx hará el resto

        } catch (err: any) {
            console.error(err)
            setError(err.message || "Ocurrió un error al ingresar.")
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen w-full flex flex-col md:flex-row font-sans overflow-hidden">
            
            {/* IZQUIERDA: AZUL GML */}
            <div 
                className="w-full md:w-1/2 p-10 flex flex-col justify-center items-center relative text-white text-center order-1"
                style={{ backgroundColor: BRAND_COLOR }}
            >
                <div className="relative z-10 flex flex-col items-center">
                    <h1 className="text-5xl font-black tracking-tighter mb-4">
                        GML <span className="text-3xl font-bold text-blue-200 block md:inline md:ml-2">SALUD</span>
                    </h1>
                    <h2 className="text-3xl font-bold mb-2">¡Hola de nuevo!</h2>
                    <p className="text-blue-100 text-lg font-light">
                        Sistema de Gestión Integral
                    </p>
                    <div className="w-16 h-1 bg-blue-400 rounded mt-6"></div>
                </div>
                
                <div className="absolute top-0 right-0 w-40 h-40 bg-white opacity-5 rounded-full blur-2xl translate-x-10 -translate-y-10"></div>
                <div className="absolute bottom-0 left-0 w-60 h-60 bg-blue-400 opacity-5 rounded-full blur-3xl -translate-x-10 translate-y-10"></div>
                
                <div className="absolute bottom-6 text-[10px] text-blue-200/50 hidden md:block">
                    GML Enterprise System • v2.0
                </div>
            </div>

            {/* DERECHA: FORMULARIO */}
            <div className="w-full md:w-1/2 bg-white p-8 md:p-12 flex flex-col justify-center items-center order-2">
                <div className="w-full max-w-[320px] space-y-6">
                    <div className="text-center md:text-left mb-2">
                        <h3 className="text-xl font-bold text-slate-800">Iniciar Sesión</h3>
                        <p className="text-xs text-slate-500">Ingresá tu email y contraseña.</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Email</Label>
                            <Input 
                                type="email"
                                className="h-10 bg-slate-50 border-slate-200 focus:border-[#28315b] focus:ring-1 focus:ring-[#28315b] transition-all rounded" 
                                placeholder="nombre@redsaludgml.com.ar"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-1.5 relative">
                            <Label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Contraseña</Label>
                            <div className="relative">
                                <Input 
                                    type={showPassword ? "text" : "password"} 
                                    className="h-10 bg-slate-50 border-slate-200 focus:border-[#28315b] focus:ring-1 focus:ring-[#28315b] transition-all rounded pr-10" 
                                    placeholder="••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="text-center p-2 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-100 animate-in shake">
                                {error}
                            </div>
                        )}

                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                                <Checkbox 
                                    id="remember" 
                                    checked={rememberMe} 
                                    onCheckedChange={(c) => setRememberMe(c as boolean)}
                                    className="h-3.5 w-3.5 border-slate-300 data-[state=checked]:bg-[#28315b] data-[state=checked]:border-[#28315b] data-[state=checked]:text-white"
                                />
                                <label htmlFor="remember" className="text-xs text-slate-500 font-medium cursor-pointer select-none">
                                    Recordar email
                                </label>
                            </div>
                        </div>

                        <Button 
                            type="submit" 
                            className="w-full h-10 text-white font-bold text-xs shadow-md rounded mt-2 hover:opacity-90 transition-opacity"
                            style={{ backgroundColor: BRAND_COLOR }}
                            disabled={loading}
                        >
                            {loading ? (
                                <div className="flex items-center gap-2">
                                    <Loader2 className="h-3 w-3 animate-spin"/> Conectando...
                                </div>
                            ) : (
                                "INGRESAR AL SISTEMA"
                            )}
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}