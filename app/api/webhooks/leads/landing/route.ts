import { NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

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

export async function POST(req: Request) {
  try {
    // (Opcional pero MUY recomendado) secreto anti-spam
    // En Vercel: WEBHOOK_SECRET=algo-largo
    const secret = process.env.WEBHOOK_SECRET
    if (secret) {
      const incoming = req.headers.get("authorization") || ""
      // Espera: Authorization: Bearer <secret>
      if (incoming !== `Bearer ${secret}`) {
        return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401, headers: corsHeaders() })
      }
    }

    const body = await req.json()

    const nombre = body.nombre || "Sin Nombre"
    const telefono = body.telefono ? String(body.telefono).replace(/\D/g, "") : ""
    const cp = body.cp || ""
    const provincia = body.provincia || ""
    const ref = body.ref || ""
    const landing_url = body.landing_url || ""

    // ✅ Server supabase client (anon key alcanza con tu config actual)
    const supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )

    let finalTag = "Formulario - DoctoRed"

    if (ref) {
      const { data: config, error: cfgErr } = await supabase
        .from("system_config")
        .select("value")
        .eq("key", "message_source_rules")
        .limit(1)

      if (!cfgErr && config && config.length > 0) {
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

    const { error } = await supabase.from("leads").insert({
      name: nombre,
      phone: telefono,
      city: provincia,
      address: cp ? `CP: ${cp}` : "",
      source: finalTag,
      status: "ingresado",
      notes: `Landing URL: ${landing_url}`,
    })

    if (error) {
      console.error("Error insertando en Supabase:", error)
      // devolvé 200 para que la landing NO se caiga (lo que vos querés)
      return NextResponse.json({ success: false, error: error.message }, { headers: corsHeaders() })
    }

    return NextResponse.json({ success: true }, { headers: corsHeaders() })
  } catch (error: any) {
    console.error("Error general webhook:", error)
    return NextResponse.json({ success: false, error: error?.message || "Unknown" }, { status: 500, headers: corsHeaders() })
  }
}
