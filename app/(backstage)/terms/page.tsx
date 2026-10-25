import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import CrudTable from '@/components/CrudTable'

export const dynamic = 'force-dynamic'

export default async function TermsPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from('terms').select('*').order('term')
  return (
    <div className="b-page">
      <PageHead title="Terms" error={error?.message}>
        A glossary of comedy techniques. Every term that’s on is added to the caption prompt wherever a step uses <code>{'{{terms}}'}</code>, so the AI can use it.
      </PageHead>
      <CrudTable
        table="terms" noun="term" rows={data ?? []} searchKeys={['term', 'definition']}
        columns={[
          { key: 'term', label: 'Term' },
          { key: 'definition', label: 'Definition', kind: 'clamp' },
          { key: 'example', label: 'Example', kind: 'clamp' },
          { key: 'is_active', label: 'In prompt', kind: 'bool' },
          { key: 'updated_at', label: 'Updated', kind: 'date' },
        ]}
        fields={[
          { key: 'term', label: 'Term', type: 'text', required: true, maxLength: 60, placeholder: 'Rule of three' },
          { key: 'definition', label: 'Definition', type: 'textarea', required: true, maxLength: 500 },
          { key: 'example', label: 'Example', type: 'text', maxLength: 300 },
          { key: 'is_active', label: 'Include in the caption prompt', type: 'bool' },
        ]}
        emptyHint="Add a comedy technique the AI should know about."
      />
    </div>
  )
}
