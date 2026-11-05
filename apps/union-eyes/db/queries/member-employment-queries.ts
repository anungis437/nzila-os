/**
 * Job classification queries.
 *
 * These functions are not Server Actions. Callers pass an organization scope
 * that the action layer has already authorized. SQL is bound to that
 * organization through `withRLSContext({ organizationId })`. A missing row is
 * a failure for mutations.
 *
 * The member employment, employment history and leave queries lived here
 * until the screens that called them were found to be mounted nowhere; they
 * were deleted with those screens. The job classification admin screen is
 * mounted in the members console, so its three queries remain.
 *
 * This module does not prove that a deployed database enforces row-level security.
 */

import 'server-only'

import {
  jobClassifications,
  type JobClassification,
  type NewJobClassification,
} from '@/db/schema/domains/member/member-employment'
import { bargainingUnits } from '@/db/schema/union-structure-schema'
import { and, asc, eq } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'
import {
  assertRegisteredEmploymentGrant,
  EmploymentBoundaryError,
  type EmploymentAccessGrant,
} from '@/lib/member-employment/authorize-employment-access'
import { persistDurableEmploymentAudit } from '@/lib/member-employment/durable-employment-audit'

export { EmploymentBoundaryError }

export type EmploymentActorScope = EmploymentAccessGrant

function assertScope(scope: EmploymentActorScope): void {
  assertRegisteredEmploymentGrant(scope)
  if (typeof scope.organizationId !== 'string' || scope.organizationId.trim() === '') {
    throw new EmploymentBoundaryError('Organization context required')
  }
  if (typeof scope.userId !== 'string' || scope.userId.trim() === '') {
    throw new EmploymentBoundaryError('Forbidden')
  }
}

function withEmploymentOrganization<T>(
  organizationId: string,
  operation: (tx: RLSTx) => Promise<T>,
): Promise<T> {
  return withRLSContext({ organizationId }, operation)
}

async function inScope<T>(
  scope: EmploymentActorScope,
  tx: RLSTx | undefined,
  operation: (db: RLSTx) => Promise<T>,
): Promise<T> {
  assertScope(scope)
  try {
    if (tx) return await operation(tx)
    return await withEmploymentOrganization(scope.organizationId, operation)
  } catch (error) {
    if (error instanceof EmploymentBoundaryError) throw error
    logger.error('member employment query failed', new Error('member_employment_query'), {
      organizationId: scope.organizationId,
    })
    throw new Error('Failed to access member employment')
  }
}

async function assertBargainingUnit(tx: RLSTx, id: string | null | undefined, organizationId: string): Promise<void> {
  if (!id) return
  const [row] = await tx
    .select({ id: bargainingUnits.id })
    .from(bargainingUnits)
    .where(and(eq(bargainingUnits.id, id), eq(bargainingUnits.organizationId, organizationId)))
    .limit(1)
  if (!row) throw new EmploymentBoundaryError('Forbidden')
}

function rejectOrgMove(scope: EmploymentActorScope, organizationId: string | null | undefined): void {
  if (organizationId && organizationId !== scope.organizationId) {
    throw new EmploymentBoundaryError('Forbidden')
  }
}

async function auditSuccess(
  tx: RLSTx,
  scope: EmploymentActorScope,
  operation: Parameters<typeof persistDurableEmploymentAudit>[1]['operation'],
  targetId: string | null,
): Promise<void> {
  await persistDurableEmploymentAudit(tx, {
    actorUserId: scope.userId,
    organizationId: scope.organizationId,
    operation,
    outcome: 'success',
    targetId,
  })
}

export async function createJobClassification(
  scope: EmploymentActorScope,
  data: NewJobClassification,
  tx?: RLSTx,
): Promise<JobClassification> {
  rejectOrgMove(scope, data.organizationId)
  return inScope(scope, tx, async (db) => {
    await assertBargainingUnit(db, data.bargainingUnitId, scope.organizationId)
    const [classification] = await db.insert(jobClassifications).values({
      ...data,
      organizationId: scope.organizationId,
      createdBy: scope.userId,
    }).returning()
    if (!classification) throw new EmploymentBoundaryError('Job classification not found')
    await auditSuccess(db, scope, 'classification_create', classification.id)
    return classification
  })
}

/**
 * Classification minimum, maximum, and standard rates are negotiated bands
 * for a job code. They are not a member's individual compensation, so this
 * read stays on the employment-administration grant.
 */
export async function getJobClassificationsByOrganization(
  scope: EmploymentActorScope,
  activeOnly: boolean = true,
  tx?: RLSTx,
): Promise<JobClassification[]> {
  return inScope(scope, tx, async (db) => {
    const conditions = [eq(jobClassifications.organizationId, scope.organizationId)]
    if (activeOnly) conditions.push(eq(jobClassifications.isActive, true))
    return db
      .select()
      .from(jobClassifications)
      .where(and(...conditions))
      .orderBy(asc(jobClassifications.jobCode))
  })
}

export async function updateJobClassification(
  scope: EmploymentActorScope,
  id: string,
  data: Partial<NewJobClassification>,
  tx?: RLSTx,
): Promise<JobClassification> {
  rejectOrgMove(scope, data.organizationId)
  return inScope(scope, tx, async (db) => {
    const [existing] = await db
      .select()
      .from(jobClassifications)
      .where(and(
        eq(jobClassifications.id, id),
        eq(jobClassifications.organizationId, scope.organizationId),
      ))
      .limit(1)
    if (!existing) throw new EmploymentBoundaryError('Job classification not found')
    await assertBargainingUnit(db, data.bargainingUnitId, scope.organizationId)
    const patch: Partial<NewJobClassification> = { ...data, updatedAt: new Date() }
    delete patch.organizationId
    delete patch.id
    delete patch.createdBy
    const [classification] = await db
      .update(jobClassifications)
      .set(patch)
      .where(and(
        eq(jobClassifications.id, id),
        eq(jobClassifications.organizationId, scope.organizationId),
      ))
      .returning()
    if (!classification) throw new EmploymentBoundaryError('Job classification not found')
    await auditSuccess(db, scope, 'classification_update', classification.id)
    return classification
  })
}
