/**
 * Grievance procedural integration: the facts a grievance records for rule selection (binding), its procedural facts
 * (triggers, pauses, extensions, level hearings, level waivers), and the calculation that fills
 * `grievance_deadlines.calculated_due_date` with evidence — or raises a reviewable exception and writes no date.
 *
 * A computed deadline is written as SYSTEM_CALCULATED: it is a calculation from adopted rules, not a human confirmation, and
 * goes through the existing confirmation flow (lib/services/deadline-confirmation-service.ts) like any other calculated
 * deadline. A recalculation never moves a date a human has confirmed or overridden; a difference becomes an exception.
 *
 * Authority: the authority kernel decides per grievance (case:read_internal to read, case:transition to record facts or
 * calculate). A grievance the caller cannot read answers 404, whatever the reason.
 */
import { sql } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { decideCase } from '@/lib/authority/store/route-adapter';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { loadOrganizationTimeZone } from '@/lib/deadline-engine/organization-time-zone';
import { isTerminalDeadlineStatus } from '@/lib/deadline-engine/deadline-semantics';
import { calculateProceduralDeadline, digestOf, type ProceduralEvidence } from './engine';
import { FACT_PAYLOAD_SCHEMAS, type FactKind, type ProcedureBindingInputSchema } from './definition-schema';
import { selectRuleSet } from './selection';
import { decideStageTransition, decisionMakerConflicts } from './stages';
import { loadRulesForSelectionIn, queryRows } from './store';
import type { ExtensionRecord, MatterFacts, PauseRecord, ProceduralException, TriggerFact } from './types';
import type { z } from 'zod';

export type ProcedureBindingInput = z.infer<typeof ProcedureBindingInputSchema>;

export interface GrievanceProcedureActor {
  userId: string;
  organizationId: string;
}

export interface GrievanceProcedureDeps {
  loadTimeZone: (organizationId: string) => Promise<{ timeZone: string }>;
}

const defaultDeps: GrievanceProcedureDeps = { loadTimeZone: loadOrganizationTimeZone };

export const PROCEDURAL_DEADLINE_TYPE_PREFIX = 'procedural:';

/** Lock and authorize one grievance. Unreadable → 404 (existence is not disclosed); readable but not permitted → 403. */
async function requireGrievance(tx: RLSTx, actor: GrievanceProcedureActor, grievanceId: string, action: 'case:read_internal' | 'case:transition'): Promise<void> {
  const found = await queryRows<{ id: string }>(tx, sql`SELECT id::text FROM grievances
    WHERE id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid ${action === 'case:transition' ? sql`FOR UPDATE` : sql``}`);
  if (!found[0]) throw ApiError.notFound('Grievance');
  const read = await decideCase(tx, { userId: actor.userId, organizationId: actor.organizationId, caseId: grievanceId, action: 'case:read' });
  if (read.effect !== 'allow') throw ApiError.notFound('Grievance');
  const decision = await decideCase(tx, { userId: actor.userId, organizationId: actor.organizationId, caseId: grievanceId, action });
  if (decision.effect !== 'allow') throw ApiError.forbidden('This action is not permitted for this grievance.');
}

interface BindingRow {
  id: string;
  regime: string | null;
  procedure_route: string | null;
  employer_ref: string | null;
  bargaining_group: string | null;
  classification: string | null;
  matter_category: string | null;
  reference_day: unknown;
  determinations: Record<string, boolean>;
}

interface FactRow {
  id: string;
  fact_kind: FactKind;
  payload: Record<string, unknown>;
  recorded_by: string;
  recorded_at: unknown;
  voided_at: unknown;
}

const dayText = (v: unknown) => (v === null || v === undefined ? null : v instanceof Date ? v.toISOString().slice(0, 10) : String(v).slice(0, 10));

async function currentBinding(tx: RLSTx, actor: GrievanceProcedureActor, grievanceId: string): Promise<BindingRow | null> {
  const [row] = await queryRows<BindingRow>(tx, sql`SELECT * FROM grievance_procedure_bindings
    WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND superseded_at IS NULL`);
  return row ?? null;
}

async function activeFacts(tx: RLSTx, actor: GrievanceProcedureActor, grievanceId: string): Promise<FactRow[]> {
  return queryRows<FactRow>(tx, sql`SELECT id::text, fact_kind, payload, recorded_by, recorded_at, voided_at FROM grievance_procedural_facts
    WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND voided_at IS NULL ORDER BY recorded_at, id`);
}

function matterOf(binding: BindingRow | null): MatterFacts {
  return {
    regime: binding?.regime ?? null,
    procedureRoute: binding?.procedure_route ?? null,
    employerId: binding?.employer_ref ?? null,
    bargainingGroup: binding?.bargaining_group ?? null,
    classification: binding?.classification ?? null,
    determinations: binding?.determinations ?? {},
  };
}

async function selectionContext(tx: RLSTx, actor: GrievanceProcedureActor, binding: BindingRow | null) {
  const matter = matterOf(binding);
  const loaded = matter.regime && matter.procedureRoute ? await loadRulesForSelectionIn(tx, actor.organizationId, matter.regime, matter.procedureRoute) : { ruleSets: [], calendars: [] };
  return { matter, referenceDay: dayText(binding?.reference_day), ...loaded };
}

// ---------------------------------------------------------------------------------------------------------------------------

export async function recordProcedureBinding(actor: GrievanceProcedureActor, grievanceId: string, input: ProcedureBindingInput) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    const prior = await currentBinding(tx, actor, grievanceId);
    if (prior) {
      await tx.execute(sql`UPDATE grievance_procedure_bindings SET superseded_by = ${actor.userId}, superseded_at = now()
        WHERE id = ${prior.id}::uuid AND organization_id = ${actor.organizationId}::uuid AND superseded_at IS NULL`);
    }
    const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO grievance_procedure_bindings
      (organization_id, grievance_id, regime, procedure_route, employer_ref, bargaining_group, classification, matter_category, reference_day, determinations, recorded_by)
      VALUES (${actor.organizationId}::uuid, ${grievanceId}::uuid, ${input.regime}, ${input.procedureRoute}, ${input.employerRef}, ${input.bargainingGroup},
        ${input.classification}, ${input.matterCategory}, ${input.referenceDay}::date, ${JSON.stringify(input.determinations)}::jsonb, ${actor.userId})
      RETURNING id::text`);
    await persistAtomicAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      action: 'grievance_procedure.bind',
      resourceType: 'grievances',
      resourceId: grievanceId,
      details: { bindingId: row.id, supersededBindingId: prior?.id ?? null, regime: input.regime, procedureRoute: input.procedureRoute },
    });
    return { bindingId: row.id, supersededBindingId: prior?.id ?? null };
  });
}

export type FactRecordResult = {
  factId: string;
  decisionMakerCheck: 'passed' | 'not_required' | 'unavailable';
  unavailableReason?: string;
};

export async function recordProceduralFact(actor: GrievanceProcedureActor, grievanceId: string, kind: FactKind, payload: unknown): Promise<FactRecordResult> {
  const parsed = FACT_PAYLOAD_SCHEMAS[kind].safeParse(payload);
  if (!parsed.success) throw ApiError.fromZod(parsed.error);
  const data = parsed.data as Record<string, unknown>;
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    let check: FactRecordResult['decisionMakerCheck'] = 'not_required';
    let unavailableReason: string | undefined;

    if (kind === 'level_hearing' || kind === 'level_waiver') {
      const binding = await currentBinding(tx, actor, grievanceId);
      const ctx = await selectionContext(tx, actor, binding);
      const selected = ctx.referenceDay ? selectRuleSet(ctx.ruleSets, ctx.matter, ctx.referenceDay) : null;
      if (kind === 'level_waiver') {
        // Eliminating a level is a governed decision: it needs the governing rule set to permit it.
        if (!selected?.ok) throw ApiError.conflict('No single adopted rule set governs this grievance; a level waiver cannot be validated.', { code: selected ? selected.exception.code : 'missing_reference_day' });
        const decision = decideStageTransition(selected.ruleSet, String(data.fromStageKey), String(data.toStageKey), {
          waiver: { unionPartyRef: String(data.unionPartyRef), employerPartyRef: String(data.employerPartyRef), agreedOnDay: String(data.agreedOnDay) },
        });
        if (!decision.ok || decision.kind !== 'waive_intermediate') {
          throw ApiError.conflict(decision.ok ? 'This transition does not skip a level.' : decision.message, { code: decision.ok ? 'not_a_waiver' : decision.code });
        }
      } else if (!selected?.ok) {
        check = 'unavailable';
        unavailableReason = selected ? selected.exception.code : 'missing_reference_day';
      } else if (selected.ruleSet.distinctDecisionMakerPerLevel) {
        const hearings = (await activeFacts(tx, actor, grievanceId))
          .filter((f) => f.fact_kind === 'level_hearing')
          .map((f) => ({ stageKey: String(f.payload.stageKey), employerDecisionMakerRef: String(f.payload.employerDecisionMakerRef) }));
        hearings.push({ stageKey: String(data.stageKey), employerDecisionMakerRef: String(data.employerDecisionMakerRef) });
        const conflicts = decisionMakerConflicts(selected.ruleSet, hearings);
        if (conflicts.length > 0) {
          await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_procedure.fact.level_hearing', resourceType: 'grievances', resourceId: grievanceId, details: { refused: 'decision_maker_conflict', conflicts } }, 'failure');
          throw ApiError.conflict('The same employer decision-maker cannot hear this grievance at more than one level under the governing rules.', { code: 'decision_maker_conflict', conflicts });
        }
        check = 'passed';
      }
    }

    const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO grievance_procedural_facts (organization_id, grievance_id, fact_kind, payload, recorded_by)
      VALUES (${actor.organizationId}::uuid, ${grievanceId}::uuid, ${kind}, ${JSON.stringify(data)}::jsonb, ${actor.userId}) RETURNING id::text`);
    await persistAtomicAudit(tx, {
      organizationId: actor.organizationId,
      userId: actor.userId,
      action: `grievance_procedure.fact.${kind}`,
      resourceType: 'grievances',
      resourceId: grievanceId,
      details: { factId: row.id, payloadDigest: digestOf(data) },
    });
    return { factId: row.id, decisionMakerCheck: check, ...(unavailableReason ? { unavailableReason } : {}) };
  });
}

export async function voidProceduralFact(actor: GrievanceProcedureActor, grievanceId: string, factId: string, reason: string) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    const updated = await queryRows<{ id: string }>(tx, sql`UPDATE grievance_procedural_facts SET voided_by = ${actor.userId}, voided_at = now(), void_reason = ${reason}
      WHERE id = ${factId}::uuid AND grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND voided_at IS NULL RETURNING id::text`);
    if (!updated[0]) throw ApiError.notFound('Procedural fact');
    await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_procedure.fact.void', resourceType: 'grievances', resourceId: grievanceId, details: { factId, reason } });
    return { factId, voided: true };
  });
}

export async function readGrievanceProcedure(actor: GrievanceProcedureActor, grievanceId: string) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:read_internal');
    const binding = await currentBinding(tx, actor, grievanceId);
    const facts = await queryRows<FactRow & { voided_by: string | null; void_reason: string | null }>(tx, sql`SELECT id::text, fact_kind, payload, recorded_by, recorded_at, voided_at, voided_by, void_reason
      FROM grievance_procedural_facts WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid ORDER BY recorded_at, id`);
    const exceptions = await queryRows<Record<string, unknown>>(tx, sql`SELECT id::text, clock_key, codes, evidence_digest, status, raised_at, resolved_by, resolved_at, resolution
      FROM grievance_procedural_exceptions WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid ORDER BY raised_at DESC, id`);
    const deadlines = await queryRows<Record<string, unknown>>(tx, sql`SELECT id::text, deadline_type, due_date, calculated_due_date, confirmation_status, status, calculation_provenance->>'evidenceDigest' AS evidence_digest
      FROM grievance_deadlines WHERE grievance_id = ${grievanceId}::uuid AND deadline_type LIKE ${PROCEDURAL_DEADLINE_TYPE_PREFIX + '%'} ORDER BY created_at, id`);
    return { binding, facts, exceptions, deadlines };
  });
}

export type ComputeOutcome =
  | { status: 'computed'; deadlineId: string; dueDay: string; dueAt: string; written: 'created' | 'recalculated' | 'unchanged'; evidence: ProceduralEvidence }
  | { status: 'exception'; exceptionId: string; exceptions: Array<{ code: string; message: string; detail?: Record<string, unknown> }>; evidence: ProceduralEvidence };

interface DeadlineRow {
  id: string;
  status: string;
  confirmation_status: string;
  override_due_date: unknown;
  evidence_digest: string | null;
  calculated_due_date: unknown;
}

async function raiseException(tx: RLSTx, actor: GrievanceProcedureActor, grievanceId: string, clockKey: string, exceptions: Array<{ code: string; message: string; detail?: Record<string, unknown> }>, evidence: ProceduralEvidence): Promise<ComputeOutcome> {
  const digest = digestOf({ exceptions, evidence });
  const [open] = await queryRows<{ id: string; evidence_digest: string }>(tx, sql`SELECT id::text, evidence_digest FROM grievance_procedural_exceptions
    WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND clock_key = ${clockKey} AND status = 'open'`);
  if (open && open.evidence_digest === digest) return { status: 'exception', exceptionId: open.id, exceptions, evidence };
  if (open) {
    await tx.execute(sql`UPDATE grievance_procedural_exceptions SET status = 'superseded', resolved_by = ${actor.userId}, resolved_at = now(), resolution = 'superseded by a later calculation'
      WHERE id = ${open.id}::uuid AND organization_id = ${actor.organizationId}::uuid AND status = 'open'`);
  }
  const codes = `{${exceptions.map((e) => e.code).join(',')}}`;
  const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO grievance_procedural_exceptions (organization_id, grievance_id, clock_key, codes, evidence, evidence_digest, raised_by)
    VALUES (${actor.organizationId}::uuid, ${grievanceId}::uuid, ${clockKey}, ${codes}::text[], ${JSON.stringify({ exceptions, evidence })}::jsonb, ${digest}, ${actor.userId}) RETURNING id::text`);
  await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_procedure.exception.raise', resourceType: 'grievances', resourceId: grievanceId, details: { exceptionId: row.id, clockKey, codes: exceptions.map((e) => e.code) } });
  return { status: 'exception', exceptionId: row.id, exceptions, evidence };
}

/**
 * Calculates one clock for a grievance from its recorded facts and the adopted rules, and writes the result: a
 * SYSTEM_CALCULATED grievance deadline with `calculated_due_date` and the evidence in `calculation_provenance`, or an open
 * reviewable exception (no date).
 */
export async function computeGrievanceDeadline(actor: GrievanceProcedureActor, grievanceId: string, clockKey: string, deps: GrievanceProcedureDeps = defaultDeps): Promise<ComputeOutcome> {
  const { timeZone } = await deps.loadTimeZone(actor.organizationId);
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    const binding = await currentBinding(tx, actor, grievanceId);
    const ctx = await selectionContext(tx, actor, binding);
    const facts = await activeFacts(tx, actor, grievanceId);
    const triggers: TriggerFact[] = facts.filter((f) => f.fact_kind === 'trigger').map((f) => f.payload as unknown as TriggerFact);
    const pauses: PauseRecord[] = facts.filter((f) => f.fact_kind === 'pause').map((f) => ({ id: f.id, ...(f.payload as Omit<PauseRecord, 'id'>) }));
    const extensions: ExtensionRecord[] = facts
      .filter((f) => f.fact_kind === 'extension' && f.payload.clockKey === clockKey)
      .map((f) => {
        const { clockKey: _clock, ...rest } = f.payload as Record<string, unknown>;
        return { id: f.id, ...(rest as Omit<ExtensionRecord, 'id'>) };
      });

    const result = calculateProceduralDeadline({
      ruleSets: ctx.ruleSets,
      holidayCalendars: ctx.calendars,
      matter: ctx.matter,
      referenceDay: ctx.referenceDay,
      clockKey,
      triggers,
      pauses,
      extensions,
      timeZone,
    });
    const deadlineType = `${PROCEDURAL_DEADLINE_TYPE_PREFIX}${clockKey}`;
    const [existing] = await queryRows<DeadlineRow>(tx, sql`SELECT id::text, status, confirmation_status, override_due_date, calculated_due_date, calculation_provenance->>'evidenceDigest' AS evidence_digest
      FROM grievance_deadlines WHERE grievance_id = ${grievanceId}::uuid AND deadline_type = ${deadlineType} AND superseded_at IS NULL
      ORDER BY created_at DESC, id LIMIT 1`);
    const live = existing && !isTerminalDeadlineStatus(existing.status) ? existing : undefined;

    if (result.status === 'exception') {
      const exceptions: ProceduralException[] = result.exceptions.map((e) => (live ? { ...e, detail: { ...(e.detail ?? {}), standingDeadlineId: live.id } } : e));
      return raiseException(tx, actor, grievanceId, clockKey, exceptions, result.evidence);
    }

    const resolveOpen = async () => {
      await tx.execute(sql`UPDATE grievance_procedural_exceptions SET status = 'superseded', resolved_by = ${actor.userId}, resolved_at = now(), resolution = 'superseded by a computed deadline'
        WHERE grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND clock_key = ${clockKey} AND status = 'open'`);
    };
    const provenance = JSON.stringify(result.evidence);
    const audit = (deadlineId: string, written: string) =>
      persistAtomicAudit(tx, {
        organizationId: actor.organizationId,
        userId: actor.userId,
        action: 'grievance_procedure.deadline.calculate',
        resourceType: 'grievance_deadlines',
        resourceId: deadlineId,
        details: { grievanceId, clockKey, dueAt: result.dueAt, written, evidenceDigest: result.evidence.evidenceDigest, ruleSetId: result.evidence.ruleSet?.id, legal_calculation_claimed: false },
      });

    if (live && live.evidence_digest === result.evidence.evidenceDigest) {
      await resolveOpen();
      return { status: 'computed', deadlineId: live.id, dueDay: result.dueDay, dueAt: result.dueAt, written: 'unchanged', evidence: result.evidence };
    }
    if (live && (live.confirmation_status !== 'SYSTEM_CALCULATED' || live.override_due_date !== null)) {
      // A human has confirmed or overridden this deadline: never move it. A different calculation is for a reviewer.
      return raiseException(tx, actor, grievanceId, clockKey, [{
        code: 'confirmed_deadline_differs',
        message: 'A recalculation differs from a deadline a person has confirmed or overridden; a reviewer must decide.',
        detail: { standingDeadlineId: live.id, recalculatedDueAt: result.dueAt },
      }], result.evidence);
    }
    if (live) {
      await tx.execute(sql`UPDATE grievance_deadlines SET due_date = ${result.dueAt}::timestamptz, calculated_due_date = ${result.dueAt}::timestamptz,
          calculation_provenance = ${provenance}::jsonb, updated_at = now()
        WHERE id = ${live.id}::uuid AND confirmation_status = 'SYSTEM_CALCULATED' AND override_due_date IS NULL`);
      await resolveOpen();
      await audit(live.id, 'recalculated');
      return { status: 'computed', deadlineId: live.id, dueDay: result.dueDay, dueAt: result.dueAt, written: 'recalculated', evidence: result.evidence };
    }
    const clock = result.evidence.clock!;
    const [row] = await queryRows<{ id: string }>(tx, sql`INSERT INTO grievance_deadlines
      (grievance_id, deadline_type, description, due_date, status, confirmation_status, calculated_due_date, calculation_provenance, reminder_days)
      VALUES (${grievanceId}::uuid, ${deadlineType}, ${`${clock.kind}: ${clock.sourceClause}`.slice(0, 500)}, ${result.dueAt}::timestamptz, 'pending',
        'SYSTEM_CALCULATED', ${result.dueAt}::timestamptz, ${provenance}::jsonb, ARRAY[7,3,1])
      RETURNING id::text`);
    await resolveOpen();
    await audit(row.id, 'created');
    return { status: 'computed', deadlineId: row.id, dueDay: result.dueDay, dueAt: result.dueAt, written: 'created', evidence: result.evidence };
  });
}

export async function resolveProceduralException(actor: GrievanceProcedureActor, grievanceId: string, exceptionId: string, resolution: string) {
  return withRLSContext({ organizationId: actor.organizationId }, async (tx) => {
    await requireGrievance(tx, actor, grievanceId, 'case:transition');
    const updated = await queryRows<{ id: string }>(tx, sql`UPDATE grievance_procedural_exceptions SET status = 'resolved', resolved_by = ${actor.userId}, resolved_at = now(), resolution = ${resolution}
      WHERE id = ${exceptionId}::uuid AND grievance_id = ${grievanceId}::uuid AND organization_id = ${actor.organizationId}::uuid AND status = 'open' RETURNING id::text`);
    if (!updated[0]) throw ApiError.notFound('Open procedural exception');
    await persistAtomicAudit(tx, { organizationId: actor.organizationId, userId: actor.userId, action: 'grievance_procedure.exception.resolve', resourceType: 'grievances', resourceId: grievanceId, details: { exceptionId } });
    return { exceptionId, status: 'resolved' as const };
  });
}
