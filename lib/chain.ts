/* eslint-disable @typescript-eslint/no-explicit-any */
// The AI prompt chain, driven by the database and logged for Backstage.
//
//   prompt_chain_mix      -> which chain a new meme uses (weighted pick) and how many captions it writes
//   prompt_chains / steps -> the prompts, in order; step 1 sees the photo, the last step returns captions
//   llm_models / providers-> which model answers each step, with a backup model if it's overloaded
//   terms / ai_generation_examples -> optional context fed into {{terms}} and {{examples}}
//   generation_requests   -> one row per meme attempt (status, timing, which chain, which meme it became)
//   llm_responses         -> one row per AI call (prompt, response, model, latency, tokens, errors)
//
// If any of that is missing or broken, the built-in prompts below run instead, so making a meme never
// depends on the configuration being perfect. Logging is best-effort and never blocks a meme.
//
// This file is identical in Caption Club and Backstage.
import { DESCRIBE_PROMPT, captionPrompt } from './ai'

type SB = any

export type ModelInfo = {
  name: string
  apiModelId: string
  provider: string
  apiStyle: 'gemini' | 'openai_compatible'
  baseUrl: string
  keyEnv: string
}

export type Step = {
  id: number | null
  order: number
  name: string
  template: string
  temperature: number | null
  json: boolean
  model: ModelInfo
  fallback: ModelInfo | null
}

export type Chain = {
  id: number | null
  slug: string
  name: string
  captionCount: number
  steps: Step[]
  examples: string
  terms: string
  note?: string // why the built-in chain ran, if it did
}

export type StepResult = {
  text: string
  prompt: string
  model: ModelInfo
  usedFallback: boolean
  attempts: number
  httpStatus: number | null
  latencyMs: number
  inputTokens: number | null
  outputTokens: number | null
}

export class StepError extends Error {
  constructor(message: string, public info: Omit<StepResult, 'text'> & { text?: string }) {
    super(message)
  }
}

// ---------------------------------------------------------------- built-in chain (today's prompts)
const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta'
const builtInModel = (id: string): ModelInfo => ({
  name: id, apiModelId: id, provider: 'Google Gemini', apiStyle: 'gemini', baseUrl: GEMINI_BASE, keyEnv: 'GEMINI_API_KEY',
})

export function builtInChain(note: string, captionCount = 5): Chain {
  const main = builtInModel(process.env.GEMINI_MODEL || 'gemini-3.8-flash')
  const lite = builtInModel('gemini-3.5-flash-lite')
  return {
    id: null,
    slug: 'built-in',
    name: 'Built-in prompts',
    captionCount,
    note,
    examples: '',
    terms: '',
    steps: [
      { id: null, order: 1, name: 'Describe the photo', template: DESCRIBE_PROMPT, temperature: null, json: false, model: main, fallback: lite },
      { id: null, order: 2, name: 'Write captions', template: captionPrompt('{{description}}'), temperature: null, json: true, model: main, fallback: lite },
    ],
  }
}

// ---------------------------------------------------------------- loading from the database
const MODEL_COLS = 'name, api_model_id, is_active, provider:llm_providers(name, api_style, api_base_url, api_key_env, is_active)'

function toModel(row: any): ModelInfo | null {
  const p = Array.isArray(row?.provider) ? row.provider[0] : row?.provider
  if (!row || !row.is_active || !p || !p.is_active) return null
  return { name: row.name, apiModelId: row.api_model_id, provider: p.name, apiStyle: p.api_style, baseUrl: String(p.api_base_url).replace(/\/+$/, ''), keyEnv: p.api_key_env }
}

const one = (v: any) => (Array.isArray(v) ? v[0] : v)

// Pick a chain for a new meme: weight ÷ total weight of active chains in the mix.
export async function pickChain(supabase: SB, random = Math.random): Promise<Chain> {
  try {
    const { data, error } = await supabase
      .from('prompt_chain_mix')
      .select('weight, caption_count, chain:prompt_chains(id, is_active)')
    if (error) return builtInChain(`Mix unavailable: ${error.message}`)
    const options = ((data ?? []) as any[])
      .map((r) => ({ weight: Number(r.weight) || 0, count: Number(r.caption_count) || 5, chain: one(r.chain) }))
      .filter((r) => r.weight > 0 && r.chain?.is_active)
    const total = options.reduce((s, r) => s + r.weight, 0)
    if (!total) return builtInChain('No active chain has weight in the mix')
    let roll = random() * total
    const pick = options.find((r) => (roll -= r.weight) < 0) ?? options[options.length - 1]
    return await loadChain(supabase, pick.chain.id, pick.count)
  } catch (e: any) {
    return builtInChain(`Mix unavailable: ${e?.message ?? e}`)
  }
}

// Load one chain with its steps, models, examples and terms. Falls back to the built-in chain if it can't run.
export async function loadChain(supabase: SB, chainId: number, captionCount = 5): Promise<Chain> {
  try {
    const [c, s, ex, t] = await Promise.all([
      supabase.from('prompt_chains').select('id, slug, name, is_active').eq('id', chainId).maybeSingle(),
      supabase
        .from('prompt_chain_steps')
        .select(`id, step_order, name, prompt_template, temperature, json_output,
          model:llm_models!prompt_chain_steps_model_id_fkey(${MODEL_COLS}),
          fallback:llm_models!prompt_chain_steps_fallback_model_id_fkey(${MODEL_COLS})`)
        .eq('chain_id', chainId)
        .order('step_order'),
      supabase.from('ai_generation_examples').select('photo_description, caption, chain_id').eq('is_active', true).order('id').limit(40),
      supabase.from('terms').select('term, definition, example').eq('is_active', true).order('term').limit(25),
    ])
    const err = c.error || s.error
    if (err) return builtInChain(`Chain ${chainId} unavailable: ${err.message}`, captionCount)
    if (!c.data) return builtInChain(`Chain ${chainId} not found`, captionCount)

    const steps: Step[] = []
    for (const row of (s.data ?? []) as any[]) {
      const main = toModel(one(row.model))
      const backup = toModel(one(row.fallback))
      const model = main ?? backup
      if (!model) return builtInChain(`Step ${row.step_order} of "${c.data.slug}" has no active model`, captionCount)
      steps.push({
        id: row.id, order: row.step_order, name: row.name, template: row.prompt_template,
        temperature: row.temperature === null ? null : Number(row.temperature), json: !!row.json_output,
        model, fallback: main && backup && backup.apiModelId !== main.apiModelId ? backup : null,
      })
    }
    if (steps.length < 2) return builtInChain(`"${c.data.slug}" needs at least 2 steps`, captionCount)

    const examples = ((ex.data ?? []) as any[])
      .filter((e) => e.chain_id === null || e.chain_id === chainId)
      .slice(0, 8)
      .map((e) => `- Photo: ${e.photo_description}\n  Caption: ${e.caption}`)
    const terms = ((t.data ?? []) as any[]).map((x) => `- ${x.term}: ${x.definition}${x.example ? ` (e.g. ${x.example})` : ''}`)

    return {
      id: c.data.id, slug: c.data.slug, name: c.data.name, captionCount, steps,
      examples: examples.length ? `Examples of captions that landed well (match the spirit, don't copy them):\n${examples.join('\n')}` : '',
      terms: terms.length ? `Comedy techniques you can use:\n${terms.join('\n')}` : '',
    }
  } catch (e: any) {
    return builtInChain(`Chain ${chainId} unavailable: ${e?.message ?? e}`, captionCount)
  }
}

// ---------------------------------------------------------------- running a step
export function render(template: string, chain: Chain, vars: { description?: string; previous?: string }) {
  return template
    .replaceAll('{{description}}', vars.description ?? '')
    .replaceAll('{{previous}}', vars.previous ?? vars.description ?? '')
    .replaceAll('{{caption_count}}', String(chain.captionCount))
    .replaceAll('{{examples}}', chain.examples)
    .replaceAll('{{terms}}', chain.terms)
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const RETRYABLE = [429, 500, 503]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))
const ALLOWED_KEY = /^[A-Z][A-Z0-9_]*_API_KEY$/

async function callOnce(model: ModelInfo, prompt: string, step: Step, imageBase64?: string) {
  if (!ALLOWED_KEY.test(model.keyEnv) || model.keyEnv.includes('SUPABASE')) {
    return { ok: false as const, status: null, error: `Key variable ${model.keyEnv} isn't allowed` }
  }
  const key = process.env[model.keyEnv]
  if (!key) return { ok: false as const, status: null, error: `${model.keyEnv} is not set` }
  if (!model.baseUrl.startsWith('https://')) return { ok: false as const, status: null, error: 'Provider URL must use https' }

  let res: Response
  if (model.apiStyle === 'openai_compatible') {
    const content: any[] = [{ type: 'text', text: prompt }]
    if (imageBase64) content.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}` } })
    res = await fetch(`${model.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: model.apiModelId,
        messages: [{ role: 'user', content }],
        ...(step.json ? { response_format: { type: 'json_object' } } : {}),
        ...(step.temperature !== null ? { temperature: step.temperature } : {}),
      }),
    })
    if (!res.ok) return { ok: false as const, status: res.status, error: (await res.text()).slice(0, 600) }
    const data = await res.json()
    return {
      ok: true as const, status: res.status,
      text: String(data.choices?.[0]?.message?.content ?? '').trim(),
      inputTokens: data.usage?.prompt_tokens ?? null, outputTokens: data.usage?.completion_tokens ?? null,
    }
  }

  const parts: any[] = []
  if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } })
  parts.push({ text: prompt })
  const config: Record<string, unknown> = {}
  if (step.json) config.responseMimeType = 'application/json'
  if (step.temperature !== null) config.temperature = step.temperature
  res = await fetch(`${model.baseUrl}/models/${encodeURIComponent(model.apiModelId)}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ role: 'user', parts }], ...(Object.keys(config).length ? { generationConfig: config } : {}) }),
  })
  if (!res.ok) return { ok: false as const, status: res.status, error: (await res.text()).slice(0, 600) }
  const data = await res.json()
  return {
    ok: true as const, status: res.status,
    text: (data.candidates?.[0]?.content?.parts ?? []).map((p: any) => (p.thought ? '' : p.text ?? '')).join('').trim(),
    inputTokens: data.usageMetadata?.promptTokenCount ?? null, outputTokens: data.usageMetadata?.candidatesTokenCount ?? null,
  }
}

// Runs one step: main model with up to 3 tries on overload, then the backup model.
export async function runStep(step: Step, prompt: string, imageBase64?: string): Promise<StepResult> {
  const started = Date.now()
  const models = step.fallback ? [step.model, step.fallback] : [step.model]
  let attempts = 0
  let last = { status: null as number | null, error: 'No model ran', model: step.model }
  for (const model of models) {
    for (let i = 0; i < 3; i++) {
      attempts++
      let r: Awaited<ReturnType<typeof callOnce>>
      try {
        r = await callOnce(model, prompt, step, imageBase64)
      } catch (e: any) {
        r = { ok: false, status: null, error: `Network error: ${e?.message ?? e}` }
      }
      if (r.ok && r.text) {
        return {
          text: r.text, prompt, model, usedFallback: model !== step.model, attempts, httpStatus: r.status,
          latencyMs: Date.now() - started, inputTokens: r.inputTokens, outputTokens: r.outputTokens,
        }
      }
      last = r.ok ? { status: r.status, error: 'Empty response', model } : { status: r.status, error: r.error, model }
      if (!r.ok && (r.status === null || !RETRYABLE.includes(r.status))) break // bad key/model: go to the backup
      if (i < 2) await wait(1000 * (i + 1))
    }
  }
  throw new StepError(`${last.model.name}${last.status ? ` ${last.status}` : ''}: ${last.error}`.slice(0, 900), {
    prompt, model: last.model, usedFallback: last.model !== step.model, attempts, httpStatus: last.status,
    latencyMs: Date.now() - started, inputTokens: null, outputTokens: null,
  })
}

// ---------------------------------------------------------------- captions
export function parseCaptions(raw: string, count = 5): string[] {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start === -1 || end === -1) throw new Error('No JSON in caption response')
  const obj = JSON.parse(raw.slice(start, end + 1))
  const seen = new Set<string>()
  const captions = (Array.isArray(obj.captions) ? obj.captions : [])
    .map((c: unknown) => String(c ?? '').trim().replace(/^["“]+|["”]+$/g, '').slice(0, 140))
    .filter((c: string) => {
      const k = c.toLowerCase()
      if (!c || seen.has(k)) return false
      seen.add(k)
      return true
    })
    .slice(0, count)
  if (captions.length < Math.min(3, count)) throw new Error('Too few captions')
  return captions
}

// ---------------------------------------------------------------- logging (best-effort)
export async function startRequest(
  supabase: SB,
  r: { userId: string; source: 'caption_club' | 'backstage'; chain: Chain; storagePath: string },
): Promise<number | null> {
  try {
    const { data } = await supabase
      .from('generation_requests')
      .insert({ user_id: r.userId, source: r.source, chain_id: r.chain.id, chain_slug: r.chain.slug, storage_path: r.storagePath, caption_count: r.chain.captionCount })
      .select('id')
      .single()
    return data?.id ?? null
  } catch {
    return null
  }
}

export async function logStep(supabase: SB, requestId: number | null, step: Step, out: { result?: StepResult; error?: StepError | Error }) {
  if (!requestId) return
  const info: Partial<StepResult> = out.result ?? (out.error instanceof StepError ? out.error.info : {})
  try {
    await supabase.from('llm_responses').insert({
      request_id: requestId,
      step_id: step.id,
      step_order: step.order,
      step_name: step.name.slice(0, 80),
      provider: (info.model ?? step.model).provider.slice(0, 80),
      model: (info.model ?? step.model).apiModelId.slice(0, 120),
      used_fallback: !!info.usedFallback,
      attempts: Math.min(Math.max(info.attempts ?? 1, 1), 20),
      status: out.result ? 'ok' : 'error',
      http_status: info.httpStatus ?? null,
      prompt: (step.order === 1 ? '[photo attached]\n\n' : '') + String(info.prompt ?? '').slice(0, 19000),
      response: out.result ? out.result.text.slice(0, 20000) : null,
      error: out.error ? String(out.error.message).slice(0, 1000) : null,
      latency_ms: info.latencyMs ?? null,
      input_tokens: info.inputTokens ?? null,
      output_tokens: info.outputTokens ?? null,
    })
  } catch {
    // never let logging break a meme
  }
}

export async function finishRequest(
  supabase: SB,
  requestId: number | null,
  r: { status: 'succeeded' | 'failed'; startedAt?: string | number; memeImageId?: number; failedStep?: number; error?: string },
) {
  if (!requestId) return
  try {
    const started = r.startedAt ? new Date(r.startedAt).getTime() : NaN
    await supabase
      .from('generation_requests')
      .update({
        status: r.status,
        finished_at: new Date().toISOString(),
        total_ms: Number.isFinite(started) ? Math.max(0, Date.now() - started) : null,
        ...(r.memeImageId ? { meme_image_id: r.memeImageId } : {}),
        ...(r.failedStep ? { failed_step: r.failedStep } : {}),
        ...(r.error ? { error: r.error.slice(0, 1000) } : {}),
      })
      .eq('id', requestId)
  } catch {
    // best-effort
  }
}

// Runs every step after step 1 (text only), feeding each output into the next. Returns the captions.
export async function runTextSteps(supabase: SB, requestId: number | null, chain: Chain, description: string) {
  let previous = description
  let lastPrompt = ''
  for (const step of chain.steps.slice(1)) {
    const prompt = render(step.template, chain, { description, previous })
    lastPrompt = prompt
    try {
      const result = await runStep(step, prompt)
      await logStep(supabase, requestId, step, { result })
      previous = result.text
    } catch (e: any) {
      await logStep(supabase, requestId, step, { error: e })
      throw Object.assign(new Error(e?.message ?? String(e)), { failedStep: step.order })
    }
  }
  try {
    return { captions: parseCaptions(previous, chain.captionCount), captionPrompt: lastPrompt }
  } catch (e: any) {
    throw Object.assign(new Error(`Couldn't read captions: ${e?.message ?? e}`), { failedStep: chain.steps[chain.steps.length - 1].order })
  }
}
