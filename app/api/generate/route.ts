import { NextResponse } from 'next/server'
import { adminOrNull } from '@/lib/admin'
import { DESCRIBE_PROMPT, captionPrompt, describeImage, writeCaptions } from '@/lib/ai'

export const maxDuration = 60

// Runs the AI prompt chain on a photo an admin just uploaded, but saves nothing.
// The admin reviews and edits the results before creating the meme.
export async function POST(request: Request) {
  const admin = await adminOrNull()
  if (!admin) return NextResponse.json({ error: 'Superadmins only.' }, { status: 403 })
  const { supabase, user } = admin

  const body = await request.json().catch(() => null)
  const path = typeof body?.path === 'string' ? body.path : ''
  if (!path.startsWith(`${user.id}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'That upload doesn’t belong to you.' }, { status: 403 })
  }

  const { data: file, error } = await supabase.storage.from('memes').download(path)
  if (error || !file) return NextResponse.json({ error: 'Couldn’t find the uploaded photo. Try again.' }, { status: 404 })

  try {
    const description = (await describeImage(Buffer.from(await file.arrayBuffer()).toString('base64'))).slice(0, 2000)
    if (!description) throw new Error('Empty description')
    const captions = await writeCaptions(description)
    return NextResponse.json({ description, captions, descriptionPrompt: DESCRIBE_PROMPT, captionPrompt: captionPrompt(description) })
  } catch (e) {
    console.error('generate failed', e)
    return NextResponse.json({ error: 'The AI couldn’t finish. Try again in a minute.' }, { status: 502 })
  }
}
