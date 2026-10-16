'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sbBrowser } from '@/lib/sb/browser'
import { deleteMeme } from '@/lib/actions'
import MemeThumb from '@/components/MemeThumb'
import Confirm from '@/components/Confirm'

type Cap = { id: number | null; key: string; content: string; original: string; removed?: boolean }
type Vote = { id: number; captionId: number; value: number; createdAt: string; voter: string }

export default function MemeEditor({
  meme, initialCaptions, votes,
}: {
  meme: { id: number; url: string | null; description: string; createdAt: string; maker: string }
  initialCaptions: { id: number; content: string }[]
  votes: Vote[]
}) {
  const router = useRouter()
  const [description, setDescription] = useState(meme.description)
  const [savedDescription, setSavedDescription] = useState(meme.description)
  const [caps, setCaps] = useState<Cap[]>(initialCaptions.map((c) => ({ id: c.id, key: String(c.id), content: c.content, original: c.content })))
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  const tally = (id: number | null) => {
    const v = votes.filter((x) => x.captionId === id)
    const ups = v.filter((x) => x.value > 0).length
    return { ups, downs: v.length - ups }
  }
  const live = caps.filter((c) => !c.removed)
  const preview = [...live].sort((a, b) => (tally(b.id).ups - tally(b.id).downs) - (tally(a.id).ups - tally(a.id).downs))[0]?.content ?? ''
  const dirty = description.trim() !== savedDescription || caps.some((c) => c.removed ? c.id !== null : c.id === null ? !!c.content.trim() : c.content.trim() !== c.original)
  const invalid = !description.trim() || live.some((c) => c.id !== null && !c.content.trim()) || live.some((c) => c.content.length > 200)

  async function save() {
    setSaving(true)
    setMessage(null)
    const supabase = sbBrowser()
    try {
      if (description.trim() !== savedDescription) {
        const { data, error } = await supabase.from('meme_images').update({ description: description.trim() }).eq('id', meme.id).select('id')
        if (error || !data?.length) throw new Error(error?.message || 'The description didn’t save.')
      }
      for (const c of caps) {
        if (c.removed && c.id !== null) {
          const { error } = await supabase.from('meme_captions').delete().eq('id', c.id)
          if (error) throw new Error(error.message)
        } else if (!c.removed && c.id === null && c.content.trim()) {
          const { error } = await supabase.from('meme_captions').insert({ image_id: meme.id, content: c.content.trim() })
          if (error) throw new Error(error.message)
        } else if (!c.removed && c.id !== null && c.content.trim() !== c.original) {
          const { data, error } = await supabase.from('meme_captions').update({ content: c.content.trim() }).eq('id', c.id).select('id')
          if (error || !data?.length) throw new Error(error?.message || 'A caption didn’t save.')
        }
      }
      setSavedDescription(description.trim())
      setMessage({ kind: 'ok', text: 'Changes saved. They’re live in Caption Club now.' })
      router.refresh()
      // pick up new caption ids and drop removed rows
      const { data } = await supabase.from('meme_captions').select('id, content').eq('image_id', meme.id).order('id')
      if (data) setCaps(data.map((c: any) => ({ id: c.id, key: String(c.id), content: c.content, original: c.content })))
    } catch (e: any) {
      setMessage({ kind: 'error', text: /row-level|permission/i.test(e?.message) ? 'Your account isn’t allowed to make that change.' : e?.message || 'Something didn’t save. Try again.' })
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    setDeleting(true)
    setDeleteError('')
    try {
      await deleteMeme(meme.id)
      router.replace('/memes')
      router.refresh()
    } catch (e: any) {
      setDeleteError(e?.message || 'Couldn’t delete it.')
      setDeleting(false)
    }
  }

  return (
    <div className="b-page">
      <Link href="/memes" className="b-back">← All memes</Link>
      <header className="b-head">
        <div>
          <h1>Edit meme</h1>
          <p>Made by {meme.maker} on <time dateTime={meme.createdAt}>{meme.createdAt.slice(0, 10)}</time>. Edits go live in Caption Club as soon as you save.</p>
        </div>
        <button className="b-btn b-btn-danger" onClick={() => { setDeleteError(''); setConfirmOpen(true) }}>Delete meme</button>
      </header>

      <div className="b-edit">
        <div className="b-edit-preview">
          <MemeThumb url={meme.url} caption={preview} alt={description} size="lg" />
          <p className="b-muted">Preview shows the current top caption.</p>
        </div>

        <div className="b-edit-form">
          <label className="b-field">
            <span>What the AI saw <small>(description)</small></span>
            <textarea rows={5} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={2000} />
          </label>

          <div className="b-field">
            <span>Captions</span>
            <ol className="b-cap-edit">
              {caps.map((c, i) => {
                if (c.removed) return null
                const t = tally(c.id)
                return (
                  <li key={c.key}>
                    <span className="b-cap-n">{i + 1}</span>
                    <input value={c.content} maxLength={200} placeholder="Write a caption" aria-label={`Caption ${i + 1}`}
                      onChange={(e) => setCaps((l) => l.map((x) => (x.key === c.key ? { ...x, content: e.target.value } : x)))} />
                    <span className="b-split" aria-label={`${t.ups} up, ${t.downs} down`}><span className="up">▲ {t.ups}</span><span className="down">▼ {t.downs}</span></span>
                    <button className="b-icon-btn" aria-label={`Remove caption ${i + 1}`} title="Remove caption"
                      onClick={() => setCaps((l) => (c.id === null ? l.filter((x) => x.key !== c.key) : l.map((x) => (x.key === c.key ? { ...x, removed: true } : x))))}>×</button>
                  </li>
                )
              })}
            </ol>
            {caps.some((c) => c.removed) && <p className="b-muted">Removed captions (and their votes) are deleted when you save.</p>}
            <button className="b-btn b-btn-quiet b-btn-sm" onClick={() => setCaps((l) => [...l, { id: null, key: `new-${Date.now()}`, content: '', original: '' }])}>+ Add a caption</button>
          </div>

          <div className="b-save-row">
            <button className="b-btn b-btn-primary" onClick={save} disabled={!dirty || invalid || saving}>{saving ? 'Saving…' : 'Save changes'}</button>
            {dirty && !saving && <span className="b-muted">Unsaved changes</span>}
            {message && <p className={message.kind === 'ok' ? 'b-ok' : 'b-error'} role="status">{message.text}</p>}
          </div>
        </div>
      </div>

      <section className="b-card b-mt">
        <h3>Votes on this meme</h3>
        <p className="b-card-note">{votes.length} {votes.length === 1 ? 'vote' : 'votes'}, newest first.</p>
        {votes.length === 0 ? <p className="b-muted">Nobody has voted on this meme yet.</p> : (
          <div className="b-table-wrap">
            <table className="b-table">
              <thead><tr><th>Voter</th><th>Vote</th><th>Caption</th><th>When (UTC)</th></tr></thead>
              <tbody>
                {votes.map((v) => (
                  <tr key={v.id}>
                    <td>{v.voter}</td>
                    <td>{v.value > 0 ? <span className="b-pill up">▲ Up</span> : <span className="b-pill down">▼ Down</span>}</td>
                    <td>{caps.find((c) => c.id === v.captionId)?.original ?? 'Removed caption'}</td>
                    <td><time dateTime={v.createdAt}>{v.createdAt.slice(0, 16).replace('T', ' ')}</time></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Confirm open={confirmOpen} title="Delete this meme?" confirmLabel="Delete meme" busy={deleting} error={deleteError}
        onCancel={() => setConfirmOpen(false)} onConfirm={remove}>
        <p>The photo, its {live.length} captions and {votes.length} votes are removed from Caption Club for everyone. This can’t be undone.</p>
      </Confirm>
    </div>
  )
}
