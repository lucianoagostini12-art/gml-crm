"use server"

import { sendWhatsAppMessage } from '@/lib/whatsapp'

/**
 * Server Action para enviar mensajes de WhatsApp desde el frontend.
 * Esto permite que AdminIABrain pueda enviar mensajes manuales a los clientes.
 */
export async function sendManualWhatsAppMessage(to: string, text: string): Promise<{ success: boolean; error?: string }> {
    try {
        if (!to || !text) {
            return { success: false, error: 'Faltan datos: número de teléfono o mensaje' }
        }

        // Limpiar el número de teléfono (solo dígitos)
        const cleanPhone = to.replace(/\D/g, '')

        if (!cleanPhone || cleanPhone.length < 10) {
            return { success: false, error: 'Número de teléfono inválido' }
        }

        console.log(`📤 Enviando mensaje manual a ${cleanPhone}: ${text.substring(0, 50)}...`)

        await sendWhatsAppMessage(cleanPhone, text)

        console.log(`✅ Mensaje enviado exitosamente a ${cleanPhone}`)
        return { success: true }

    } catch (error: any) {
        console.error('❌ Error enviando mensaje manual:', error)
        return {
            success: false,
            error: error?.response?.data?.error?.message || error?.message || 'Error desconocido al enviar mensaje'
        }
    }
}
