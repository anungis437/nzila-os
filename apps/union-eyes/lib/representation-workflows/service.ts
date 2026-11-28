/**
 * Representation workflows on a grievance (platform migration 0091, RLS scoped 0064), institution-neutral:
 *
 *   - Group grievances: each participant's own consent (form and evidence) is recorded per member. Every participant must
 *     work in the same portion of the employer administration (an incompatible cohort is refused), a group matter is
 *     not ready to file until it has at least two consenting participants, and one participant's withdrawal leaves the
 *     matter and every other participant (and its own history) intact.
 *   - Filing paths: an employer-initiated filing keeps the employer's own case identifier and the form it arrived in; a
 *     union policy filing routes to the final level and needs the approvals it names, from distinct people holding distinct
 *     executive offices, none of them the requester.
 *   - Final-level handoff: recorded by an executive office holder (the signatory) with the packet and receiving component;
 *     its receipt is acknowledged by someone else.
 *   - Abandonment and beyond-control exceptions are findings on the record. No record here closes or changes a grievance:
 *     closure stays a separate human decision.
 *
 * Authority: the authority kernel decides per grievance (case:read_internal to read, case:transition to record). A grievance
 * the caller cannot read answers 404. Offices are read from the caller's active membership on the server, never from input.
 */
import { sql } from 'drizzle-orm';
import { z } from 'zod';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { decideCase } from '@/lib/authority/store/route-adapter';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { isCalendarDay } from '@/lib/deadline-engine/deadline-day';

/** Membership roles that count as an executive office for approvals and handoff signature. */
export const EXECUTIVE_OFFICES = ['president', 'vice_president', 'secretary_treasurer', 'national_officer'] as const;

export interface RepresentationActor {
  userId: string;
  organizationId: string;
}

async function queryRows<T>(tx: RLSTx, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = (await tx.execute(query)) as unknown;
  if (Array.isArray(result)) return result as T[];
  return ((result as { rows?: T[] })?.rows ?? []) as T[];
}

async function requireGrievance(tx: RLSTx, actor: RepresentationActor, grievanceId: string, action: 'case:read_internal' | 'case:transition') {
  const found = await queryRows<{ id: string; is_group_grievance: boolean | null }>(tx, sql`SELECT id::text, is_group_grievance FROM grievances
    WHERE id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid ${action === 'case:transition' ? sql`FOR UPDATE` : sql``}`);
  if (!found[0]) throw ApiError.notFound('Grievance');
  const read = await decideCase(tx, { userId: actor.userId, organizationId: actor.organizationId, caseId: grievanceId, action: 'case:read' });
  if (read.effect !== 'allow') throw ApiError.notFound('Grievance');
  const decision = await decideCase(tx, { userId: actor.userId, organizationId: actor.organizationId, caseId: grievanceId, action });
  if (decision.effect !== 'allow') throw ApiError.forbidden('This action is not permitted for this grievance.');
  return { isGroup: found[0].is_group_grievance === true };
}

async function officeOf(tx: RLSTx, actor: RepresentationActor): Promise<string | null> {
  const [row] = await queryRows<{ role: string }>(tx, sql`SELECT role FROM organization_members
    WHERE organization_id = ${actor.organizationId}::uuid AND user_id = ${actor.userId} AND status = 'active' AND deleted_at IS NULL LIMIT 1`);
  return row && (EXECUTIVE_OFFICES as readonly string[]).includes(row.role) ? row.role : null;
}

const day = z.string().refine(isCalendarDay, 'must be a calendar day (YYYY-MM-DD)');
const ref = z.string().trim().min(1).max(200);
const text = z.string().trim().min(5).max(2000);

// ---------------------------------------------------------------------------------------------------------------------------
// Group participants

export const ParticipantInputSchema = z
  .object({
    memberUserId: ref,
    employerPortionRef: ref,
    consentForm: z.enum(['written_signature', 'electronic_signature', 'alternate_compliant_form']),
    consentEvidenceRef: ref,
    consentedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const WithdrawalInputSchema = z.object({ reason: text, evidenceRef: ref.nullable() }).strict();

interface ParticipantRow {
  id: string;
  member_user_id: string;
  employer_portion_ref: string;
  consent_form: string;
  consent_evidence_ref: string;
  consented_at: unknown;
  withdrawn_at: unknown;
  withdrawal_reason: string | null;
}

export const MIN_GROUP_PARTICIPANTS = 2;

function readiness(rows: ParticipantRow[]) {
  const active = rows.filter((r) => r.withdrawn_at === null);
  const portions = [...new Set(active.map((r) => r.employer_portion_ref))];
  const reasons: string[] = [];
  if (active.length < MIN_GROUP_PARTICIPANTS) reasons.push('fewer_than_two_consenting_participants');
  if (portions.length > 1) reasons.push('participants_span_more_than_one_employer_portion');
  return { readyToFile: reasons.length === 0, reasons, activeParticipants: active.length, withdrawnParticipants: rows.length - active.length, employerPortion: portions.length === 1 ? portions[0] : null };
}

async function participants(tx: RLSTx, actor: RepresentationActor, grievanceId: string) {
  return queryRows<ParticipantRow>(tx, sql`SELECT id::text, member_user_id, employer_portion_ref, consent_form, consent_evidence_ref, consented_at, withdrawn_at, withdrawal_reason
    FROM grievance_group_participants WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid ORDER BY recorded_at, id`);
}

export async function addGroupParticipant(actor: RepresentationActor, grievanceId: string, input: z.infer<typeof ParticipantInputSchema>) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    const { isGroup } = await requireGrievance(tx, actor, grievanceId, 'case:transition');
    if (!isGroup) throw ApiError.conflict('Participants are recorded only on a group grievance.', { code: 'not_a_group_grievance' });
    const member = await queryRows<{ user_id: string }>(tx, sql`SELECT user_id FROM organization_members
      WHERE organization_id = ${actor.organizationId}::uuid AND user_id = ${input.memberUserId} AND status = 'active' AND deleted_at IS NULL LIMIT 1`);
    if (!member[0]) throw ApiError.conflict('The participant is not an active member of this organization.', { code: 'not_an_active_member' });
    const current = (await participants(tx, actor, grievanceId)).filter((r) => r.withdrawn_at === null);
    if (current.some((r) => r.member_user_id === input.memberUserId)) throw ApiError.conflict('This member already participates.', { code: 'already_participating' });
    const portion = current[0]?.employer_portion_ref;
    if (portion !== undefined && portion !== input.employerPortionRef) {
      await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_group.participant.add', resourceType: 'grievances', resourceId: grievanceId, details: { refused: 'incompatible_cohort' } }, 'failure');
      throw ApiError.conflict('Every participant in a group grievance must work in the same portion of the employer administration.', { code: 'incompatible_cohort', groupPortion: portion });
    }
    const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO grievance_group_participants
      (organization_id, grievance_id, member_user_id, employer_portion_ref, consent_form, consent_evidence_ref, consented_at, recorded_by)
      VALUES (${actor.organizationId}::uuid, ${grievanceId}::uuid, ${input.memberUserId}, ${input.employerPortionRef}, ${input.consentForm},
        ${input.consentEvidenceRef}, ${input.consentedAt}::timestamptz, ${actor.userId}) RETURNING id::text`);
    await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_group.participant.add', resourceType: 'grievances', resourceId: grievanceId, details: { participantId: row.id, consentForm: input.consentForm } });
    return { participantId: row.id, ...readiness(await participants(tx, actor, grievanceId)) };
  });
}

export async function withdrawGroupParticipant(actor: RepresentationActor, grievanceId: string, participantId: string, input: z.infer<typeof WithdrawalInputSchema>) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    const updated = await queryRows<{ id: string }>(tx, sql`UPDATE grievance_group_participants
      SET withdrawn_at = now(), withdrawn_recorded_by = ${actor.userId}, withdrawal_reason = ${input.reason}, withdrawal_evidence_ref = ${input.evidenceRef}
      WHERE id = ${participantId}::uuid AND grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND withdrawn_at IS NULL RETURNING id::text`);
    if (!updated[0]) throw ApiError.notFound('Active participant');
    await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_group.participant.withdraw', resourceType: 'grievances', resourceId: grievanceId, details: { participantId } });
    return { participantId, withdrawn: true, ...readiness(await participants(tx, actor, grievanceId)) };
  });
}

export async function readGroupParticipants(actor: RepresentationActor, grievanceId: string) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    const { isGroup } = await requireGrievance(tx, actor, grievanceId, 'case:read_internal');
    const rows = await participants(tx, actor, grievanceId);
    return { isGroupGrievance: isGroup, participants: rows, ...readiness(rows) };
  });
}

// ---------------------------------------------------------------------------------------------------------------------------
// Representation records

export const RECORD_PAYLOAD_SCHEMAS = {
  employer_initiated_filing: z
    .object({
      employerRef: ref,
      employerCaseRef: ref,
      receivedOnDay: day,
      form: z.enum(['written', 'electronic', 'alternate_compliant_form']),
      employerAcknowledgementRef: ref.nullable(),
      summary: text,
    })
    .strict(),
  policy_filing: z
    .object({ routeToFinalLevel: z.literal(true), requiredApprovals: z.number().int().min(1).max(3), summary: text })
    .strict(),
  filing_approval: z.object({ decision: z.literal('approve'), note: z.string().trim().max(2000).nullable() }).strict(),
  final_level_handoff: z
    .object({ signedOnDay: day, receivingComponentRef: ref, packetDocumentRefs: z.array(ref).min(1).max(200), summary: text })
    .strict(),
  handoff_receipt: z.object({ receivedOnDay: day, note: z.string().trim().max(2000).nullable() }).strict(),
  abandonment: z
    .object({
      basis: z.enum(['written_abandonment', 'missed_escalation_finding']),
      evidenceRef: ref,
      missedDeadlineId: z.string().uuid().nullable(),
      note: text,
    })
    .strict()
    .refine((a) => a.basis !== 'missed_escalation_finding' || a.missedDeadlineId !== null, 'a missed-escalation finding names the deadline that was missed'),
  beyond_control_exception: z.object({ reason: text, evidenceRef: ref, affectedDeadlineId: z.string().uuid().nullable() }).strict(),
} as const;

export type RecordKind = keyof typeof RECORD_PAYLOAD_SCHEMAS;
export const RECORD_KINDS = Object.keys(RECORD_PAYLOAD_SCHEMAS) as RecordKind[];

interface RecordRow {
  id: string;
  record_kind: RecordKind;
  parent_record_id: string | null;
  actor_office: string | null;
  payload: Record<string, unknown>;
  recorded_by: string;
  recorded_at: unknown;
}

async function records(tx: RLSTx, actor: RepresentationActor, grievanceId: string) {
  return queryRows<RecordRow>(tx, sql`SELECT id::text, record_kind, parent_record_id::text, actor_office, payload, recorded_by, recorded_at
    FROM grievance_representation_records WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid ORDER BY recorded_at, id`);
}

/** Approval state of each policy filing: approvals from distinct people holding distinct offices, none of them the requester. */
export function approvalState(all: RecordRow[]) {
  return all
    .filter((r) => r.record_kind === 'policy_filing')
    .map((filing) => {
      const approvals = all.filter((r) => r.record_kind === 'filing_approval' && r.parent_record_id === filing.id);
      const offices = new Set(approvals.map((a) => a.actor_office));
      const required = Number(filing.payload.requiredApprovals);
      return { recordId: filing.id, required, approvals: approvals.length, distinctOffices: offices.size, approved: approvals.length >= required && offices.size >= required };
    });
}

export async function recordRepresentation(actor: RepresentationActor, grievanceId: string, kind: RecordKind, payload: unknown, parentRecordId: string | null) {
  const parsed = RECORD_PAYLOAD_SCHEMAS[kind].safeParse(payload);
  if (!parsed.success) throw ApiError.fromZod(parsed.error);
  const data = parsed.data as Record<string, unknown>;
  const needsParent = kind === 'filing_approval' || kind === 'handoff_receipt';
  if (needsParent !== (parentRecordId !== null)) throw ApiError.badRequest(needsParent ? 'This record answers a parent record.' : 'This record takes no parent record.');

  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    const existing = await records(tx, actor, grievanceId);
    let office: string | null = null;
    const refuse = async (code: string, message: string, status: 'conflict' | 'forbidden' = 'conflict') => {
      await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: `grievance_representation.${kind}`, resourceType: 'grievances', resourceId: grievanceId, details: { refused: code } }, 'failure');
      throw status === 'forbidden' ? ApiError.forbidden(message) : ApiError.conflict(message, { code });
    };

    if (parentRecordId !== null) {
      const parent = existing.find((r) => r.id === parentRecordId);
      if (!parent) throw ApiError.notFound('Parent record');
      if (kind === 'filing_approval') {
        if (parent.record_kind !== 'policy_filing') await refuse('parent_not_approvable', 'Only a policy filing takes approvals.');
        if (parent.recorded_by === actor.userId) await refuse('self_approval', 'The requester cannot approve their own filing.', 'forbidden');
        office = await officeOf(tx, actor);
        if (!office) await refuse('approver_holds_no_executive_office', 'An approval needs a holder of an executive office.', 'forbidden');
        const prior = existing.filter((r) => r.record_kind === 'filing_approval' && r.parent_record_id === parentRecordId);
        if (prior.some((r) => r.recorded_by === actor.userId)) await refuse('already_approved', 'This approver has already approved.');
        if (prior.some((r) => r.actor_office === office)) await refuse('office_already_approved', 'This office has already approved; the next approval must come from another office.');
      } else {
        if (parent.record_kind !== 'final_level_handoff') await refuse('parent_not_a_handoff', 'Only a final-level handoff takes a receipt.');
        if (parent.recorded_by === actor.userId) await refuse('self_receipt', 'The receipt must be acknowledged by someone other than the signatory.', 'forbidden');
        if (existing.some((r) => r.record_kind === 'handoff_receipt' && r.parent_record_id === parentRecordId)) await refuse('already_received', 'This handoff has already been acknowledged.');
      }
    }
    if (kind === 'final_level_handoff') {
      office = await officeOf(tx, actor);
      if (!office) await refuse('signatory_holds_no_executive_office', 'A final-level handoff is signed by a holder of an executive office.', 'forbidden');
    }
    if (kind === 'abandonment' && data.missedDeadlineId) {
      const [deadline] = await queryRows<{ id: string; past: boolean; open: boolean }>(tx, sql`SELECT id::text, due_date < now() AS past, status NOT IN ('completed','met') AS open
        FROM grievance_deadlines WHERE id = ${String(data.missedDeadlineId)}::uuid AND grievance_id = ${grievanceId}::uuid`);
      if (!deadline) await refuse('deadline_not_on_grievance', 'The missed deadline is not a deadline of this grievance.');
      else if (!deadline.past || !deadline.open) await refuse('deadline_not_missed', 'A missed-escalation finding needs a deadline that has passed without being met.');
    }

    const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO grievance_representation_records
      (organization_id, grievance_id, record_kind, parent_record_id, actor_office, payload, recorded_by)
      VALUES (${actor.organizationId}::uuid, ${grievanceId}::uuid, ${kind}, ${parentRecordId}::uuid, ${office}, ${JSON.stringify(data)}::jsonb, ${actor.userId})
      RETURNING id::text`);
    await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: `grievance_representation.${kind}`, resourceType: 'grievances', resourceId: grievanceId, details: { recordId: row.id, parentRecordId, office } });
    const after = await records(tx, actor, grievanceId);
    return { recordId: row.id, kind, approvals: approvalState(after) };
  });
}

export async function readRepresentationRecords(actor: RepresentationActor, grievanceId: string) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:read_internal');
    const all = await records(tx, actor, grievanceId);
    const handoffs = all
      .filter((r) => r.record_kind === 'final_level_handoff')
      .map((h) => ({ recordId: h.id, received: all.some((r) => r.record_kind === 'handoff_receipt' && r.parent_record_id === h.id) }));
    return { records: all, approvals: approvalState(all), handoffs };
  });
}
