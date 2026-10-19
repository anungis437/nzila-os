/**
 * Member employment queries.
 *
 * These functions are not Server Actions. Callers pass an organization scope
 * that the action layer has already authorized. SQL is bound to that
 * organization through `withRLSContext({ organizationId })`. A missing row is
 * a failure for mutations. Hard deletion is refused: employment history has
 * no retention-safe archive in this schema.
 *
 * This module does not prove that a deployed database enforces row-level security.
 */

import 'server-only'

import {
  memberEmployment,
  employmentHistory,
  memberLeaves,
  jobClassifications,
  type MemberEmployment,
  type NewMemberEmployment,
  type EmploymentHistory,
  type NewEmploymentHistory,
  type MemberLeave,
  type NewMemberLeave,
  type JobClassification,
  type NewJobClassification,
} from '@/db/schema/domains/member/member-employment'
import { organizationMembers } from '@/db/schema-organizations'
import { employers, worksites, bargainingUnits } from '@/db/schema/union-structure-schema'
import { and, asc, desc, eq, gte, isNull, lte, or } from 'drizzle-orm'
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context'
import { logger } from '@/lib/logger'
import {
  assertRegisteredEmploymentGrant,
  EmploymentBoundaryError,
  leaveApprovalAttempted,
  leaveSelfApprovalDenied,
  leaveSubjectIdentityUnresolved,
  type EmploymentAccessGrant,
} from '@/lib/member-employment/authorize-employment-access'
import {
  compensationWriteAttempted,
  projectEmploymentHistory,
  projectMemberEmployment,
  snapshotContainsCompensation,
} from '@/lib/member-employment/compensation-disclosure'
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

function releaseEmployment<T>(scope: EmploymentActorScope, row: T): T {
  return projectMemberEmployment(row, scope.discloseCompensation)
}

function releaseHistory<T extends { previousValues?: unknown; newValues?: unknown }>(
  scope: EmploymentActorScope,
  row: T,
): T {
  return projectEmploymentHistory(row, scope.discloseCompensation)
}

function assertCompensationWrite(scope: EmploymentActorScope, data: object): void {
  if (!scope.discloseCompensation && compensationWriteAttempted(data)) {
    throw new EmploymentBoundaryError('Forbidden')
  }
}

function assertHistoryDisclosure(scope: EmploymentActorScope, data: { previousValues?: unknown; newValues?: unknown }): void {
  if (scope.discloseCompensation) return
  if (snapshotContainsCompensation(data.previousValues) || snapshotContainsCompensation(data.newValues)) {
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

async function loadMember(
  tx: RLSTx,
  organizationId: string,
  memberId: string,
): Promise<{ id: string; userId: string } | null> {
  const [member] = await tx
    .select({ id: organizationMembers.id, userId: organizationMembers.userId })
    .from(organizationMembers)
    .where(and(
      eq(organizationMembers.id, memberId),
      eq(organizationMembers.organizationId, organizationId),
      eq(organizationMembers.status, 'active'),
      isNull(organizationMembers.deletedAt),
    ))
    .limit(1)
  return member ?? null
}

async function requireMember(
  tx: RLSTx,
  organizationId: string,
  memberId: string,
): Promise<{ id: string; userId: string }> {
  const member = await loadMember(tx, organizationId, memberId)
  if (!member) throw new EmploymentBoundaryError('Forbidden')
  return member
}

async function assertEmployer(tx: RLSTx, id: string | null | undefined, organizationId: string): Promise<void> {
  if (!id) return
  const [row] = await tx
    .select({ id: employers.id })
    .from(employers)
    .where(and(eq(employers.id, id), eq(employers.organizationId, organizationId)))
    .limit(1)
  if (!row) throw new EmploymentBoundaryError('Forbidden')
}

async function assertWorksite(tx: RLSTx, id: string | null | undefined, organizationId: string): Promise<void> {
  if (!id) return
  const [row] = await tx
    .select({ id: worksites.id })
    .from(worksites)
    .where(and(eq(worksites.id, id), eq(worksites.organizationId, organizationId)))
    .limit(1)
  if (!row) throw new EmploymentBoundaryError('Forbidden')
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

async function assertEmploymentRefs(
  tx: RLSTx,
  organizationId: string,
  data: {
    employerId?: string | null
    worksiteId?: string | null
    bargainingUnitId?: string | null
    jobCode?: string | null
    supervisorId?: string | null
  },
): Promise<void> {
  await assertEmployer(tx, data.employerId, organizationId)
  await assertWorksite(tx, data.worksiteId, organizationId)
  await assertBargainingUnit(tx, data.bargainingUnitId, organizationId)
  if (data.supervisorId) await requireMember(tx, organizationId, data.supervisorId)
  if (data.jobCode) {
    const [classification] = await tx
      .select({ id: jobClassifications.id })
      .from(jobClassifications)
      .where(and(
        eq(jobClassifications.organizationId, organizationId),
        eq(jobClassifications.jobCode, data.jobCode),
        eq(jobClassifications.isActive, true),
      ))
      .limit(1)
    if (!classification) throw new EmploymentBoundaryError('Forbidden')
  }
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

export async function createMemberEmployment(
  scope: EmploymentActorScope,
  data: NewMemberEmployment,
  tx?: RLSTx,
): Promise<MemberEmployment> {
  rejectOrgMove(scope, data.organizationId)
  assertCompensationWrite(scope, data)
  return inScope(scope, tx, async (db) => {
    await requireMember(db, scope.organizationId, data.memberId)
    await assertEmploymentRefs(db, scope.organizationId, data)
    const [employment] = await db.insert(memberEmployment).values({
      ...data,
      organizationId: scope.organizationId,
      createdBy: scope.userId,
      updatedBy: scope.userId,
    }).returning()
    if (!employment) throw new EmploymentBoundaryError('Employment record not found')
    await auditSuccess(db, scope, 'create', employment.id)
    return releaseEmployment(scope, employment)
  })
}

export async function getMemberEmploymentById(
  scope: EmploymentActorScope,
  id: string,
  tx?: RLSTx,
): Promise<MemberEmployment | null> {
  return inScope(scope, tx, async (db) => {
    const [employment] = await db
      .select()
      .from(memberEmployment)
      .where(and(eq(memberEmployment.id, id), eq(memberEmployment.organizationId, scope.organizationId)))
      .limit(1)
    return employment ? releaseEmployment(scope, employment) : null
  })
}

export async function getActiveMemberEmployment(
  scope: EmploymentActorScope,
  memberId: string,
  tx?: RLSTx,
): Promise<MemberEmployment | null> {
  return inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) return null
    const [employment] = await db
      .select()
      .from(memberEmployment)
      .where(and(
        eq(memberEmployment.memberId, memberId),
        eq(memberEmployment.organizationId, scope.organizationId),
        eq(memberEmployment.employmentStatus, 'active'),
      ))
      .orderBy(desc(memberEmployment.hireDate))
      .limit(1)
    return employment ? releaseEmployment(scope, employment) : null
  })
}

export async function getAllMemberEmployment(
  scope: EmploymentActorScope,
  memberId: string,
  tx?: RLSTx,
): Promise<MemberEmployment[]> {
  return inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) return []
    return db
      .select()
      .from(memberEmployment)
      .where(and(
        eq(memberEmployment.memberId, memberId),
        eq(memberEmployment.organizationId, scope.organizationId),
      ))
      .orderBy(desc(memberEmployment.hireDate))
      .then((rows) => rows.map((row) => releaseEmployment(scope, row)))
  })
}

export async function getEmploymentByOrganization(
  scope: EmploymentActorScope,
  status?: string,
  tx?: RLSTx,
): Promise<MemberEmployment[]> {
  return inScope(scope, tx, async (db) => {
    const conditions = [eq(memberEmployment.organizationId, scope.organizationId)]
    if (status) {
      conditions.push(eq(memberEmployment.employmentStatus, status as MemberEmployment['employmentStatus']))
    }
    return db
      .select()
      .from(memberEmployment)
      .where(and(...conditions))
      .orderBy(asc(memberEmployment.jobTitle))
      .then((rows) => rows.map((row) => releaseEmployment(scope, row)))
  })
}

export async function updateMemberEmployment(
  scope: EmploymentActorScope,
  id: string,
  data: Partial<NewMemberEmployment>,
  tx?: RLSTx,
): Promise<MemberEmployment> {
  rejectOrgMove(scope, data.organizationId)
  assertCompensationWrite(scope, data)
  return inScope(scope, tx, async (db) => {
    const [existing] = await db
      .select()
      .from(memberEmployment)
      .where(and(eq(memberEmployment.id, id), eq(memberEmployment.organizationId, scope.organizationId)))
      .limit(1)
    if (!existing) throw new EmploymentBoundaryError('Employment record not found')
    if (data.memberId && data.memberId !== existing.memberId) {
      throw new EmploymentBoundaryError('Forbidden')
    }
    await assertEmploymentRefs(db, scope.organizationId, data)
    const patch: Partial<NewMemberEmployment> = { ...data, updatedAt: new Date(), updatedBy: scope.userId }
    delete patch.organizationId
    delete patch.memberId
    delete patch.id
    delete patch.createdBy
    const [employment] = await db
      .update(memberEmployment)
      .set(patch)
      .where(and(eq(memberEmployment.id, id), eq(memberEmployment.organizationId, scope.organizationId)))
      .returning()
    if (!employment) throw new EmploymentBoundaryError('Employment record not found')
    await auditSuccess(db, scope, 'update', employment.id)
    return releaseEmployment(scope, employment)
  })
}

export async function deleteMemberEmployment(
  scope: EmploymentActorScope,
  _id: string,
): Promise<void> {
  assertScope(scope)
  throw new EmploymentBoundaryError(
    'Employment records are retained. Update employment status instead.',
  )
}

export async function getEmploymentForDuesCalculation(
  scope: EmploymentActorScope,
  memberId: string,
  tx?: RLSTx,
): Promise<{
  grossWages?: number
  baseSalary?: number
  hourlyRate?: number
  hoursWorked?: number
  employmentStatus: string
  payFrequency: string
} | null> {
  if (!scope.discloseCompensation) throw new EmploymentBoundaryError('Forbidden')
  return inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) return null
    const [employment] = await db
      .select()
      .from(memberEmployment)
      .where(and(
        eq(memberEmployment.memberId, memberId),
        eq(memberEmployment.organizationId, scope.organizationId),
        eq(memberEmployment.employmentStatus, 'active'),
      ))
      .orderBy(desc(memberEmployment.hireDate))
      .limit(1)
    if (!employment) return null
    await auditSuccess(db, scope, 'compensation_read', employment.id)
    return {
      grossWages: employment.grossWages ? parseFloat(employment.grossWages.toString()) : undefined,
      baseSalary: employment.baseSalary ? parseFloat(employment.baseSalary.toString()) : undefined,
      hourlyRate: employment.hourlyRate ? parseFloat(employment.hourlyRate.toString()) : undefined,
      hoursWorked: employment.regularHoursPerPeriod
        ? parseFloat(employment.regularHoursPerPeriod.toString())
        : undefined,
      employmentStatus: employment.employmentStatus,
      payFrequency: employment.payFrequency,
    }
  })
}

export async function createEmploymentHistory(
  scope: EmploymentActorScope,
  data: NewEmploymentHistory,
  tx?: RLSTx,
): Promise<EmploymentHistory> {
  rejectOrgMove(scope, data.organizationId)
  assertHistoryDisclosure(scope, data)
  return inScope(scope, tx, async (db) => {
    await requireMember(db, scope.organizationId, data.memberId)
    if (data.memberEmploymentId) {
      const [employment] = await db
        .select({ id: memberEmployment.id, memberId: memberEmployment.memberId })
        .from(memberEmployment)
        .where(and(
          eq(memberEmployment.id, data.memberEmploymentId),
          eq(memberEmployment.organizationId, scope.organizationId),
          eq(memberEmployment.memberId, data.memberId),
        ))
        .limit(1)
      if (!employment) throw new EmploymentBoundaryError('Forbidden')
    }
    const [history] = await db.insert(employmentHistory).values({
      ...data,
      organizationId: scope.organizationId,
      createdBy: scope.userId,
    }).returning()
    if (!history) throw new EmploymentBoundaryError('Employment record not found')
    await auditSuccess(db, scope, 'history', history.id)
    return releaseHistory(scope, history)
  })
}

export async function getEmploymentHistoryByMember(
  scope: EmploymentActorScope,
  memberId: string,
  tx?: RLSTx,
): Promise<EmploymentHistory[]> {
  return inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) return []
    return db
      .select()
      .from(employmentHistory)
      .where(and(
        eq(employmentHistory.memberId, memberId),
        eq(employmentHistory.organizationId, scope.organizationId),
      ))
      .orderBy(desc(employmentHistory.effectiveDate))
      .then((rows) => rows.map((row) => releaseHistory(scope, row)))
  })
}

function assertLeaveWrite(data: Partial<NewMemberLeave>): void {
  if (leaveApprovalAttempted(data)) {
    throw new EmploymentBoundaryError('Approval fields are assigned by the approval action')
  }
  if (data.duesWaiverApproved === true) {
    throw new EmploymentBoundaryError('Forbidden')
  }
}

export async function createMemberLeave(
  scope: EmploymentActorScope,
  data: NewMemberLeave,
  tx?: RLSTx,
): Promise<MemberLeave> {
  rejectOrgMove(scope, data.organizationId)
  assertLeaveWrite(data)
  return inScope(scope, tx, async (db) => {
    await requireMember(db, scope.organizationId, data.memberId)
    if (data.memberEmploymentId) {
      const [employment] = await db
        .select({ id: memberEmployment.id })
        .from(memberEmployment)
        .where(and(
          eq(memberEmployment.id, data.memberEmploymentId),
          eq(memberEmployment.organizationId, scope.organizationId),
          eq(memberEmployment.memberId, data.memberId),
        ))
        .limit(1)
      if (!employment) throw new EmploymentBoundaryError('Forbidden')
    }
    const [leave] = await db.insert(memberLeaves).values({
      ...data,
      organizationId: scope.organizationId,
      isApproved: false,
      approvedBy: null,
      approvedAt: null,
      duesWaiverApproved: false,
      createdBy: scope.userId,
    }).returning()
    if (!leave) throw new EmploymentBoundaryError('Leave record not found')
    await auditSuccess(db, scope, 'leave_create', leave.id)
    return leave
  })
}

export async function getActiveMemberLeaves(
  scope: EmploymentActorScope,
  memberId: string,
  currentDate?: Date,
  tx?: RLSTx,
): Promise<MemberLeave[]> {
  return inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) return []
    const now = currentDate || new Date()
    const nowStr = now.toISOString().split('T')[0]
    return db
      .select()
      .from(memberLeaves)
      .where(and(
        eq(memberLeaves.memberId, memberId),
        eq(memberLeaves.organizationId, scope.organizationId),
        lte(memberLeaves.startDate, nowStr),
        or(isNull(memberLeaves.endDate), gte(memberLeaves.endDate, nowStr)),
      ))
      .orderBy(desc(memberLeaves.startDate))
  })
}

export async function getAllMemberLeaves(
  scope: EmploymentActorScope,
  memberId: string,
  tx?: RLSTx,
): Promise<MemberLeave[]> {
  return inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) return []
    return db
      .select()
      .from(memberLeaves)
      .where(and(
        eq(memberLeaves.memberId, memberId),
        eq(memberLeaves.organizationId, scope.organizationId),
      ))
      .orderBy(desc(memberLeaves.startDate))
  })
}

export async function updateMemberLeave(
  scope: EmploymentActorScope,
  id: string,
  data: Partial<NewMemberLeave>,
  tx?: RLSTx,
): Promise<MemberLeave> {
  rejectOrgMove(scope, data.organizationId)
  assertLeaveWrite(data)
  return inScope(scope, tx, async (db) => {
    const [existing] = await db
      .select()
      .from(memberLeaves)
      .where(and(eq(memberLeaves.id, id), eq(memberLeaves.organizationId, scope.organizationId)))
      .limit(1)
    if (!existing) throw new EmploymentBoundaryError('Leave record not found')
    if (data.memberId && data.memberId !== existing.memberId) {
      throw new EmploymentBoundaryError('Forbidden')
    }
    if (data.memberEmploymentId) {
      const [employment] = await db
        .select({ id: memberEmployment.id })
        .from(memberEmployment)
        .where(and(
          eq(memberEmployment.id, data.memberEmploymentId),
          eq(memberEmployment.organizationId, scope.organizationId),
          eq(memberEmployment.memberId, existing.memberId),
        ))
        .limit(1)
      if (!employment) throw new EmploymentBoundaryError('Forbidden')
    }
    const patch: Partial<NewMemberLeave> = {
      ...data,
      updatedAt: new Date(),
      isApproved: existing.isApproved,
      approvedBy: existing.approvedBy,
      approvedAt: existing.approvedAt,
      duesWaiverApproved: existing.duesWaiverApproved,
    }
    delete patch.organizationId
    delete patch.memberId
    delete patch.id
    delete patch.createdBy
    const [leave] = await db
      .update(memberLeaves)
      .set(patch)
      .where(and(eq(memberLeaves.id, id), eq(memberLeaves.organizationId, scope.organizationId)))
      .returning()
    if (!leave) throw new EmploymentBoundaryError('Leave record not found')
    await auditSuccess(db, scope, 'leave_update', leave.id)
    return leave
  })
}

export async function approveMemberLeave(
  scope: EmploymentActorScope,
  id: string,
  tx?: RLSTx,
): Promise<MemberLeave> {
  return inScope(scope, tx, async (db) => {
    const [existing] = await db
      .select()
      .from(memberLeaves)
      .where(and(eq(memberLeaves.id, id), eq(memberLeaves.organizationId, scope.organizationId)))
      .limit(1)
    if (!existing) throw new EmploymentBoundaryError('Leave record not found')
    const member = await requireMember(db, scope.organizationId, existing.memberId)
    if (leaveSubjectIdentityUnresolved(member.userId)) {
      throw new EmploymentBoundaryError('Leave approval requires a resolved subject identity')
    }
    if (leaveSelfApprovalDenied(scope.userId, member.userId)) {
      throw new EmploymentBoundaryError('Leave approval requires a different member')
    }
    const [leave] = await db
      .update(memberLeaves)
      .set({
        isApproved: true,
        approvedBy: scope.userId,
        approvedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(and(
        eq(memberLeaves.id, id),
        eq(memberLeaves.organizationId, scope.organizationId),
        or(eq(memberLeaves.isApproved, false), isNull(memberLeaves.isApproved)),
      ))
      .returning()
    if (!leave) throw new EmploymentBoundaryError('Leave approval was not applied')
    await auditSuccess(db, scope, 'leave_approve', leave.id)
    return leave
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
export async function getJobClassificationByCode(
  scope: EmploymentActorScope,
  jobCode: string,
  tx?: RLSTx,
): Promise<JobClassification | null> {
  return inScope(scope, tx, async (db) => {
    const [classification] = await db
      .select()
      .from(jobClassifications)
      .where(and(
        eq(jobClassifications.organizationId, scope.organizationId),
        eq(jobClassifications.jobCode, jobCode),
        eq(jobClassifications.isActive, true),
      ))
      .limit(1)
    return classification ?? null
  })
}

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

export async function calculateSeniorityYears(
  scope: EmploymentActorScope,
  seniorityDate: Date,
  currentDate?: Date,
  memberId?: string,
  tx?: RLSTx,
): Promise<number> {
  const now = currentDate || new Date()
  let totalDays = Math.floor((now.getTime() - seniorityDate.getTime()) / (1000 * 60 * 60 * 24))
  if (!memberId) {
    assertScope(scope)
    return Math.max(0, totalDays / 365.25)
  }
  const leaves = await inScope(scope, tx, async (db) => {
    const member = await loadMember(db, scope.organizationId, memberId)
    if (!member) throw new EmploymentBoundaryError('Forbidden')
    return db
      .select()
      .from(memberLeaves)
      .where(and(
        eq(memberLeaves.memberId, memberId),
        eq(memberLeaves.organizationId, scope.organizationId),
      ))
  })
  const adjustmentDays = leaves
    .filter((leave) => leave.affectsSeniority && leave.seniorityAdjustmentDays)
    .reduce((sum, leave) => sum + (leave.seniorityAdjustmentDays || 0), 0)
  totalDays -= adjustmentDays
  return Math.max(0, totalDays / 365.25)
}
