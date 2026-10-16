// Raw rows Backstage reads. Superadmin rules in the database let these queries see everyone's data.
export type MemeRow = { id: number; user_id: string; storage_path: string; description: string; created_at: string }
export type CaptionRow = { id: number; image_id: number; content: string; created_at: string }
export type VoteRow = { id: number; caption_id: number; user_id: string; value: number; created_at: string }
export type UserRow = {
  id: string; email: string; created_at: string; last_sign_in_at: string | null
  first_name: string | null; last_name: string | null; profile_photo_url: string | null
  is_superadmin: boolean; memes_made: number; votes_cast: number
}

export async function loadEverything(supabase: any) {
  const [m, c, v, u] = await Promise.all([
    supabase.from('meme_images').select('id, user_id, storage_path, description, created_at').order('created_at', { ascending: false }).limit(2000),
    supabase.from('meme_captions').select('id, image_id, content, created_at').order('id').limit(10000),
    supabase.from('meme_votes').select('id, caption_id, user_id, value, created_at').order('created_at', { ascending: false }).limit(20000),
    supabase.rpc('admin_users'),
  ])
  return {
    memes: (m.data ?? []) as MemeRow[],
    captions: (c.data ?? []) as CaptionRow[],
    votes: (v.data ?? []) as VoteRow[],
    users: ((u.data ?? []) as UserRow[]).map((x) => ({ ...x, memes_made: Number(x.memes_made), votes_cast: Number(x.votes_cast) })),
    error: m.error?.message || c.error?.message || v.error?.message || u.error?.message || null,
  }
}

export async function signUrls(supabase: any, paths: string[]) {
  if (!paths.length) return new Map<string, string>()
  const { data } = await supabase.storage.from('memes').createSignedUrls(paths, 60 * 60 * 6)
  return new Map<string, string>(((data as any[]) ?? []).filter((s) => s.signedUrl).map((s) => [s.path, s.signedUrl]))
}

export function displayName(u?: Pick<UserRow, 'first_name' | 'last_name' | 'email'> | null) {
  if (!u) return 'Unknown user'
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email || 'Unknown user'
}
