'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'

export type VoteItem = { id: number; value: number; createdAt: string; voter: string; voterId: string; caption: string; memeId: number | null }

const PAGE = 50

export default function VotesTable({ items }: { items: VoteItem[] }) {
  const [kind, setKind] = useState<'all' | 'up' | 'down'>('all')
  const [voter, setVoter] = useState('all')
  const [q, setQ] = useState('')
  const [limit, setLimit] = useState(PAGE)
  const voters = useMemo(() => [...new Map(items.map((i) => [i.voterId, i.voter])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [items])
  const ups = items.filter((i) => i.value > 0).length
  const term = q.trim().toLowerCase()
  const shown = items.filter((i) =>
    (kind === 'all' || (kind === 'up' ? i.value > 0 : i.value < 0)) && (voter === 'all' || i.voterId === voter) && (!term || i.caption.toLowerCase().includes(term)))

  return (
    <>
      <div className="b-filters">
        <div className="b-seg" role="tablist" aria-label="Vote type">
          {([['all', `All ${items.length}`], ['up', `▲ Up ${ups}`], ['down', `▼ Down ${items.length - ups}`]] as const).map(([k, label]) => (
            <button key={k} role="tab" aria-selected={kind === k} className={kind === k ? 'is-on' : ''} onClick={() => { setKind(k); setLimit(PAGE) }}>{label}</button>
          ))}
        </div>
        <label className="b-select"><span>Voter</span>
          <select value={voter} onChange={(e) => { setVoter(e.target.value); setLimit(PAGE) }}>
            <option value="all">Everyone</option>
            {voters.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <input className="b-search" type="search" placeholder="Search captions" value={q} onChange={(e) => { setQ(e.target.value); setLimit(PAGE) }} aria-label="Search votes by caption" />
        <span className="b-count">{shown.length} votes</span>
      </div>
      {shown.length === 0 ? (
        <div className="b-empty"><h2>{items.length ? 'No votes match' : 'No votes yet'}</h2><p>{items.length ? 'Try a different filter.' : 'Votes show up here as soon as people vote in Caption Club.'}</p></div>
      ) : (
        <>
          <div className="b-table-wrap">
            <table className="b-table">
              <thead><tr><th>Vote</th><th>Caption</th><th>Voter</th><th>When (UTC)</th></tr></thead>
              <tbody>
                {shown.slice(0, limit).map((v) => (
                  <tr key={v.id}>
                    <td>{v.value > 0 ? <span className="b-pill up">▲ Up</span> : <span className="b-pill down">▼ Down</span>}</td>
                    <td>{v.memeId ? <Link className="b-link" href={`/memes/${v.memeId}`}>{v.caption}</Link> : v.caption}</td>
                    <td>{v.voter}</td>
                    <td><time dateTime={v.createdAt}>{v.createdAt.slice(0, 16).replace('T', ' ')}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {shown.length > limit && (
            <button className="b-btn b-btn-outline b-more" onClick={() => setLimit((l) => l + PAGE)}>Show {Math.min(PAGE, shown.length - limit)} more</button>
          )}
        </>
      )}
    </>
  )
}
