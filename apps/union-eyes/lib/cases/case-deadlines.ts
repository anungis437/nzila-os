import { createHash, randomUUID } from 'node:crypto'
import { sql } from 'drizzle-orm'
import { ApiError } from '@/lib/api/errors'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { findReadableCase, requireCaseFilingCapacity, type CaseActor } from './case-authorization'
import { decideCase } from '@/lib/authority/store/route-adapter'
import { isUuid } from '@/lib/authority/store/executor'
import { calendarDayInZone, endOfDayInZone } from '@/lib/deadline-engine/deadline-day'
import { loadOrganizationTimeZone } from '@/lib/deadline-engine/organization-time-zone'
import { writeDeadlineAuditEvent } from '@/lib/deadline-engine/audit'
import { scheduleGrievanceDeadlineReminders } from '@/lib/deadline-engine/reminder-scheduler'
import { MEMBER_VISIBLE_DEADLINE_TYPE } from './case-deadline-contract'
import type { CreateCaseDeadlineInput, ChangeCaseDeadlineInput, CaseDeadlineWire } from './case-deadline-contract'
import { isTerminalDeadlineStatus } from '@/lib/deadline-engine/deadline-semantics'


type Source = 'claim_deadlines' | 'grievance_deadlines'
type Target = { id: string; source: Source; canManage: boolean; memberVisible: boolean }
type Row = { id: string; title: string; due_at: Date | string; status: string; version: string }

const rows = async <T>(tx: RLSTx, query: ReturnType<typeof sql>) => await tx.execute(query) as unknown as T[]

/** Publishing a dated case action requires handler eligibility, explicit draft-action authority and member-disclosure authority.
 * A role, case read, note-writing permission or platform administration cannot substitute for either. */
async function targetFor(tx: RLSTx, actor: CaseActor, reference: string, write: boolean): Promise<Target> {
  const claim = await findReadableCase(tx, actor, reference, write)
  let id = claim?.claimId
  let memberVisible = claim?.visibility === 'member_visible'
  const source: Source = claim ? 'claim_deadlines' : 'grievance_deadlines'
  if (!claim) {
    if (!isUuid(reference)) throw ApiError.notFound('Case')
    const found = await rows<{ id: string }>(tx, sql`SELECT id::text FROM grievances
      WHERE id=${reference}::uuid AND organization_id=${actor.organizationId}::uuid ${write ? sql`FOR UPDATE` : sql``}`)
    if (!found[0]) throw ApiError.notFound('Case')
    const read = await decideCase(tx, { ...actor, caseId: reference, action: 'case:read' })
    if (read.effect !== 'allow') throw ApiError.notFound('Case')
    memberVisible = read.scope?.visibility === 'member_visible'
    id = found[0].id
  }
  const caseId = id!
  let handler = true
  try { await requireCaseFilingCapacity(tx, actor, 'handler') } catch (error) { if (error instanceof ApiError) handler = false; else throw error }
  const canManage = handler &&
    (await decideCase(tx, { ...actor, caseId, action: 'case:read_internal' })).effect === 'allow' &&
    (await decideCase(tx, { ...actor, caseId, action: 'case:draft_action' })).effect === 'allow' &&
    (await decideCase(tx, { ...actor, caseId, action: 'case:disclose_to_member' })).effect === 'allow'
  if (write && !canManage) throw ApiError.forbidden('Case deadline management authority required')
  return { id: caseId, source, canManage, memberVisible }
}

// Identifiers come exclusively from the two source-owned models above, never from request data.
const tableFor = (target: Target) => sql.raw(target.source)
const parentFor = (target: Target) => sql.raw(target.source === 'claim_deadlines' ? 'claim_id' : 'grievance_id')
const titleFor = (target: Target) => sql.raw(target.source === 'claim_deadlines' ? 'deadline_name' : 'coalesce(description, deadline_type)')
const scopeFor = (target: Target, actor: CaseActor) => target.source === 'claim_deadlines'
  ? sql`claim_id=${target.id}::uuid AND organization_id=${actor.organizationId}::uuid`
  : sql`grievance_id=${target.id}::uuid AND grievance_id IN (SELECT id FROM grievances WHERE organization_id=${actor.organizationId}::uuid)`
const selectFor = (target: Target) => sql`SELECT id::text, ${titleFor(target)} AS title, due_date AS due_at, status, updated_at::text AS version FROM ${tableFor(target)}`
function wire(row: Row, zone: string): CaseDeadlineWire {
  const due = new Date(row.due_at)
  return { id: row.id, title: row.title, dueAt: due.toISOString(), dueDay: calendarDayInZone(due, zone),
    status: ['completed', 'met'].includes(row.status) ? 'completed' : ['cancelled', 'waived', 'superseded'].includes(row.status) ? 'cancelled' : 'pending', version: row.version }
}

export async function listCaseDeadlines(tx: RLSTx, actor: CaseActor, reference: string) {
  const target = await targetFor(tx, actor, reference, false)
  const { timeZone } = await loadOrganizationTimeZone(actor.organizationId)
  const found = await rows<Row>(tx, sql`${selectFor(target)} WHERE ${scopeFor(target, actor)} ${target.memberVisible ? sql`AND deadline_type=${MEMBER_VISIBLE_DEADLINE_TYPE}` : sql``} ORDER BY due_date,id LIMIT 201`)
  return { caseId: target.id, canManage: target.canManage, timeZone, remindersAvailable: target.source === 'grievance_deadlines',
    truncated: found.length > 200, deadlines: found.slice(0, 200).map(row => wire(row, timeZone)) }
}

async function audit(tx: RLSTx, actor: CaseActor, target: Target, id: string, event: 'deadline.created' | 'deadline.rescheduled' | 'deadline.completed' | 'deadline.cancelled', metadata: Record<string, string | number | boolean | null>) {
  await writeDeadlineAuditEvent({ organizationId: actor.organizationId, sourceTable: target.source, sourceDeadlineId: id,
    eventType: event, actorType: 'user', actorId: actor.userId, correlationId: randomUUID(), metadata: { case_id: target.id, ...metadata } }, tx)
}

/** Pending AND claimed reminders are retired atomically with a changed source. The worker revalidates before dispatch. */
async function cancelReminders(tx: RLSTx, actor: CaseActor, target: Target, id: string, reason: string) {
  await tx.execute(sql`UPDATE deadline_reminders SET status='cancelled', cancelled_reason=${reason}, lease_owner=NULL, lease_expires_at=NULL
    WHERE organization_id=${actor.organizationId}::uuid AND source_table=${target.source} AND source_deadline_id=${id}::uuid AND status IN ('pending','claimed')`)
}
async function schedule(target: Target, actor: CaseActor, id: string, due: Date) {
  if (target.source === 'grievance_deadlines') await scheduleGrievanceDeadlineReminders({
    sourceDeadlineId: id, grievanceId: target.id, dueDate: due, reminderOffsetsInDays: [7, 3, 1], actor: { type: 'user', id: actor.userId },
  })
}

/** Parent lock serializes create/change with case assignment and prevents an authority check racing a case write. */
export async function createCaseDeadline(tx: RLSTx, actor: CaseActor, reference: string, input: CreateCaseDeadlineInput) {
  const target = await targetFor(tx, actor, reference, true)
  const { timeZone } = await loadOrganizationTimeZone(actor.organizationId)
  const due = endOfDayInZone(input.dueDay, timeZone)
  const existing = await rows<Row>(tx, sql`${selectFor(target)} WHERE ${scopeFor(target, actor)} AND id=${input.id}::uuid`)
  if (existing[0]) {
    if (existing[0].title !== input.title || new Date(existing[0].due_at).getTime() !== due.getTime()) throw ApiError.conflict('Deadline ID already used')
    return { created: false, deadline: wire(existing[0], timeZone) }
  }
  if (target.source === 'claim_deadlines') await tx.execute(sql`INSERT INTO claim_deadlines
    (id,claim_id,organization_id,deadline_name,deadline_type,event_date,original_deadline,due_date)
    VALUES (${input.id}::uuid,${target.id}::uuid,${actor.organizationId}::uuid,${input.title},${MEMBER_VISIBLE_DEADLINE_TYPE},now(),${due.toISOString()}::timestamptz,${due.toISOString()}::timestamptz)`)
  else await tx.execute(sql`INSERT INTO grievance_deadlines
    (id,grievance_id,deadline_type,description,due_date,confirmation_status,confirmed_at,confirmed_by,reminder_days)
    VALUES (${input.id}::uuid,${target.id}::uuid,${MEMBER_VISIBLE_DEADLINE_TYPE},${input.title},${due.toISOString()}::timestamptz,'HUMAN_CONFIRMED',now(),${actor.userId},ARRAY[7,3,1])`)
  await audit(tx, actor, target, input.id, 'deadline.created', { due_at: due.toISOString(), time_zone: timeZone,
    title_sha256: createHash('sha256').update(input.title).digest('hex'), legal_calculation_claimed: false })
  await schedule(target, actor, input.id, due)
  const [saved] = await rows<Row>(tx, sql`${selectFor(target)} WHERE ${scopeFor(target, actor)} AND id=${input.id}::uuid`)
  return { created: true, deadline: wire(saved, timeZone) }
}

export async function changeCaseDeadline(tx: RLSTx, actor: CaseActor, reference: string, input: ChangeCaseDeadlineInput) {
  const target = await targetFor(tx, actor, reference, true)
  const [before] = await rows<Row>(tx, sql`${selectFor(target)} WHERE ${scopeFor(target, actor)} AND id=${input.id}::uuid FOR UPDATE`)
  if (!before) throw ApiError.notFound('Deadline')
  if (before.version !== input.version) throw ApiError.conflict('Deadline changed; reload before editing')
  if (isTerminalDeadlineStatus(before.status) || ['met', 'waived', 'superseded'].includes(before.status)) throw ApiError.conflict('Completed or cancelled deadlines cannot be changed')
  const { timeZone } = await loadOrganizationTimeZone(actor.organizationId)
  const due = input.action === 'reschedule' ? endOfDayInZone(input.dueDay, timeZone) : new Date(before.due_at)
  const status = input.action === 'complete' ? 'completed' : input.action === 'cancel' ? (target.source === 'claim_deadlines' ? 'waived' : 'cancelled') : 'pending'
  await tx.execute(sql`UPDATE ${tableFor(target)} SET due_date=${due.toISOString()}::timestamptz, status=${status},
    completed_at=${input.action === 'complete' ? sql`now()` : sql`NULL`}, updated_at=clock_timestamp()
    ${target.source === 'claim_deadlines' ? sql`, completed_by=${input.action === 'complete' ? actor.userId : null}` : sql`, override_due_date=CASE WHEN override_due_date IS NULL THEN NULL ELSE ${due.toISOString()}::timestamptz END, confirmation_status='HUMAN_CONFIRMED', confirmed_at=now(), confirmed_by=${actor.userId}`}
    WHERE ${scopeFor(target, actor)} AND id=${input.id}::uuid AND updated_at::text=${input.version}`)
  await cancelReminders(tx, actor, target, input.id, 'deadline_'+input.action)
  const event = input.action === 'reschedule' ? 'deadline.rescheduled' : input.action === 'complete' ? 'deadline.completed' : 'deadline.cancelled'
  await audit(tx, actor, target, input.id, event, { previous_due_at: new Date(before.due_at).toISOString(), due_at: due.toISOString(), previous_status: before.status, status, time_zone: timeZone })
  if (input.action === 'reschedule') await schedule(target, actor, input.id, due)
  const [saved] = await rows<Row>(tx, sql`${selectFor(target)} WHERE ${scopeFor(target, actor)} AND id=${input.id}::uuid`)
  return { deadline: wire(saved, timeZone) }
}
