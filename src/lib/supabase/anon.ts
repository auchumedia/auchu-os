import { createClient } from '@supabase/supabase-js'

// Plain anon client — no session management, no cookies.
// Used for public pages (portal) that must work without authentication.
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
