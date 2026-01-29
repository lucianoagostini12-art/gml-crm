// app/api/webhook/whatsapp/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase'; 
// 👇 CORREGIDO: Apunta a donde me dijiste que está el archivo
import { generateAIResponse } from '@/app/actions/chat-ia'; 
import { sendWhatsAppMessage } from '@/lib/whatsapp'; 

// 1. VERIFICACIÓN (Esto es lo que Meta prueba al configurar el webhook)
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // "gml_secret_123" es la contraseña que pusiste en tu .env
  if (mode === 'subscribe' && token === process.env.META_WEBHOOK_SECRET) {
    console.log('✅ Webhook verificado correctamente');
    return new NextResponse(challenge);
  }
  return new NextResponse('Error de verificación', { status: 403 });
}

// 2. RECEPCIÓN DE MENSAJES (Cuando alguien te escribe)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    
    const entry = body.entry?.[0];
    const changes = entry?.changes?.[0];
    const value = changes?.value;
    const message = value?.messages?.[0];

    // Si no es un mensaje de texto, lo ignoramos (pero respondemos OK a Meta para que no insista)
    if (!message || message.type !== 'text') {
      return new NextResponse('OK');
    }

    const from = message.from; // Número del cliente
    const text = message.text.body; // Lo que escribió
    const name = value?.contacts?.[0]?.profile?.name || "Cliente";

    console.log(`📩 Mensaje de ${name} (${from}): ${text}`);

    // --- CONEXIÓN CON TU CEREBRO ---
    const supabase = createClient();

    // 1. Buscamos si el lead existe
    let { data: lead } = await supabase.from('leads').select('*').eq('phone', from).single();

    // 2. Si no existe, lo creamos
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
      if (error) throw error;
      lead = newLead;
    }

    // 3. Guardamos el mensaje del cliente en Supabase
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
      sender: name,
      isMe: false
    };

    const updatedChat = [...(lead.chat || []), userMsg];

    await supabase.from('leads').update({
        chat: updatedChat,
        last_update: new Date().toISOString(),
        unread_count: (lead.unread_count || 0) + 1,
        last_message_from: 'client'
    }).eq('id', lead.id);

    // 4. Si la IA está activa, responde
    if (lead.ai_status === 'active') {
      // Llamamos a la Server Action en app/actions
      const aiResponse = await generateAIResponse(updatedChat);

      if (aiResponse.success && aiResponse.text) {
        // Enviar a WhatsApp real
        await sendWhatsAppMessage(from, aiResponse.text);

        // Guardar respuesta en DB
        const aiMsg = {
          role: 'assistant',
          content: aiResponse.text,
          timestamp: new Date().toISOString(),
          sender: 'Sofía IA',
          isMe: true
        };

        await supabase.from('leads').update({
            chat: [...updatedChat, aiMsg],
            last_message_from: 'ai',
            unread_count: 0
        }).eq('id', lead.id);
      }
    }

    return new NextResponse('EVENT_RECEIVED');

  } catch (error) {
    console.error('❌ Error en webhook:', error);
    return new NextResponse('Internal Error', { status: 200 });
  }
}