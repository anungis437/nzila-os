import {
  PLATFORM_PERMISSIONS,
  platformRoleHasPermission,
  type PlatformRole,
  type Permission,
} from '@/lib/rbac'
import { and, or, inArray, desc, eq, sql } from 'drizzle-orm'
import { auditEvents, auditLog, orgMembers } from '@nzila/db/schema'
import {
  buildCanonicalPayload,
  computeCanonicalHash,
  canonicalStringify,
  CANONICAL_HASH_VERSION,
} from '@nzila/db/audit-hash'
import {
  assertCfoActionContext,
  assertCfoContextPermission,
  assertCfoCapability,
  cfoAuthoritySource,
  cfoContextPermission,
  isCfoOrganizationId,
  CfoScopeError,
  type CfoActionContext,
} from '@/lib/resolve-org'
import { cfoRows, lockCfoOrganization } from '@/queries/action-context'

/** Same organization chain/key and canonical-v1 storage contract as the
 * current shared authorization writer, on the caller's actual platform TX.
 * No default connection, separate commit, best-effort emitter or fake org. */
async function appendPrimaryAudit(
  context: CfoActionContext,
  event: {
    organizationId: string
    action: string
    targetType: string
    targetId: string
    afterJson: Record<string, unknown>
  },
) {
  assertCfoActionContext(context)
  if (context.purpose === 'personal') throw new CfoScopeError()
  if (context.purpose === 'organization' && context.organizationId !== event.organizationId)
    throw new CfoScopeError()
  if (
    context.purpose === 'organizations' &&
    !context.organizationIds.includes(event.organizationId)
  )
    throw new CfoScopeError()
  if (!(await lockCfoOrganization(context.db, event.organizationId))) throw new CfoScopeError()
  await context.db.execute(
    sql`SELECT pg_advisory_xact_lock(hashtext(${`audit_events:${event.organizationId}`}))`,
  )
  const [head] = await context.db
    .select({ hash: auditEvents.hash })
    .from(auditEvents)
    .where(eq(auditEvents.orgId, event.organizationId))
    .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
    .limit(1)
  const [clock] = cfoRows<{ captured: Date | string }>(
    await context.db.execute(sql`SELECT clock_timestamp() AS captured`),
  )
  const occurredAt =
    clock?.captured instanceof Date ? clock.captured : new Date(clock?.captured ?? '')
  if (!Number.isFinite(occurredAt.getTime())) throw new Error('CFO_AUDIT_CLOCK_UNAVAILABLE')
  const afterJson = JSON.parse(JSON.stringify(event.afterJson)) as Record<string, unknown>
  const previousHash = head?.hash ?? null
  const hash = computeCanonicalHash(
    buildCanonicalPayload({
      action: event.action,
      actorClerkUserId: context.userId,
      actorRole: null,
      afterJson,
      hashTimestamp: occurredAt.toISOString(),
      orgId: event.organizationId,
      targetId: event.targetId,
      targetType: event.targetType,
    }),
    previousHash,
  )
  const [record] = await context.db
    .insert(auditEvents)
    .values({
      orgId: event.organizationId,
      actorClerkUserId: context.userId,
      actorRole: null,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      afterJson,
      previousHash,
      hash,
      occurredAt,
      hashVersion: CANONICAL_HASH_VERSION,
      createdAt: sql`clock_timestamp()`,
    })
    .returning({ id: auditEvents.id })
  if (!record) throw new Error('CFO_MANDATORY_AUDIT_NOT_STORED')
  return record
}

const ORIGIN_ACTION = 'cfo.resource.origin.v1'
const ORIGIN_TARGET = 'cfo.audit_log.root'
const ORIGIN_SCHEMA = 'cfo.record-origin.v1'
const ROOTS = {
  'document.uploaded': {
    kind: 'document',
    entityType: 'document',
    create: 'documents:upload',
    read: 'documents:view',
    manage: 'documents:upload',
  },
  'task.created': {
    kind: 'task',
    entityType: 'task',
    create: 'tasks:create',
    read: 'tasks:view',
    manage: 'tasks:complete',
  },
  'alert.raised': {
    kind: 'alert',
    entityType: 'alert',
    create: 'alerts:view',
    read: 'alerts:view',
    manage: 'alerts:view',
  },
  'message.sent': {
    kind: 'message',
    entityType: 'message',
    create: 'messages:send',
    read: 'messages:view',
    manage: 'messages:send',
  },
  'message.received': {
    kind: 'message',
    entityType: 'message',
    create: 'messages:send',
    read: 'messages:view',
    manage: 'messages:send',
  },
  'settings.updated': {
    kind: 'settings',
    entityType: 'settings',
    create: 'settings:manage',
    read: 'settings:view',
    manage: 'settings:manage',
  },
  'report.generated': {
    kind: 'report',
    entityType: 'report',
    create: 'reports:create',
    read: 'reports:view',
    manage: 'reports:export',
  },
  'report.created': {
    kind: 'report',
    entityType: 'report',
    create: 'reports:create',
    read: 'reports:view',
    manage: 'reports:export',
  },
  'notification.created': {
    kind: 'notification',
    entityType: 'notification',
    create: 'notifications:manage',
    read: 'notifications:view',
    manage: 'notifications:manage',
  },
  'workflow.registered': {
    kind: 'workflow-template',
    entityType: 'workflow',
    create: 'workflows:create',
    read: 'workflows:view',
    manage: 'workflows:manage',
  },
  'workflow.instance.created': {
    kind: 'workflow-instance',
    entityType: 'workflow_instance',
    create: 'workflows:create',
    read: 'workflows:view',
    manage: 'workflows:manage',
  },
} as const
type RootAction = keyof typeof ROOTS
export type CfoRecordKind = (typeof ROOTS)[RootAction]['kind']
interface Header {
  id: string
  action: string
  actorId: string
  orgId: string | null
  entityType: string
  createdAt: Date
  createdAtToken: string
  hasClaim: boolean
  claim: unknown
  recipientId: unknown
  parentId: unknown
}
interface ParentBinding {
  recordId: string
  actorUserId: string
  action: string
  organizationId: string | null
  originId: string | null
}
interface RecordScope {
  organizationId: string | null
  originId: string | null
  parent: ParentBinding | null
}
export interface CfoRecord {
  readonly id: string
  readonly action: RootAction
  readonly actorId: string
  readonly organizationId: string | null
  readonly createdAt: Date
  readonly metadata: Readonly<Record<string, unknown>>
}
const verified = new WeakMap<
  object,
  { context: CfoActionContext; header: Header; scope: RecordScope; writable: boolean }
>()

/** Generic emitters cannot mint the protected origin operation. Only the
 * fresh-record creator below calls the private writer with that identity. */
/**
 * Writes the legacy audit_log row that CFO read models count (for example client totals).
 * It is an audit record of a mutation already performed in the same transaction, owned here
 * with every other CFO audit_log write; it never replaces appendCfoPrimaryAudit.
 */
export async function appendCfoLegacyAuditRow(
  context: CfoActionContext,
  row: { action: string; entityType: string; orgId: string; metadata: Record<string, unknown> },
) {
  await context.db
    .insert(auditLog)
    .values({ ...row, actorId: context.userId })
}

export async function appendCfoPrimaryAudit(
  context: CfoActionContext,
  event: Parameters<typeof appendPrimaryAudit>[1],
) {
  if (event.action === ORIGIN_ACTION || event.targetType === ORIGIN_TARGET)
    throw new CfoScopeError()
  return appendPrimaryAudit(context, event)
}
function rootAction(action: string): action is RootAction {
  return Object.hasOwn(ROOTS, action)
}
function plain(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}
function iso(value: Date | string) {
  const date = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(date.getTime())) throw new CfoScopeError()
  return date.toISOString()
}
function same(left: unknown, right: unknown) {
  return canonicalStringify(left) === canonicalStringify(right)
}
function scopeSourceAllowed(context: CfoActionContext, org: string) {
  return (
    context.purpose === 'platform' ||
    (context.purpose === 'organization' && context.organizationId === org) ||
    (context.purpose === 'organizations' && context.organizationIds.includes(org))
  )
}
function authorityMatches(value: unknown, header: Header, permission: string) {
  if (
    !plain(value) ||
    value.actorUserId !== header.actorId ||
    value.organizationId !== header.orgId ||
    value.permission !== permission
  )
    return false
  if (value.kind === 'membership')
    return (
      same(
        Object.keys(value).sort(),
        ['kind', 'source', 'organizationId', 'actorUserId', 'permission', 'membershipIds'].sort(),
      ) &&
      value.source === 'org_members' &&
      Array.isArray(value.membershipIds) &&
      value.membershipIds.length > 0 &&
      value.membershipIds.every(isCfoOrganizationId) &&
      new Set(value.membershipIds).size === value.membershipIds.length
    )
  return (
    same(
      Object.keys(value).sort(),
      ['kind', 'source', 'organizationId', 'actorUserId', 'permission', 'platformRole'].sort(),
    ) &&
    value.kind === 'platform' &&
    value.source === 'cfo.platform-permissions' &&
    typeof value.platformRole === 'string' &&
    Object.hasOwn(PLATFORM_PERMISSIONS, value.platformRole) &&
    (value.platformRole === 'platform_admin' ||
      platformRoleHasPermission(value.platformRole as PlatformRole, permission as Permission))
  )
}
function originScope(header: Header, events: (typeof auditEvents.$inferSelect)[]): RecordScope {
  if (!header.hasClaim && !events.length)
    return { organizationId: null, originId: null, parent: null }
  if (
    header.claim !== ORIGIN_SCHEMA ||
    !header.hasClaim ||
    !header.orgId ||
    events.length !== 1 ||
    !rootAction(header.action)
  )
    throw new CfoScopeError()
  const event = events[0],
    data = event.afterJson
  if (
    event.action !== ORIGIN_ACTION ||
    event.targetType !== ORIGIN_TARGET ||
    event.targetId !== header.id ||
    event.orgId !== header.orgId ||
    event.actorClerkUserId !== header.actorId ||
    event.hashVersion !== CANONICAL_HASH_VERSION ||
    event.actorRole !== null ||
    !plain(data)
  )
    throw new CfoScopeError()
  const expected = [
    'application',
    'schema',
    'operation',
    'rootRecordId',
    'actorUserId',
    'organizationId',
    'rootCreatedAt',
    'authoritySource',
    'bindings',
  ].sort()
  if (
    !same(Object.keys(data).sort(), expected) ||
    data.application !== 'cfo' ||
    data.schema !== ORIGIN_SCHEMA ||
    data.operation !== header.action ||
    data.rootRecordId !== header.id ||
    data.actorUserId !== header.actorId ||
    data.organizationId !== header.orgId ||
    data.rootCreatedAt !== header.createdAtToken ||
    !authorityMatches(data.authoritySource, header, ROOTS[header.action].create) ||
    !plain(data.bindings)
  )
    throw new CfoScopeError()
  if (!same(Object.keys(data.bindings).sort(), ['parent', 'recipientId'])) throw new CfoScopeError()
  const recipient = header.recipientId
  if (
    (recipient !== null && typeof recipient !== 'string') ||
    data.bindings.recipientId !== recipient
  )
    throw new CfoScopeError()
  let parent: ParentBinding | null = null
  if (header.action === 'workflow.instance.created') {
    const value = data.bindings.parent
    if (
      !plain(value) ||
      !same(
        Object.keys(value).sort(),
        ['recordId', 'actorUserId', 'action', 'organizationId', 'originId'].sort(),
      ) ||
      value.recordId !== header.parentId ||
      !isCfoOrganizationId(value.recordId) ||
      typeof value.actorUserId !== 'string' ||
      value.action !== 'workflow.registered' ||
      value.organizationId !== header.orgId ||
      !isCfoOrganizationId(value.originId)
    )
      throw new CfoScopeError()
    parent = value as unknown as ParentBinding
  } else if (data.bindings.parent !== null || header.parentId !== null) throw new CfoScopeError()
  const hash = computeCanonicalHash(
    buildCanonicalPayload({
      action: event.action,
      actorClerkUserId: event.actorClerkUserId,
      actorRole: event.actorRole,
      afterJson: data,
      hashTimestamp: iso(event.occurredAt),
      orgId: event.orgId,
      targetId: event.targetId,
      targetType: event.targetType,
    }),
    event.previousHash,
  )
  if (event.hash !== hash) throw new CfoScopeError()
  return { organizationId: header.orgId, originId: event.id, parent }
}
async function requireOriginVisibility(context: CfoActionContext) {
  const [row] = cfoRows<{ filtered: boolean }>(
    await context.db.execute(
      sql`SELECT pg_catalog.row_security_active('public.audit_events'::regclass) AS filtered`,
    ),
  )
  if (row?.filtered !== false) throw new CfoScopeError('Record source is unavailable')
}
function recordFact(context: CfoActionContext, record: CfoRecord) {
  assertCfoActionContext(context)
  const fact = verified.get(record)
  if (!fact || fact.context !== context) throw new CfoScopeError()
  return fact
}

function remember(
  context: CfoActionContext,
  header: Header,
  scope: RecordScope,
  metadata: Record<string, unknown>,
  writable = false,
): CfoRecord {
  if (!rootAction(header.action)) throw new CfoScopeError()
  const record = Object.freeze({
    id: header.id,
    action: header.action,
    actorId: header.actorId,
    organizationId: scope.organizationId,
    createdAt: header.createdAt,
    metadata: Object.freeze(metadata),
  })
  const stableScope = Object.freeze({
    ...scope,
    parent: scope.parent ? Object.freeze({ ...scope.parent }) : null,
  })
  verified.set(record, {
    context,
    header: Object.freeze({ ...header }),
    scope: stableScope,
    writable,
  })
  return record
}
const headerProjection = {
  id: auditLog.id,
  action: auditLog.action,
  actorId: auditLog.actorId,
  orgId: auditLog.orgId,
  entityType: auditLog.entityType,
  createdAt: auditLog.createdAt,
  createdAtToken: sql<string>`to_char(${auditLog.createdAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
  hasClaim: sql<boolean>`${auditLog.metadata} ? '_cfoOrigin'`,
  claim: sql<unknown>`${auditLog.metadata}->'_cfoOrigin'`,
  recipientId: sql<unknown>`CASE WHEN ${auditLog.action} IN ('message.sent','message.received') THEN ${auditLog.metadata}->'to' WHEN ${auditLog.action}='task.created' THEN ${auditLog.metadata}->'assignedTo' ELSE ${auditLog.metadata}->'recipientId' END`,
  parentId: sql<unknown>`${auditLog.metadata}->'templateId'`,
}
async function headersFor(
  context: CfoActionContext,
  ids: readonly string[],
  lock: 'share' | 'update',
) {
  if (ids.some((id) => !isCfoOrganizationId(id))) throw new CfoScopeError()
  if (!ids.length) return []
  return context.db
    .select(headerProjection)
    .from(auditLog)
    .where(inArray(auditLog.id, [...ids]))
    .orderBy(auditLog.id)
    .for(lock)
}
/** Bounded transport coalescing inside this transaction. Header and provenance
 * facts precede private payloads; held row/membership locks outlive projection.
 * No cross-request/user verdict cache or first-membership authority. */
async function recordsFromHeaders(
  context: CfoActionContext,
  headers: Header[],
  allowed: readonly RootAction[],
  options: { manage?: boolean; tolerant?: boolean; writable?: boolean } = {},
): Promise<CfoRecord[]> {
  assertCfoActionContext(context)
  if (!headers.length) return []
  await requireOriginVisibility(context)
  for (const permission of new Set(allowed.map((action) => ROOTS[action].read)))
    await assertCfoCapability(context, permission)
  const events = await context.db
    .select()
    .from(auditEvents)
    .where(
      and(
        inArray(
          auditEvents.targetId,
          headers.map((h) => h.id),
        ),
        or(eq(auditEvents.action, ORIGIN_ACTION), eq(auditEvents.targetType, ORIGIN_TARGET)),
      ),
    )
  const eventMap = new Map<string, (typeof auditEvents.$inferSelect)[]>()
  for (const event of events)
    if (event.targetId)
      eventMap.set(event.targetId, [...(eventMap.get(event.targetId) ?? []), event])
  const scoped: { header: Header; scope: RecordScope }[] = []
  for (const header of headers) {
    try {
      if (
        !rootAction(header.action) ||
        !allowed.includes(header.action) ||
        header.entityType !== ROOTS[header.action].entityType
      )
        throw new CfoScopeError()
      const config = ROOTS[header.action],
        capabilities: readonly Permission[] = [config.read, config.create, config.manage]
      if (!capabilities.includes(cfoContextPermission(context))) throw new CfoScopeError()
      if (options.manage) assertCfoContextPermission(context, config.manage)
      const scope = originScope(header, eventMap.get(header.id) ?? [])
      if (scope.organizationId && !scopeSourceAllowed(context, scope.organizationId))
        throw new CfoScopeError()
      if (
        header.action === 'notification.created' &&
        header.recipientId !== null &&
        typeof header.recipientId !== 'string'
      )
        throw new CfoScopeError()
      const owner =
        header.action === 'notification.created' && typeof header.recipientId === 'string'
          ? header.recipientId
          : header.actorId
      if (header.action === 'notification.created' && owner !== context.userId)
        throw new CfoScopeError()
      const message = header.action === 'message.sent' || header.action === 'message.received'
      if (message && header.actorId !== context.userId && header.recipientId !== context.userId)
        throw new CfoScopeError()
      const legacyOwner =
        owner === context.userId ||
        ((message || header.action === 'task.created') && header.recipientId === context.userId)
      if (!scope.organizationId && context.purpose !== 'platform' && !legacyOwner)
        throw new CfoScopeError()
      scoped.push({ header, scope })
    } catch (error) {
      if (!options.tolerant || !(error instanceof CfoScopeError)) throw error
    }
  }
  const parentIds = [
    ...new Set(
      scoped
        .filter((row) => row.header.action === 'workflow.instance.created')
        .map((row) =>
          typeof row.header.parentId === 'string' ? row.header.parentId : row.header.orgId,
        )
        .filter(isCfoOrganizationId),
    ),
  ]
  const parents = parentIds.length
    ? await recordsFromHeaders(
        context,
        await headersFor(context, parentIds, 'share'),
        ['workflow.registered'],
        { tolerant: options.tolerant },
      )
    : []
  const parentMap = new Map(parents.map((row) => [row.id, row]))
  const authorized = scoped.filter(({ header, scope }) => {
    try {
      if (header.action !== 'workflow.instance.created') return true
      const parentId = typeof header.parentId === 'string' ? header.parentId : header.orgId
      const parent = parentId ? parentMap.get(parentId) : undefined
      if (!parent) throw new CfoScopeError()
      const parentFact = recordFact(context, parent)
      if (
        scope.parent &&
        !same(scope.parent, {
          recordId: parent.id,
          actorUserId: parent.actorId,
          action: parent.action,
          organizationId: parentFact.scope.organizationId,
          originId: parentFact.scope.originId,
        })
      )
        throw new CfoScopeError()
      if (
        !scope.parent &&
        header.parentId !== null &&
        header.orgId !== null &&
        header.orgId !== parentId
      )
        throw new CfoScopeError()
      // Personal legacy lineage is a verified resource reference, never an
      // adopted tenant source or permission inherited from a UUID label.
      if (!scope.parent)
        scope.parent = {
          recordId: parent.id,
          actorUserId: parent.actorId,
          action: parent.action,
          organizationId: parentFact.scope.organizationId,
          originId: parentFact.scope.originId,
        }
      return true
    } catch (error) {
      if (!options.tolerant || !(error instanceof CfoScopeError)) throw error
      return false
    }
  })
  if (!authorized.length) return []
  const payloads = await context.db
    .select({ id: auditLog.id, metadata: auditLog.metadata })
    .from(auditLog)
    .where(
      inArray(
        auditLog.id,
        authorized.map((row) => row.header.id),
      ),
    )
  const payloadMap = new Map(payloads.map((row) => [row.id, row.metadata]))
  return authorized.map(({ header, scope }) => {
    const metadata = payloadMap.get(header.id)
    if (!plain(metadata)) throw new CfoScopeError()
    return remember(context, header, scope, metadata, options.writable)
  })
}
export async function getCfoRecord(
  context: CfoActionContext,
  id: string,
  allowed: readonly RootAction[],
  options: { lock?: 'share' | 'update'; manage?: boolean } = {},
): Promise<CfoRecord | null> {
  assertCfoActionContext(context)
  return (
    (
      await recordsFromHeaders(
        context,
        await headersFor(context, [id], options.lock ?? 'share'),
        allowed,
        { ...options, writable: options.lock === 'update' },
      )
    )[0] ?? null
  )
}
export async function listCfoRecords(
  context: CfoActionContext,
  action: RootAction,
): Promise<CfoRecord[]> {
  const listCapabilities: readonly Permission[] = [ROOTS[action].read, ROOTS[action].manage]
  if (!listCapabilities.includes(cfoContextPermission(context))) throw new CfoScopeError()
  // This narrows candidates only. Exact origin and parent decisions above are
  // still required before any private metadata leaves the database adapter.
  const tenantHint =
    context.purpose === 'organizations' && context.organizationIds.length
      ? inArray(auditLog.orgId, [...context.organizationIds])
      : context.purpose === 'organization'
        ? eq(auditLog.orgId, context.organizationId)
        : undefined
  const sourceFilter =
    context.purpose === 'platform'
      ? undefined
      : or(
          eq(auditLog.actorId, context.userId),
          tenantHint,
          sql`${headerProjection.recipientId} = to_jsonb(${context.userId}::text)`,
        )
  const headers = await context.db
    .select(headerProjection)
    .from(auditLog)
    .where(and(eq(auditLog.action, action), sourceFilter))
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .for('share')
  return recordsFromHeaders(context, headers, [action], { tolerant: true })
}

export async function createCfoRecord(
  context: CfoActionContext,
  input: { action: RootAction; metadata: Record<string, unknown>; parent?: CfoRecord },
): Promise<CfoRecord> {
  if (!rootAction(input.action)) throw new CfoScopeError()
  assertCfoContextPermission(context, ROOTS[input.action].create)
  for (const key of [
    '_cfoOrigin',
    'orgId',
    'organizationId',
    'actorId',
    'actorUserId',
    'scopeVersion',
    'originEventId',
    'templateId',
  ])
    if (Object.hasOwn(input.metadata, key)) throw new CfoScopeError()
  let organizationId: string | null = null,
    parent: ParentBinding | null = null
  if (input.action === 'workflow.instance.created') {
    if (!input.parent || input.parent.action !== 'workflow.registered') throw new CfoScopeError()
    const fact = recordFact(context, input.parent)
    organizationId = fact.scope.organizationId
    parent = {
      recordId: input.parent.id,
      actorUserId: input.parent.actorId,
      action: input.parent.action,
      organizationId,
      originId: fact.scope.originId,
    }
  } else {
    if (context.purpose !== 'organization') throw new CfoScopeError()
    organizationId = context.organizationId
  }
  if (organizationId && !scopeSourceAllowed(context, organizationId)) throw new CfoScopeError()
  const metadata: Record<string, unknown> = {
    ...input.metadata,
    ...(parent ? { templateId: parent.recordId } : {}),
    ...(organizationId ? { _cfoOrigin: ORIGIN_SCHEMA } : {}),
  }
  const recipient =
    input.action === 'notification.created'
      ? input.metadata.recipientId
      : input.action === 'message.sent' || input.action === 'message.received'
        ? input.metadata.to
        : input.action === 'task.created'
          ? input.metadata.assignedTo
          : null
  if (
    input.action === 'notification.created' ||
    input.action === 'message.sent' ||
    input.action === 'message.received' ||
    (recipient !== null && recipient !== undefined)
  ) {
    if (
      typeof recipient !== 'string' ||
      !recipient ||
      recipient !== recipient.trim() ||
      recipient.length > 255 ||
      /[\u0000-\u001f\u007f]/.test(recipient) ||
      !organizationId
    )
      throw new CfoScopeError()
    const members = await context.db
      .select({ id: orgMembers.id })
      .from(orgMembers)
      .where(
        and(
          eq(orgMembers.orgId, organizationId),
          eq(orgMembers.userId, recipient),
          eq(orgMembers.status, 'active'),
        ),
      )
      .for('share')
    if (!members.length) throw new CfoScopeError()
  }
  const [row] = await context.db
    .insert(auditLog)
    .values({
      action: input.action,
      entityType: ROOTS[input.action].entityType,
      actorId: context.userId,
      orgId: organizationId,
      metadata,
      createdAt: sql`clock_timestamp()`,
    })
    .returning({
      id: auditLog.id,
      action: auditLog.action,
      actorId: auditLog.actorId,
      orgId: auditLog.orgId,
      entityType: auditLog.entityType,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
      createdAtToken: sql<string>`to_char(${auditLog.createdAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
    })
  if (!row) throw new Error('CFO_RECORD_NOT_STORED')
  let originId: string | null = null
  if (organizationId) {
    const authoritySource = cfoAuthoritySource(context, organizationId, ROOTS[input.action].create)
    const origin = await appendPrimaryAudit(context, {
      organizationId,
      action: ORIGIN_ACTION,
      targetType: ORIGIN_TARGET,
      targetId: row.id,
      afterJson: {
        application: 'cfo',
        schema: ORIGIN_SCHEMA,
        operation: row.action,
        rootRecordId: row.id,
        actorUserId: row.actorId,
        organizationId,
        rootCreatedAt: row.createdAtToken,
        authoritySource,
        bindings: {
          recipientId: recipient ?? null,
          parent,
        },
      },
    })
    originId = origin.id
  }
  return remember(
    context,
    {
      id: row.id,
      action: row.action,
      actorId: row.actorId,
      orgId: row.orgId,
      entityType: row.entityType,
      createdAt: row.createdAt,
      createdAtToken: row.createdAtToken,
      hasClaim: !!organizationId,
      claim: organizationId ? ORIGIN_SCHEMA : null,
      recipientId: recipient ?? null,
      parentId: metadata.templateId ?? null,
    },
    { organizationId, originId, parent },
    metadata,
    true,
  )
}

export interface CfoNotification {
  id: string
  type:
    | 'workflow_assignment'
    | 'alert_triggered'
    | 'report_ready'
    | 'task_overdue'
    | 'system'
    | 'security_event'
  title: string
  message: string
  priority: 'urgent' | 'high' | 'normal' | 'low'
  read: boolean
  actionUrl: string | null
  createdAt: Date
}
const NOTIFICATION_TYPES = [
  'workflow_assignment',
  'alert_triggered',
  'report_ready',
  'task_overdue',
  'system',
  'security_event',
] as const
const PRIORITIES = ['urgent', 'high', 'normal', 'low'] as const
export function safeCfoNotificationUrl(value: unknown): string | null {
  if (typeof value !== 'string' || !value) return null
  try {
    const base = 'https://cfo.invalid',
      parsed = new URL(value, base)
    if (!['https:', 'http:'].includes(parsed.protocol) || parsed.username || parsed.password)
      return null
    if (value.startsWith('/') && parsed.origin === base) return value
    return /^https?:\/\//i.test(value) ? value : null
  } catch {
    return null
  }
}
function notificationOwner(header: Header) {
  return typeof header.recipientId === 'string' ? header.recipientId : header.actorId
}
async function visibleNotificationHeaders(context: CfoActionContext) {
  assertCfoContextPermission(context, 'notifications:view')
  await requireOriginVisibility(context)
  const rows = await context.db
    .select({
      header: {
        id: auditLog.id,
        action: auditLog.action,
        actorId: auditLog.actorId,
        orgId: auditLog.orgId,
        entityType: auditLog.entityType,
        createdAt: auditLog.createdAt,
        createdAtToken: sql<string>`to_char(${auditLog.createdAt} AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
        hasClaim: sql<boolean>`${auditLog.metadata} ? '_cfoOrigin'`,
        claim: sql<unknown>`${auditLog.metadata}->'_cfoOrigin'`,
        recipientId: sql<unknown>`CASE WHEN ${auditLog.action} IN ('message.sent','message.received') THEN ${auditLog.metadata}->'to' WHEN ${auditLog.action}='task.created' THEN ${auditLog.metadata}->'assignedTo' ELSE ${auditLog.metadata}->'recipientId' END`,
        parentId: sql<unknown>`${auditLog.metadata}->'templateId'`,
      },
      origin: auditEvents,
    })
    .from(auditLog)
    .leftJoin(
      auditEvents,
      and(
        eq(auditEvents.targetId, auditLog.id),
        or(eq(auditEvents.action, ORIGIN_ACTION), eq(auditEvents.targetType, ORIGIN_TARGET)),
      ),
    )
    .where(
      and(
        eq(auditLog.action, 'notification.created'),
        or(
          sql`${auditLog.metadata}->>'recipientId'=${context.userId}`,
          and(
            eq(auditLog.actorId, context.userId),
            sql`(${auditLog.metadata}->'recipientId' IS NULL OR ${auditLog.metadata}->'recipientId'='null'::jsonb)`,
          ),
        ),
      ),
    )
    .orderBy(desc(auditLog.createdAt), desc(auditLog.id))
    .for('share', { of: auditLog })
  const grouped = new Map<string, { header: Header; events: (typeof auditEvents.$inferSelect)[] }>()
  for (const row of rows) {
    const group = grouped.get(row.header.id) ?? { header: row.header, events: [] }
    if (row.origin) group.events.push(row.origin)
    grouped.set(row.header.id, group)
  }
  const eligible: { header: Header; scope: RecordScope }[] = []
  for (const group of grouped.values()) {
    try {
      const { header } = group
      if (
        header.entityType !== 'notification' ||
        (header.recipientId !== null && typeof header.recipientId !== 'string') ||
        notificationOwner(header) !== context.userId
      )
        throw new CfoScopeError()
      const scope = originScope(header, group.events)
      if (scope.organizationId && !scopeSourceAllowed(context, scope.organizationId))
        throw new CfoScopeError()
      eligible.push({ header, scope })
    } catch (error) {
      if (!(error instanceof CfoScopeError)) throw error
    }
  }
  return eligible
}
async function notificationReceiptState(context: CfoActionContext) {
  const rows = await context.db
    .select({
      action: auditLog.action,
      orgId: auditLog.orgId,
      metadata: auditLog.metadata,
      createdAt: auditLog.createdAt,
    })
    .from(auditLog)
    .where(
      and(
        eq(auditLog.actorId, context.userId),
        inArray(auditLog.action, [
          'notification.read',
          'notification.read_all',
          'notification.deleted',
        ]),
      ),
    )
  const read = new Set<string>(),
    deleted = new Set<string>()
  let legacyCutoff: Date | null = null
  for (const row of rows) {
    if (!plain(row.metadata)) continue
    if (row.action === 'notification.read_all') {
      if (
        row.metadata.schema === 'cfo.notification.receipt.v1' &&
        Array.isArray(row.metadata.notificationIds)
      ) {
        for (const id of row.metadata.notificationIds) if (isCfoOrganizationId(id)) read.add(id)
      } else if (
        !Object.hasOwn(row.metadata, 'schema') &&
        (!legacyCutoff || row.createdAt > legacyCutoff)
      )
        legacyCutoff = row.createdAt
    } else {
      const id =
        row.metadata.schema === 'cfo.notification.receipt.v1'
          ? row.metadata.notificationId
          : !Object.hasOwn(row.metadata, 'schema')
            ? row.orgId
            : null
      if (isCfoOrganizationId(id)) (row.action === 'notification.deleted' ? deleted : read).add(id)
    }
  }
  return { read, deleted, legacyCutoff }
}
export async function listCfoNotifications(
  context: CfoActionContext,
  options: { unreadOnly?: boolean; page?: number } = {},
) {
  const eligible = await visibleNotificationHeaders(context),
    state = await notificationReceiptState(context)
  const visible = eligible
    .filter((row) => !state.deleted.has(row.header.id))
    .map((row) => ({
      ...row,
      read:
        state.read.has(row.header.id) ||
        (!!state.legacyCutoff && row.header.createdAt <= state.legacyCutoff),
    }))
  const unreadCount = visible.filter((row) => !row.read).length
  const filtered = options.unreadOnly ? visible.filter((row) => !row.read) : visible
  const page = Math.max(1, Number.isFinite(options.page) ? Math.trunc(options.page!) : 1)
  const selected = filtered.slice((page - 1) * 50, page * 50)
  const payloads = selected.length
    ? await context.db
        .select({ id: auditLog.id, metadata: auditLog.metadata })
        .from(auditLog)
        .where(
          inArray(
            auditLog.id,
            selected.map((row) => row.header.id),
          ),
        )
    : []
  const metadata = new Map(payloads.map((row) => [row.id, row.metadata]))
  const notifications: CfoNotification[] = selected.map((row) => {
    const value = metadata.get(row.header.id)
    if (!plain(value)) throw new CfoScopeError('Notification data is unavailable')
    return {
      id: row.header.id,
      type: (NOTIFICATION_TYPES as readonly unknown[]).includes(value.type)
        ? (value.type as CfoNotification['type'])
        : 'system',
      title: typeof value.title === 'string' ? value.title : 'Notification',
      message: typeof value.message === 'string' ? value.message : '',
      priority: (PRIORITIES as readonly unknown[]).includes(value.priority)
        ? (value.priority as CfoNotification['priority'])
        : 'normal',
      read: row.read,
      actionUrl: safeCfoNotificationUrl(value.actionUrl),
      createdAt: row.header.createdAt,
    }
  })
  return { notifications, unreadCount }
}
export async function markCfoNotification(
  context: CfoActionContext,
  id: string,
  operation: 'read' | 'deleted',
) {
  assertCfoContextPermission(
    context,
    operation === 'read' ? 'notifications:view' : 'notifications:manage',
  )
  const record = await getCfoRecord(context, id, ['notification.created'], {
    lock: 'share',
    manage: operation === 'deleted',
  })
  if (!record) return { success: false }
  const fact = recordFact(context, record)
  if (notificationOwner(fact.header) !== context.userId) throw new CfoScopeError()
  const metadata = {
    schema: 'cfo.notification.receipt.v1',
    notificationId: record.id,
    recipientId: context.userId,
  }
  const [receipt] = await context.db
    .insert(auditLog)
    .values({
      action: `notification.${operation}`,
      actorId: context.userId,
      entityType: 'notification',
      orgId: fact.scope.organizationId,
      metadata,
    })
    .returning({ id: auditLog.id })
  if (!receipt) throw new Error('Notification receipt was not stored')
  if (fact.scope.organizationId)
    await appendCfoPrimaryAudit(context, {
      organizationId: fact.scope.organizationId,
      action: `cfo.notification.${operation}`,
      targetType: 'cfo.notification.receipt',
      targetId: receipt.id,
      afterJson: {
        schema: 'cfo.notification.receipt.v1',
        notificationId: record.id,
        recipientId: context.userId,
        receiptId: receipt.id,
        authoritySource: cfoAuthoritySource(
          context,
          fact.scope.organizationId,
          operation === 'read' ? 'notifications:view' : 'notifications:manage',
        ),
      },
    })
  return { success: true }
}
export async function markAllCfoNotifications(context: CfoActionContext) {
  const eligible = await visibleNotificationHeaders(context),
    state = await notificationReceiptState(context)
  const visible = eligible.filter((row) => !state.deleted.has(row.header.id))
  const [receipt] = await context.db
    .insert(auditLog)
    .values({
      action: 'notification.read_all',
      actorId: context.userId,
      entityType: 'notification',
      orgId: null,
      metadata: {
        schema: 'cfo.notification.receipt.v1',
        notificationIds: visible.map((row) => row.header.id),
      },
    })
    .returning({ id: auditLog.id })
  if (!receipt) throw new Error('Notification receipt was not stored')
  const organizations = [
    ...new Set(
      visible.map((row) => row.scope.organizationId).filter((id): id is string => id !== null),
    ),
  ].sort()
  for (const organizationId of organizations)
    await appendCfoPrimaryAudit(context, {
      organizationId,
      action: 'cfo.notification.read_all',
      targetType: 'cfo.notification.receipt',
      targetId: receipt.id,
      afterJson: {
        schema: 'cfo.notification.receipt.v1',
        receiptId: receipt.id,
        notificationIds: visible
          .filter((row) => row.scope.organizationId === organizationId)
          .map((row) => row.header.id),
        authoritySource: cfoAuthoritySource(context, organizationId, 'notifications:view'),
      },
    })
  return { success: true }
}

/** Existing workflow state only. Header/parent/source identities are immutable;
 * a real FOR UPDATE receipt from this live context is mandatory for updates. */
export async function updateCfoWorkflowRecord(
  context: CfoActionContext,
  record: CfoRecord,
  patch: Record<string, unknown>,
  operation: 'started' | 'approved' | 'rejected',
  detail: Record<string, unknown>,
) {
  const fact = recordFact(context, record)
  if (!fact.writable) throw new CfoScopeError()
  const detailKeys = operation === 'started' ? ['instanceId'] : ['stepIndex', 'stepName', 'comment']
  if (Object.keys(detail).some((key) => !detailKeys.includes(key))) throw new CfoScopeError()
  if (operation === 'started' && !isCfoOrganizationId(detail.instanceId)) throw new CfoScopeError()
  if (
    operation !== 'started' &&
    (!Number.isInteger(detail.stepIndex) ||
      Number(detail.stepIndex) < 0 ||
      typeof detail.stepName !== 'string' ||
      (detail.comment !== null && typeof detail.comment !== 'string'))
  )
    throw new CfoScopeError()
  if (operation === 'started') {
    if (
      record.action !== 'workflow.registered' ||
      Object.keys(patch).some((k) => !['runCount', 'lastRun'].includes(k))
    )
      throw new CfoScopeError()
    assertCfoContextPermission(context, 'workflows:create')
  } else {
    if (
      record.action !== 'workflow.instance.created' ||
      Object.keys(patch).some((k) => !['steps', 'currentStep', 'status'].includes(k))
    )
      throw new CfoScopeError()
    assertCfoContextPermission(context, 'workflows:manage')
  }
  const [updated] = await context.db
    .update(auditLog)
    .set({ metadata: { ...record.metadata, ...patch } })
    .where(
      and(
        eq(auditLog.id, record.id),
        eq(auditLog.action, record.action),
        eq(auditLog.actorId, record.actorId),
        sql`${auditLog.orgId} IS NOT DISTINCT FROM ${fact.header.orgId}::uuid`,
        sql`${auditLog.createdAt}= ${fact.header.createdAtToken}::timestamptz`,
        sql`${auditLog.metadata}=${JSON.stringify(record.metadata)}::jsonb`,
      ),
    )
    .returning({ id: auditLog.id })
  if (!updated) throw new CfoScopeError('Workflow changed; reload it before retrying')
  const action = operation === 'started' ? 'workflow.started' : `workflow.step.${operation}`
  const [receipt] = await context.db
    .insert(auditLog)
    .values({
      action,
      actorId: context.userId,
      entityType: record.action === 'workflow.registered' ? 'workflow' : 'workflow_instance',
      orgId: fact.scope.organizationId,
      metadata: {
        ...detail,
        schema: 'cfo.workflow.receipt.v1',
        workflowRecordId: record.id,
        templateId: fact.scope.parent?.recordId ?? record.id,
      },
    })
    .returning({ id: auditLog.id })
  if (!receipt) throw new Error('Workflow receipt was not stored')
  if (fact.scope.organizationId)
    await appendCfoPrimaryAudit(context, {
      organizationId: fact.scope.organizationId,
      action: `cfo.${action}`,
      targetType: 'cfo.workflow.receipt',
      targetId: receipt.id,
      afterJson: {
        ...detail,
        schema: 'cfo.workflow.receipt.v1',
        receiptId: receipt.id,
        workflowRecordId: record.id,
        templateId: fact.scope.parent?.recordId ?? record.id,
        authoritySource: cfoAuthoritySource(
          context,
          fact.scope.organizationId,
          operation === 'started' ? 'workflows:create' : 'workflows:manage',
        ),
      },
    })
}

/** Old audit_log used org_id for unrelated resource IDs and arbitrary labels.
 * It cannot establish tenant jurisdiction. Preserve personal actor history;
 * only a real declared global platform purpose can read the full old stream.
 * Corrected collaborative roots use the independently checked origin service. */
export function legacyCfoAuditPredicate(context: CfoActionContext) {
  assertCfoActionContext(context)
  return context.purpose === 'platform' ? sql`TRUE` : sql`actor_id=${context.userId}`
}

export async function changeCfoRecordMetadata(
  context: CfoActionContext,
  record: CfoRecord,
  patch: Record<string, unknown>,
  operation: 'document.annotated' | 'task.status_changed' | 'alert.acknowledged',
) {
  const contracts = {
    'document.annotated': {
      action: 'document.uploaded',
      permission: 'documents:upload',
      keys: ['name', 'type'],
    },
    'task.status_changed': {
      action: 'task.created',
      permission: 'tasks:complete',
      keys: ['status'],
    },
    'alert.acknowledged': {
      action: 'alert.raised',
      permission: 'alerts:view',
      keys: ['acknowledged'],
    },
  } as const
  const contract = contracts[operation],
    fact = recordFact(context, record)
  assertCfoContextPermission(context, contract.permission)
  if (
    !fact.writable ||
    record.action !== contract.action ||
    Object.keys(patch).some((key) => !(contract.keys as readonly string[]).includes(key))
  )
    throw new CfoScopeError()
  const [updated] = await context.db
    .update(auditLog)
    .set({ metadata: { ...record.metadata, ...patch } })
    .where(
      and(
        eq(auditLog.id, record.id),
        eq(auditLog.action, record.action),
        eq(auditLog.actorId, record.actorId),
        sql`${auditLog.orgId} IS NOT DISTINCT FROM ${fact.header.orgId}::uuid`,
        sql`${auditLog.createdAt}=${fact.header.createdAtToken}::timestamptz`,
        sql`${auditLog.metadata}=${JSON.stringify(record.metadata)}::jsonb`,
      ),
    )
    .returning({ id: auditLog.id })
  if (!updated) throw new CfoScopeError('Record changed; reload it before retrying')
  const [receipt] = await context.db
    .insert(auditLog)
    .values({
      action: operation,
      actorId: context.userId,
      entityType: fact.header.entityType,
      orgId: fact.scope.organizationId,
      metadata: { schema: 'cfo.record-change.v1', recordId: record.id, ...patch },
    })
    .returning({ id: auditLog.id })
  if (!receipt) throw new Error('Record receipt was not stored')
  if (fact.scope.organizationId)
    await appendCfoPrimaryAudit(context, {
      organizationId: fact.scope.organizationId,
      action: `cfo.${operation}`,
      targetType: 'cfo.record-change',
      targetId: receipt.id,
      afterJson: {
        schema: 'cfo.record-change.v1',
        receiptId: receipt.id,
        recordId: record.id,
        ...patch,
        authoritySource: cfoAuthoritySource(
          context,
          fact.scope.organizationId,
          contract.permission,
        ),
      },
    })
  return { success: true }
}
