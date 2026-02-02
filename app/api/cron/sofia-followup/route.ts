import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { generateAIResponse } from '@/app/actions/chat-ia';

// Configuración
const FOLLOWUP_DELAY_MINUTES = 15
const MAX_LEADS_PER_RUN = 10 // Límite para evitar sobrecarga

export async function GET(request: Request) {
    // Verificar token de seguridad (opcional pero recomendado)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('🔄 [Cron] Iniciando búsqueda de leads para follow-up...');

    const supabase = createClient();
    const now = new Date();
    const cutoffTime = new Date(now.getTime() - FOLLOWUP_DELAY_MINUTES * 60 * 1000);

    console.log(`🕐 [Cron] Ahora: ${now.toISOString()}`);
    console.log(`🕐 [Cron] CutoffTime (debe ser < que esto): ${cutoffTime.toISOString()}`);

    try {
        // DEBUG: Primero busquemos todos los leads de sofia para ver qué hay
        const { data: debugLeads } = await supabase
            .from('leads')
            .select('id, name, phone, chat_source, last_message_from, followup_sent, ai_status, agent_name, last_update')
            .eq('chat_source', 'sofia_ai')
            .limit(5);

        console.log('🔍 [Debug] Leads de Sofia encontrados:', JSON.stringify(debugLeads, null, 2));

        // Buscar leads de Sofía que:
        // 1. Tienen chat activo (chat_source = 'sofia_ai')
        // 2. El último mensaje fue del cliente (last_message_from = 'client')
        // 3. No han recibido follow-up (followup_sent = false)
        // 4. La IA está activa (ai_status = 'active')
        // 5. Pasaron más de 15 minutos desde el último update
        // 6. No están asignados a un agente (agent_name es null o 'Sin Asignar')
        const { data: leadsToFollowup, error } = await supabase
            .from('leads')
            .select('id, phone, name, chat')
            .eq('chat_source', 'sofia_ai')
            .eq('last_message_from', 'client')
            .eq('followup_sent', false)
            .eq('ai_status', 'active')
            .lt('last_update', cutoffTime.toISOString())
            .or('agent_name.is.null,agent_name.eq.Sin Asignar,agent_name.eq.Sin asignar')
            .limit(MAX_LEADS_PER_RUN);

        if (error) {
            console.error('❌ [Cron] Error buscando leads:', error);
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (!leadsToFollowup || leadsToFollowup.length === 0) {
            console.log('✅ [Cron] No hay leads pendientes de follow-up');
            return NextResponse.json({
                success: true,
                message: 'No leads to follow up',
                processed: 0
            });
        }

        console.log(`📋 [Cron] Encontrados ${leadsToFollowup.length} leads para follow-up`);

        let successCount = 0;
        let errorCount = 0;

        for (const lead of leadsToFollowup) {
            try {
                // Obtener historial del chat para contexto
                const chatHistory = lead.chat || [];

                // Agregar mensaje del sistema para indicar que es follow-up
                const chatWithFollowupContext = [
                    ...chatHistory,
                    {
                        role: 'user',
                        content: `[SISTEMA: El cliente no ha respondido en ${FOLLOWUP_DELAY_MINUTES} minutos. Genera un mensaje corto y amigable de seguimiento para retomar la conversación. NO repitas información que ya le diste. Sé breve (máximo 2-3 oraciones) y termina con una pregunta simple para que sea fácil responder.]`
                    }
                ];

                // Generar respuesta de Sofía
                const aiResult = await generateAIResponse(chatWithFollowupContext);

                if (!aiResult.success || !aiResult.text) {
                    console.error(`❌ [Cron] No se pudo generar respuesta para lead ${lead.id}`);
                    errorCount++;
                    continue;
                }

                const aiResponseText = aiResult.text;

                // Enviar mensaje por WhatsApp
                if (lead.phone) {
                    await sendWhatsAppMessage(lead.phone, aiResponseText);
                    console.log(`✅ [Cron] Follow-up enviado a ${lead.name} (${lead.phone})`);
                }

                // Actualizar el chat con el mensaje de follow-up
                const newMessage = {
                    role: 'assistant',
                    content: aiResponseText,
                    timestamp: new Date().toISOString(),
                    sender: 'Sofía IA',
                    isMe: true,
                    isFollowup: true // Marcar como follow-up
                };

                const updatedChat = [...chatHistory, newMessage];

                // Actualizar lead en la base de datos
                await supabase
                    .from('leads')
                    .update({
                        chat: updatedChat,
                        followup_sent: true,
                        last_update: new Date().toISOString(),
                        last_message_from: 'assistant'
                    })
                    .eq('id', lead.id);

                successCount++;

            } catch (err) {
                console.error(`❌ [Cron] Error procesando lead ${lead.id}:`, err);
                errorCount++;
            }
        }

        console.log(`🏁 [Cron] Finalizado. Éxitos: ${successCount}, Errores: ${errorCount}`);

        return NextResponse.json({
            success: true,
            processed: leadsToFollowup.length,
            successCount,
            errorCount
        });

    } catch (err: any) {
        console.error('❌ [Cron] Error general:', err);
        return NextResponse.json({ error: err.message }, { status: 500 });
    }
}
