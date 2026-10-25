import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import CrudTable from '@/components/CrudTable'

export const dynamic = 'force-dynamic'

export default async function ExamplesPage() {
  const { supabase } = await requireAdmin()
  const [{ data, error }, { data: chains }] = await Promise.all([
    supabase.from('ai_generation_examples').select('*').order('id', { ascending: false }),
    supabase.from('prompt_chains').select('id, name').order('id'),
  ])
  const chainOptions = (chains ?? []).map((c: any) => ({ value: String(c.id), label: c.name }))
  return (
    <div className="b-page">
      <PageHead title="AI generation examples" error={error?.message}>
        Few-shot examples: a photo description and a caption that landed. Up to 8 active examples are added to the caption prompt wherever a
        step uses <code>{'{{examples}}'}</code>, either for one chain or for all of them.
      </PageHead>
      <CrudTable
        table="ai_generation_examples" noun="example" rows={data ?? []} searchKeys={['caption', 'photo_description', 'notes']}
        columns={[
          { key: 'caption', label: 'Caption' },
          { key: 'photo_description', label: 'Photo description', kind: 'clamp' },
          { key: 'chain_id', label: 'Chain', kind: 'option', options: [...chainOptions] },
          { key: 'is_active', label: 'In prompt', kind: 'bool' },
          { key: 'updated_at', label: 'Updated', kind: 'date' },
        ]}
        fields={[
          { key: 'photo_description', label: 'Photo description', type: 'textarea', required: true, maxLength: 1000, placeholder: 'A cat sitting in a cardboard box far too small for it.' },
          { key: 'caption', label: 'Caption', type: 'text', required: true, maxLength: 200, placeholder: 'Working from home' },
          { key: 'chain_id', label: 'Chain', type: 'select', options: chainOptions, help: 'Leave empty to use this example in every chain.' },
          { key: 'notes', label: 'Why it works', type: 'text', maxLength: 500 },
          { key: 'is_active', label: 'Include in the caption prompt', type: 'bool' },
        ]}
        emptyHint="Add a caption that landed well so the AI learns the house style."
      />
    </div>
  )
}
