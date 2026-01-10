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

export async function POST(req: Request) {
  const supabase = createClient()

  try {
    const body = await req.json()

    const nombre = (body.nombre || body.name || "Sin Nombre").toString().trim()
    const telefono = onlyDigits(body.telefono || body.phone)
    const cp = (body.cp || body.zip || "").toString().trim()
    const provincia = (body.provincia || body.province || "").toString().trim()
    const landing_url = (body.landing_url || "").toString().trim()
    const ref = (body.ref || "").toString().trim()

    if (!telefono) {
      // No cortamos con 400 para no “romper” frontends,
      // pero devolvemos success false
      return NextResponse.json({ success: false, error: "No phone" }, { headers: corsHeaders() })
    }

    // Tag por defecto
    let finalTag = "Formulario - DoctoRed"

    // Si mandan ref, intentamos reglas (igual que tu lógica previa)
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

    // 1) Buscar si ya existe por phone
    const { data: existingLead, error: findErr } = await supabase
      .from("leads")
      .select("id, source, notes")
      .eq("phone", telefono)
      .maybeSingle()

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

      // Guardamos geo
      if (provincia) updates.province = provincia
      if (cp) updates.zip = cp

      // Notes: si ya hay, lo “apendizamos” sin pisar
      if (extraNotes) {
        const prev = (existingLead.notes || "").toString()
        updates.notes = prev ? `${prev}\n${extraNotes}` : extraNotes
      }

      // Si el source anterior es genérico o vacío, lo actualizamos al formulario
      if (!existingLead.source || existingLead.source === "WATI / Bot") {
        updates.source = finalTag
      }

      // No cambiamos status si ya lo estaban trabajando, pero si querés forzar ingresado:
      // updates.status = "ingresado"

      const { error: updErr } = await supabase.from("leads").update(updates).eq("id", existingLead.id)
      if (updErr) {
        console.error("Error actualizando lead:", updErr)
        return NextResponse.json({ success: false, error: updErr.message }, { headers: corsHeaders() })
      }

      return NextResponse.json({ success: true, action: "updated" }, { headers: corsHeaders() })
    }

    // 3) Si NO existe: insert
    const { error: insErr } = await supabase.from("leads").insert({
      name: nombre,
      phone: telefono,
      source: finalTag,
      status: "ingresado",
      notes: extraNotes || null,
      province: provincia || null,
      zip: cp || null,
      created_at: now,
      last_update: now,
    })

    if (insErr) {
      console.error("Error insertando lead:", insErr)
      return NextResponse.json({ success: false, error: insErr.message }, { headers: corsHeaders() })
    }

    return NextResponse.json({ success: true, action: "created" }, { headers: corsHeaders() })
  } catch (error: any) {
    console.error("Error general landing webhook:", error)
    return NextResponse.json(
      { success: false, error: error?.message || "Unknown error" },
      { status: 500, headers: corsHeaders() }
    )
  }
}
