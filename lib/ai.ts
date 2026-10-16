// Prompt chain using Google Gemini (free tier works).
// If a model is overloaded, wait and retry, then fall back to a lighter model.
const MODELS = [process.env.GEMINI_MODEL || 'gemini-3.8-flash', 'gemini-3.5-flash-lite']
const RETRYABLE = [429, 500, 503]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function gemini(parts: unknown[], json = false): Promise<string> {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set')

  let lastError = ''
  for (const model of MODELS) {
    for (let attempt = 0; attempt < 3; attempt++) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts }],
          ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
        }),
      })

      if (res.ok) {
        const data = await res.json()
        return (data.candidates?.[0]?.content?.parts ?? [])
          .map((p: any) => (p.thought ? '' : p.text ?? ''))
          .join('')
          .trim()
      }

      lastError = `Gemini ${res.status} (${model}): ${await res.text()}`
      if (!RETRYABLE.includes(res.status)) break // wrong model or bad key: try the backup model
      await wait(1000 * (attempt + 1)) // wait 1s, then 2s, then 3s
    }
  }
  throw new Error(lastError)
}

// Step 1: image -> plain description
// Exported so the exact prompt text can be saved alongside each image.
export const DESCRIBE_PROMPT = `Describe this photo for someone who can't see it, so they could write a funny meme caption about it.
Cover the main subject, what they're doing, facial expressions or body language, the setting, and any odd or funny small details.
Be concrete and literal. 3 to 5 sentences of plain prose, no lists.`

export async function describeImage(base64Jpeg: string) {
  return gemini([
    { inline_data: { mime_type: 'image/jpeg', data: base64Jpeg } },
    { text: DESCRIBE_PROMPT },
  ])
}

// Step 2: description -> 5 funny captions
// Exported so the exact prompt text can be saved alongside each caption.
export function captionPrompt(description: string) {
  return `You write captions for a meme app. Here is a description of a photo:

${description}

Write exactly 5 funny meme captions for this photo.
Rules:
- Each caption is at most 12 words.
- Each takes a different comedic angle: a relatable everyday struggle, an absurd overreaction, the subject's inner monologue, a "when you..." scenario, and deadpan understatement.
- Ground every joke in specific details from the description.
- Keep it kind: no jokes about anyone's body, race, ethnicity, gender, sexuality, age, religion or disability. No slurs.
- No real song lyrics and no quotes from movies or TV shows.
Return only JSON in this shape: {"captions": ["...", "...", "...", "...", "..."]}`
}

export async function writeCaptions(description: string) {
  const raw = await gemini(
    [
      {
        text: captionPrompt(description),
      },
    ],
    true
  )
  return parseCaptions(raw)
}

export function parseCaptions(raw: string): string[] {
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
    .slice(0, 5)
  if (captions.length < 3) throw new Error('Too few captions')
  return captions
}