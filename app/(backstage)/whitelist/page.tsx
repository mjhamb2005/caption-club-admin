import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import CrudTable from '@/components/CrudTable'

export const dynamic = 'force-dynamic'

export default async function WhitelistPage() {
  const { supabase } = await requireAdmin()
  const { data, error } = await supabase.from('whitelisted_emails').select('*').order('email')
  return (
    <div className="b-page">
      <PageHead title="Whitelisted emails" error={error?.message}>
        Individual people who can create an account even though their email domain isn’t on the allowed list, such as a PM using a personal Gmail.
      </PageHead>
      <CrudTable
        table="whitelisted_emails" noun="email" rows={data ?? []} searchKeys={['email', 'note']}
        deleteNote="If they haven’t signed up yet, they won’t be able to (existing accounts keep working)."
        columns={[
          { key: 'email', label: 'Email', kind: 'mono' },
          { key: 'note', label: 'Note' },
          { key: 'created_at', label: 'Added', kind: 'date' },
        ]}
        fields={[
          { key: 'email', label: 'Email', type: 'text', required: true, lower: true, maxLength: 254, placeholder: 'name@gmail.com' },
          { key: 'note', label: 'Note', type: 'text', maxLength: 200, placeholder: 'Who they are' },
        ]}
      />
    </div>
  )
}
