import { requireAdmin } from '@/lib/admin'
import NewMeme from './NewMeme'

export const dynamic = 'force-dynamic'

export default async function NewMemePage() {
  const { viewer } = await requireAdmin()
  return <NewMeme adminId={viewer.id} />
}
