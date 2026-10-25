'use client'
import { Fragment, useState } from 'react'
import Link from 'next/link'
import StatusPill from '@/components/StatusPill'
import { secs, when, type ResponseRow } from '@/lib/pipeline'

export default function ResponsesTable({ rows }: { rows: ResponseRow[] }) {
  const [status, setStatus] = useState('all')
  const [model, setModel] = useState('all')
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [limit, setLimit] = useState(100)
  const models = [...new Set(rows.map((r) => r.model ?? 'unknown'))]
  const term = q.trim().toLowerCase()
  const shown = rows.filter((r) =>
    (status === 'all' || r.status === status || (status === 'fallback' && r.used_fallback)) &&
    (model === 'all' || (r.model ?? 'unknown') === model) &&
    (!term || `${r.prompt ?? ''} ${r.response ?? ''} ${r.error ?? ''}`.toLowerCase().includes(term)))
  if (!rows.length) return <div className="b-empty"><h2>No AI calls logged yet</h2><p>Each step of each meme adds a row here.</p></div>
  return (
    <>
      <div className="b-filters">
        <input className="b-search" type="search" placeholder="Search prompts, responses and errors" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search responses" />
        <label className="b-select"><span>Status</span>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All</option><option value="ok">OK</option><option value="error">Error</option><option value="fallback">Backup model</option>
          </select>
        </label>
        <label className="b-select"><span>Model</span>
          <select value={model} onChange={(e) => setModel(e.target.value)}>
            <option value="all">All</option>{models.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </label>
        <span className="b-count">{shown.length} of {rows.length}</span>
      </div>
      <div className="b-table-wrap">
        <table className="b-table">
          <thead><tr><th>When (UTC)</th><th>Request</th><th>Step</th><th>Model</th><th>Status</th><th className="num">Latency</th><th className="num">Tokens in / out</th><th>Response</th><th aria-label="Details" /></tr></thead>
          <tbody>
            {shown.slice(0, limit).map((r) => (
              <Fragment key={r.id}>
                <tr>
                  <td><time dateTime={r.created_at}>{when(r.created_at)}</time></td>
                  <td><Link className="b-link" href={`/requests/${r.request_id}`}>#{r.request_id}</Link></td>
                  <td>{r.step_order}. {r.step_name}</td>
                  <td><code>{r.model}</code>{r.used_fallback && <span className="b-pill off">backup</span>}</td>
                  <td><StatusPill status={r.status} />{r.attempts > 1 && <small className="b-sub-inline"> {r.attempts} tries</small>}</td>
                  <td className="num">{secs(r.latency_ms)}</td>
                  <td className="num">{r.input_tokens ?? '—'} / {r.output_tokens ?? '—'}</td>
                  <td><span className={`b-clamp${r.error ? ' b-err-text' : ''}`}>{r.response ?? r.error ?? '—'}</span></td>
                  <td><button className="b-btn b-btn-quiet b-btn-sm" aria-expanded={open === r.id} onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Hide' : 'View'}</button></td>
                </tr>
                {open === r.id && (
                  <tr className="b-expand">
                    <td colSpan={9}>
                      <div className="b-expand-grid">
                        <div><h4>Prompt</h4><pre>{r.prompt}</pre></div>
                        <div><h4>{r.error ? 'Error' : 'Response'}</h4><pre>{r.error ? `${r.http_status ? `HTTP ${r.http_status}\n` : ''}${r.error}` : r.response}</pre></div>
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > limit && <button className="b-btn b-btn-outline b-more" onClick={() => setLimit((l) => l + 100)}>Show more</button>}
    </>
  )
}
