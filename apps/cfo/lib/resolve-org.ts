import type { PlatformRole } from '@/lib/rbac'
import { auth } from '@nzila/platform-auth/entra/server'
import { platformRoleHasPermission, requirePermission, type Permission } from '@/lib/rbac'
import {
  lockCfoMemberships,
  lockCfoOrganization,
  withCfoActionTransaction,
  type CfoActionDb,
} from '@/queries/action-context'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const active = new WeakSet<object>()
const sources = new WeakMap<
  object,
  {
    permission: Permission
    platformRole: PlatformRole
    memberships: { organizationId: string; membershipId: string }[]
  }
>()
export class CfoScopeError extends Error {
  readonly status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'CfoScopeError'
  }
}
export function isCfoOrganizationId(value: unknown): value is string {
  return typeof value === 'string' && UUID.test(value)
}

interface ScopeBase {
  readonly userId: string
  readonly db: CfoActionDb
}
export interface OrganizationContext extends ScopeBase {
  readonly purpose: 'organization'
  readonly organizationId: string
  readonly authority: 'membership' | 'platform'
}
export interface OrganizationsContext extends ScopeBase {
  readonly purpose: 'organizations'
  readonly organizationId: null
  readonly organizationIds: readonly string[]
}
export interface PlatformContext extends ScopeBase {
  readonly purpose: 'platform'
  readonly organizationId: null
}
export interface PersonalContext extends ScopeBase {
  readonly purpose: 'personal'
  readonly organizationId: null
}
export type CfoActionContext =
  OrganizationContext | OrganizationsContext | PlatformContext | PersonalContext
interface ContextMap {
  organization: OrganizationContext
  collection: OrganizationsContext | PlatformContext
  platform: PlatformContext
  personal: PersonalContext
  resource: OrganizationsContext | PlatformContext | PersonalContext
}
type OptionsMap = {
  organization: { permission: Permission; organizationId?: string }
  collection: { permission: Permission }
  platform: { permission: Permission }
  personal: { permission: Permission }
  resource: { permission: Permission }
}

export function assertCfoActionContext(context: CfoActionContext): void {
  if (!context || !active.has(context)) throw new CfoScopeError()
}

/** Verified identity plus a real declared purpose. A metadata capability never
 * establishes tenant membership. The callback owns the transaction and locks
 * through its last effect; contexts expire on return and carry no bearer. */
export async function resolveOrgContext<P extends keyof ContextMap, T>(
  purpose: P,
  options: OptionsMap[P],
  operation: (context: ContextMap[P]) => Promise<T>,
): Promise<T> {
  if (!['organization', 'collection', 'platform', 'personal', 'resource'].includes(purpose))
    throw new CfoScopeError()
  const actor = await auth()
  const userId = actor.userId
  if (
    !userId ||
    userId !== userId.trim() ||
    userId.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(userId)
  )
    throw new CfoScopeError('Unauthorized')
  let roles: Awaited<ReturnType<typeof requirePermission>>
  try {
    roles = await requirePermission(options.permission, userId)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Forbidden:')) throw new CfoScopeError()
    throw error
  }
  if ((await auth()).userId !== userId) throw new CfoScopeError()
  const platform =
    roles.platformRole === 'platform_admin' ||
    platformRoleHasPermission(roles.platformRole, options.permission)
  if (purpose === 'platform' && !platform) throw new CfoScopeError()
  const requested = 'organizationId' in options ? options.organizationId : undefined
  if (requested !== undefined && !isCfoOrganizationId(requested)) throw new CfoScopeError()

  return withCfoActionTransaction(async (db) => {
    let memberships: Awaited<ReturnType<typeof lockCfoMemberships>> = []
    let fields:
      | Omit<OrganizationContext, 'db'>
      | Omit<OrganizationsContext, 'db'>
      | Omit<PlatformContext, 'db'>
      | Omit<PersonalContext, 'db'>
    if (
      purpose === 'platform' ||
      ((purpose === 'collection' || purpose === 'resource') && platform)
    ) {
      fields = { purpose: 'platform', userId, organizationId: null }
    } else if (purpose === 'personal') {
      fields = { purpose: 'personal', userId, organizationId: null }
    } else {
      memberships = await lockCfoMemberships(db, userId)
      const ids = [...new Set(memberships.map((row) => row.organizationId))].sort()
      if (purpose === 'collection' || purpose === 'resource') {
        if (!ids.length && purpose === 'collection') throw new CfoScopeError()
        fields = !ids.length
          ? { purpose: 'personal', userId, organizationId: null }
          : {
              purpose: 'organizations',
              userId,
              organizationId: null,
              organizationIds: Object.freeze(ids),
            }
      } else {
        // A provider group/selection is only a hint after membership is proved.
        const hint = isCfoOrganizationId(actor.orgId) ? actor.orgId.toLowerCase() : undefined
        const selected =
          requested?.toLowerCase() ??
          (hint && ids.includes(hint) ? hint : ids.length === 1 ? ids[0] : undefined)
        if (!selected) throw new CfoScopeError('Select a verified organization')
        const member = ids.includes(selected)
        if (!member && (!platform || !requested || !(await lockCfoOrganization(db, selected))))
          throw new CfoScopeError()
        fields = {
          purpose: 'organization',
          userId,
          organizationId: selected,
          authority: member ? 'membership' : 'platform',
        }
      }
    }
    const constructed = Object.assign(fields, { db })
    Object.defineProperty(constructed, 'db', {
      enumerable: false,
      get() {
        if (!active.has(constructed)) throw new CfoScopeError()
        return db
      },
    })
    const context: CfoActionContext = Object.freeze(constructed)
    active.add(context)
    sources.set(context, {
      permission: options.permission,
      platformRole: roles.platformRole,
      memberships,
    })
    try {
      return await operation(context as ContextMap[P])
    } finally {
      active.delete(context)
      sources.delete(context)
    }
  })
}

export function assertCfoContextPermission(
  context: CfoActionContext,
  permission: Permission,
): void {
  assertCfoActionContext(context)
  if (sources.get(context)?.permission !== permission) throw new CfoScopeError()
}

/** Historical origin evidence only. Every subsequent action must independently
 * resolve its own live actor, purpose, membership and resource parent. */
export function cfoAuthoritySource(
  context: CfoActionContext,
  organizationId: string,
  permission: Permission,
) {
  assertCfoContextPermission(context, permission)
  if (!isCfoOrganizationId(organizationId) || context.purpose === 'personal')
    throw new CfoScopeError()
  const org = organizationId.toLowerCase(),
    facts = sources.get(context)!
  if (context.purpose === 'organization' && context.organizationId !== org)
    throw new CfoScopeError()
  if (context.purpose === 'organizations' && !context.organizationIds.includes(org))
    throw new CfoScopeError()
  if (
    context.purpose === 'platform' ||
    (context.purpose === 'organization' && context.authority === 'platform')
  )
    return {
      kind: 'platform' as const,
      source: 'cfo.platform-permissions',
      organizationId: org,
      actorUserId: context.userId,
      permission,
      platformRole: facts.platformRole,
    }
  const membershipIds = [
    ...new Set(
      facts.memberships.filter((row) => row.organizationId === org).map((row) => row.membershipId),
    ),
  ].sort()
  if (!membershipIds.length) throw new CfoScopeError()
  return {
    kind: 'membership' as const,
    source: 'org_members',
    organizationId: org,
    actorUserId: context.userId,
    permission,
    membershipIds,
  }
}

export function cfoContextPermission(context: CfoActionContext): Permission {
  assertCfoActionContext(context)
  const source = sources.get(context)
  if (!source) throw new CfoScopeError()
  return source.permission
}
export async function assertCfoCapability(
  context: CfoActionContext,
  permission: Permission,
): Promise<void> {
  assertCfoActionContext(context)
  try {
    await requirePermission(permission, context.userId)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Forbidden:')) throw new CfoScopeError()
    throw error
  }
}

/** A genuine additional global purpose on the SAME transaction. Never acquire
 * a second pool connection while a caller holds source locks (pool-size-one
 * deployments and SQL-engine components must remain usable). No verdict reuse:
 * reverify the same actor and the existing global permission source. */
export async function withCfoPlatformPurpose<T>(
  parent: CfoActionContext,
  permission: Permission,
  operation: (context: PlatformContext) => Promise<T>,
): Promise<T> {
  assertCfoActionContext(parent)
  const actor = await auth()
  if (actor.userId !== parent.userId) throw new CfoScopeError()
  let roles: Awaited<ReturnType<typeof requirePermission>>
  try {
    roles = await requirePermission(permission, parent.userId)
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('Forbidden:')) throw new CfoScopeError()
    throw error
  }
  if (
    (await auth()).userId !== parent.userId ||
    (roles.platformRole !== 'platform_admin' &&
      !platformRoleHasPermission(roles.platformRole, permission))
  )
    throw new CfoScopeError()
  const fields = { purpose: 'platform' as const, userId: parent.userId, organizationId: null }
  const constructed = Object.assign(fields, { db: parent.db })
  Object.defineProperty(constructed, 'db', {
    enumerable: false,
    get() {
      assertCfoActionContext(parent)
      if (!active.has(constructed)) throw new CfoScopeError()
      return parent.db
    },
  })
  const context: PlatformContext = Object.freeze(constructed)
  active.add(context)
  sources.set(context, { permission, platformRole: roles.platformRole, memberships: [] })
  try {
    return await operation(context)
  } finally {
    active.delete(context)
    sources.delete(context)
  }
}
