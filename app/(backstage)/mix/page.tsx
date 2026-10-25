import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import MixEditor from './MixEditor'

export const dynamic = 'force-dynamic'

export default async function MixPage() {
  const { supabase } = await requireAdmin()
  const [{ data: chains, error }, { data: mix }] = await Promise.all([
    supabase.from('prompt_chains').select('id, slug, name, description, is_active').order('id'),
    supabase.from('prompt_chain_mix').select('chain_id, weight, caption_count, updated_at'),
  ])
  const rows = (chains ?? []).map((c: any) => {
    const m = (mix ?? []).find((x: any) => x.chain_id === c.id)
    return { id: c.id, name: c.name, slug: c.slug, description: c.description, active: c.is_active, weight: m?.weight ?? 0, captionCount: m?.caption_count ?? 5, hasRow: !!m, updatedAt: m?.updated_at ?? null }
  })
  return (
    <div className="b-page">
      <PageHead title="Prompt chain mix" error={error?.message}>
        How Caption Club picks a chain for each new meme: a chain’s chance is its weight divided by the total. Set a weight to 0 to stop using a chain.
        If every weight is 0, Caption Club uses its built-in prompts.
      </PageHead>
      <MixEditor rows={rows} />
    </div>
  )
}
