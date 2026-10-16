import { NextResponse } from 'next/server'
import { sbServer } from '@/lib/sb/server'

export async function POST(request: Request) {
  const supabase = await sbServer()
  await supabase.auth.signOut()
  return NextResponse.redirect(new URL('/', request.url), 303)
}

// Sign-out is POST-only so link prefetching can never log someone out.
export async function GET(request: Request) {
  return NextResponse.redirect(new URL('/dashboard', request.url))
}