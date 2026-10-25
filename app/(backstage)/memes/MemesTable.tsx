'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import MemeThumb from '@/components/MemeThumb'
import Confirm from '@/components/Confirm'
import { deleteMeme } from '@/lib/actions'

export type MemeItem = {
  id: number; url: string | null; description: string; createdAt: string; maker: string; makerId: string
  topCaption: string; captionText: string; captionCount: number; ups: number; downs: number
}

const SORTS = { newest: 'Newest', votes: 'Most votes', score: 'Best score', oldest: 'Oldest' } as const

export default function MemesTable({ items: initial }: { items: MemeItem[] }) {
  const router = useRouter()
  const [items, setItems] = useState(initial)
  const [q, setQ] = useState('')
  const [maker, setMaker] = useState('all')
  const [sort, setSort] = useState<keyof typeof SORTS>('newest')
  const [doomed, setDoomed] = useState<MemeItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')

  const makers = useMemo(() => [...new Map(items.map((i) => [i.makerId, i.maker])).entries()].sort((a, b) => a[1].localeCompare(b[1])), [items])
  const term = q.trim().toLowerCase()
  const shown = items
    .filter((i) => (maker === 'all' || i.makerId === maker) && (!term || `${i.captionText} ${i.description} ${i.maker}`.toLowerCase().includes(term)))
    .sort((a, b) =>
      sort === 'newest' ? b.createdAt.localeCompare(a.createdAt)
      : sort === 'oldest' ? a.createdAt.localeCompare(b.createdAt)
      : sort === 'votes' ? b.ups + b.downs - (a.ups + a.downs)
      : b.ups - b.downs - (a.ups - a.downs))

  async function confirmDelete() {
    if (!doomed) return
    setBusy(true)
    setError('')
    try {
      await deleteMeme(doomed.id)
      setItems((l) => l.filter((x) => x.id !== doomed.id))
      setToast('Meme deleted.')
      setTimeout(() => setToast(''), 3000)
      setDoomed(null)
      router.refresh()
    } catch (e: any) {
      setError(e?.message || 'Couldn’t delete it. Try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="b-filters">
        <input className="b-search" type="search" placeholder="Search captions, descriptions or makers" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search memes" />
        <label className="b-select"><span>Made by</span>
          <select value={maker} onChange={(e) => setMaker(e.target.value)}>
            <option value="all">Anyone</option>
            {makers.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
          </select>
        </label>
        <label className="b-select"><span>Sort</span>
          <select value={sort} onChange={(e) => setSort(e.target.value as keyof typeof SORTS)}>
            {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <span className="b-count">{shown.length} of {items.length}</span>
      </div>

      {shown.length === 0 ? (
        <div className="b-empty">
          <h2>{items.length ? 'No memes match' : 'No memes yet'}</h2>
          <p>{items.length ? 'Try a different search or filter.' : 'Make the first one: upload a photo and the AI writes the captions.'}</p>
          {!items.length && <Link href="/memes/new" className="b-btn b-btn-primary">Make a meme</Link>}
        </div>
      ) : (
        <ul className="b-meme-list">
          {shown.map((m) => (
            <li key={m.id} className="b-meme-row">
              <Link href={`/memes/${m.id}`} className="b-meme-row-thumb"><MemeThumb url={m.url} caption={m.topCaption} alt={m.description} size="sm" /></Link>
              <div className="b-meme-row-main">
                <Link href={`/memes/${m.id}`} className="b-meme-row-title">{m.topCaption || 'No captions'}</Link>
                <p className="b-meme-row-desc">{m.description}</p>
                <p className="b-meme-row-meta">
                  <span>{m.maker}</span>
                  <span><time dateTime={m.createdAt}>{m.createdAt.slice(0, 10)}</time></span>
                  <span>{m.captionCount} captions</span>
                </p>
              </div>
              <div className="b-meme-row-votes" aria-label={`${m.ups} upvotes, ${m.downs} downvotes`}>
                <span className="up">▲ {m.ups}</span><span className="down">▼ {m.downs}</span>
              </div>
              <div className="b-meme-row-actions">
                <Link href={`/memes/${m.id}`} className="b-btn b-btn-outline b-btn-sm">Edit</Link>
                <button className="b-btn b-btn-danger b-btn-sm" onClick={() => { setError(''); setDoomed(m) }}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Confirm
        open={!!doomed} title="Delete this meme?" confirmLabel="Delete meme" busy={busy} error={error}
        onCancel={() => setDoomed(null)} onConfirm={confirmDelete}
      >
        {doomed && (
          <div className="b-confirm-meme">
            <MemeThumb url={doomed.url} caption={doomed.topCaption} alt={doomed.description} />
            <p>The photo, all {doomed.captionCount} captions and {doomed.ups + doomed.downs} votes are removed from Caption Club for everyone. This can’t be undone.</p>
          </div>
        )}
      </Confirm>
      {toast && <div className="b-toast" role="status">{toast}</div>}
    </>
  )
}
