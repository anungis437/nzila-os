import { z } from 'zod'

const identifier = z.string().regex(/^[A-Za-z0-9][A-Za-z0-9:._/@-]{0,159}$/)

export const invocationSchema = z.object({
  subject: identifier,
  organizationId: identifier,
  missionId: identifier,
  invocationRef: identifier,
  source: identifier,
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
  status: z.enum(['ACTIVE', 'REVOKED']),
  roles: z.array(identifier).max(16),
}).strict()

export type InvocationRecord = Readonly<Omit<z.infer<typeof invocationSchema>, 'roles'>> & {
  readonly roles: readonly string[]
}
export type AuthenticatedInvocation = InvocationRecord

/** Host-only dependency: context is a transport session, never request JSON. */
export interface InvocationAuthenticator {
  authenticate(hostContext: unknown): Promise<InvocationRecord | null>
}

export class DenyInvocationAuthenticator implements InvocationAuthenticator {
  async authenticate(): Promise<null> {
    return null
  }
}

const minted = new WeakSet<object>()

export function isAuthenticatedInvocation(value: unknown): value is AuthenticatedInvocation {
  return typeof value === 'object' && value !== null && minted.has(value)
}

export async function authenticateInvocation(
  authenticator: InvocationAuthenticator,
  hostContext: unknown,
  now: Date = new Date(),
): Promise<AuthenticatedInvocation> {
  const result = invocationSchema.safeParse(await authenticator.authenticate(hostContext))
  if (!result.success) throw new Error('INVOCATION_UNAUTHENTICATED')
  const r = result.data
  if (r.status !== 'ACTIVE' || Date.parse(r.issuedAt) > now.getTime() ||
      Date.parse(r.expiresAt) <= now.getTime() ||
      Date.parse(r.expiresAt) - Date.parse(r.issuedAt) > 300_000) {
    throw new Error('INVOCATION_STALE_OR_REVOKED')
  }
  const value = Object.freeze({ ...r, roles: Object.freeze([...r.roles]) })
  minted.add(value)
  return value
}
