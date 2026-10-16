// Google sign-in that returns straight to /auth/callback (no extra query params),
// then hands Google's ID token to Supabase. No client secret needed.
const CLIENT_ID =
  process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ||
  '388960353527-fh4grc6mla425lg0e3g1hh67omtrdihd.apps.googleusercontent.com'

function randomHex(bytes = 32) {
  const a = new Uint8Array(bytes)
  crypto.getRandomValues(a)
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('')
}

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function startGoogleSignIn() {
  const nonce = randomHex() // raw value goes to Supabase; Google gets its hash
  const state = randomHex(16) // protects against forged callbacks
  sessionStorage.setItem('cc_nonce', nonce)
  sessionStorage.setItem('cc_state', state)

  const params = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: `${window.location.origin}/auth/callback`,
    response_type: 'id_token',
    scope: 'openid email profile',
    nonce: await sha256Hex(nonce),
    state,
    prompt: 'select_account',
  })
  window.location.assign(`https://accounts.google.com/o/oauth2/v2/auth?${params}`)
}

export function takeGoogleSession() {
  const nonce = sessionStorage.getItem('cc_nonce')
  const state = sessionStorage.getItem('cc_state')
  sessionStorage.removeItem('cc_nonce')
  sessionStorage.removeItem('cc_state')
  return nonce && state ? { nonce, state } : null
}