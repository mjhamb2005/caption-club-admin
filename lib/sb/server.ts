import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

// Supabase client for Server Components, Route Handlers and Server Actions.
// It reads and refreshes the login session stored in cookies.
export async function sbServer() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
          } catch {
            // Server Components can't set cookies; middleware refreshes the session instead.
          }
        },
      },
    }
  )
}