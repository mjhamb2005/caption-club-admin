import SignInButton from '@/components/SignInButton'

const MESSAGES: Record<string, string> = {
  cancelled: 'Sign-in was cancelled. Try again whenever you’re ready.',
  auth: 'Google sign-in didn’t finish. Try again.',
  not_allowed: 'That email isn’t on the allowed sign-up list.',
}

// The stage door. Signed-in visitors never see this: the proxy sends them to the dashboard.
export default async function Home({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams
  const message = error ? MESSAGES[error] ?? MESSAGES.auth : null
  return (
    <main className="b-door">
      <div className="b-door-card">
        <div className="b-sign b-sign-lg">
          <span className="b-sign-name">Backstage</span>
          <span className="b-sign-plate">Staff only</span>
        </div>
        <h1>Caption Club’s admin area.</h1>
        <p>
          See how the crowd is voting, manage every meme the AI has made, and look up users and votes. Only superadmins get
          past this door.
        </p>
        <SignInButton />
        {message && <p className="b-error" role="alert">{message}</p>}
      </div>
    </main>
  )
}
