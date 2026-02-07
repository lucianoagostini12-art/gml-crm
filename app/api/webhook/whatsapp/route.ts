import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase';
// Asegurate que esta ruta sea la correcta según tus carpetas:
import { generateAIResponse } from '@/app/actions/chat-ia';
import { sendWhatsAppMessage } from '@/lib/whatsapp';

// ✅ Dedupe simple (evita dobles respuestas por reintentos/status)
const processedMessageIds = new Map<string, number>()
const DEDUPE_TTL_MS = 10 * 60 * 1000 // 10 min

function seenRecently(messageId: string) {
  const now = Date.now()
  for (const [k, ts] of processedMessageIds.entries()) {
    if (now - ts > DEDUPE_TTL_MS) processedMessageIds.delete(k)
  }
  if (processedMessageIds.has(messageId)) return true
  processedMessageIds.set(messageId, now)
  return false
}

// ✅ NUEVO: Determinar source según reglas de etiquetado configuradas en AdminConfig
async function determineSourceFromRules(supabase: any, messageText: string): Promise<string | null> {
  try {
    // Obtener las reglas de message_source_rules desde system_config
    const { data: config } = await supabase
      .from('system_config')
      .select('value')
      .eq('key', 'message_source_rules')
      .single();

    if (!config?.value || !Array.isArray(config.value)) {
      return null;
    }

    const rules = config.value as { trigger: string; source: string; matchType: string; priority?: number }[];

    // Ordenar por prioridad (mayor primero)
    const sortedRules = [...rules].sort((a, b) => (b.priority || 0) - (a.priority || 0));

    const lowerText = messageText.toLowerCase();

    for (const rule of sortedRules) {
      const trigger = rule.trigger.toLowerCase();
      let matches = false;

      switch (rule.matchType) {
        case 'exact':
          matches = lowerText === trigger;
          break;
        case 'starts_with':
          matches = lowerText.startsWith(trigger);
          break;
        case 'contains':
        default:
          matches = lowerText.includes(trigger);
          break;
      }

      if (matches) {
        console.log(`🏷️ Regla aplicada: "${rule.trigger}" → ${rule.source}`);
        return rule.source;
      }
    }

    return null;
  } catch (err) {
    console.error('Error obteniendo reglas de source:', err);
    return null;
  }
}

// ✅ NUEVO: Generador automático de etiquetas IA basado en el chat
function generateAILabels(chat: any[], leadData?: { province?: string; locality?: string; group?: string; work?: string }): string[] {
  const labels: string[] = []

  // Extraer todo el texto del cliente
  const clientText = (chat || [])
    .filter((m: any) => {
      if (typeof m?.isMe === "boolean") return !m.isMe
      if (typeof m?.role === "string") return m.role === "user" || m.role === "client"
      return true
    })
    .map((m: any) => String(m?.content || m?.text || ""))
    .join("\n")
    .toLowerCase()

  // Detectar EDAD → etiqueta positiva
  const ageMatch =
    clientText.match(/\btengo\s+(\d{1,3})\b/) ||
    clientText.match(/\b(\d{1,3})\s*años\b/) ||
    clientText.match(/\bedad\s*[:=]?\s*(\d{1,3})\b/)
  if (ageMatch?.[1]) {
    const n = parseInt(ageMatch[1], 10)
    if (!Number.isNaN(n) && n >= 0 && n <= 120) labels.push(`Edad: ${n}`)
  }

  // Detectar ZONA → etiqueta positiva
  const zoneMatch =
    clientText.match(/\bsoy de\s+([a-záéíóúñ\s]{3,40})\b/) ||
    clientText.match(/\bvivo en\s+([a-záéíóúñ\s]{3,40})\b/) ||
    clientText.match(/\bestoy en\s+([a-záéíóúñ\s]{3,40})\b/)
  const zoneKeyword = clientText.match(/\bzona\s+(norte|sur|oeste|centro|capital|gba|caba|bs as|buenos aires)/i)
  if (leadData?.province) {
    labels.push(`Zona: ${leadData.province}`)
  } else if (leadData?.locality) {
    labels.push(`Zona: ${leadData.locality}`)
  } else if (zoneMatch?.[1]) {
    labels.push(`Zona: ${zoneMatch[1].trim()}`)
  } else if (zoneKeyword?.[1]) {
    labels.push(`Zona: ${zoneKeyword[1].trim()}`)
  }

  // Detectar SITUACIÓN LABORAL → etiqueta positiva
  if (leadData?.work) {
    labels.push(`Laboral: ${leadData.work}`)
  } else if (/\bjubilad/.test(clientText)) {
    labels.push("Jubilado/a")
  } else if (/\bmonotribut/.test(clientText)) {
    labels.push("Monotributista")
  } else if (/\bdependencia\b|\ben blanco\b|\bempleado\b|\bsueldo\b/.test(clientText)) {
    labels.push("Rel. dependencia")
  } else if (/\bautonom/.test(clientText)) {
    labels.push("Autónomo/a")
  }

  // Detectar GRUPO FAMILIAR → etiqueta positiva
  if (leadData?.group) {
    labels.push(`Grupo: ${leadData.group}`)
  } else if (/\bhijos\b/.test(clientText)) {
    labels.push("Tiene hijos")
  } else if (/\bfamilia\b/.test(clientText)) {
    labels.push("Familia")
  } else if (/\besposa\b|\bmarido\b|\bpareja\b/.test(clientText)) {
    labels.push("Con pareja")
  } else if (/\bsolo\b|\bpara mi\b|\bpara mí\b/.test(clientText)) {
    labels.push("Individual")
  }

  // Señales de INTENCIÓN
  if (/\bprecio\b|\bcu[aá]nto sale\b|\bvalor\b|\bcotiz/.test(clientText) || /\$\s*\d/.test(clientText)) {
    labels.push("Pidió precio")
  }
  if (/\burgente\b|\bhoy\b|\bya\b|\bllamame\b|\bllámame\b/.test(clientText)) {
    labels.push("Intención alta")
  }

  // Detectar PREPAGA mencionada
  const prepagas = ['swiss', 'galeno', 'osde', 'medife', 'omint', 'sancor', 'avalian', 'doctored', 'prevención', 'prevencion']
  for (const p of prepagas) {
    if (clientText.includes(p)) {
      labels.push(`Mencionó: ${p.charAt(0).toUpperCase() + p.slice(1)}`)
      break // Solo una
    }
  }

  return Array.from(new Set(labels)) // Eliminar duplicados
}


export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  console.log('🔍 WEBHOOK VERIFY:', { mode, token, challenge, envSecret: process.env.META_WEBHOOK_SECRET ? `${process.env.META_WEBHOOK_SECRET.substring(0, 4)}...` : 'UNDEFINED' });

  if (mode === 'subscribe' && token === (process.env.META_WEBHOOK_SECRET || '')) {
    return new NextResponse(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
  return new NextResponse('Error de verificación', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const value = body?.entry?.[0]?.changes?.[0]?.value;

    // ✅ Solo procesamos mensajes entrantes reales
    const message = value?.messages?.[0];
    if (!message || message.type !== 'text') return new NextResponse('OK');

    const messageId = message.id;
    if (messageId && seenRecently(messageId)) {
      console.log('⏭️ DEDUPE: mensaje ya procesado', messageId);
      return new NextResponse('OK');
    }

    const from = message.from;
    const text = String(message?.text?.body || '').trim();
    if (!text) return new NextResponse('OK');

    const name = value?.contacts?.[0]?.profile?.name || "Cliente";

    console.log(`📩 MENSAJE RECIBIDO de ${name}: ${text}`);

    const supabase = createClient();

    // 1. Buscar o Crear Lead
    let { data: lead } = await supabase.from('leads').select('*').eq('phone', from).single();

    if (!lead) {
      console.log('👤 Creando nuevo usuario en base de datos...');

      // ✅ Determinar source según reglas de etiquetado
      const detectedSource = await determineSourceFromRules(supabase, text);

      const { data: newLead, error } = await supabase.from('leads').insert({
        phone: from,
        name: name,
        status: 'nuevo',
        chat: [],
        ai_status: 'active',
        chat_source: 'sofia_ai',
        chat_status: 'abierto', // ✅ NUEVO: Iniciar como chat abierto
        source: detectedSource || 'WhatsApp Directo',
        last_update: new Date().toISOString()
      }).select().single();
      if (error) console.error('Error creando lead:', error);
      lead = newLead;
    }

    if (lead) {
      // 2. Guardar mensaje del usuario
      const updatedChat = [...(lead.chat || []), { role: 'user', content: text, timestamp: new Date().toISOString(), sender: name, isMe: false }];

      // ✅ NUEVO: Actualizar chat_source y source si no estaban seteados (leads legacy)
      const updateData: any = {
        chat: updatedChat,
        last_update: new Date().toISOString(),
        last_message_from: 'client',  // ✅ Track quién mandó el último mensaje
        followup_sent: false           // ✅ Resetear para permitir UN nuevo follow-up
      };
      if (!lead.chat_source) {
        updateData.chat_source = 'sofia_ai';
      }
      // ✅ Aplicar reglas de source si no tiene uno asignado
      if (!lead.source) {
        const detectedSource = await determineSourceFromRules(supabase, text);
        if (detectedSource) {
          updateData.source = detectedSource;
        }
      }

      // ✅ NUEVO: Reabrir chat si estaba cerrado y el cliente vuelve a escribir
      if (lead.chat_status === 'cerrado') {
        updateData.chat_status = 'abierto';
        updateData.ai_status = 'active'; // Reactivar la IA también
        console.log('🔓 [Webhook] Chat reabierto automáticamente');
      }

      await supabase.from('leads').update(updateData).eq('id', lead.id);

      // 3. IA
      if (lead.ai_status === 'active') {
        console.log('🤔 Sofía está pensando...');

        try {
          const aiResponse = await generateAIResponse(updatedChat);
          console.log('🧠 Resultado IA:', aiResponse);

          if (aiResponse.success && aiResponse.text) {
            console.log('📤 Enviando respuesta a WhatsApp...');
            try {
              await sendWhatsAppMessage(from, aiResponse.text);
            } catch (metaErr) {
              console.error('❌ Error enviando a Meta:', metaErr);
              // No reventar el webhook: evitamos reintentos y dobles respuestas
            }

            // Guardar respuesta de IA en DB
            const aiMsg = { role: 'assistant', content: aiResponse.text, timestamp: new Date().toISOString(), sender: 'Sofía IA', isMe: true };
            const finalChat = [...updatedChat, aiMsg];

            // ✅ NUEVO: Generar etiquetas automáticas basadas en el chat completo
            const aiLabels = generateAILabels(finalChat, {
              province: lead.province,
              locality: lead.locality,
              group: lead.group || lead.family_group,
              work: lead.work || lead.work_status || lead.laboral
            });

            console.log('🏷️ Etiquetas generadas:', aiLabels);

            await supabase.from('leads').update({
              chat: finalChat,
              ai_labels: aiLabels,
              chat_source: 'sofia_ai',
              last_message_from: 'assistant'  // ✅ Track que la IA respondió
            }).eq('id', lead.id);

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