import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
// Asegurate que esta ruta sea la correcta según tus carpetas:
import { generateAIResponse } from '@/app/actions/chat-ia';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === 'gml_secret_123') {
    return new NextResponse(challenge);
  }
  return new NextResponse('Error de verificación', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const message = body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];

    if (!message || message.type !== 'text') return new NextResponse('OK');

    const from = message.from;
    const text = message.text.body;
    const name = body.entry?.[0]?.changes?.[0]?.value?.contacts?.[0]?.profile?.name || "Cliente";

    console.log(`📩 MENSAJE RECIBIDO de ${name}: ${text}`);

    const supabase = createClient();

    // 1. Buscar o Crear Lead
    let { data: lead } = await supabase.from('leads').select('*').eq('phone', from).single();
    
    if (!lead) {
      console.log('👤 Creando nuevo usuario en base de datos...');
      const { data: newLead, error } = await supabase.from('leads').insert({
          phone: from, name: name, status: 'nuevo', chat: [], ai_status: 'active',
          last_update: new Date().toISOString()
        }).select().single();
      if (error) console.error('Error creando lead:', error);
      lead = newLead;
    }

    if (lead) {
      // 2. Guardar mensaje
      const updatedChat = [...(lead.chat || []), { role: 'user', content: text, timestamp: new Date().toISOString(), sender: name, isMe: false }];
      await supabase.from('leads').update({ chat: updatedChat }).eq('id', lead.id);

      // 3. IA
      if (lead.ai_status === 'active') {
        console.log('🤔 Sofía está pensando...'); // <--- ESTO QUEREMOS VER
        
        try {
            const aiResponse = await generateAIResponse(updatedChat);
            console.log('🧠 Resultado IA:', aiResponse); // <--- ESTO NOS DIRÁ EL ERROR

            if (aiResponse.success && aiResponse.text) {
                console.log('📤 Enviando respuesta a WhatsApp...');
                await sendWhatsAppMessage(from, aiResponse.text);
                
                // Guardar en DB
                const aiMsg = { role: 'assistant', content: aiResponse.text, timestamp: new Date().toISOString(), sender: 'Sofía IA', isMe: true };
                await supabase.from('leads').update({ chat: [...updatedChat, aiMsg] }).eq('id', lead.id);
                console.log('✅ ¡Ciclo completado con éxito!');
            } else {
                console.log('⚠️ La IA respondió pero sin texto o sin éxito.');
            }
        } catch (err) {
            console.error('❌ CRASH EN LA IA:', err);
        }
      } else {
        console.log('💤 La IA está desactivada para este usuario.');
      }
    }

    return new NextResponse('EVENT_RECEIVED');
  } catch (error) {
    console.error('❌ Error general:', error);
    return new NextResponse('Internal Error', { status: 200 });
  }
}