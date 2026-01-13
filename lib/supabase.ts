import { createBrowserClient } from '@supabase/ssr'

// Variable "memoria" para guardar la conexión y no perderla
let client: ReturnType<typeof createBrowserClient> | undefined

export function createClient() {
  // 1. Si ya existe una conexión viva, la devolvemos (REUTILIZACIÓN)
  if (client) return client

  // 2. Si no existe, creamos una nueva y la guardamos
  client = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
  
  return client
}