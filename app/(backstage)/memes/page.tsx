import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { displayName, loadEverything, signUrls } from '@/lib/data'
import { scoreCaptions } from '@/lib/stats'
import MemesTable, { type MemeItem } from './MemesTable'

export const dynamic = 'force-dynamic'

export default async function MemesPage() {
  const { supabase } = await requireAdmin()
  const { memes, captions, votes, users, error } = await loadEverything(supabase)
  const scores = scoreCaptions(votes)
  const urls = await signUrls(supabase, memes.map((m) => m.storage_path))
  const userById = new Map(users.map((u) => [u.id, u]))

  const items: MemeItem[] = memes.map((m) => {
    const caps = captions.filter((c) => c.image_id === m.id)
    let top = caps[0]
    let ups = 0, downs = 0
    for (const c of caps) {
      const s = scores.get(c.id)
      if (s) { ups += s.ups; downs += s.downs }
      if (top && (s?.score ?? 0) > (scores.get(top.id)?.score ?? 0)) top = c
    }
    return {
      id: m.id,
      url: urls.get(m.storage_path) ?? null,
      description: m.description,
      createdAt: m.created_at,
      maker: displayName(userById.get(m.user_id)),
      makerId: m.user_id,
      topCaption: top?.content ?? '',
      captionText: caps.map((c) => c.content).join(' '),
      captionCount: caps.length,
      ups, downs,
    }
  })

  return (
    <div className="b-page">
      <header className="b-head">
        <div>
          <h1>Memes</h1>
          <p>Every AI-generated meme: the photo, the AI’s description and its captions. Create, edit or delete any of them.</p>
        </div>
        <Link href="/memes/new" className="b-btn b-btn-primary">Make a meme</Link>
      </header>
      {error && <p className="b-alert" role="alert">Some data couldn’t load ({error}).</p>}
      <MemesTable items={items} />
    </div>
  )
}
