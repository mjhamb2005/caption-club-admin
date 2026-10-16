import { requireAdmin } from '@/lib/admin'
import type { UserRow } from '@/lib/data'
import UsersTable from './UsersTable'

export const dynamic = 'force-dynamic'

export default async function UsersPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.rpc('admin_users')
  const users = ((data as UserRow[]) ?? []).map((u) => ({ ...u, memes_made: Number(u.memes_made), votes_cast: Number(u.votes_cast) }))
  return (
    <div className="b-page">
      <header className="b-head">
        <div>
          <h1>Users</h1>
          <p>Everyone who has signed in to Caption Club, with their profile and activity. Read-only.</p>
        </div>
      </header>
      {error && <p className="b-alert" role="alert">Users couldn’t load ({error.message}). Have you run supabase/admin-setup.sql?</p>}
      <UsersTable users={users} />
    </div>
  )
}
