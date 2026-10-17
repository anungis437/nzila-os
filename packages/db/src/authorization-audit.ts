import { desc, eq, sql } from 'drizzle-orm'

import { db } from './client'
import { authAuditLog, auditEvents, orgs } from './schema'
import { buildCanonicalPayload, computeCanonicalHash } from './audit-hash'

export interface AuthorizationDecisionAuditEvent {
  readonly event: 'application_authorization'
  readonly decision: 'ALLOW' | 'DENY'
  readonly reason: string
  readonly platformUserId?: string
  readonly identityBindingId?: string
  readonly identityProvider: string
  readonly externalIdentityReference: string
  readonly organizationId?: string
  readonly membershipId?: string
  readonly applicationId: string
  readonly requiredPermissions?: readonly string[]
  readonly effectivePermissions?: readonly string[]
  readonly permissionGrantIds?: readonly string[]
  readonly occurredAt: string
  readonly correlationId: string
}

export interface SourceDisclosureDecisionAuditEvent {
  readonly decisionId: string
  readonly decision: 'ALLOW' | 'WITHHOLD' | 'DENY'
  readonly reason: string
  readonly actorId: string
  readonly identityBindingId: string
  readonly membershipId: string
  readonly organizationId: string
  readonly applicationId: string
  readonly surface: string
  readonly action: string
  readonly purpose: string
  readonly sourceSystem: string
  readonly sourceDomain?: string
  readonly sourceEntity?: string
  readonly sourceOrganizationId?: string
  readonly factClass: string
  readonly policyId?: string
  readonly policyVersion?: string
  readonly occurredAt: string
  readonly correlationId: string
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
}

function safeActorId(event: AuthorizationDecisionAuditEvent): string {
  return event.platformUserId ?? 'system:unauthenticated'
}

function auditDetails(event: AuthorizationDecisionAuditEvent): Record<string, unknown> {
  return {
    event: event.event,
    decision: event.decision,
    reason: event.reason,
    identityProvider: event.identityProvider,
    externalIdentityReference: event.externalIdentityReference,
    ...(event.platformUserId ? { platformUserId: event.platformUserId } : {}),
    ...(event.identityBindingId ? { identityBindingId: event.identityBindingId } : {}),
    ...(event.organizationId ? { organizationId: event.organizationId } : {}),
    ...(event.membershipId ? { membershipId: event.membershipId } : {}),
    applicationId: event.applicationId,
    requiredPermissions: event.requiredPermissions ?? [],
    effectivePermissions: event.effectivePermissions ?? [],
    permissionGrantIds: event.permissionGrantIds ?? [],
    correlationId: event.correlationId,
  }
}

/**
 * Persist a platform authorization outcome before returning an allow decision.
 * Resolved organization outcomes use the shared canonical audit hash chain;
 * unresolved outcomes use the shared auth audit log without raw identity claims.
 */
export async function writeAuthorizationDecision(
  event: AuthorizationDecisionAuditEvent,
): Promise<void> {
  const details = auditDetails(event)
  const organizationId =
    event.organizationId && isUuid(event.organizationId) ? event.organizationId : null
  const organizationExists = organizationId
    ? await db.select({ id: orgs.id }).from(orgs).where(eq(orgs.id, organizationId)).limit(1)
    : []

  if (!organizationId || organizationExists.length === 0) {
    const [row] = await db
      .insert(authAuditLog)
      .values({
        userId: event.platformUserId ?? null,
        eventType: 'authorization_decision',
        metadata: details,
      })
      .returning({ id: authAuditLog.id })
    if (!row?.id) throw new Error('Authorization audit persistence returned no row')
    return
  }

  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`audit_events:${organizationId}`}))`,
    )
    const [latest] = await transaction
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .where(eq(auditEvents.orgId, organizationId))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(1)

    const occurredAt = new Date(event.occurredAt)
    if (Number.isNaN(occurredAt.getTime())) {
      throw new Error('Authorization audit event has an invalid timestamp')
    }
    const hashTimestamp = occurredAt.toISOString()
    const action = `authorization.${event.decision.toLowerCase()}`
    const afterJson = details
    const previousHash = latest?.hash ?? null
    const hash = computeCanonicalHash(
      buildCanonicalPayload({
        action,
        actorClerkUserId: safeActorId(event),
        actorRole: null,
        afterJson,
        hashTimestamp,
        orgId: organizationId,
        targetId: null,
        targetType: 'platform_authorization',
      }),
      previousHash,
    )
    const [row] = await transaction
      .insert(auditEvents)
      .values({
        orgId: organizationId,
        actorClerkUserId: safeActorId(event),
        actorRole: null,
        action,
        targetType: 'platform_authorization',
        targetId: null,
        afterJson,
        hash,
        previousHash,
        occurredAt,
        hashVersion: 'canonical-v1',
        createdAt: sql<Date>`clock_timestamp()`,
      })
      .returning({ id: auditEvents.id })
    if (!row?.id) throw new Error('Authorization audit persistence returned no row')
  })
}

export async function writeSourceDisclosureDecisionAudit(
  event: SourceDisclosureDecisionAuditEvent,
): Promise<void> {
  const requiredValues = [
    event.decisionId,
    event.reason,
    event.actorId,
    event.identityBindingId,
    event.membershipId,
    event.organizationId,
    event.applicationId,
    event.surface,
    event.action,
    event.purpose,
    event.sourceSystem,
    event.factClass,
    event.correlationId,
  ]
  if (requiredValues.some((value) => !value.trim()) || !isUuid(event.organizationId)) {
    throw new Error('Source-disclosure audit requires a valid canonical organization context')
  }
  const occurredAt = new Date(event.occurredAt)
  if (Number.isNaN(occurredAt.getTime())) {
    throw new Error('Source-disclosure audit event has an invalid timestamp')
  }

  const afterJson = {
    decisionId: event.decisionId,
    decision: event.decision,
    reason: event.reason,
    actorId: event.actorId,
    identityBindingId: event.identityBindingId,
    membershipId: event.membershipId,
    applicationId: event.applicationId,
    surface: event.surface,
    action: event.action,
    purpose: event.purpose,
    sourceSystem: event.sourceSystem,
    ...(event.sourceDomain ? { sourceDomain: event.sourceDomain } : {}),
    ...(event.sourceEntity ? { sourceEntity: event.sourceEntity } : {}),
    ...(event.sourceOrganizationId
      ? { sourceOrganizationId: event.sourceOrganizationId }
      : {}),
    factClass: event.factClass,
    ...(event.policyId ? { policyId: event.policyId } : {}),
    ...(event.policyVersion ? { policyVersion: event.policyVersion } : {}),
    correlationId: event.correlationId,
  }
  const organizationId = event.organizationId
  await db.transaction(async (transaction) => {
    await transaction.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`audit_events:${organizationId}`}))`,
    )
    const [latest] = await transaction
      .select({ hash: auditEvents.hash })
      .from(auditEvents)
      .where(eq(auditEvents.orgId, organizationId))
      .orderBy(desc(auditEvents.createdAt), desc(auditEvents.id))
      .limit(1)
    const previousHash = latest?.hash ?? null
    const hashTimestamp = occurredAt.toISOString()
    const action = `source_disclosure.${event.decision.toLowerCase()}`
    const hash = computeCanonicalHash(
      buildCanonicalPayload({
        action,
        actorClerkUserId: event.actorId,
        actorRole: null,
        afterJson,
        hashTimestamp,
        orgId: organizationId,
        targetId: null,
        targetType: 'platform_source_disclosure',
      }),
      previousHash,
    )
    const [row] = await transaction
      .insert(auditEvents)
      .values({
        orgId: organizationId,
        actorClerkUserId: event.actorId,
        actorRole: null,
        action,
        targetType: 'platform_source_disclosure',
        targetId: null,
        afterJson,
        hash,
        previousHash,
        occurredAt,
        hashVersion: 'canonical-v1',
        createdAt: sql<Date>`clock_timestamp()`,
      })
      .returning({ id: auditEvents.id })
    if (!row?.id) throw new Error('Source-disclosure audit persistence returned no row')
  })
}
