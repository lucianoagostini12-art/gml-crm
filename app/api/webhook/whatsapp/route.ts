import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
// Importamos la IA desde la carpeta actions
import { generateAIResponse } from '@/app/actions/chat-ia';

// 1. VERIFICACIÓN (Acá ponemos la clave fija para que no falle)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // TRUCO: Escribimos 'gml_secret_123' directo acá para asegurar que coincida
  if (mode === 'subscribe' && token === 'gml_secret_123') {
    console.log('✅ Webhook verificado correctamente');
    return new NextResponse(challenge);
  }
  
  console.log('❌ Falló la verificación. Token recibido:', token);
  return new NextResponse('Error de verificación', { status: 403 });
}

// 2. RECEPCIÓN DE MENSAJES
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    if (!message || message.type !== 'text') {
      return new NextResponse('OK');
    }

    const from = message.from;
    const text = message.text.body;
    const name = value?.contacts?.[0]?.profile?.name || "Cliente";

    console.log(`📩 Mensaje de ${name} (${from}): ${text}`);

    const supabase = createClient();

    // 1. Buscar lead
    let { data: lead } = await supabase.from('leads').select('*').eq('phone', from).single();

    if (!lead) {
      const { data: newLead, error } = await supabase
        .from('leads')
        .insert({
          phone: from,
          name: name,
          status: 'nuevo',
          chat: [],
          ai_status: 'active',
          last_update: new Date().toISOString()
        })
        .select()
        .single();
      if (!error) lead = newLead;
    }

    if (lead) {
      // 2. Guardar mensaje usuario
      const userMsg = { role: 'user', content: text, timestamp: new Date().toISOString(), sender: name, isMe: false };
      const updatedChat = [...(lead.chat || []), userMsg];
      
      await supabase.from('leads').update({
        chat: updatedChat,
        last_update: new Date().toISOString(),
        unread_count: (lead.unread_count || 0) + 1,
        last_message_from: 'client'
      }).eq('id', lead.id);

      // 3. IA responde
      if (lead.ai_status === 'active') {
        const aiResponse = await generateAIResponse(updatedChat);
        if (aiResponse.success && aiResponse.text) {
          await sendWhatsAppMessage(from, aiResponse.text);
          const aiMsg = { role: 'assistant', content: aiResponse.text, timestamp: new Date().toISOString(), sender: 'Sofía IA', isMe: true };
          await supabase.from('leads').update({
            chat: [...updatedChat, aiMsg],
            last_message_from: 'ai',
            unread_count: 0
          }).eq('id', lead.id);
        }
      }
    }

    return new NextResponse('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Error webhook:', error);
    return new NextResponse('Internal Error', { status: 200 });
  }
}