import { notFound } from 'next/navigation'
import { requireAdmin } from '@/lib/admin'
import { displayName, signUrls } from '@/lib/data'
import MemeEditor from './MemeEditor'

export const dynamic = 'force-dynamic'

export default async function MemePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const memeId = Number(id)
  if (!Number.isInteger(memeId) || memeId <= 0) notFound()
  const { supabase } = await requireAdmin()

  const { data: meme } = await supabase
    .from('meme_images')
    .select('id, user_id, storage_path, description, created_at, meme_captions(id, content)')
    .eq('id', memeId)
    .maybeSingle()
  if (!meme) notFound()

  const captions = [...((meme as any).meme_captions ?? [])].sort((a: any, b: any) => a.id - b.id)
  const [{ data: votes }, { data: users }, urls] = await Promise.all([
    captions.length
      ? supabase.from('meme_votes').select('id, caption_id, user_id, value, created_at').in('caption_id', captions.map((c: any) => c.id)).order('created_at', { ascending: false })
      : Promise.resolve({ data: [] as any[] }),
    supabase.rpc('admin_users'),
    signUrls(supabase, [meme.storage_path]),
  ])
  const userById = new Map(((users as any[]) ?? []).map((u) => [u.id, u]))

  return (
    <MemeEditor
      meme={{
        id: meme.id,
        url: urls.get(meme.storage_path) ?? null,
        description: meme.description,
        createdAt: meme.created_at,
        maker: displayName(userById.get(meme.user_id)),
      }}
      initialCaptions={captions.map((c: any) => ({ id: c.id, content: c.content }))}
      votes={((votes as any[]) ?? []).map((v) => ({ id: v.id, captionId: v.caption_id, value: v.value, createdAt: v.created_at, voter: displayName(userById.get(v.user_id)) }))}
    />
  )
}
