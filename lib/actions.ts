'use client'
import { sbBrowser } from './sb/browser'

const friendly = (m: string) => (/row-level security|permission|superadmin/i.test(m) ? 'Your account isn’t allowed to do that. Are you still a superadmin?' : m)

// Delete a meme: its captions and votes go with it (ON DELETE CASCADE), then remove the photo
export async function deleteMeme(id: number) {
  const supabase = sbBrowser()
  const { data, error } = await supabase.from('meme_images').delete().eq('id', id).select('storage_path')
  if (error) throw new Error(friendly(error.message))
  if (!data?.length) throw new Error('That meme was already deleted, or your account can’t delete it.')
  await supabase.storage.from('memes').remove(data.map((r: { storage_path: string }) => r.storage_path))
}
