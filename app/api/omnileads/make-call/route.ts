import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

function onlyDigits(v: any) {
  return String(v || "").replace(/\D+/g, "")
}

export async function POST(req: Request) {
  const supabase = await createServerClient()

  try {
    // 1) Leer body
    const body = await req.json().catch(() => ({}))
    const phoneRaw = body?.phone
    const phone = onlyDigits(phoneRaw)

    if (!phone || phone.length < 8) {
      return NextResponse.json({ ok: false, error: "Telefono invalido" }, { status: 400 })
    }

    // 2) Variables de entorno (Vercel)
    const baseUrl = process.env.OMNILEADS_BASE_URL
    const apiUser = process.env.OMNILEADS_API_USER
    const apiPass = process.env.OMNILEADS_API_PASS
    const campaignIdStr = process.env.OMNILEADS_CAMPAIGN_ID

    if (!baseUrl || !apiUser || !apiPass || !campaignIdStr) {
      return NextResponse.json(
        { ok: false, error: "Faltan variables de entorno de OmniLeads en Vercel" },
        { status: 500 }
      )
    }

    const idCampaign = Number(campaignIdStr)
    if (!Number.isFinite(idCampaign)) {
      return NextResponse.json({ ok: false, error: "OMNILEADS_CAMPAIGN_ID invalida" }, { status: 500 })
    }

    // 3) Saber quién está logueado (CRM)
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 })
    }
    const user = authData?.user
    if (!user) {
      return NextResponse.json({ ok: false, error: "No autenticado" }, { status: 401 })
    }

    // 4) Traer omnileads_agent_id desde profiles
    const { data: profile, error: profErr } = await supabase
      .from("profiles")
      .select("omnileads_agent_id")
      .eq("id", user.id)
      .maybeSingle()

    if (profErr) {
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 })
    }

    const idAgent = profile?.omnileads_agent_id
    if (!idAgent) {
      return NextResponse.json(
        { ok: false, error: "Tu perfil no tiene omnileads_agent_id (falta cargarlo en profiles)" },
        { status: 400 }
      )
    }

    // 5) Login OmniLeads (token)
    const loginRes = await fetch(`${baseUrl}/api/v1/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: apiUser, password: apiPass }),
      cache: "no-store",
    })

    const loginJson = await loginRes.json().catch(() => null)
    if (!loginRes.ok) {
      return NextResponse.json(
        { ok: false, error: loginJson?.detail || loginJson?.message || `Login OmniLeads fallo (${loginRes.status})`, raw: loginJson },
        { status: 502 }
      )
    }

    const token = loginJson?.token
    if (!token) {
      return NextResponse.json({ ok: false, error: "OmniLeads no devolvio token" }, { status: 502 })
    }

    // 6) makeCall
    const callRes = await fetch(`${baseUrl}/api/v1/makeCall/`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ idCampaign, idAgent, phone }),
      cache: "no-store",
    })

    const callJson = await callRes.json().catch(() => null)
    if (!callRes.ok) {
      return NextResponse.json(
        { ok: false, error: callJson?.detail || callJson?.message || `makeCall fallo (${callRes.status})`, raw: callJson },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, result: callJson })
  } catch (error: any) {
    return NextResponse.json({ ok: false, error: error?.message || "Unknown error" }, { status: 500 })
  }
}
