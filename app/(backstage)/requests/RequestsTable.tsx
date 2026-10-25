'use client'
import { useState } from 'react'
import Link from 'next/link'
import StatusPill from '@/components/StatusPill'
import { secs, when, type RequestRow } from '@/lib/pipeline'

type Row = RequestRow & { state: string; who: string; calls: number; fallback: boolean; retries: number }
const STATES = ['all', 'succeeded', 'failed', 'running', 'abandoned'] as const

export default function RequestsTable({ rows }: { rows: Row[] }) {
  const [state, setState] = useState<(typeof STATES)[number]>('all')
  const [source, setSource] = useState('all')
  const [chain, setChain] = useState('all')
  const [limit, setLimit] = useState(100)
  const chains = [...new Set(rows.map((r) => r.chain_slug ?? 'unknown'))]
  const shown = rows.filter((r) => (state === 'all' || r.state === state) && (source === 'all' || r.source === source) && (chain === 'all' || (r.chain_slug ?? 'unknown') === chain))
  if (!rows.length) return <div className="b-empty"><h2>No requests yet</h2><p>Make a meme in Caption Club and it shows up here within seconds.</p></div>
  return (
    <>
      <div className="b-filters">
        <div className="b-seg" role="group" aria-label="Status">
          {STATES.map((s) => <button key={s} className={state === s ? 'is-on' : ''} aria-pressed={state === s} onClick={() => setState(s)}>{s === 'all' ? 'All' : s[0].toUpperCase() + s.slice(1)}</button>)}
        </div>
        <label className="b-select"><span>Source</span>
          <select value={source} onChange={(e) => setSource(e.target.value)}>
            <option value="all">All</option><option value="caption_club">Caption Club</option><option value="backstage">Backstage</option>
          </select>
        </label>
        <label className="b-select"><span>Chain</span>
          <select value={chain} onChange={(e) => setChain(e.target.value)}>
            <option value="all">All</option>{chains.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <span className="b-count">{shown.length} of {rows.length}</span>
      </div>
      <div className="b-table-wrap">
        <table className="b-table">
          <thead><tr><th>Request</th><th>Started (UTC)</th><th>Who</th><th>Source</th><th>Chain</th><th>Status</th><th className="num">AI calls</th><th className="num">Total time</th><th>Result</th></tr></thead>
          <tbody>
            {shown.slice(0, limit).map((r) => (
              <tr key={r.id}>
                <td><Link className="b-link" href={`/requests/${r.id}`}><b>#{r.id}</b></Link></td>
                <td><time dateTime={r.created_at}>{when(r.created_at)}</time></td>
                <td>{r.who}</td>
                <td>{r.source === 'backstage' ? 'Backstage' : 'Caption Club'}</td>
                <td><code>{r.chain_slug ?? '—'}</code></td>
                <td><StatusPill status={r.state} />{r.fallback && <span className="b-pill off" title="A backup model answered at least one step">backup</span>}</td>
                <td className="num">{r.calls}{r.retries ? <small className="b-sub-inline"> +{r.retries} retries</small> : null}</td>
                <td className="num">{secs(r.total_ms)}</td>
                <td>
                  {r.meme_image_id ? <Link className="b-link" href={`/memes/${r.meme_image_id}`}>Meme #{r.meme_image_id}</Link>
                    : r.error ? <span className="b-clamp b-err-text" title={r.error}>Step {r.failed_step ?? '?'}: {r.error}</span> : <span className="b-muted-inline">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > limit && <button className="b-btn b-btn-outline b-more" onClick={() => setLimit((l) => l + 100)}>Show more</button>}
    </>
  )
}
