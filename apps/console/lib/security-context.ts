import type { NextRequest } from 'next/server'

export function hasTrustedSecurityContext(req: NextRequest): boolean {
  const sharedSecret = process.env.INTERNAL_CONTEXT_SHARED_SECRET
  if (!sharedSecret) return false
  return req.headers.get('x-internal-context-secret') === sharedSecret
}
