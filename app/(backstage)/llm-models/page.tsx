import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import CrudTable from '@/components/CrudTable'

export const dynamic = 'force-dynamic'

export default async function ModelsPage() {
  const { supabase } = await requireAdmin()
  const [{ data, error }, { data: providers }, { data: steps }] = await Promise.all([
    supabase.from('llm_models').select('*').order('provider_id').order('name'),
    supabase.from('llm_providers').select('id, name').order('name'),
    supabase.from('prompt_chain_steps').select('model_id, fallback_model_id'),
  ])
  const providerOptions = (providers ?? []).map((p: any) => ({ value: String(p.id), label: p.name }))
  const uses = new Map<number, number>()
  for (const s of (steps ?? []) as any[]) for (const id of [s.model_id, s.fallback_model_id]) if (id) uses.set(id, (uses.get(id) ?? 0) + 1)
  const rows = (data ?? []).map((m: any) => ({ ...m, used_by: uses.get(m.id) ?? 0 }))
  return (
    <div className="b-page">
      <PageHead title="LLM models" error={error?.message}>
        The models prompt chain steps can use. Turning a model off makes its steps use their backup model; if a step has no active model, Caption Club
        falls back to its built-in prompts so making memes never breaks.
      </PageHead>
      <CrudTable
        table="llm_models" noun="model" rows={rows} searchKeys={['name', 'api_model_id']}
        deleteNote="Steps that use it lose this model and switch to their backup."
        columns={[
          { key: 'name', label: 'Model' },
          { key: 'provider_id', label: 'Provider', kind: 'option', options: providerOptions },
          { key: 'api_model_id', label: 'API model ID', kind: 'mono' },
          { key: 'supports_images', label: 'Sees images', kind: 'bool' },
          { key: 'used_by', label: 'Used by steps', kind: 'num' },
          { key: 'is_active', label: 'Active', kind: 'bool' },
        ]}
        fields={[
          { key: 'provider_id', label: 'Provider', type: 'select', required: true, options: providerOptions },
          { key: 'name', label: 'Display name', type: 'text', required: true, maxLength: 80, placeholder: 'Gemini 3.8 Flash' },
          { key: 'api_model_id', label: 'API model ID', type: 'text', required: true, maxLength: 120, placeholder: 'gemini-3.8-flash', help: 'Exactly as the provider’s API expects it.' },
          { key: 'supports_images', label: 'Can read images (needed for step 1)', type: 'bool' },
          { key: 'notes', label: 'Notes', type: 'text', maxLength: 500 },
          { key: 'is_active', label: 'Active', type: 'bool' },
        ]}
        defaults={{ supports_images: true, is_active: true }}
      />
    </div>
  )
}
