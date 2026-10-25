import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import CrudTable from '@/components/CrudTable'

export const dynamic = 'force-dynamic'

const STYLES = [
  { value: 'gemini', label: 'Google Gemini API' },
  { value: 'openai_compatible', label: 'OpenAI-compatible (chat/completions)' },
]

export default async function ProvidersPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from('llm_providers').select('*').order('name')
  return (
    <div className="b-page">
      <PageHead title="LLM providers" error={error?.message}>
        The AI companies Caption Club can call. Keys are never stored here: each provider names the Vercel environment variable that holds its key,
        and it must end in <code>_API_KEY</code>.
      </PageHead>
      <CrudTable
        table="llm_providers" noun="provider" rows={data ?? []} searchKeys={['name', 'api_base_url']}
        deleteNote="Delete its models first."
        columns={[
          { key: 'name', label: 'Provider' },
          { key: 'api_style', label: 'API', kind: 'option', options: STYLES },
          { key: 'api_base_url', label: 'Base URL', kind: 'mono' },
          { key: 'api_key_env', label: 'Key variable', kind: 'mono' },
          { key: 'is_active', label: 'Active', kind: 'bool' },
        ]}
        fields={[
          { key: 'name', label: 'Name', type: 'text', required: true, maxLength: 80, placeholder: 'OpenAI' },
          { key: 'api_style', label: 'API style', type: 'select', required: true, options: STYLES },
          { key: 'api_base_url', label: 'Base URL', type: 'text', required: true, maxLength: 300, placeholder: 'https://api.openai.com/v1', help: 'Must start with https://' },
          { key: 'api_key_env', label: 'Key environment variable', type: 'text', required: true, maxLength: 64, placeholder: 'OPENAI_API_KEY', help: 'Uppercase, ending in _API_KEY. Add the real key in Vercel → Settings → Environment Variables.' },
          { key: 'notes', label: 'Notes', type: 'text', maxLength: 500 },
          { key: 'is_active', label: 'Active (inactive providers are skipped)', type: 'bool' },
        ]}
        defaults={{ api_style: 'openai_compatible', is_active: true }}
      />
    </div>
  )
}
