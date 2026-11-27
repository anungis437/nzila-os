import { afterEach, beforeEach, vi } from 'vitest'
import { NextRequest } from 'next/server'
export { canonicalActionScope } from '@/actions/__tests__/fixtures/canonical-action-scope'
export { UserRole } from '@/lib/auth/roles'
const ports = vi.hoisted(() => ({
  query: vi.fn(() => {
    throw new Error('unexpected financial SQL')
  }),
  transactions: vi.fn(),
}))
vi.mock('@/db', () => ({ db: new Proxy({}, { get: () => ports.query }) }))
// Transport port only. Production withApi + canonical actor/org/role checks and
// actual service entry guards remain real; no financial result is fabricated.
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, operation: (tx: object) => Promise<unknown>) => {
    ports.transactions()
    return operation({})
  },
  withSystemContext: ports.query,
}))
export const rewardHttpPorts = ports
beforeEach(() => {
  process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
  vi.clearAllMocks()
})
afterEach(() => {
  delete process.env.UE_CANONICAL_BOOTSTRAP_V2
})
export function rewardRequest(path: string, method = 'GET', body?: unknown) {
  return new NextRequest(`http://localhost${path}`, {
    method,
    headers: { origin: 'http://localhost', 'content-type': 'application/json' },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  })
}
