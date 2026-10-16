import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { HOME, NEXT_COOKIE } from '@/lib/routes'

// Routing rules:
//   Logged out + any page except "/"  -> "/" (remembering where they were headed)
//   Logged in  + "/"                  -> /dashboard
//   /auth/* and /api/* handle themselves (APIs return 401 JSON, never redirects)
//   Being signed in is not enough: every page and API route also checks profiles.is_superadmin (lib/admin.ts)
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        },
      },
    }
  )

  // Also refreshes an expiring session
  const { data: { user } } = await supabase.auth.getUser()
  const { pathname, search } = request.nextUrl

  if (pathname.startsWith('/api') || pathname.startsWith('/auth')) return response

  const redirectTo = (path: string) => {
    const url = request.nextUrl.clone()
    url.pathname = path
    url.search = ''
    const r = NextResponse.redirect(url)
    response.cookies.getAll().forEach((c) => r.cookies.set(c)) // keep refreshed session cookies
    return r
  }

  if (!user && pathname !== '/') {
    const r = redirectTo('/')
    r.cookies.set(NEXT_COOKIE, pathname + search, { path: '/', maxAge: 600, httpOnly: true, sameSite: 'lax' })
    return r
  }
  if (user && pathname === '/') return redirectTo(HOME)

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)'],
}