import { createClient } from '@supabase/supabase-js'

// Plain anon client — no session management, no cookies.
// Used for public pages (portal) that must work without authentication.
export function createAnonClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        // Next.js patches the global fetch to cache/dedupe responses during
        // server rendering. `dynamic = 'force-dynamic'` on a route doesn't
        // reliably reach fetches made several layers down inside a
        // third-party client — without this, PostgREST reads (e.g. the
        // portal's content_pieces query) can be served stale from Next's
        // Data Cache, which looked exactly like a status change that
        // "didn't persist" when it actually had.
        fetch: (input: RequestInfo | URL, init?: RequestInit) => fetch(input, { ...init, cache: 'no-store' }),
      },
    }
  )
}
