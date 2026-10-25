import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import type { ResponseRow } from '@/lib/pipeline'
import ResponsesTable from './ResponsesTable'

export const dynamic = 'force-dynamic'

export default async function ResponsesPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from('llm_responses').select('*').order('id', { ascending: false }).limit(500)
  return (
    <div className="b-page">
      <PageHead title="LLM responses" error={error?.message}>
        Every call to an AI model, newest first: the exact prompt, what came back, which model answered, how long it took and how many tokens it used.
        Showing the latest 500. Read-only.
      </PageHead>
      <ResponsesTable rows={(data ?? []) as ResponseRow[]} />
    </div>
  )
}
