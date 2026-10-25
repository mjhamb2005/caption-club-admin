'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Viewer } from '@/lib/admin'

const NAV: { group: string; links: { href: string; label: string }[] }[] = [
  { group: 'Overview', links: [
    { href: '/dashboard', label: 'Tonight’s numbers' },
    { href: '/pipeline', label: 'Pipeline health' },
  ] },
  { group: 'Content', links: [
    { href: '/memes', label: 'AI memes & images' },
    { href: '/users', label: 'Users' },
    { href: '/votes', label: 'Votes' },
  ] },
  { group: 'Prompt chain', links: [
    { href: '/prompt-chains', label: 'Chains' },
    { href: '/prompt-chain-steps', label: 'Steps' },
    { href: '/mix', label: 'Mix' },
    { href: '/terms', label: 'Terms' },
    { href: '/examples', label: 'Examples' },
  ] },
  { group: 'Models', links: [
    { href: '/llm-providers', label: 'Providers' },
    { href: '/llm-models', label: 'Models' },
  ] },
  { group: 'Logs', links: [
    { href: '/requests', label: 'Generation requests' },
    { href: '/llm-responses', label: 'LLM responses' },
  ] },
  { group: 'Sign-up access', links: [
    { href: '/signup-domains', label: 'Allowed domains' },
    { href: '/whitelist', label: 'Whitelisted emails' },
  ] },
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
        {NAV.map((g) => (
          <div key={g.group} className="b-nav-group">
            <span className="b-nav-label">{g.group}</span>
            {g.links.map((n) => {
              const active = pathname === n.href || (n.href !== '/dashboard' && pathname.startsWith(n.href + '/'))
              return (
                <Link key={n.href} href={n.href} className={active ? 'is-active' : ''} aria-current={active ? 'page' : undefined}>
                  {n.label}
                </Link>
              )
            })}
          </div>
        ))}
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
