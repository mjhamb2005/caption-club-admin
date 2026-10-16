import { requireAdmin } from '@/lib/admin'
import Sidebar from '@/components/Sidebar'

// Everything inside Backstage is superadmin-only. Pages check again on their own too.
export default async function BackstageLayout({ children }: { children: React.ReactNode }) {
  const { viewer } = await requireAdmin()
  return (
    <div className="b-shell">
      <Sidebar viewer={viewer} publicUrl={process.env.NEXT_PUBLIC_CAPTION_CLUB_URL ?? null} />
      <main className="b-main">{children}</main>
    </div>
  )
}
