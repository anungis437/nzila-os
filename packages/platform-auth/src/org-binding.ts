import { createHash, randomBytes } from 'node:crypto'
import { and, asc, desc, eq, sql } from 'drizzle-orm'
import { authOrganizationUsers, authUserSessions, authUsers } from '@nzila/db/schema'
import { authDb, withAuthContext } from './auth-db'
import { AUTH_BRIDGE_PURPOSE } from '@nzila/db/auth-storage-authority'
import { SESSION_COOKIE_NAME, validateSession, type SessionData } from './password/session'

export class AuthOrgBindingError extends Error {
  constructor(
    readonly code:
      | 'UNAUTHENTICATED'
      | 'ACTOR_MISMATCH'
      | 'INVALID_ORGANIZATION'
      | 'SESSION_AUTHORITY_REQUIRED'
      | 'MEMBERSHIP_REQUIRED'
      | 'ROLE_REQUIRED',
    options?: ErrorOptions,
  ) {
    super(code, options)
    this.name = 'AuthOrgBindingError'
  }
}

export interface AuthenticatedOrgBinding {
  readonly userId: string
  readonly organizationId: string
  readonly role: string
  readonly isSystemAdmin?: boolean
  /** Server-held bearer. Never serialize, log or expose through an API response. */
  readonly sessionToken: string
  readonly expiresAt: Date
  readonly authority: 'pg-session' | 'verified-provider-bridge'
}

export interface AuthOrgBindingOptions {
  readonly organizationId?: string | null
  readonly expectedActorUserId?: string
  /** Trusted route/policy role requirements, not client-supplied authority. */
  readonly requiredRoles?: readonly string[]
}

/**
 * Establishes canonical actor -> active membership -> live session authority.
 * Provider claims/legacy org selectors are never membership or role authority.
 */
export async function withAuthenticatedOrgBinding<T>(
  options: AuthOrgBindingOptions,
  callback: (binding: AuthenticatedOrgBinding) => Promise<T>,
): Promise<T> {
  const { auth } = await import('./entra/server')
  const actor = await auth()
  const userId = actor.userId
  if (!userId) throw new AuthOrgBindingError('UNAUTHENTICATED')
  if (options.expectedActorUserId && options.expectedActorUserId !== userId)
    throw new AuthOrgBindingError('ACTOR_MISMATCH')
  const provider =
    actor.identityProvider === 'entra' || actor.identityProvider === 'union-eyes-acceptance'
  const { cookies } = await import('next/headers')
  const cookie = provider ? undefined : (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = cookie ? await validateSession(cookie) : null
  if (!provider && (!session || session.userId !== userId))
    throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
  return withResolvedOrgBinding(
    { userId, orgId: actor.orgId, identityProvider: actor.identityProvider },
    session,
    cookie,
    options,
    callback,
  )
}

/**
 * Express/mobile bearer authentication uses the same live membership/session
 * authority as Next. A verified directory tenant is never a business organization.
 */
export async function withBearerOrgBinding<T>(
  token: string,
  options: AuthOrgBindingOptions,
  callback: (binding: AuthenticatedOrgBinding) => Promise<T>,
): Promise<T> {
  if (!token || token.length > 16384) throw new AuthOrgBindingError('UNAUTHENTICATED')
  if (!token.includes('.')) {
    const session = await validateSession(token)
    if (!session) throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
    if (!session.organizationId) throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
    return withResolvedOrgBinding(
      { userId: session.userId, identityProvider: 'password' },
      session,
      token,
      options,
      callback,
    )
  }
  if (!options.organizationId) throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  if (!process.env.AZURE_AD_CLIENT_ID || !process.env.AZURE_AD_TENANT_ID)
    throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
  const { verifyToken } = await import('./entra/verify')
  let payload: Awaited<ReturnType<typeof verifyToken>>['payload']
  try {
    ;({ payload } = await verifyToken(token))
  } catch (error) {
    throw new AuthOrgBindingError('UNAUTHENTICATED', { cause: error })
  }
  if (typeof payload.tid !== 'string' || typeof payload.oid !== 'string')
    throw new AuthOrgBindingError('UNAUTHENTICATED')
  const { resolveExternalAuthIdentity } = await import('./provider-identity')
  const identity = await resolveExternalAuthIdentity('entra', `${payload.tid}:${payload.oid}`)
  if (!identity) throw new AuthOrgBindingError('UNAUTHENTICATED')
  return withResolvedOrgBinding(
    {
      userId: identity.platformUserId,
      identityProvider: 'entra',
    },
    null,
    undefined,
    options,
    callback,
  )
}

async function withResolvedOrgBinding<T>(
  actor: { userId: string; orgId?: string | null; identityProvider?: string | null },
  session: SessionData | null,
  cookie: string | undefined,
  options: AuthOrgBindingOptions,
  callback: (binding: AuthenticatedOrgBinding) => Promise<T>,
): Promise<T> {
  const { userId } = actor
  if (options.expectedActorUserId && options.expectedActorUserId !== userId)
    throw new AuthOrgBindingError('ACTOR_MISMATCH')
  const requestedOrg = options.organizationId ?? session?.organizationId ?? actor.orgId
  if (
    requestedOrg &&
    !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(requestedOrg)
  )
    throw new AuthOrgBindingError('INVALID_ORGANIZATION')
  if (
    session?.organizationId &&
    requestedOrg &&
    session.organizationId.toLowerCase() !== requestedOrg.toLowerCase()
  )
    throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  const binding = await withAuthContext(
    { phase: 'identity', userId },
    async (): Promise<AuthenticatedOrgBinding> => {
      const [user] = await authDb
        .select({
          userId: authUsers.userId,
          isSystemAdmin: authUsers.isSystemAdmin,
        })
        .from(authUsers)
        .where(
          and(
            eq(authUsers.userId, userId),
            eq(authUsers.isActive, true),
            eq(authUsers.lifecycleState, 'active'),
          ),
        )
        .limit(1)
      const [membership] = await authDb
        .select({
          organizationId: authOrganizationUsers.organizationId,
          role: authOrganizationUsers.role,
        })
        .from(authOrganizationUsers)
        .where(
          and(
            eq(authOrganizationUsers.userId, userId),
            eq(authOrganizationUsers.isActive, true),
            ...(requestedOrg ? [eq(authOrganizationUsers.organizationId, requestedOrg)] : []),
          ),
        )
        .orderBy(desc(authOrganizationUsers.isPrimary), asc(authOrganizationUsers.organizationId))
        .limit(1)
      if (!user || !membership) throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
      if (options.requiredRoles && !options.requiredRoles.includes(membership.role))
        throw new AuthOrgBindingError('ROLE_REQUIRED')
      // The caller's own session cookie is a long-lived bearer: it is validated above and then never forwarded to
      // PostgreSQL. Every binding, whatever authenticated the principal, carries a 30-second single-purpose token that
      // is revoked when the callback ends. `authority` records how the principal was authenticated, not what is sent.
      const authority: AuthenticatedOrgBinding['authority'] =
        session && cookie ? 'pg-session' : 'verified-provider-bridge'
      const token = randomBytes(32).toString('base64url')
      const hash = createHash('sha256').update(token).digest('hex')
      const [created] = await authDb
        .insert(authUserSessions)
        .values({
          userId,
          organizationId: membership.organizationId,
          sessionToken: hash,
          sessionTokenHash: hash,
          createdAt: sql`statement_timestamp()`,
          expiresAt: sql`statement_timestamp()+interval '30 seconds'`,
          isActive: true,
          // The bridge is a request-scoped child of the validated parent session. The business predicate
          // re-reads the parent on every statement, so revoking it ends the bridge's authority at once.
          deviceInfo: {
            purpose: AUTH_BRIDGE_PURPOSE,
            provider: actor.identityProvider,
            ...(session && cookie ? { parentSessionId: session.sessionId } : {}),
          },
        })
        .returning({ expiresAt: authUserSessions.expiresAt })
      if (!created) throw new Error('Canonical business session authority was not created')
      return {
        userId,
        organizationId: membership.organizationId,
        role: membership.role,
        isSystemAdmin: user.isSystemAdmin === true,
        sessionToken: token,
        expiresAt: created.expiresAt,
        authority,
      }
    },
  )
  let callbackFailed = false
  let callbackError: unknown
  try {
    return await callback(binding)
  } catch (error) {
    callbackFailed = true
    callbackError = error
    throw error
  } finally {
    {
      const hash = createHash('sha256').update(binding.sessionToken).digest('hex')
      try {
        await withAuthContext({ phase: 'identity', userId }, () =>
          authDb
            .update(authUserSessions)
            .set({ isActive: false })
            .where(
              and(eq(authUserSessions.userId, userId), eq(authUserSessions.sessionTokenHash, hash)),
            ),
        )
      } catch (error) {
        if (callbackFailed)
          throw new AggregateError(
            [callbackError, error],
            'Authenticated organization callback and bridge revocation both failed',
            { cause: callbackError },
          )
        throw error
      }
    }
  }
}

/** For an already-open ordinary transaction; all values remain parameterized. */
export function authenticatedOrgBindingSql(binding: AuthenticatedOrgBinding) {
  return sql`SELECT set_config('app.current_user_id',${binding.userId},true),
    set_config('app.current_org_id',${binding.organizationId},true),
    set_config('app.current_session_token',${binding.sessionToken},true)`
}
