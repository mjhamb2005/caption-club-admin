import type { CaptionRow, MemeRow, UserRow, VoteRow } from './data'

export type CaptionScore = { ups: number; downs: number; score: number }

export function scoreCaptions(votes: VoteRow[]) {
  const s = new Map<number, CaptionScore>()
  for (const v of votes) {
    const x = s.get(v.caption_id) ?? { ups: 0, downs: 0, score: 0 }
    if (v.value > 0) x.ups++
    else x.downs++
    x.score += v.value
    s.set(v.caption_id, x)
  }
  return s
}

const words = (t: string) => t.trim().split(/\s+/).filter(Boolean).length

export function computeStats(memes: MemeRow[], captions: CaptionRow[], votes: VoteRow[], users: UserRow[]) {
  const scores = scoreCaptions(votes)
  const sc = (id: number) => scores.get(id) ?? { ups: 0, downs: 0, score: 0 }
  const memeById = new Map(memes.map((m) => [m.id, m]))
  const capsByMeme = new Map<number, CaptionRow[]>()
  for (const c of captions) {
    if (!memeById.has(c.image_id)) continue
    const list = capsByMeme.get(c.image_id) ?? []
    list.push(c)
    capsByMeme.set(c.image_id, list)
  }
  capsByMeme.forEach((l) => l.sort((a, b) => a.id - b.id))

  const ups = votes.filter((v) => v.value > 0).length
  const totals = {
    memes: memes.length,
    captions: captions.length,
    votes: votes.length,
    ups,
    downs: votes.length - ups,
    voters: new Set(votes.map((v) => v.user_id)).size,
    makers: new Set(memes.map((m) => m.user_id)).size,
    users: users.length,
    upShare: votes.length ? ups / votes.length : 0,
  }

  // The crowd's favorite captions
  const headliners = captions
    .map((c) => ({ caption: c, ...sc(c.id) }))
    .filter((x) => x.score > 0 && memeById.has(x.caption.image_id))
    .sort((a, b) => b.score - a.score || b.ups - a.ups)
    .slice(0, 5)

  // Captions that split the room: lots of ups AND lots of downs
  const divisive = captions
    .map((c) => ({ caption: c, ...sc(c.id) }))
    .filter((x) => x.ups > 0 && x.downs > 0 && memeById.has(x.caption.image_id))
    .sort((a, b) => Math.min(b.ups, b.downs) - Math.min(a.ups, a.downs) || b.ups + b.downs - (a.ups + a.downs))
    .slice(0, 5)

  // Which of the AI's five tries ends up winning? Position = the order the AI wrote them in.
  const positionWins = [0, 0, 0, 0, 0]
  let decided = 0
  capsByMeme.forEach((list) => {
    if (!list.some((c) => sc(c.id).ups + sc(c.id).downs > 0)) return
    let best = 0
    list.forEach((c, i) => { if (sc(c.id).score > sc(list[best].id).score) best = i })
    if (sc(list[best].id).score <= 0 || best > 4) return
    positionWins[best]++
    decided++
  })

  // Are short captions funnier? Average score by length (only captions people voted on)
  const buckets = [
    { label: '1–4 words', min: 1, max: 4 },
    { label: '5–7 words', min: 5, max: 7 },
    { label: '8–10 words', min: 8, max: 10 },
    { label: '11+ words', min: 11, max: 999 },
  ].map((b) => {
    const hit = captions.filter((c) => { const w = words(c.content); const s = sc(c.id); return w >= b.min && w <= b.max && s.ups + s.downs > 0 })
    const avg = hit.length ? hit.reduce((t, c) => t + sc(c.id).score, 0) / hit.length : 0
    return { label: b.label, avg, count: hit.length }
  })

  // Who's on stage most: memes made and the votes their captions earned
  const capMeme = new Map(captions.map((c) => [c.id, c.image_id]))
  const earned = new Map<string, number>()
  for (const v of votes) {
    const meme = memeById.get(capMeme.get(v.caption_id) ?? -1)
    if (meme) earned.set(meme.user_id, (earned.get(meme.user_id) ?? 0) + v.value)
  }
  const userById = new Map(users.map((u) => [u.id, u]))
  const makers = [...new Set(memes.map((m) => m.user_id))]
    .map((id) => ({ user: userById.get(id) ?? null, id, memes: memes.filter((m) => m.user_id === id).length, earned: earned.get(id) ?? 0 }))
    .sort((a, b) => b.memes - a.memes || b.earned - a.earned)
    .slice(0, 5)

  return { totals, headliners, divisive, positionWins, decided, buckets, makers, scores }
}
