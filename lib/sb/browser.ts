import { createBrowserClient } from '@supabase/ssr'

// Supabase client for Client Components. Stores the session in cookies,
// so the server, middleware and browser all see the same login.
let client: ReturnType<typeof createBrowserClient> | undefined

export function sbBrowser() {
  if (!client) {
    client = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}