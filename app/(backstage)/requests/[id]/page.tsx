import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import StatusPill from '@/components/StatusPill'
import MemeThumb from '@/components/MemeThumb'
import { displayName, signUrls, type UserRow } from '@/lib/data'
import { REQUEST_COLS, effectiveStatus, secs, when, type RequestRow, type ResponseRow } from '@/lib/pipeline'

export const dynamic = 'force-dynamic'

export default async function RequestPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id)
  if (!Number.isInteger(id)) notFound()
  const { supabase } = await requireAdmin()
  const [{ data: req, error }, { data: resp }, { data: users }] = await Promise.all([
    supabase.from('generation_requests').select(REQUEST_COLS).eq('id', id).maybeSingle(),
    supabase.from('llm_responses').select('*').eq('request_id', id).order('id'),
    supabase.rpc('admin_users'),
  ])
  if (!req && !error) notFound()
  const r = req as RequestRow | null
  const who = r?.user_id ? ((users ?? []) as UserRow[]).find((u) => u.id === r.user_id) : null
  const urls = r?.storage_path ? await signUrls(supabase, [r.storage_path]) : new Map<string, string>()
  const { data: caps } = r?.meme_image_id ? await supabase.from('meme_captions').select('id, content').eq('image_id', r.meme_image_id).order('id') : { data: null }
  const calls = (resp ?? []) as ResponseRow[]
  const tokens = calls.reduce((s, c) => s + (c.input_tokens ?? 0) + (c.output_tokens ?? 0), 0)

  return (
    <div className="b-page">
      <Link href="/requests" className="b-back">← All generation requests</Link>
      <PageHead title={`Request #${id}`} error={error?.message}>
        {r && <>Started {when(r.created_at)} UTC by {who ? displayName(who) : 'an unknown user'} in {r.source === 'backstage' ? 'Backstage' : 'Caption Club'}, using the <code>{r.chain_slug}</code> chain.</>}
      </PageHead>
      {r && (
        <div className="b-req">
          <div className="b-req-side">
            <MemeThumb url={r.storage_path ? urls.get(r.storage_path) ?? null : null} caption={caps?.[0]?.content ?? ''} alt="Uploaded photo" size="lg" />
            <dl className="b-facts b-facts-stack">
              <div><dt>Status</dt><dd><StatusPill status={effectiveStatus(r)} /></dd></div>
              <div><dt>Total time</dt><dd>{secs(r.total_ms)}</dd></div>
              <div><dt>AI calls</dt><dd>{calls.length}</dd></div>
              <div><dt>Tokens</dt><dd>{tokens ? tokens.toLocaleString() : '—'}</dd></div>
              <div><dt>Captions asked for</dt><dd>{r.caption_count ?? '—'}</dd></div>
              <div><dt>Meme</dt><dd>{r.meme_image_id ? <Link className="b-link" href={`/memes/${r.meme_image_id}`}>#{r.meme_image_id}</Link> : 'Not saved'}</dd></div>
            </dl>
            {r.error && <p className="b-alert">Failed at step {r.failed_step ?? '?'}: {r.error}</p>}
          </div>
          <ol className="b-timeline" aria-label="AI calls">
            {calls.length === 0 && <li className="b-muted">No AI calls were logged for this request.</li>}
            {calls.map((c) => (
              <li key={c.id} className={c.status === 'error' ? 'is-error' : ''}>
                <div className="b-timeline-head">
                  <span className="b-step-n sm">{c.step_order}</span>
                  <b>{c.step_name ?? `Step ${c.step_order}`}</b>
                  <StatusPill status={c.status} />
                  <span className="b-muted-inline"><code>{c.model}</code>{c.used_fallback && ' (backup model)'} · {secs(c.latency_ms)} · {c.attempts} {c.attempts === 1 ? 'try' : 'tries'}
                    {c.input_tokens !== null && ` · ${c.input_tokens} in / ${c.output_tokens ?? 0} out tokens`}</span>
                </div>
                {c.error && <p className="b-err-text">{c.http_status ? `HTTP ${c.http_status}: ` : ''}{c.error}</p>}
                <details className="b-prompt"><summary>Prompt sent</summary><pre>{c.prompt}</pre></details>
                {c.response && <details className="b-prompt" open><summary>Response</summary><pre>{c.response}</pre></details>}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
