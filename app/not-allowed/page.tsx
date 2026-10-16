import { redirect } from 'next/navigation'
import { sbServer } from '@/lib/sb/server'

export const dynamic = 'force-dynamic'

// Signed in, but profiles.is_superadmin isn't TRUE for this account
export default async function NotAllowed() {
  const supabase = await sbServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/')
  const { data: isAdmin } = await supabase.rpc('is_superadmin')
  if (isAdmin === true) redirect('/dashboard')

  return (
    <main className="b-door">
      <div className="b-door-card">
        <div className="b-sign b-sign-lg">
          <span className="b-sign-name">Backstage</span>
          <span className="b-sign-plate">Staff only</span>
        </div>
        <h1>This door is staff only.</h1>
        <p>
          You’re signed in as <b>{user.email}</b>, but that account isn’t a superadmin. If it should be, ask an admin to
          turn on <code>is_superadmin</code> for it in Supabase, then sign in again.
        </p>
        <form action="/auth/signout" method="post">
          <button className="b-btn b-btn-primary" type="submit">Sign out and try another account</button>
        </form>
      </div>
    </main>
  )
}
