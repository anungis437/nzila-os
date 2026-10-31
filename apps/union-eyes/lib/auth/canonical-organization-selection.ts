import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { authOrganizationUsers, authUsers } from '@nzila/db/schema'
import { authDb, withAuthContext } from '@nzila/platform-auth/auth-execution'
import { auth } from '@nzila/platform-auth/entra/server'
import {
  SESSION_COOKIE_NAME,
  SessionRebindDenied,
  rebindSessionOrganization,
  sessionCookieAttributes,
  validateSession,
  type SessionData,
} from '@nzila/platform-auth/password'
import {
  AuthOrgBindingError,
  withAuthenticatedOrgBinding,
  type AuthenticatedOrgBinding,
  type AuthOrgBindingOptions,
} from '@nzila/platform-auth/org-binding'
import { createLogger } from '@nzila/os-core'
import { organizations } from '@/db/schema-organizations'
import { recordOrganizationSelection } from './organization-selection-audit'
import { canonicalMembershipRole } from './canonical-membership-role'
import {
  CANONICAL_ORGANIZATION_AUTHORITY,
  CANONICAL_ORGANIZATION_HIERARCHY_SCOPE,
} from './organization-authority'

export { CANONICAL_ORGANIZATION_AUTHORITY } from './organization-authority'
export const CANONICAL_ORGANIZATION_PREFERENCE_COOKIE = 'ue_canonical_org_preference'
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i
const logger = createLogger('canonical:organization-selection')

type SelectionActor =
  | { userId: string; authority: 'pg-session'; session: SessionData; token: string }
  | { userId: string; authority: 'verified-provider'; organizationId: string | null }

async function selectionActor(): Promise<SelectionActor> {
  const actor = await auth()
  if (!actor.userId) throw new AuthOrgBindingError('UNAUTHENTICATED')
  if (actor.identityProvider === 'entra' || actor.identityProvider === 'union-eyes-acceptance')
    return { userId: actor.userId, authority: 'verified-provider', organizationId: actor.orgId }
  const token = (await cookies()).get(SESSION_COOKIE_NAME)?.value
  const session = token ? await validateSession(token) : null
  if (!session || !token || session.userId !== actor.userId)
    throw new AuthOrgBindingError('SESSION_AUTHORITY_REQUIRED')
  return { userId: actor.userId, authority: 'pg-session', session, token }
}

async function providerPreference(userId: string): Promise<string | undefined> {
  const raw = (await cookies()).get(CANONICAL_ORGANIZATION_PREFERENCE_COOKIE)?.value
  if (!raw) return undefined
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch (error) {
    logger.warn('Invalid canonical organization preference encoding', { error })
    throw new AuthOrgBindingError('INVALID_ORGANIZATION')
  }
  if (
    !value ||
    typeof value !== 'object' ||
    !('userId' in value) ||
    !('organizationId' in value) ||
    typeof value.organizationId !== 'string' ||
    !uuid.test(value.organizationId)
  ) {
    logger.warn('Invalid canonical organization preference shape')
    throw new AuthOrgBindingError('INVALID_ORGANIZATION')
  }
  if (value.userId !== userId) {
    logger.warn('Canonical organization preference belongs to a different actor')
    return undefined
  }
  return value.organizationId.toLowerCase()
}

/** A provider preference selects a candidate only; the shared binder rechecks live membership. */
export async function withCanonicalOrganizationBinding<T>(
  options: AuthOrgBindingOptions,
  callback: (binding: AuthenticatedOrgBinding) => Promise<T>,
): Promise<T> {
  const choices = await getCanonicalOrganizationChoices()
  const organizationId = options.organizationId?.toLowerCase() ?? choices.activeOrganizationId
  if (
    !organizationId ||
    !choices.memberships.some((membership) => membership.organizationId === organizationId)
  )
    throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  return withAuthenticatedOrgBinding({ ...options, organizationId }, callback)
}

async function choicesInIdentityScope(userId: string) {
  const [profile] = await authDb
    .select({ isSystemAdmin: authUsers.isSystemAdmin })
    .from(authUsers)
    .where(
      and(
        eq(authUsers.userId, userId),
        eq(authUsers.isActive, true),
        eq(authUsers.lifecycleState, 'active'),
      ),
    )
    .limit(1)
  if (!profile) throw new AuthOrgBindingError('UNAUTHENTICATED')
  const memberships = await authDb
    .select({
      id: authOrganizationUsers.organizationUserId,
      organizationId: authOrganizationUsers.organizationId,
      userId: authOrganizationUsers.userId,
      role: authOrganizationUsers.role,
      isPrimary: authOrganizationUsers.isPrimary,
      joinedAt: authOrganizationUsers.joinedAt,
      createdAt: authOrganizationUsers.createdAt,
    })
    .from(authOrganizationUsers)
    .where(and(eq(authOrganizationUsers.userId, userId), eq(authOrganizationUsers.isActive, true)))
    .orderBy(desc(authOrganizationUsers.isPrimary), asc(authOrganizationUsers.organizationId))
  for (const membership of memberships)
    canonicalMembershipRole(membership.role, profile.isSystemAdmin === true)
  if (!memberships.length) return { organizations: [], memberships: [] }
  const { withSystemContext } = await import('@/lib/db/with-rls-context')
  const rows = await withSystemContext((tx) =>
    tx
      .select({
        id: organizations.id,
        name: organizations.name,
        slug: organizations.slug,
        organizationType: organizations.organizationType,
        parentId: organizations.parentId,
        sectors: organizations.sectors,
        provinceTerritory: organizations.provinceTerritory,
        description: organizations.description,
        createdAt: organizations.createdAt,
        updatedAt: organizations.updatedAt,
        hierarchyPath: organizations.hierarchyPath,
        hierarchyLevel: organizations.hierarchyLevel,
        memberCount: organizations.memberCount,
        status: organizations.status,
      })
      .from(organizations)
      .where(
        and(
          inArray(
            organizations.id,
            memberships.map((membership) => membership.organizationId),
          ),
          eq(organizations.status, 'active'),
        ),
      ),
  )
  const ids = new Set(rows.map((row) => row.id))
  return {
    organizations: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      type: row.organizationType,
      parentId: row.parentId,
      sector: row.sectors?.[0] ?? null,
      jurisdiction: row.provinceTerritory,
      description: row.description,
      createdAt: row.createdAt?.toISOString() ?? null,
      updatedAt: row.updatedAt?.toISOString() ?? null,
      hierarchyPath: row.hierarchyPath,
      hierarchyLevel: row.hierarchyLevel,
      memberCount: row.memberCount,
      status: row.status,
    })),
    memberships: memberships
      .filter((membership) => ids.has(membership.organizationId))
      .map((membership) => ({
        id: membership.id,
        organizationId: membership.organizationId,
        userId: membership.userId,
        role: membership.role,
        isPrimary: membership.isPrimary === true,
        joinedAt: (membership.joinedAt ?? membership.createdAt)?.toISOString() ?? null,
      })),
  }
}

export async function getCanonicalOrganizationChoices() {
  const actor = await selectionActor()
  const choices = await withAuthContext({ phase: 'identity', userId: actor.userId }, () =>
    choicesInIdentityScope(actor.userId),
  )
  const requested =
    actor.authority === 'pg-session'
      ? actor.session.organizationId
      : ((await providerPreference(actor.userId)) ?? actor.organizationId)
  const activeOrganizationId = requested
    ? (choices.memberships.find(
        (membership) => membership.organizationId === requested.toLowerCase(),
      )?.organizationId ?? null)
    : actor.authority === 'pg-session'
      ? null
      : (choices.memberships[0]?.organizationId ?? null)
  return {
    ...choices,
    organizationAuthority: CANONICAL_ORGANIZATION_AUTHORITY,
    activeOrganizationId,
  }
}

export function canonicalOrganizationError(error: unknown, operation: string) {
  logger.error(
    `Canonical organization ${operation} denied or failed`,
    error instanceof Error ? error : { detail: error },
  )
  const code = error instanceof AuthOrgBindingError ? error.code : null
  const status =
    error instanceof SessionRebindDenied ||
    code === 'UNAUTHENTICATED' ||
    code === 'SESSION_AUTHORITY_REQUIRED' ||
    code === 'ACTOR_MISMATCH'
      ? 401
      : code
        ? 403
        : 500
  return NextResponse.json(
    {
      error:
        status === 500 ? `Failed to ${operation} organization` : 'Organization authority denied',
    },
    { status },
  )
}

export async function getCanonicalOrganizationTree() {
  const choices = await getCanonicalOrganizationChoices()
  return {
    data: choices.organizations.toSorted(
      (left, right) =>
        left.hierarchyLevel - right.hierarchyLevel || left.name.localeCompare(right.name),
    ),
    organizationAuthority: CANONICAL_ORGANIZATION_AUTHORITY,
    hierarchyScope: CANONICAL_ORGANIZATION_HIERARCHY_SCOPE,
  }
}

export async function getCanonicalOrganizationPath(id: string) {
  const choices = await getCanonicalOrganizationChoices()
  const organization = choices.organizations.find(
    (candidate) => candidate.id === id.toLowerCase() || candidate.slug === id,
  )
  if (!organization) throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
  const tokens = (organization.hierarchyPath ?? []).filter(
    (token) => token !== organization.id && token !== organization.slug,
  )
  const ancestors = tokens.map((token) =>
    choices.organizations.find(
      (candidate) => candidate.id === token.toLowerCase() || candidate.slug === token,
    ),
  )
  const data = [
    ...new Map(
      ancestors
        .filter((ancestor) => ancestor !== undefined)
        .map((ancestor) => [ancestor.id, ancestor]),
    ).values(),
    organization,
  ]
  const omittedAncestorCount = ancestors.filter((ancestor) => ancestor === undefined).length
  return {
    data,
    organizationAuthority: CANONICAL_ORGANIZATION_AUTHORITY,
    hierarchyScope: CANONICAL_ORGANIZATION_HIERARCHY_SCOPE,
    completePath:
      omittedAncestorCount === 0 &&
      (!organization.parentId || data.some((ancestor) => ancestor.id === organization.parentId)),
    omittedAncestorCount,
  }
}

export async function handleCanonicalOrganizationSwitch(request: NextRequest) {
  try {
    const actor = await selectionActor()
    let body: unknown
    try {
      body = await request.json()
    } catch (error) {
      logger.warn('Invalid canonical organization switch JSON', { error })
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }
    if (
      !body ||
      typeof body !== 'object' ||
      !('organizationId' in body) ||
      typeof body.organizationId !== 'string' ||
      !uuid.test(body.organizationId)
    ) {
      logger.warn('Invalid canonical organization switch identifier')
      return NextResponse.json({ error: 'A valid organizationId is required' }, { status: 400 })
    }
    const organizationId = body.organizationId.toLowerCase()
    const prepareResponse = async () => {
      const choices = await choicesInIdentityScope(actor.userId)
      const organization = choices.organizations.find(
        (candidate) => candidate.id === organizationId,
      )
      if (!organization) throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
      // Recorded before the session is rebound or the preference set; a failure refuses the selection.
      await recordOrganizationSelection({
        organizationId,
        userId: actor.userId,
        authority: 'membership',
        mode: actor.authority === 'pg-session' ? 'canonical_session' : 'canonical_preference',
      })
      const response = NextResponse.json({
        success: true,
        organization,
        organizationAuthority: CANONICAL_ORGANIZATION_AUTHORITY,
        activeOrganizationId: organizationId,
      })
      if (actor.authority === 'pg-session') {
        const rebound = await rebindSessionOrganization({
          userId: actor.userId,
          organizationId,
          token: actor.token,
        })
        response.cookies.set(
          SESSION_COOKIE_NAME,
          rebound.token,
          sessionCookieAttributes(rebound.session.expiresAt),
        )
      } else {
        response.cookies.set(
          CANONICAL_ORGANIZATION_PREFERENCE_COOKIE,
          JSON.stringify({ userId: actor.userId, organizationId }),
          sessionCookieAttributes(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
        )
      }
      return response
    }
    if (actor.authority === 'pg-session')
      return await withAuthContext({ phase: 'identity', userId: actor.userId }, prepareResponse)
    return await withAuthenticatedOrgBinding(
      { organizationId, expectedActorUserId: actor.userId },
      () => withAuthContext({ phase: 'identity', userId: actor.userId }, prepareResponse),
    )
  } catch (error) {
    return canonicalOrganizationError(error, 'switch')
  }
}
