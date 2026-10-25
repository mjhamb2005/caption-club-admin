import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import CrudTable from '@/components/CrudTable'

export const dynamic = 'force-dynamic'

export default async function DomainsPage() {
  const { supabase } = await requireAdmin()
  const [{ data, error }, { count }] = await Promise.all([
    supabase.from('allowed_signup_domains').select('*').order('domain'),
    supabase.from('whitelisted_emails').select('id', { count: 'exact', head: true }),
  ])
  const open = !error && !(data ?? []).length && !count
  return (
    <div className="b-page">
      <PageHead title="Allowed sign-up domains" error={error?.message}>
        A brand-new Caption Club account is only created if its email ends in one of these domains, or is on the whitelist. Existing accounts are never affected.
      </PageHead>
      {open && <p className="b-note">Both lists are empty, so <b>anyone</b> with a Google account can sign up right now.</p>}
      <CrudTable
        table="allowed_signup_domains" noun="domain" rows={data ?? []} searchKeys={['domain', 'note']}
        deleteNote="New accounts from this domain will be turned away (existing ones keep working)."
        columns={[
          { key: 'domain', label: 'Domain', kind: 'mono' },
          { key: 'note', label: 'Note' },
          { key: 'created_at', label: 'Added', kind: 'date' },
        ]}
        fields={[
          { key: 'domain', label: 'Domain', type: 'text', required: true, lower: true, maxLength: 253, placeholder: 'columbia.edu', help: 'Just the part after @. Subdomains need their own row.' },
          { key: 'note', label: 'Note', type: 'text', maxLength: 200 },
        ]}
      />
    </div>
  )
}
