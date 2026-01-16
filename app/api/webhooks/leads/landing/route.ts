import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders() })
}

function onlyDigits(v: any) {
  return String(v || "").replace(/\D+/g, "")
}

// ✅ NUEVO: normaliza a "canon" 10 dígitos (AR) para dedupe
function normalizePhoneCanon(raw: any) {
  const d = String(raw || "").replace(/\D+/g, "")

  if (!d) return null

  // WhatsApp AR: 549XXXXXXXXXX (13+)
  if (d.startsWith("549") && d.length >= 13) return d.substring(3, 13)

  // AR con país: 54XXXXXXXXXX (12+)
  if (d.startsWith("54") && d.length >= 12) return d.substring(2, 12)

  // 9 + 10 dígitos
  if (d.startsWith("9") && d.length === 11) return d.substring(1)

  // Ya canon
  if (d.length === 10) return d

  // fallback: últimos 10
  return d.length > 10 ? d.slice(-10) : d
}

// ✅ helper: log de eventos sin romper el webhook si falla
async function safeLeadEvent(
  supabase: any,
  evt: {
    lead_id?: string | null
    phone_canon?: string | null
    source: string
    event_type: string
    actor_name?: string | null
    summary?: string | null
    payload?: any
  }
) {
  try {
    const { error } = await supabase.from("lead_events").insert({
      lead_id: evt.lead_id ?? null,
      phone_canon: evt.phone_canon ?? null,
      source: evt.source,
      event_type: evt.event_type,
      actor_name: evt.actor_name ?? null,
      summary: evt.summary ?? null,
      payload: evt.payload ?? null,
    })

    if (error) console.error("❌ lead_events insert error:", error)
  } catch (e: any) {
    console.error("❌ lead_events insert fatal:", e?.message || e)
  }
}

export async function POST(req: Request) {
  const supabase = createClient()

  try {
    const body = await req.json()

    const nombre = (body.nombre || body.name || "Sin Nombre").toString().trim()
    const telefono = onlyDigits(body.telefono || body.phone)
    const phoneCanon = normalizePhoneCanon(telefono)
    const cp = (body.cp || body.zip || "").toString().trim()
    const provincia = (body.provincia || body.province || "").toString().trim()
    const landing_url = (body.landing_url || "").toString().trim()
    const ref = (body.ref || "").toString().trim()

    // ✅ NUEVO: permitir que cada landing defina el source
    const sourceFromLanding = (body.source || "").toString().trim()

    if (!telefono) {
      // No cortamos con 400 para no romper frontends
      return NextResponse.json({ success: false, error: "No phone" }, { headers: corsHeaders() })
    }

    // ✅ Evento inbound (form submit) aunque todavía no sepamos lead_id
    await safeLeadEvent(supabase, {
      lead_id: null,
      phone_canon: phoneCanon,
      source: "landing",
      event_type: "form_submit",
      actor_name: "Cliente",
      summary: `Formulario: ${nombre} (${telefono})`,
      payload: body,
    })

    // ✅ CAMBIO: Tag por defecto + override por landing
    let finalTag = sourceFromLanding || "Formulario - DoctoRed"

    // Si mandan ref, intentamos reglas (igual que tu lógica previa)
    // (esto puede pisar el source de la landing si corresponde)
    if (ref) {
      const { data: config } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "message_source_rules")
        .limit(1)

      if (config && config.length > 0) {
        const rules = (config[0] as any).value || []
        const match = rules.find((r: any) => {
          if (r.matchType === "exact") return r.trigger === ref
          return String(ref).includes(r.trigger)
        })
        if (match) finalTag = match.source
        else finalTag = `Meta Ads (${ref})`
      } else {
        finalTag = `Meta Ads (${ref})`
      }
    }

    const now = new Date().toISOString()

    // 1) Buscar si ya existe por phone_canon (si lo tenemos)
    const baseFind = supabase.from("leads").select("id, source, notes, phone_canon")
    const { data: existingLead, error: findErr } = phoneCanon
      ? await baseFind.eq("phone_canon", phoneCanon).maybeSingle()
      : await baseFind.eq("phone", telefono).maybeSingle()

    if (findErr) {
      console.error("Error buscando lead:", findErr)
      return NextResponse.json({ success: false, error: findErr.message }, { headers: corsHeaders() })
    }

    // Armar notes
    const extraNotesParts: string[] = []
    if (landing_url) extraNotesParts.push(`Landing URL: ${landing_url}`)
    if (cp) extraNotesParts.push(`CP: ${cp}`)
    if (provincia) extraNotesParts.push(`Provincia: ${provincia}`)
    const extraNotes = extraNotesParts.join(" | ")

    // 2) Si existe: update
    if (existingLead?.id) {
      const updates: any = {
        last_update: now,
      }

      // ✅ Completar phone_canon si faltaba (para saneo)
      if (!existingLead.phone_canon && phoneCanon) {
        updates.phone_canon = phoneCanon
      }

      // Guardamos geo
      if (provincia) updates.province = provincia
      if (cp) updates.zip = cp

      // Notes: si ya hay, lo apendizamos sin pisar
      if (extraNotes) {
        const prev = (existingLead.notes || "").toString()
        updates.notes = prev ? `${prev}\n${extraNotes}` : extraNotes
      }

      // ✅ CAMBIO: si el source anterior es genérico o vacío, lo actualizamos al de esta landing
      if (!existingLead.source || existingLead.source === "WATI / Bot") {
        updates.source = finalTag
      }

      const { error: updErr } = await supabase.from("leads").update(updates).eq("id", existingLead.id)
      if (updErr) {
        console.error("Error actualizando lead:", updErr)
        return NextResponse.json({ success: false, error: updErr.message }, { headers: corsHeaders() })
      }

      // ✅ Evento: lead actualizado por formulario
      await safeLeadEvent(supabase, {
        lead_id: existingLead.id,
        phone_canon: phoneCanon,
        source: "landing",
        event_type: "lead_updated",
        actor_name: "Sistema",
        summary: `Formulario actualizó lead (source=${finalTag})`,
        payload: { body, finalTag, updates },
      })

      return NextResponse.json({ success: true, action: "updated" }, { headers: corsHeaders() })
    }

    // 3) Si NO existe: insert (✅ devolvemos id para loguear evento)
    const { data: insertedLead, error: insErr } = await supabase
      .from("leads")
      .insert({
        name: nombre,
        phone: telefono,
        phone_canon: phoneCanon, // ✅ NUEVO
        source: finalTag,
        status: "nuevo",
        notes: extraNotes || null,
        province: provincia || null,
        zip: cp || null,
        created_at: now,
        last_update: now,

        // ✅ CLAVE para que aparezca en AdminLeadFactory:
        agent_name: null,

        // Opcional prolijo: tu tabla tiene assigned_to
        assigned_to: null,
      })
      .select("id")
      .single()

    if (insErr) {
      console.error("Error insertando lead:", insErr)
      return NextResponse.json({ success: false, error: insErr.message }, { headers: corsHeaders() })
    }

    // ✅ Evento: lead creado por formulario
    await safeLeadEvent(supabase, {
      lead_id: insertedLead?.id || null,
      phone_canon: phoneCanon,
      source: "landing",
      event_type: "lead_created",
      actor_name: "Sistema",
      summary: `Lead creado desde Formulario (source=${finalTag})`,
      payload: { body, finalTag },
    })

    return NextResponse.json({ success: true, action: "created" }, { headers: corsHeaders() })
  } catch (error: any) {
    console.error("Error general landing webhook:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500, headers: corsHeaders() }
    )
  }
}
