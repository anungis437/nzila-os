import { timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { isDevOrTestRuntime, requireEnvVar } from '@/lib/runtime-env'

export function requireWorkerAuth(request: Request): NextResponse | null {
  const auth = request.headers.get('authorization') ?? ''

  // In dev/test allow local execution without token to simplify workflows.
  if (isDevOrTestRuntime() && !process.env.INTERNAL_WORKER_BEARER_TOKEN) {
    return null
  }

  const token = requireEnvVar('INTERNAL_WORKER_BEARER_TOKEN')
  const expected = `Bearer ${token}`
  const authBytes = Buffer.from(auth)
  const expectedBytes = Buffer.from(expected)

  const valid =
    authBytes.length === expectedBytes.length &&
    timingSafeEqual(authBytes, expectedBytes)

  if (!valid) {
    return NextResponse.json({ ok: false, error: 'Unauthorized worker call' }, { status: 401 })
  }

  return null
}
