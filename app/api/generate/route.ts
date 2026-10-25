import { NextResponse } from 'next/server'
import { adminOrNull } from '@/lib/admin'
import { finishRequest, logStep, pickChain, render, runStep, runTextSteps, startRequest } from '@/lib/chain'

export const maxDuration = 60

// Runs the same prompt chain Caption Club uses (picked from the mix) on a photo an admin just uploaded.
// Saves no meme: the admin reviews and edits first. The run is logged as a "backstage" generation request,
// and the meme is linked to it when the admin saves.
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

  const chain = await pickChain(supabase)
  const requestId = await startRequest(supabase, { userId: user.id, source: 'backstage', chain, storagePath: path })
  const startedAt = Date.now()
  const first = chain.steps[0]

  try {
    let description: string
    try {
      // Both steps share one 60-second request here: about 25s to describe, 28s to write captions
      const result = await runStep(first, render(first.template, chain, {}), Buffer.from(await file.arrayBuffer()).toString('base64'), 25_000)
      await logStep(supabase, requestId, first, { result })
      description = result.text.slice(0, 2000)
    } catch (e: any) {
      await logStep(supabase, requestId, first, { error: e })
      throw Object.assign(e, { failedStep: 1 })
    }
    const { captions, captionPrompt } = await runTextSteps(supabase, requestId, chain, description, Math.max(10_000, 53_000 - (Date.now() - startedAt)))
    await finishRequest(supabase, requestId, { status: 'succeeded', startedAt })
    return NextResponse.json({ description, captions, descriptionPrompt: first.template, captionPrompt, requestId, chain: chain.name })
  } catch (e: any) {
    console.error('generate failed', e)
    await finishRequest(supabase, requestId, { status: 'failed', startedAt, failedStep: e?.failedStep, error: String(e?.message ?? e) })
    return NextResponse.json({ error: 'The AI couldn’t finish. Try again in a minute.', requestId }, { status: 502 })
  }
}
