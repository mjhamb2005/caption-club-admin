import { requireAdmin } from '@/lib/admin'
import PageHead from '@/components/PageHead'
import StepCard from '@/components/StepCard'

export const dynamic = 'force-dynamic'
const MODEL = 'name, api_model_id, is_active'

export default async function StepsPage() {
  const { supabase } = await requireAdmin()
  const [{ data: steps, error }, { data: chains }] = await Promise.all([
    supabase.from('prompt_chain_steps')
      .select(`*, model:llm_models!prompt_chain_steps_model_id_fkey(${MODEL}), fallback:llm_models!prompt_chain_steps_fallback_model_id_fkey(${MODEL})`)
      .order('chain_id').order('step_order'),
    supabase.from('prompt_chains').select('id, name').order('id'),
  ])
  return (
    <div className="b-page">
      <PageHead title="Prompt chain steps" error={error?.message}>
        Every step of every chain, in order. Step 1 sees the photo; each later step gets the text before it, and the last one returns the captions.
        Placeholders like <code>{'{{description}}'}</code> are filled in when a meme is made.
      </PageHead>
      {(chains ?? []).map((c: any) => {
        const mine = (steps ?? []).filter((s: any) => s.chain_id === c.id)
        return (
          <section key={c.id} className="b-steps b-mt" aria-label={c.name}>
            <h2 className="b-section-title">{c.name} <small>{mine.length} steps</small></h2>
            {mine.map((s: any) => <StepCard key={s.id} step={s} chain={c} />)}
          </section>
        )
      })}
    </div>
  )
}
