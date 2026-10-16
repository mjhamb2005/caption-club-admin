import Link from 'next/link'
import { requireAdmin } from '@/lib/admin'
import { displayName, loadEverything, signUrls } from '@/lib/data'
import { computeStats } from '@/lib/stats'
import { BarList, DailyVotes, VoteHeatmap } from '@/components/Charts'
import MemeThumb from '@/components/MemeThumb'

export const dynamic = 'force-dynamic'

const pct = (v: number) => `${Math.round(v * 100)}%`
const fmt = (n: number) => (n >= 10000 ? `${(n / 1000).toFixed(1)}K` : n.toLocaleString('en-US'))

export default async function Dashboard() {
  const { supabase } = await requireAdmin()
  const { memes, captions, votes, users, error } = await loadEverything(supabase)
  const s = computeStats(memes, captions, votes, users)

  const memeById = new Map(memes.map((m) => [m.id, m]))
  const urls = await signUrls(supabase, [...new Set(s.headliners.map((h) => memeById.get(h.caption.image_id)!.storage_path))])
  const winner = s.positionWins.indexOf(Math.max(...s.positionWins))

  return (
    <div className="b-page">
      <header className="b-head">
        <div>
          <h1>Tonight’s numbers</h1>
          <p>How Caption Club’s crowd is laughing, live from the database.</p>
        </div>
        <Link href="/memes/new" className="b-btn b-btn-primary">Make a meme</Link>
      </header>

      {error && <p className="b-alert" role="alert">Some data couldn’t load ({error}). Have you run supabase/admin-setup.sql?</p>}

      <section className="b-hero" aria-label="Headline numbers">
        <div className="b-hero-main">
          <b>{fmt(s.totals.votes)}</b>
          <span>votes cast on {fmt(s.totals.captions)} AI-written captions</span>
        </div>
        <dl className="b-kpis">
          <div><dt>Memes</dt><dd>{fmt(s.totals.memes)}</dd></div>
          <div><dt>People who voted</dt><dd>{fmt(s.totals.voters)} <small>of {fmt(s.totals.users)}</small></dd></div>
          <div><dt>Meme makers</dt><dd>{fmt(s.totals.makers)}</dd></div>
          <div>
            <dt>Upvotes</dt>
            <dd>{s.totals.votes ? pct(s.totals.upShare) : '—'}</dd>
            <span className="b-meter" role="img" aria-label={`${pct(s.totals.upShare)} of votes are upvotes`}>
              <i style={{ width: pct(s.totals.upShare) }} />
            </span>
          </div>
        </dl>
      </section>

      <div className="b-grid-2">
        <DailyVotes times={votes.map((v) => v.created_at)} />
        <VoteHeatmap times={votes.map((v) => v.created_at)} />
      </div>

      <div className="b-grid-2">
        <BarList
          title="Does the AI’s first idea win?"
          note={
            s.decided
              ? <>Across {s.decided} memes with a clear winner, caption #{winner + 1} of the AI’s five wins most often.</>
              : 'Once memes have a winning caption, this shows which of the AI’s five tries wins.'
          }
          rows={s.positionWins.map((n, i) => ({ label: `Caption #${i + 1}`, value: s.decided ? n / s.decided : 0, sub: `${n} wins` }))}
          format="percent"
          head={['AI’s order', 'Share of wins']}
        />
        <BarList
          title="Are short captions funnier?"
          note="Average score (upvotes minus downvotes) of captions people voted on, by length."
          rows={s.buckets.map((b) => ({ label: b.label, value: b.avg, sub: `${b.count} captions` }))}
          format="score"
          head={['Length', 'Average score']}
        />
      </div>

      <div className="b-grid-3">
        <section className="b-card">
          <h3>Headliners</h3>
          <p className="b-card-note">The five highest-scoring captions.</p>
          {s.headliners.length === 0 ? <p className="b-muted">No votes yet.</p> : (
            <ol className="b-rank">
              {s.headliners.map((h, i) => {
                const m = memeById.get(h.caption.image_id)!
                return (
                  <li key={h.caption.id}>
                    <span className="b-rank-n">{i + 1}</span>
                    <Link href={`/memes/${m.id}`} className="b-rank-thumb"><MemeThumb url={urls.get(m.storage_path) ?? null} alt={m.description} size="sm" /></Link>
                    <span className="b-rank-text">{h.caption.content}</span>
                    <span className="b-rank-score">+{h.score}</span>
                  </li>
                )
              })}
            </ol>
          )}
        </section>

        <section className="b-card">
          <h3>Split the room</h3>
          <p className="b-card-note">Captions with the most upvotes and downvotes at once.</p>
          {s.divisive.length === 0 ? <p className="b-muted">Nothing divisive yet.</p> : (
            <ol className="b-rank">
              {s.divisive.map((d) => (
                <li key={d.caption.id}>
                  <Link href={`/memes/${d.caption.image_id}`} className="b-rank-text b-link">{d.caption.content}</Link>
                  <span className="b-split" aria-label={`${d.ups} up, ${d.downs} down`}>
                    <span className="up">▲ {d.ups}</span><span className="down">▼ {d.downs}</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="b-card">
          <h3>Most active makers</h3>
          <p className="b-card-note">Who uploads the most, and the net votes their memes earned.</p>
          {s.makers.length === 0 ? <p className="b-muted">No memes yet.</p> : (
            <ol className="b-rank">
              {s.makers.map((m) => (
                <li key={m.id}>
                  <span className="b-avatar-sm">
                    {m.user?.profile_photo_url ? <img src={m.user.profile_photo_url} alt="" /> : <span>{displayName(m.user)[0]?.toUpperCase()}</span>}
                  </span>
                  <span className="b-rank-text">{displayName(m.user)}</span>
                  <span className="b-rank-score">{m.memes} {m.memes === 1 ? 'meme' : 'memes'}<small>{m.earned >= 0 ? '+' : ''}{m.earned} net</small></span>
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}
