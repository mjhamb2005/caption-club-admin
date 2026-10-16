import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { sbServer } from '@/lib/sb/server'
import { NEXT_COOKIE, safePath } from '@/lib/routes'

// After sign-in: go to the page they originally wanted, or the dashboard.
export async function GET(request: Request) {
  const supabase = await sbServer()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()
  const next = safePath(cookieStore.get(NEXT_COOKIE)?.value)
  cookieStore.delete(NEXT_COOKIE)
  return NextResponse.redirect(new URL(user ? next : '/?error=auth', request.url))
}