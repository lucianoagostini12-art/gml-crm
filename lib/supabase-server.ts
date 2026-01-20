import { cookies } from "next/headers"
import { createRouteHandlerClient } from "@supabase/auth-helpers-nextjs"
import type { Database } from "@/types/supabase" // si no lo tenés, lo sacamos

export function createServerClient() {
  return createRouteHandlerClient<Database>({
    cookies,
  })
}
