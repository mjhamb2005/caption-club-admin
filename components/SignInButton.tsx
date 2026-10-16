'use client'
import { useEffect, useState } from 'react'
import { startGoogleSignIn } from '@/lib/google-auth'

export default function SignInButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Back button from Google can restore the page with the button stuck
  useEffect(() => {
    const onShow = (e: PageTransitionEvent) => { if (e.persisted) setBusy(false) }
    window.addEventListener('pageshow', onShow)
    return () => window.removeEventListener('pageshow', onShow)
  }, [])

  async function signIn() {
    setBusy(true)
    setError('')
    try {
      await startGoogleSignIn()
    } catch {
      setError('Couldn’t open Google sign-in. Try again.')
      setBusy(false)
    }
  }

  return (
    <div>
      <button className="b-btn b-btn-primary b-btn-lg" onClick={signIn} disabled={busy}>
        {busy ? 'Opening Google…' : 'Sign in with Google'}
      </button>
      {error && <p className="b-error" role="alert">{error}</p>}
    </div>
  )
}
