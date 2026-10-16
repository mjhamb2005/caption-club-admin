import type { Metadata } from 'next'
import { fontVars } from '@/lib/fonts'
import './backstage.css'

export const metadata: Metadata = {
  title: 'Backstage · Caption Club',
  description: 'Staff-only admin area for Caption Club.',
  robots: { index: false, follow: false },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={fontVars}>{children}</body>
    </html>
  )
}
