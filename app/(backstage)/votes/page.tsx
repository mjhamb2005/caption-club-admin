import { requireAdmin } from '@/lib/admin'
import { displayName, loadEverything } from '@/lib/data'
import VotesTable, { type VoteItem } from './VotesTable'

export const dynamic = 'force-dynamic'

export default async function VotesPage() {
  const { supabase } = await requireAdmin()
  const { memes, captions, votes, users, error } = await loadEverything(supabase)
  const capById = new Map(captions.map((c) => [c.id, c]))
  const memeIds = new Set(memes.map((m) => m.id))
  const userById = new Map(users.map((u) => [u.id, u]))
  const items: VoteItem[] = votes.map((v) => {
    const c = capById.get(v.caption_id)
    return {
      id: v.id,
      value: v.value,
      createdAt: v.created_at,
      voter: displayName(userById.get(v.user_id)),
      voterId: v.user_id,
      caption: c?.content ?? 'Deleted caption',
      memeId: c && memeIds.has(c.image_id) ? c.image_id : null,
    }
  })
  return (
    <div className="b-page">
      <header className="b-head">
        <div>
          <h1>Votes</h1>
          <p>Every upvote and downvote cast in Caption Club, newest first. Read-only.</p>
        </div>
      </header>
      {error && <p className="b-alert" role="alert">Votes couldn’t load ({error}). Have you run supabase/admin-setup.sql?</p>}
      <VotesTable items={items} />
    </div>
  )
}
