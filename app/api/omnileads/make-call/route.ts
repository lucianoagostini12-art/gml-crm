import { NextResponse } from "next/server"
import { createServerClient } from "@/lib/supabase-server"

function onlyDigits(v: any) {
  return String(v || "").replace(/\D+/g, "")
}

function safeJsonParse(txt: string) {
  try {
    return JSON.parse(txt)
  } catch {
    return null
  }
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

    // Logs útiles para Vercel
    console.log("[omnileads] baseUrl:", baseUrl)
    console.log("[omnileads] apiUser:", apiUser)
    console.log("[omnileads] idCampaign:", idCampaign)
    console.log("[omnileads] phone:", phone)

    // 3) Saber quién está logueado (CRM)
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr) {
      console.error("[omnileads] authErr:", authErr)
      return NextResponse.json({ ok: false, error: authErr.message }, { status: 401 })
    }
    const user = authData?.user
    console.log("[omnileads] auth user id:", user?.id ?? null)

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
      console.error("[omnileads] profErr:", profErr)
      return NextResponse.json({ ok: false, error: profErr.message }, { status: 500 })
    }

    const idAgent = profile?.omnileads_agent_id
    console.log("[omnileads] profile idAgent:", idAgent ?? null)

    if (!idAgent) {
      return NextResponse.json(
        { ok: false, error: "Tu perfil no tiene omnileads_agent_id (falta cargarlo en profiles)" },
        { status: 400 }
      )
    }

    // 5) Login OmniLeads (token) — IMPORTANTE: login SIN slash final
    const loginUrl = `${baseUrl}/api/v1/login`
    console.log("[omnileads] loginUrl:", loginUrl)

    let loginRes: Response
    try {
      loginRes = await fetch(loginUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: apiUser, password: apiPass }),
        cache: "no-store",
      })
    } catch (e: any) {
      console.error("[omnileads] fetch login failed:", e)
      return NextResponse.json(
        { ok: false, error: "fetch login failed", details: e?.message || String(e) },
        { status: 502 }
      )
    }

    const loginText = await loginRes.text()
    const loginJson = safeJsonParse(loginText)

    if (!loginRes.ok) {
      console.error("[omnileads] login not ok:", loginRes.status, loginText)
      return NextResponse.json(
        {
          ok: false,
          error: loginJson?.detail || loginJson?.message || `Login OmniLeads fallo (${loginRes.status})`,
          raw: loginJson ?? loginText,
        },
        { status: 502 }
      )
    }

    const token = loginJson?.token
    if (!token) {
      console.error("[omnileads] login ok but no token:", loginText)
      return NextResponse.json({ ok: false, error: "OmniLeads no devolvio token", raw: loginJson ?? loginText }, { status: 502 })
    }

    // 6) makeCall — IMPORTANTE: makeCall CON slash final
    const callUrl = `${baseUrl}/api/v1/makeCall/`
    console.log("[omnileads] callUrl:", callUrl)

    let callRes: Response
    try {
      callRes = await fetch(callUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ idCampaign, idAgent, phone }),
        cache: "no-store",
      })
    } catch (e: any) {
      console.error("[omnileads] fetch makeCall failed:", e)
      return NextResponse.json(
        { ok: false, error: "fetch makeCall failed", details: e?.message || String(e) },
        { status: 502 }
      )
    }

    const callText = await callRes.text()
    const callJson = safeJsonParse(callText)

    if (!callRes.ok) {
      console.error("[omnileads] makeCall not ok:", callRes.status, callText)
      return NextResponse.json(
        {
          ok: false,
          error: callJson?.detail || callJson?.message || `makeCall fallo (${callRes.status})`,
          raw: callJson ?? callText,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, result: callJson ?? callText })
  } catch (error: any) {
    console.error("[omnileads] unhandled:", error)
    return NextResponse.json(
      { ok: false, error: error?.message || "Unknown error", details: String(error) },
      { status: 500 }
    )
  }
}
