'use client'
import { useState } from 'react'
import { displayName, type UserRow } from '@/lib/data'

const SORTS = { newest: 'Newest', active: 'Most active', name: 'Name' } as const
const day = (iso: string | null) => (iso ? iso.slice(0, 10) : 'Never')

export default function UsersTable({ users }: { users: UserRow[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState<keyof typeof SORTS>('newest')
  const [onlyAdmins, setOnlyAdmins] = useState(false)
  const term = q.trim().toLowerCase()
  const shown = users
    .filter((u) => (!onlyAdmins || u.is_superadmin) && (!term || `${displayName(u)} ${u.email}`.toLowerCase().includes(term)))
    .sort((a, b) =>
      sort === 'newest' ? b.created_at.localeCompare(a.created_at)
      : sort === 'active' ? b.memes_made + b.votes_cast - (a.memes_made + a.votes_cast)
      : displayName(a).localeCompare(displayName(b)))

  return (
    <>
      <div className="b-filters">
        <input className="b-search" type="search" placeholder="Search names or emails" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" />
        <label className="b-select"><span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label className="b-check"><input type="checkbox" checked={onlyAdmins} onChange={(e) => setOnlyAdmins(e.target.checked)} /> Superadmins only</label>
        <span className="b-count">{shown.length} of {users.length}</span>
      </div>
      {shown.length === 0 ? (
        <div className="b-empty"><h2>No users match</h2><p>Try a different search.</p></div>
      ) : (
        <div className="b-table-wrap">
          <table className="b-table">
            <thead>
              <tr><th>Person</th><th>Role</th><th className="num">Memes</th><th className="num">Votes</th><th>Joined</th><th>Last sign-in</th></tr>
            </thead>
            <tbody>
              {shown.map((u) => (
                <tr key={u.id}>
                  <td>
                    <span className="b-person">
                      <span className="b-avatar-sm">{u.profile_photo_url ? <img src={u.profile_photo_url} alt="" /> : <span>{displayName(u)[0]?.toUpperCase()}</span>}</span>
                      <span><b>{displayName(u)}</b>{(u.first_name || u.last_name) && <small>{u.email}</small>}{!u.first_name && !u.last_name && <small>No name set</small>}</span>
                    </span>
                  </td>
                  <td>{u.is_superadmin ? <span className="b-pill admin">Superadmin</span> : <span className="b-muted">Member</span>}</td>
                  <td className="num">{u.memes_made}</td>
                  <td className="num">{u.votes_cast}</td>
                  <td><time dateTime={u.created_at}>{day(u.created_at)}</time></td>
                  <td>{day(u.last_sign_in_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
