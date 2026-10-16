'use client'
import { useEffect, useState, type DragEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { sbBrowser } from '@/lib/sb/browser'
import { toJpeg } from '@/lib/resize'
import MemeThumb from '@/components/MemeThumb'

type Stage = 'pick' | 'uploading' | 'thinking' | 'review' | 'saving'
type Draft = { description: string; captions: string[]; descriptionPrompt: string; captionPrompt: string }

const STEPS = ['Uploading your photo', 'AI is describing it and writing five captions', 'Review and edit', 'Save']

export default function NewMeme({ adminId }: { adminId: string }) {
  const router = useRouter()
  const [stage, setStage] = useState<Stage>('pick')
  const [error, setError] = useState('')
  const [preview, setPreview] = useState<string | null>(null)
  const [path, setPath] = useState<string | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [over, setOver] = useState(false)

  // Leaving before saving: offer a warning; the uploaded photo is cleaned up on Start over
  useEffect(() => {
    if (stage === 'pick') return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [stage])

  async function startOver() {
    if (path) await sbBrowser().storage.from('memes').remove([path])
    if (preview) URL.revokeObjectURL(preview)
    setPath(null); setPreview(null); setDraft(null); setError(''); setStage('pick')
  }

  async function handle(file?: File) {
    if (!file) return
    setError('')
    if (!file.type.startsWith('image/')) return setError('That file isn’t an image. Choose a JPG, PNG, WebP or GIF.')
    if (file.size > 25 * 1024 * 1024) return setError('That image is over 25 MB. Choose a smaller one.')
    let blob: Blob
    try { blob = await toJpeg(file) } catch { return setError('This browser can’t read that image format. Try a JPG or PNG.') }
    setPreview(URL.createObjectURL(blob))

    const supabase = sbBrowser()
    const p = `${adminId}/${crypto.randomUUID()}.jpg`
    setStage('uploading')
    const up = await supabase.storage.from('memes').upload(p, blob, { contentType: 'image/jpeg' })
    if (up.error) { setStage('pick'); setPreview(null); return setError('The upload didn’t go through. Check your connection and try again.') }
    setPath(p)

    setStage('thinking')
    const res = await fetch('/api/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ path: p }) })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) {
      await supabase.storage.from('memes').remove([p])
      setPath(null); setPreview(null); setStage('pick')
      return setError(data.error || 'The AI couldn’t finish. Try again in a minute.')
    }
    setDraft({ description: data.description, captions: data.captions, descriptionPrompt: data.descriptionPrompt, captionPrompt: data.captionPrompt })
    setStage('review')
  }

  async function save() {
    if (!draft || !path) return
    setStage('saving')
    setError('')
    const supabase = sbBrowser()
    const { data: image, error: e1 } = await supabase
      .from('meme_images')
      .insert({ user_id: adminId, storage_path: path, description: draft.description.trim(), description_prompt: draft.descriptionPrompt })
      .select('id')
      .single()
    if (e1 || !image) { setStage('review'); return setError('The meme didn’t save. Try again.') }
    const rows = draft.captions.map((c) => c.trim()).filter(Boolean).map((content) => ({ image_id: image.id, content, caption_prompt: draft.captionPrompt }))
    const { error: e2 } = await supabase.from('meme_captions').insert(rows)
    if (e2) {
      await supabase.from('meme_images').delete().eq('id', image.id)
      setStage('review')
      return setError('The captions didn’t save. Try again.')
    }
    router.replace(`/memes/${image.id}`)
    router.refresh()
  }

  const stepIndex = stage === 'pick' ? -1 : stage === 'uploading' ? 0 : stage === 'thinking' ? 1 : stage === 'review' ? 2 : 3
  const valid = !!draft && !!draft.description.trim() && draft.captions.filter((c) => c.trim()).length >= 1

  return (
    <div className="b-page">
      <Link href="/memes" className="b-back">← All memes</Link>
      <header className="b-head">
        <div>
          <h1>Make a meme</h1>
          <p>Upload a photo and the same AI prompt chain Caption Club uses writes a description and five captions. Edit anything before you save.</p>
        </div>
      </header>

      {stage !== 'pick' && (
        <ol className="b-stepper" aria-label="Progress">
          {STEPS.map((s, i) => <li key={s} className={i < stepIndex ? 'done' : i === stepIndex ? 'active' : ''}>{s}</li>)}
        </ol>
      )}

      {stage === 'pick' && (
        <label
          className={`b-drop${over ? ' is-over' : ''}`}
          onDragOver={(e: DragEvent) => { e.preventDefault(); setOver(true) }}
          onDragLeave={() => setOver(false)}
          onDrop={(e: DragEvent) => { e.preventDefault(); setOver(false); handle(e.dataTransfer.files?.[0]) }}
        >
          <input type="file" accept="image/*" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = '' }} />
          <span className="b-drop-icon" aria-hidden="true">+</span>
          <strong>Drop a photo here, or click to choose one</strong>
          <span>JPG, PNG, WebP or GIF, up to 25 MB.</span>
        </label>
      )}
      {error && <p className="b-error" role="alert">{error}</p>}

      {(stage === 'uploading' || stage === 'thinking') && preview && (
        <div className="b-working">
          <img src={preview} alt="Your photo" />
          <p><span className="b-spinner" aria-hidden="true" />{stage === 'uploading' ? 'Uploading…' : 'The AI is looking at your photo and writing captions. This takes about 10–20 seconds.'}</p>
        </div>
      )}

      {(stage === 'review' || stage === 'saving') && draft && (
        <div className="b-edit">
          <div className="b-edit-preview">
            <MemeThumb url={preview} caption={draft.captions[0] ?? ''} alt={draft.description} size="lg" />
            <p className="b-muted">Preview with caption 1.</p>
          </div>
          <div className="b-edit-form">
            <label className="b-field">
              <span>What the AI saw <small>(description)</small></span>
              <textarea rows={5} value={draft.description} maxLength={2000} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </label>
            <div className="b-field">
              <span>Captions</span>
              <ol className="b-cap-edit">
                {draft.captions.map((c, i) => (
                  <li key={i}>
                    <span className="b-cap-n">{i + 1}</span>
                    <input value={c} maxLength={200} aria-label={`Caption ${i + 1}`}
                      onChange={(e) => setDraft({ ...draft, captions: draft.captions.map((x, j) => (j === i ? e.target.value : x)) })} />
                  </li>
                ))}
              </ol>
            </div>
            <div className="b-save-row">
              <button className="b-btn b-btn-primary" onClick={save} disabled={!valid || stage === 'saving'}>{stage === 'saving' ? 'Saving…' : 'Save meme'}</button>
              <button className="b-btn b-btn-outline" onClick={startOver} disabled={stage === 'saving'}>Start over</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
