import { redirect } from 'next/navigation'
import { sbServer } from './sb/server'

export type Viewer = { id: string; email: string; name: string; avatar: string | null }

// Every Backstage page calls this first. Signed out -> sign-in page.
// Signed in but profiles.is_superadmin isn't TRUE -> "not allowed" page. Nothing else renders.
export async function requireAdmin() {
  const supabase = await sbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')

  const [{ data: isAdmin }, { data: profile }] = await Promise.all([
    supabase.rpc('is_superadmin'),
    supabase.from('profiles').select('first_name, last_name, profile_photo_url').eq('id', user.id).maybeSingle(),
  ])
  if (isAdmin !== true) redirect('/not-allowed')

  const meta = user.user_metadata ?? {}
  const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ') || meta.full_name || meta.name || user.email || ''
  const viewer: Viewer = {
    id: user.id,
    email: user.email ?? '',
    name,
    avatar: profile?.profile_photo_url || meta.avatar_url || meta.picture || null,
  }
  return { supabase, user, viewer }
}

// Same check for API routes: returns null instead of redirecting
export async function adminOrNull() {
  const supabase = await sbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: isAdmin } = await supabase.rpc('is_superadmin')
  return isAdmin === true ? { supabase, user } : null
}
