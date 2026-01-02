"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Users, Shield, ShieldAlert, Briefcase } from "lucide-react"
import { Button } from "@/components/ui/button"

export function TeamManager() {
    const supabase = createClient()
    const [users, setUsers] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchUsers()
    }, [])

    const fetchUsers = async () => {
        setLoading(true)
        // Traemos todos los perfiles de la base de datos
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false })
        
        if (data) setUsers(data)
        setLoading(false)
    }

    const updateUserRole = async (userId: string, newRole: string) => {
        // 1. Actualizamos visualmente rápido (Optimistic UI)
        setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))

        // 2. Actualizamos en la base de datos
        const { error } = await supabase
            .from('profiles')
            .update({ role: newRole })
            .eq('id', userId)

        if (error) {
            alert("Error al actualizar rol")
            fetchUsers() // Revertimos si falló
        } else {
            // Opcional: Feedback visual
        }
    }

    const getRoleBadge = (role: string) => {
        switch (role) {
            case 'admin': return <Badge className="bg-red-100 text-red-700 hover:bg-red-200">SUPER ADMIN</Badge>
            case 'ops': return <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-200">ADMIN OPS (Maca)</Badge>
            case 'seller': return <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">VENDEDOR</Badge>
            default: return <Badge variant="outline">SIN ROL</Badge>
        }
    }

    return (
        <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-xl"><Users className="h-6 w-6 text-blue-600"/> Gestión de Equipos</CardTitle>
                        <CardDescription>Asigná roles y permisos a tus usuarios.</CardDescription>
                    </div>
                    <Button variant="outline" size="sm" onClick={fetchUsers}>Refrescar Lista</Button>
                </div>
            </CardHeader>
            <CardContent>
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Usuario</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>Rol Actual</TableHead>
                            <TableHead className="text-right">Asignar Rol</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {users.map((user) => (
                            <TableRow key={user.id}>
                                <TableCell className="font-bold">{user.full_name || 'Sin Nombre'}</TableCell>
                                <TableCell className="text-slate-500">{user.email}</TableCell>
                                <TableCell>{getRoleBadge(user.role)}</TableCell>
                                <TableCell className="text-right">
                                    <div className="flex justify-end">
                                        <Select 
                                            defaultValue={user.role} 
                                            onValueChange={(val) => updateUserRole(user.id, val)}
                                        >
                                            <SelectTrigger className="w-[180px]">
                                                <SelectValue placeholder="Seleccionar Rol" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="admin"><div className="flex items-center gap-2"><ShieldAlert size={14} className="text-red-500"/> Super Admin (Lucho)</div></SelectItem>
                                                <SelectItem value="ops"><div className="flex items-center gap-2"><Shield size={14} className="text-purple-500"/> Admin Ops (Maca)</div></SelectItem>
                                                <SelectItem value="seller"><div className="flex items-center gap-2"><Briefcase size={14} className="text-blue-500"/> Vendedor</div></SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </CardContent>
        </Card>
    )
}