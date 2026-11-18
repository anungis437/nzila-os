/** Verified tenant, personal-owner and published-projection purposes. Provider
 * organization labels are selection hints, never source membership facts. */
import { auth, currentUser } from '@nzila/platform-auth/entra/server'
import type { ZongaOrgContext } from '@nzila/zonga-core/types'
import { isSuperAdmin } from '@nzila/os-core/config/super-admins'
import { sql } from 'drizzle-orm'
import {
  activeZongaMemberships,
  withZongaTransaction,
  zongaRows,
  type ZongaActionDb,
} from '@/queries/action-context'
type ZongaRole = 'admin' | 'creator' | 'manager' | 'viewer'
const active = new WeakSet<object>(),
  listeners = new WeakSet<object>()
export class ZongaScopeError extends Error {
  readonly status = 403
  constructor(message = 'Forbidden') {
    super(message)
    this.name = 'ZongaScopeError'
  }
}
export class ZongaUnavailableError extends Error {
  readonly status = 501
  readonly code = 'VERIFIED_TIP_PAYMENT_SOURCE_UNAVAILABLE'
  constructor() {
    super('Tipping requires a verified payment source')
    this.name = 'ZongaUnavailableError'
  }
}
export const isZongaId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
function actor(value: unknown): asserts value is string {
  if (
    typeof value !== 'string' ||
    !value ||
    value !== value.trim() ||
    value.length > 255 ||
    /[\u0000-\u001f\u007f]/.test(value)
  )
    throw new ZongaScopeError('Unauthorized')
}
export interface ListenerContext {
  readonly actorId: string
  readonly orgId: null
}
export interface ListenerActionContext extends ListenerContext {
  readonly purpose: 'personal' | 'published'
  readonly db: ZongaActionDb
}
export interface OrganizationActionContext extends ZongaOrgContext {
  readonly purpose: 'organization'
  readonly db: ZongaActionDb
}
export type ZongaActionContext = ListenerActionContext | OrganizationActionContext
export function assertZongaContext(context: ZongaActionContext) {
  if (!context || !active.has(context)) throw new ZongaScopeError()
}
async function scoped<T extends object, R>(
  fields: T,
  db: ZongaActionDb,
  operation: (context: T & { readonly db: ZongaActionDb }) => Promise<R>,
): Promise<R> {
  const constructed = Object.assign(fields, { db })
  Object.defineProperty(constructed, 'db', {
    enumerable: false,
    get() {
      if (!active.has(constructed)) throw new ZongaScopeError()
      return db
    },
  })
  const context = Object.freeze(constructed)
  active.add(context)
  try {
    return await operation(context)
  } finally {
    active.delete(context)
  }
}
export function resolveOrgContext(): Promise<ZongaOrgContext>
export function resolveOrgContext<T>(
  purpose: 'personal' | 'published',
  operation: (context: ListenerActionContext) => Promise<T>,
): Promise<T>
export function resolveOrgContext<T>(
  purpose: 'organization',
  options: { organizationId?: string },
  operation: (context: OrganizationActionContext) => Promise<T>,
): Promise<T>
export async function resolveOrgContext<T>(
  purpose?: 'personal' | 'published' | 'organization',
  options?: { organizationId?: string } | ((context: ListenerActionContext) => Promise<T>),
  operation?: (context: OrganizationActionContext) => Promise<T>,
): Promise<T | ZongaOrgContext> {
  const identity = await auth()
  actor(identity.userId)
  const actorId = identity.userId
  if (purpose === 'personal' || purpose === 'published') {
    if (typeof options !== 'function') throw new ZongaScopeError()
    if ((await auth()).userId !== actorId) throw new ZongaScopeError()
    return withZongaTransaction((db) => scoped({ purpose, actorId, orgId: null }, db, options))
  }
  if (purpose !== undefined && purpose !== 'organization') throw new ZongaScopeError()
  const requested = options && typeof options !== 'function' ? options.organizationId : undefined
  if (requested !== undefined && !isZongaId(requested)) throw new ZongaScopeError()
  return withZongaTransaction(async (db) => {
    const rows = await activeZongaMemberships(db, actorId),
      ids = [...new Set(rows.map((r) => r.orgId))]
    const hint = isZongaId(identity.orgId) ? identity.orgId.toLowerCase() : null
    const selected =
      requested?.toLowerCase() ??
      (hint && ids.includes(hint) ? hint : ids.length === 1 ? ids[0] : undefined)
    if (!selected || !ids.includes(selected))
      throw new ZongaScopeError('Select a verified organization')
    // Live selected-org assignments govern this legacy product context.
    // Provider role/metadata cannot restore powers removed by a live downgrade.
    // This is not a migration to canonical platform permission grants.
    const selectedRoles = [
      ...new Set(rows.filter((row) => row.orgId === selected).map((row) => row.role)),
    ]
    if (selectedRoles.length !== 1) throw new ZongaScopeError('Organization role is ambiguous')
    const liveRoles = {
      org_admin: 'admin',
      org_secretary: 'manager',
      org_viewer: 'viewer',
    } as const
    let role: ZongaRole = liveRoles[selectedRoles[0]]
    if (!role) throw new ZongaScopeError('Organization role is unavailable')
    if (role !== 'admin') {
      const profile = await currentUser()
      if (profile && profile.id !== actorId) throw new ZongaScopeError()
      const email =
        profile?.primaryEmailAddress?.emailAddress ?? profile?.emailAddresses?.[0]?.emailAddress
      if (isSuperAdmin(email)) role = 'admin'
    }
    if ((await auth()).userId !== actorId) throw new ZongaScopeError()
    const fields = {
      orgId: selected,
      actorId,
      role: role as ZongaOrgContext['role'],
      permissions: derivePermissions(role),
      requestId: crypto.randomUUID(),
    }
    if (purpose === undefined) return Object.freeze(fields)
    if (!operation) throw new ZongaScopeError()
    return scoped({ ...fields, purpose: 'organization' as const }, db, operation)
  })
}
/** Compatibility callers receive identity only; an unverified group hint is
 * never inserted as jurisdiction. New personal actions keep a live callback. */
export async function resolveListenerContext(): Promise<ListenerContext> {
  const identity = await auth()
  actor(identity.userId)
  const context = Object.freeze({ actorId: identity.userId, orgId: null })
  listeners.add(context)
  return context
}
export interface ListenerFacts {
  id: string
  userId: string
  displayName: string
  email: string | null
  avatarUrl: string | null
  bio: string | null
  city: string | null
  country: string | null
  plan: 'free' | 'premium'
  subscriptionStatus: string | null
  createdAt: Date
}
export async function listenerFacts(
  context: ListenerActionContext,
  create = false,
  data?: { displayName: string; email?: string },
): Promise<ListenerFacts | null> {
  assertZongaContext(context)
  await context.db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`zonga.listener:${context.actorId}`}))`,
  )
  const [row] = zongaRows<ListenerFacts>(
    await context.db.execute(
      sql`SELECT id,user_id AS "userId",display_name AS "displayName",email,avatar_url AS "avatarUrl",bio,city,country,plan,subscription_status AS "subscriptionStatus",created_at AS "createdAt" FROM public.zonga_listeners WHERE user_id=${context.actorId} ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE`,
    ),
  )
  if (row || !create) return row ?? null
  const [created] = zongaRows<ListenerFacts>(
    await context.db.execute(
      sql`INSERT INTO public.zonga_listeners(user_id,org_id,display_name,email) VALUES(${context.actorId},NULL,${data?.displayName ?? 'Listener'},${data?.email ?? null}) RETURNING id,user_id AS "userId",display_name AS "displayName",email,avatar_url AS "avatarUrl",bio,city,country,plan,subscription_status AS "subscriptionStatus",created_at AS "createdAt"`,
    ),
  )
  if (!created || !isZongaId(created.id) || created.userId !== context.actorId)
    throw new Error('Listener profile was not stored')
  return created
}
export async function resolveListenerUUID(
  context: ListenerContext | ListenerActionContext,
): Promise<string> {
  if ('purpose' in context) {
    assertZongaContext(context)
    const row = await listenerFacts(context, true)
    if (!row) throw new Error('Listener profile is unavailable')
    return row.id
  }
  if (!listeners.has(context) || (await auth()).userId !== context.actorId)
    throw new ZongaScopeError()
  return resolveOrgContext('personal', async (current) => {
    if (current.actorId !== context.actorId) throw new ZongaScopeError()
    const row = await listenerFacts(current, true)
    if (!row) throw new Error('Listener profile is unavailable')
    return row.id
  })
}

/**
 * Derive permission keys from ZongaRole.
 */
function derivePermissions(role: ZongaRole): readonly string[] {
  const base = ['zonga:read', 'zonga:catalog:list']

  switch (role) {
    case 'admin':
      return [
        ...base,
        'zonga:catalog:create',
        'zonga:catalog:publish',
        'zonga:creator:manage',
        'zonga:release:create',
        'zonga:release:publish',
        'zonga:revenue:record',
        'zonga:payout:execute',
        'zonga:payout:preview',
        'zonga:settings:manage',
      ]
    case 'manager':
      return [
        ...base,
        'zonga:catalog:create',
        'zonga:catalog:publish',
        'zonga:creator:manage',
        'zonga:release:create',
        'zonga:release:publish',
        'zonga:revenue:record',
        'zonga:payout:preview',
      ]
    case 'creator':
      return [...base, 'zonga:catalog:create', 'zonga:release:create', 'zonga:payout:preview']
    case 'viewer':
    default:
      return base
  }
}
