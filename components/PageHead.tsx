import type { ReactNode } from 'react'

// Page title + one-line explanation, and a setup hint if the page's tables don't exist yet.
export default function PageHead({ title, children, error, action }: { title: string; children: ReactNode; error?: string | null; action?: ReactNode }) {
  const missing = !!error && /does not exist|schema cache|relation/i.test(error)
  return (
    <>
      <header className="b-head">
        <div>
          <h1>{title}</h1>
          <p>{children}</p>
        </div>
        {action}
      </header>
      {error && (
        <p className="b-alert" role="alert">
          {missing ? <>This page’s tables don’t exist yet. Run <code>supabase/week7-setup.sql</code> in the Supabase SQL Editor, then refresh.</> : <>Couldn’t load ({error}).</>}
        </p>
      )}
    </>
  )
}
