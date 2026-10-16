'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Viewer } from '@/lib/admin'

const NAV = [
  { href: '/dashboard', label: 'Tonight’s numbers' },
  { href: '/memes', label: 'Memes' },
  { href: '/users', label: 'Users' },
  { href: '/votes', label: 'Votes' },
]

export default function Sidebar({ viewer, publicUrl }: { viewer: Viewer; publicUrl: string | null }) {
  const pathname = usePathname()
  const initial = (viewer.name || viewer.email || '?').trim()[0]?.toUpperCase() ?? '?'
  return (
    <aside className="b-side">
      <Link href="/dashboard" className="b-sign" aria-label="Backstage home">
        <span className="b-sign-name">Backstage</span>
        <span className="b-sign-plate">Staff only</span>
      </Link>
      <nav className="b-nav" aria-label="Sections">
        {NAV.map((n) => {
          const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href))
          return (
            <Link key={n.href} href={n.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
              {n.label}
            </Link>
          )
        })}
      </nav>
      <div className="b-side-foot">
        {publicUrl && <a href={publicUrl} className="b-out" target="_blank" rel="noreferrer">Open Caption Club ↗</a>}
        <div className="b-me">
          {viewer.avatar ? <img src={viewer.avatar} alt="" referrerPolicy="no-referrer" /> : <span>{initial}</span>}
          <div>
            <b>{viewer.name}</b>
            <small>Superadmin</small>
          </div>
        </div>
        <form action="/auth/signout" method="post">
          <button className="b-btn b-btn-quiet b-btn-sm" type="submit">Sign out</button>
        </form>
      </div>
    </aside>
  )
}
