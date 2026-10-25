// Shared helpers for the AI pipeline pages.
export type RequestRow = {
  id: number; created_at: string; finished_at: string | null; user_id: string | null; source: string
  chain_id: number | null; chain_slug: string | null; storage_path: string | null; meme_image_id: number | null
  caption_count: number | null; status: 'running' | 'succeeded' | 'failed'; failed_step: number | null; error: string | null; total_ms: number | null
}
export type ResponseRow = {
  id: number; created_at: string; request_id: number; step_id: number | null; step_order: number; step_name: string | null
  provider: string | null; model: string | null; used_fallback: boolean; attempts: number; status: 'ok' | 'error'; http_status: number | null
  prompt?: string | null; response?: string | null; error: string | null; latency_ms: number | null; input_tokens: number | null; output_tokens: number | null
}

export const REQUEST_COLS = 'id, created_at, finished_at, user_id, source, chain_id, chain_slug, storage_path, meme_image_id, caption_count, status, failed_step, error, total_ms'
export const RESPONSE_COLS = 'id, created_at, request_id, step_id, step_order, step_name, provider, model, used_fallback, attempts, status, http_status, error, latency_ms, input_tokens, output_tokens'

// A request still "running" after 5 minutes was abandoned (the person closed the tab between steps).
export const STALE_MS = 5 * 60 * 1000
export function effectiveStatus(r: Pick<RequestRow, 'status' | 'created_at'>, now = Date.now()) {
  return r.status === 'running' && now - new Date(r.created_at).getTime() > STALE_MS ? 'abandoned' : r.status
}

export function percentile(values: number[], p: number) {
  if (!values.length) return null
  const s = [...values].sort((a, b) => a - b)
  return s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))]
}

export const secs = (ms: number | null | undefined) => (ms === null || ms === undefined ? '—' : ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`)
export const when = (iso: string) => iso.replace('T', ' ').slice(0, 16)
