'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sbBrowser } from '@/lib/sb/browser'
import { friendlyDbError } from '@/components/CrudTable'

type Row = { id: number; name: string; slug: string; description: string | null; active: boolean; weight: number; captionCount: number; hasRow: boolean; updatedAt: string | null }

export default function MixEditor({ rows }: { rows: Row[] }) {
  const router = useRouter()
  const [draft, setDraft] = useState(() => Object.fromEntries(rows.map((r) => [r.id, { weight: r.weight, captionCount: r.captionCount }])))
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const total = rows.reduce((s, r) => s + (r.active ? draft[r.id]?.weight ?? 0 : 0), 0)
  const changed = rows.filter((r) => draft[r.id].weight !== r.weight || draft[r.id].captionCount !== r.captionCount || !r.hasRow)
  const invalid = rows.some((r) => {
    const d = draft[r.id]
    return !Number.isInteger(d.weight) || d.weight < 0 || d.weight > 100 || !Number.isInteger(d.captionCount) || d.captionCount < 3 || d.captionCount > 10
  })

  async function save() {
    setBusy(true); setMsg(null)
    const supabase = sbBrowser()
    const { data: { user } } = await supabase.auth.getUser()
    try {
      for (const r of changed) {
        const values = { weight: draft[r.id].weight, caption_count: draft[r.id].captionCount, updated_by: user?.id ?? null }
        const res = r.hasRow
          ? await supabase.from('prompt_chain_mix').update(values).eq('chain_id', r.id).select('chain_id')
          : await supabase.from('prompt_chain_mix').insert({ chain_id: r.id, ...values }).select('chain_id')
        if (res.error) throw new Error(friendlyDbError(res.error, 'mix'))
        if (!res.data?.length) throw new Error('Nothing saved. Your account may not be allowed to change the mix.')
      }
      setMsg({ ok: true, text: total ? 'Mix saved. New memes use it right away.' : 'Saved. Every weight is 0, so new memes use the built-in prompts.' })
      router.refresh()
    } catch (e: unknown) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : 'The mix didn’t save.' })
    } finally {
      setBusy(false)
    }
  }

  const set = (id: number, k: 'weight' | 'captionCount', v: string) => setDraft((d) => ({ ...d, [id]: { ...d[id], [k]: v === '' ? NaN : Math.round(Number(v)) } }))

  return (
    <>
      <div className="b-mix">
        {rows.map((r) => {
          const d = draft[r.id]
          const share = r.active && total ? (d.weight || 0) / total : 0
          return (
            <section key={r.id} className={`b-mix-row${!r.active ? ' is-off' : ''}`}>
              <div className="b-mix-head">
                <h3><Link className="b-link" href={`/prompt-chains/${r.id}`}>{r.name}</Link> <code>{r.slug}</code></h3>
                {r.description && <p>{r.description}</p>}
                {!r.active && <p className="b-muted">This chain is inactive, so it never runs whatever its weight.</p>}
              </div>
              <label className="b-mix-weight">
                <span>Weight</span>
                <input type="range" min={0} max={100} value={Number.isFinite(d.weight) ? d.weight : 0} onChange={(e) => set(r.id, 'weight', e.target.value)} aria-label={`${r.name} weight slider`} />
                <input className="b-input b-num" type="number" min={0} max={100} value={Number.isFinite(d.weight) ? d.weight : ''} onChange={(e) => set(r.id, 'weight', e.target.value)} aria-label={`${r.name} weight`} />
              </label>
              <label className="b-mix-count">
                <span>Captions per meme</span>
                <input className="b-input b-num" type="number" min={3} max={10} value={Number.isFinite(d.captionCount) ? d.captionCount : ''} onChange={(e) => set(r.id, 'captionCount', e.target.value)} />
              </label>
              <div className="b-mix-share" aria-label={`${Math.round(share * 100)} percent of new memes`}>
                <b>{Math.round(share * 100)}%</b>
                <span className="b-meter"><i style={{ width: `${share * 100}%` }} /></span>
                <small>of new memes</small>
              </div>
            </section>
          )
        })}
      </div>
      <div className="b-save-row b-mt">
        <button className="b-btn b-btn-primary" onClick={save} disabled={busy || invalid || !changed.length}>{busy ? 'Saving…' : 'Save mix'}</button>
        {invalid && <span className="b-error">Weights are whole numbers from 0 to 100; captions from 3 to 10.</span>}
        {!invalid && changed.length > 0 && !busy && <span className="b-muted">Unsaved changes</span>}
        {msg && <p className={msg.ok ? 'b-ok' : 'b-error'} role="status">{msg.text}</p>}
      </div>
    </>
  )
}
