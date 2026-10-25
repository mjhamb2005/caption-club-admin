import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import { displayName, type UserRow } from '@/lib/data'
import { REQUEST_COLS, effectiveStatus, type RequestRow } from '@/lib/pipeline'
import RequestsTable from './RequestsTable'

export const dynamic = 'force-dynamic'

export default async function RequestsPage() {
  const { supabase } = await requireAdmin()
  const [{ data, error }, { data: users }, { data: resp }] = await Promise.all([
    supabase.from('generation_requests').select(REQUEST_COLS).order('created_at', { ascending: false }).limit(1000),
    supabase.rpc('admin_users'),
    supabase.from('llm_responses').select('request_id, used_fallback, attempts').order('id', { ascending: false }).limit(5000),
  ])
  const names = new Map(((users ?? []) as UserRow[]).map((u) => [u.id, displayName(u)]))
  const calls = new Map<number, { n: number; fallback: boolean; retries: number }>()
  for (const r of (resp ?? []) as any[]) {
    const c = calls.get(r.request_id) ?? { n: 0, fallback: false, retries: 0 }
    c.n++; c.fallback ||= r.used_fallback; c.retries += Math.max(0, r.attempts - 1)
    calls.set(r.request_id, c)
  }
  const now = Date.now()
  const rows = ((data ?? []) as RequestRow[]).map((r) => ({
    ...r, state: effectiveStatus(r, now), who: r.user_id ? names.get(r.user_id) ?? 'Unknown user' : 'Deleted user',
    calls: calls.get(r.id)?.n ?? 0, fallback: calls.get(r.id)?.fallback ?? false, retries: calls.get(r.id)?.retries ?? 0,
  }))
  return (
    <div className="b-page">
      <PageHead title="Generation requests" error={error?.message}>
        One row every time someone asks the AI for a meme, in Caption Club or here: who, which chain, how long it took, and where it failed.
        Open one to see every AI call it made. Read-only.
      </PageHead>
      <RequestsTable rows={rows} />
    </div>
  )
}
