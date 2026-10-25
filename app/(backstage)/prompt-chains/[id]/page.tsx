import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import StepCard from '@/components/StepCard'
import StatusPill from '@/components/StatusPill'
import { REQUEST_COLS, effectiveStatus, secs, when, type RequestRow } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'
const MODEL = 'name, api_model_id, is_active'

export default async function ChainPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const { supabase } = await requireAdmin()
  const [{ data: chain, error }, { data: steps }, { data: mix }, { data: reqs }] = await Promise.all([
    supabase.from('prompt_chains').select('*').eq('id', id).maybeSingle(),
    supabase.from('prompt_chain_steps')
      .select(`*, model:llm_models!prompt_chain_steps_model_id_fkey(${MODEL}), fallback:llm_models!prompt_chain_steps_fallback_model_id_fkey(${MODEL})`)
      .eq('chain_id', id).order('step_order'),
    supabase.from('prompt_chain_mix').select('weight, caption_count').eq('chain_id', id).maybeSingle(),
    supabase.from('generation_requests').select(REQUEST_COLS).eq('chain_id', id).order('created_at', { ascending: false }).limit(10),
  ])
  if (!chain && !error) notFound()
  const now = Date.now()
  return (
    <div className="b-page">
      <Link href="/prompt-chains" className="b-back">← All prompt chains</Link>
      <PageHead title={chain?.name ?? 'Prompt chain'} error={error?.message} action={<Link className="b-btn b-btn-outline" href="/mix">Change the mix</Link>}>
        {chain?.description} <code>{chain?.slug}</code> · {chain?.is_active ? 'Active' : 'Inactive'} · weight {mix?.weight ?? 0} in the mix · {mix?.caption_count ?? 5} captions per meme
      </PageHead>
      <section className="b-steps" aria-label="Steps">
        {(steps ?? []).map((s: any) => <StepCard key={s.id} step={s} />)}
      </section>
      <section className="b-card b-mt">
        <h3>Latest runs</h3>
        <p className="b-card-note">The 10 most recent memes made with this chain.</p>
        {!reqs?.length ? <p className="b-muted">No runs yet.</p> : (
          <div className="b-table-wrap">
            <table className="b-table">
              <thead><tr><th>Request</th><th>Started (UTC)</th><th>Status</th><th className="num">Total time</th></tr></thead>
              <tbody>
                {(reqs as RequestRow[]).map((r) => (
                  <tr key={r.id}>
                    <td><Link className="b-link" href={`/requests/${r.id}`}>#{r.id}</Link></td>
                    <td><time dateTime={r.created_at}>{when(r.created_at)}</time></td>
                    <td><StatusPill status={effectiveStatus(r, now)} /></td>
                    <td className="num">{secs(r.total_ms)}</td>
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
