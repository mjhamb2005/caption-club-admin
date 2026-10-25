'use client'
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'

// Small hand-built charts in the Backstage style: thin marks, hairline grid, hover tooltips,
// and a table view under every chart so no number is hover-only.

type Tip = { x: number; y: number; value: string; label: string } | null

function useTip() {
  const [tip, setTip] = useState<Tip>(null)
  const box = useRef<HTMLDivElement>(null)
  const show = (e: { clientX: number; clientY: number } | DOMRect, value: string, label: string) => {
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const p = 'clientX' in e ? { x: e.clientX, y: e.clientY } : { x: e.left + e.width / 2, y: e.top }
    setTip({ x: p.x - r.left, y: p.y - r.top, value, label })
  }
  const el = tip && (
    <div className="b-tip" style={{ left: tip.x, top: tip.y }} role="status">
      <b>{tip.value}</b>
      <span>{tip.label}</span>
    </div>
  )
  return { box, show, hide: () => setTip(null), el }
}

function TableView({ head, rows }: { head: [string, string]; rows: [string, string][] }) {
  return (
    <details className="b-table-view">
      <summary>Show as table</summary>
      <table>
        <thead><tr><th>{head[0]}</th><th>{head[1]}</th></tr></thead>
        <tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td>{b}</td></tr>)}</tbody>
      </table>
    </details>
  )
}

const niceMax = (v: number) => {
  if (v <= 4) return 4
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = [1, 2, 2.5, 5, 10].find((m) => m * p >= v)!
  return n * p
}

// Votes per day for the last 14 days, in the viewer's own time zone
export function DailyVotes({ times }: { times: string[] }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])
  const { box, show, hide, el } = useTip()

  const days = useMemo(() => {
    if (now === null) return []
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const out = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() - (13 - i))
      return { date: d, count: 0 }
    })
    for (const t of times) {
      const d = new Date(t)
      d.setHours(0, 0, 0, 0)
      const hit = out.find((x) => x.date.getTime() === d.getTime())
      if (hit) hit.count++
    }
    return out
  }, [times, now])

  const max = niceMax(Math.max(0, ...days.map((d) => d.count)))
  const W = 640, H = 212, padL = 32, padB = 26, top = 22, plotH = H - padB - top, band = (W - padL) / 14, bar = Math.min(24, band - 8)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const peak = days.reduce((b, d, i) => (d.count > (days[b]?.count ?? -1) ? i : b), 0)
  const total = days.reduce((t, d) => t + d.count, 0)

  return (
    <figure className="b-chart">
      <figcaption>
        <h3>Votes, last 14 days</h3>
        <p>{now === null ? ' ' : `${total} ${total === 1 ? 'vote' : 'votes'} in two weeks${days[peak]?.count ? `, busiest on ${fmt(days[peak].date)}` : ''}.`}</p>
      </figcaption>
      <div className="b-plot" ref={box} onPointerLeave={hide}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Column chart of votes per day for the last 14 days">
          {[0, 0.5, 1].map((f) => {
            const y = top + plotH * (1 - f)
            return (
              <g key={f}>
                <line x1={padL} x2={W} y1={y} y2={y} className="b-grid" />
                <text x={padL - 8} y={y + 4} className="b-axis" textAnchor="end">{Math.round(max * f)}</text>
              </g>
            )
          })}
          {days.map((d, i) => {
            const h = (d.count / max) * plotH
            const x = padL + i * band + (band - bar) / 2
            const y = top + plotH - h
            const r = Math.min(4, h / 2)
            return (
              <g key={i}>
                {h > 0 && (
                  <path
                    className={i === days.length - 1 ? 'b-mark b-mark-hi' : 'b-mark'}
                    // rounded top, square at the baseline
                    d={`M${x},${top + plotH}V${y + r}q0,-${r} ${r},-${r}h${bar - 2 * r}q${r},0 ${r},${r}V${top + plotH}Z`}
                  />
                )}
                {(i % 2 === 1 || i === days.length - 1) && (
                  <text x={x + bar / 2} y={H - 6} className="b-axis" textAnchor="middle">{i === days.length - 1 ? 'Today' : fmt(d.date)}</text>
                )}
                <rect
                  x={padL + i * band} y={0} width={band} height={top + plotH} className="b-hit" tabIndex={0}
                  aria-label={`${fmt(d.date)}: ${d.count} votes`}
                  onPointerMove={(e) => show(e, `${d.count} ${d.count === 1 ? 'vote' : 'votes'}`, fmt(d.date))}
                  onFocus={(e) => show(e.currentTarget.getBoundingClientRect(), `${d.count} votes`, fmt(d.date))}
                  onBlur={hide}
                />
              </g>
            )
          })}
          {days[peak]?.count > 0 && (
            <text
              x={padL + peak * band + band / 2}
              y={top + plotH - (days[peak].count / max) * plotH - 6}
              className="b-label" textAnchor="middle"
            >{days[peak].count}</text>
          )}
        </svg>
        {el}
      </div>
      <TableView head={['Day', 'Votes']} rows={days.map((d) => [fmt(d.date), String(d.count)])} />
    </figure>
  )
}

// When people vote: day of week x hour of day, one hue from dim to bright
const RAMP = ['#2C2234', '#4A3A26', '#7A5D2C', '#B88A33', '#FFD25A']
const DOW = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
const hourLabel = (h: number) => (h === 0 ? '12a' : h < 12 ? `${h}a` : h === 12 ? '12p' : `${h - 12}p`)

export function VoteHeatmap({ times }: { times: string[] }) {
  const [ready, setReady] = useState(false)
  useEffect(() => setReady(true), [])
  const { box, show, hide, el } = useTip()

  const grid = useMemo(() => {
    const g = Array.from({ length: 7 }, () => Array(24).fill(0) as number[])
    if (!ready) return g
    for (const t of times) {
      const d = new Date(t)
      g[(d.getDay() + 6) % 7][d.getHours()]++
    }
    return g
  }, [times, ready])

  const max = Math.max(1, ...grid.flat())
  const step = (n: number) => (n === 0 ? 0 : Math.min(4, 1 + Math.floor(((n - 1) / max) * 4)))
  let best = { d: 0, h: 0, n: 0 }
  grid.forEach((row, d) => row.forEach((n, h) => { if (n > best.n) best = { d, h, n } }))
  const C = 22, G = 3, L = 40, T = 22
  const W = L + 24 * (C + G), H = T + 7 * (C + G)

  return (
    <figure className="b-chart">
      <figcaption>
        <h3>When the crowd votes</h3>
        <p>{!ready ? ' ' : best.n ? `Peak: ${DOW[best.d]}s around ${hourLabel(best.h)}, in your time zone.` : 'No votes yet.'}</p>
      </figcaption>
      <div className="b-plot b-plot-scroll" ref={box} onPointerLeave={hide}>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ minWidth: 560 }} role="img" aria-label="Heatmap of votes by day of week and hour">
          {[0, 6, 12, 18].map((h) => (
            <text key={h} x={L + h * (C + G) + C / 2} y={14} className="b-axis" textAnchor="middle">{hourLabel(h)}</text>
          ))}
          {grid.map((row, d) => (
            <g key={d}>
              <text x={L - 8} y={T + d * (C + G) + C / 2 + 4} className="b-axis" textAnchor="end">{DOW[d]}</text>
              {row.map((n, h) => (
                <rect
                  key={h} x={L + h * (C + G)} y={T + d * (C + G)} width={C} height={C} rx={4}
                  fill={RAMP[step(n)]} className="b-cell" tabIndex={n ? 0 : -1}
                  aria-label={`${DOW[d]} ${hourLabel(h)}: ${n} votes`}
                  onPointerMove={(e) => show(e, `${n} ${n === 1 ? 'vote' : 'votes'}`, `${DOW[d]}, ${hourLabel(h)}–${hourLabel((h + 1) % 24)}`)}
                  onFocus={(e) => show(e.currentTarget.getBoundingClientRect(), `${n} votes`, `${DOW[d]}, ${hourLabel(h)}`)}
                  onBlur={hide}
                />
              ))}
            </g>
          ))}
        </svg>
        {el}
      </div>
      <div className="b-scale" aria-hidden="true">
        <span>Fewer</span>
        {RAMP.map((c) => <i key={c} style={{ background: c }} />)}
        <span>More</span>
      </div>
      <TableView
        head={['Day', 'Votes (busiest hour)']}
        rows={grid.map((row, d) => {
          const tot = row.reduce((a, b) => a + b, 0)
          const h = row.indexOf(Math.max(...row))
          return [DOW[d], tot ? `${tot} (most at ${hourLabel(h)})` : '0']
        })}
      />
    </figure>
  )
}

// Horizontal bars, one series. The top bar is the story, so it gets the accent; the rest stay quiet.
export function BarList({
  title,
  note,
  rows,
  format: kind,
  head,
}: {
  title: string
  note: ReactNode
  rows: { label: string; value: number; sub?: string }[]
  format: 'percent' | 'score' | 'count' | 'seconds'
  head: [string, string]
}) {
  const format = (v: number) => (kind === 'percent' ? `${Math.round(v * 100)}%` : kind === 'count' ? String(Math.round(v)) : kind === 'seconds' ? (v < 1 ? `${Math.round(v * 1000)} ms` : `${v.toFixed(1)} s`) : v > 0 ? `+${v.toFixed(1)}` : v.toFixed(1))
  const max = Math.max(...rows.map((r) => Math.abs(r.value)), 0.0001)
  const top = rows.reduce((b, r, i) => (r.value > rows[b].value ? i : b), 0)
  return (
    <figure className="b-chart">
      <figcaption>
        <h3>{title}</h3>
        <p>{note}</p>
      </figcaption>
      <ul className="b-bars">
        {rows.map((r, i) => (
          <li key={r.label} title={r.sub}>
            <span className="b-bars-label">{r.label}</span>
            <span className="b-bars-track">
              <span
                className={`b-bars-fill${i === top && r.value > 0 ? ' is-hi' : ''}`}
                style={{ width: `${Math.max(0, (r.value / max) * 100)}%` }}
              />
            </span>
            <span className="b-bars-value">{format(r.value)}</span>
          </li>
        ))}
      </ul>
      <TableView head={head} rows={rows.map((r) => [r.label, `${format(r.value)}${r.sub ? ` (${r.sub})` : ''}`])} />
    </figure>
  )
}

// Meme requests per day for the last 14 days, split into succeeded (bright) and failed (rose), stacked
export function DailyRuns({ runs }: { runs: { at: string; ok: boolean }[] }) {
  const [now, setNow] = useState<number | null>(null)
  useEffect(() => setNow(Date.now()), [])
  const { box, show, hide, el } = useTip()
  const days = useMemo(() => {
    if (now === null) return []
    const start = new Date(now)
    start.setHours(0, 0, 0, 0)
    const out = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start)
      d.setDate(d.getDate() - (13 - i))
      return { date: d, ok: 0, failed: 0 }
    })
    for (const r of runs) {
      const d = new Date(r.at)
      d.setHours(0, 0, 0, 0)
      const hit = out.find((x) => x.date.getTime() === d.getTime())
      if (hit) { if (r.ok) hit.ok++; else hit.failed++ }
    }
    return out
  }, [runs, now])
  const max = niceMax(Math.max(0, ...days.map((d) => d.ok + d.failed)))
  const W = 640, H = 212, padL = 32, padB = 26, top = 22, plotH = H - padB - top, band = (W - padL) / 14, bar = Math.min(24, band - 8)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  const ok = days.reduce((t, d) => t + d.ok, 0), failed = days.reduce((t, d) => t + d.failed, 0)
  return (
    <figure className="b-chart">
      <figcaption>
        <h3>Meme requests, last 14 days</h3>
        <p>{now === null ? ' ' : `${ok} succeeded, ${failed} failed or abandoned.`}</p>
      </figcaption>
      <div className="b-legend"><span><i className="b-sw ok" />Succeeded</span><span><i className="b-sw bad" />Failed or abandoned</span></div>
      <div className="b-plot" ref={box} onPointerLeave={hide}>
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Stacked column chart of meme requests per day, succeeded and failed">
          {[0, 0.5, 1].map((f) => {
            const y = top + plotH * (1 - f)
            return (
              <g key={f}>
                <line x1={padL} x2={W} y1={y} y2={y} className="b-grid" />
                <text x={padL - 8} y={y + 4} className="b-axis" textAnchor="end">{Math.round(max * f)}</text>
              </g>
            )
          })}
          {days.map((d, i) => {
            const hOk = (d.ok / max) * plotH, hBad = (d.failed / max) * plotH
            const x = padL + i * band + (band - bar) / 2
            const label = `${d.ok} succeeded, ${d.failed} failed`
            return (
              <g key={i}>
                {hOk > 0 && <rect x={x} y={top + plotH - hOk} width={bar} height={hOk} className="b-mark-hi" />}
                {hBad > 0 && <rect x={x} y={top + plotH - hOk - hBad} width={bar} height={Math.max(0, hBad - (hOk > 0 ? 2 : 0))} className="b-mark-bad" />}
                {(i % 2 === 1 || i === days.length - 1) && (
                  <text x={x + bar / 2} y={H - 6} className="b-axis" textAnchor="middle">{i === days.length - 1 ? 'Today' : fmt(d.date)}</text>
                )}
                <rect x={padL + i * band} y={0} width={band} height={top + plotH} className="b-hit" tabIndex={0} aria-label={`${fmt(d.date)}: ${label}`}
                  onPointerMove={(e) => show(e, label, fmt(d.date))}
                  onFocus={(e) => show(e.currentTarget.getBoundingClientRect(), label, fmt(d.date))} onBlur={hide} />
              </g>
            )
          })}
        </svg>
        {el}
      </div>
      <TableView head={['Day', 'Succeeded / failed']} rows={days.map((d) => [fmt(d.date), `${d.ok} / ${d.failed}`])} />
    </figure>
  )
}
