import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import { effectiveStatus } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export default async function ChainsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: chains, error }, { data: steps }, { data: mix }, { data: reqs }] = await Promise.all([
    supabase.from('prompt_chains').select('*').order('id'),
    supabase.from('prompt_chain_steps').select('chain_id'),
    supabase.from('prompt_chain_mix').select('chain_id, weight, caption_count'),
    supabase.from('generation_requests').select('chain_id, status, created_at').order('created_at', { ascending: false }).limit(5000),
  ])
  const total = (mix ?? []).reduce((s: number, m: any) => s + (chains?.find((c: any) => c.id === m.chain_id)?.is_active ? m.weight : 0), 0)
  const now = Date.now()
  const rows = (chains ?? []).map((c: any) => {
    const m = (mix ?? []).find((x: any) => x.chain_id === c.id)
    const runs = (reqs ?? []).filter((r: any) => r.chain_id === c.id)
    const done = runs.filter((r: any) => ['succeeded', 'failed'].includes(effectiveStatus(r, now)))
    return {
      ...c,
      steps: (steps ?? []).filter((s: any) => s.chain_id === c.id).length,
      share: c.is_active && m && total ? m.weight / total : 0,
      captions: m?.caption_count ?? null,
      runs: runs.length,
      success: done.length ? done.filter((r: any) => r.status === 'succeeded').length / done.length : null,
    }
  })
  return (
    <div className="b-page">
      <PageHead title="Prompt chains" error={error?.message} action={<Link className="b-btn b-btn-outline" href="/mix">Change the mix</Link>}>
        Each chain is an ordered list of AI steps that turns a photo into captions. Read-only here; the mix decides how often each one runs.
      </PageHead>
      {!rows.length && !error ? <div className="b-empty"><h2>No prompt chains</h2><p>Run <code>supabase/week7-setup.sql</code> to add Caption Club’s chains.</p></div> : (
        <div className="b-table-wrap">
          <table className="b-table">
            <thead><tr><th>Chain</th><th>Slug</th><th className="num">Steps</th><th className="num">Share of new memes</th><th className="num">Captions</th><th className="num">Runs</th><th className="num">Success</th><th>Status</th></tr></thead>
            <tbody>
              {rows.map((c: any) => (
                <tr key={c.id}>
                  <td><Link className="b-link" href={`/prompt-chains/${c.id}`}><b>{c.name}</b></Link>{c.description && <small className="b-sub">{c.description}</small>}</td>
                  <td><code>{c.slug}</code></td>
                  <td className="num">{c.steps}</td>
                  <td className="num">{Math.round(c.share * 100)}%</td>
                  <td className="num">{c.captions ?? '—'}</td>
                  <td className="num">{c.runs}</td>
                  <td className="num">{c.success === null ? '—' : `${Math.round(c.success * 100)}%`}</td>
                  <td>{c.is_active ? <span className="b-pill up">Active</span> : <span className="b-pill off">Inactive</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
