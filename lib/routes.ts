// Shared routing rules (used by the proxy and auth routes)
export const HOME = '/dashboard'
export const NEXT_COOKIE = 'bs_next'

// Only allow same-site relative paths, so nobody can bounce users to an outside site
export function safePath(p?: string | null) {
  if (!p || !p.startsWith('/') || p.startsWith('//') || p.startsWith('/auth') || p.startsWith('/api') || p === '/') {
    return HOME
  }
  return p
}
