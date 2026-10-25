import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import StatusPill from '@/components/StatusPill'
import { BarList, DailyRuns } from '@/components/Charts'
import { REQUEST_COLS, RESPONSE_COLS, effectiveStatus, percentile, secs, when, type RequestRow, type ResponseRow } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'
const DAY = 86_400_000

export default async function PipelinePage() {
  const { supabase } = await requireAdmin()
  const since = new Date(Date.now() - 14 * DAY).toISOString()
  const [{ data: reqData, error }, { data: respData }] = await Promise.all([
    supabase.from('generation_requests').select(REQUEST_COLS).gte('created_at', since).order('created_at', { ascending: false }).limit(5000),
    supabase.from('llm_responses').select(RESPONSE_COLS).gte('created_at', since).order('id', { ascending: false }).limit(20000),
  ])
  const now = Date.now()
  const reqs = ((reqData ?? []) as RequestRow[]).map((r) => ({ ...r, state: effectiveStatus(r, now) }))
  const resp = (respData ?? []) as ResponseRow[]

  const week = reqs.filter((r) => now - new Date(r.created_at).getTime() < 7 * DAY)
  const finished = week.filter((r) => r.state !== 'running')
  const succeeded = finished.filter((r) => r.state === 'succeeded')
  const successRate = finished.length ? succeeded.length / finished.length : null
  const p50 = percentile(succeeded.map((r) => r.total_ms ?? 0).filter(Boolean), 50)
  const p95 = percentile(succeeded.map((r) => r.total_ms ?? 0).filter(Boolean), 95)
  const weekResp = resp.filter((r) => now - new Date(r.created_at).getTime() < 7 * DAY)
  const backupRate = weekResp.length ? weekResp.filter((r) => r.used_fallback).length / weekResp.length : null
  const tokens = weekResp.reduce((s, r) => s + (r.input_tokens ?? 0) + (r.output_tokens ?? 0), 0)

  // Latency by step (successful calls), median with p95 as context
  const byStep = new Map<string, number[]>()
  for (const r of resp) if (r.status === 'ok' && r.latency_ms !== null) {
    const k = `${r.step_order}. ${r.step_name ?? 'Step'}`
    byStep.set(k, [...(byStep.get(k) ?? []), r.latency_ms])
  }
  const stepRows = [...byStep.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, v]) => ({
    label, value: (percentile(v, 50) ?? 0) / 1000, sub: `p95 ${secs(percentile(v, 95))}, ${v.length} calls`,
  }))

  // Which model actually answered
  const byModel = new Map<string, { n: number; backup: number; errors: number }>()
  for (const r of resp) {
    const m = byModel.get(r.model ?? 'unknown') ?? { n: 0, backup: 0, errors: 0 }
    m.n++; if (r.used_fallback) m.backup++; if (r.status === 'error') m.errors++
    byModel.set(r.model ?? 'unknown', m)
  }
  const modelRows = [...byModel.entries()].sort((a, b) => b[1].n - a[1].n).map(([label, m]) => ({ label, value: m.n, sub: `${m.backup} as backup, ${m.errors} errors` }))

  // Where things break
  const failures = reqs.filter((r) => r.state === 'failed' || r.state === 'abandoned')
  const failRows = ['Step 1', 'Step 2', 'Step 3+', 'Saving', 'Abandoned'].map((label) => ({
    label,
    value: failures.filter((r) =>
      label === 'Abandoned' ? r.state === 'abandoned'
      : label === 'Saving' ? r.state === 'failed' && !r.failed_step
      : label === 'Step 3+' ? (r.failed_step ?? 0) >= 3
      : r.failed_step === Number(label.slice(-1))).length,
  }))
  const recent = failures.slice(0, 8)

  return (
    <div className="b-page">
      <PageHead title="Pipeline health" error={error?.message}>
        How the AI prompt chain is doing: how many memes people asked for, how many came back, how long each step takes, and where it breaks.
        Built from the generation request and LLM response logs.
      </PageHead>

      <section className="b-hero" aria-label="Last 7 days">
        <div className="b-hero-main">
          <b>{successRate === null ? '—' : `${Math.round(successRate * 100)}%`}</b>
          <span>of meme requests succeeded in the last 7 days ({succeeded.length} of {finished.length})</span>
        </div>
        <dl className="b-kpis">
          <div><dt>Requests, 7 days</dt><dd>{week.length}</dd></div>
          <div><dt>Typical time</dt><dd>{secs(p50)}<small className="b-kpi-sub">slowest 5%: {secs(p95)}</small></dd></div>
          <div><dt>Backup model used</dt><dd>{backupRate === null ? '—' : `${Math.round(backupRate * 100)}%`}<small className="b-kpi-sub">of AI calls</small></dd></div>
          <div><dt>Tokens, 7 days</dt><dd>{tokens ? tokens.toLocaleString() : '—'}</dd></div>
        </dl>
      </section>

      <div className="b-grid-2">
        <DailyRuns runs={reqs.filter((r) => r.state !== 'running').map((r) => ({ at: r.created_at, ok: r.state === 'succeeded' }))} />
        <BarList
          title="Where requests fail"
          note={failures.length ? `${failures.length} of ${reqs.length} requests in 14 days didn’t produce a meme.` : 'No failed requests in the last 14 days.'}
          rows={failRows} format="count" head={['Failed at', 'Requests']}
        />
      </div>
      <div className="b-grid-2">
        <BarList
          title="How long each step takes"
          note={stepRows.length ? 'Median seconds per successful AI call, last 14 days. Hover for the slowest 5% (p95).' : 'No AI calls logged yet.'}
          rows={stepRows} format="seconds" head={['Step', 'Median']}
        />
        <BarList
          title="Which model answered"
          note={modelRows.length ? 'AI calls per model, last 14 days, including when it stepped in as the backup.' : 'No AI calls logged yet.'}
          rows={modelRows} format="count" head={['Model', 'Calls']}
        />
      </div>

      <section className="b-card">
        <h3>Latest failures</h3>
        <p className="b-card-note">Open a request to see the exact prompt and error.</p>
        {!recent.length ? <p className="b-muted">Nothing has failed in the last 14 days.</p> : (
          <div className="b-table-wrap">
            <table className="b-table">
              <thead><tr><th>Request</th><th>When (UTC)</th><th>Chain</th><th>Status</th><th>What happened</th></tr></thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id}>
                    <td><Link className="b-link" href={`/requests/${r.id}`}>#{r.id}</Link></td>
                    <td><time dateTime={r.created_at}>{when(r.created_at)}</time></td>
                    <td><code>{r.chain_slug ?? '—'}</code></td>
                    <td><StatusPill status={r.state} /></td>
                    <td><span className="b-clamp" title={r.error ?? ''}>{r.state === 'abandoned' ? 'Closed before the captions step finished' : `Step ${r.failed_step ?? '—'}: ${r.error ?? 'Unknown error'}`}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
