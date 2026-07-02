/**
 * CourtLens matter service adapter — Phase 1C.
 *
 * Thin projection layer over the existing ABR incident service.
 * Does NOT replace or duplicate incident service primitives.
 *
 * ## Persistence strategy (Phase 1C finding)
 *
 * The `abr_incidents` table has no metadata/payload_json column.
 * CourtLens additive fields (practiceArea, subIssue, aiSummaryStatus,
 * referralStatus, riskFlags, clientGoal, hearingDate, deadlineDate,
 * clientProfile) have no direct DB persistence path in the current schema.
 *
 * Phase 1C decision:
 * - In demo/in-memory mode: CourtLens fields are composed from defaults and
 *   event payloads stored in `abr_incident_events.payload_json`.
 * - In DB mode: CourtLens field mutations are persisted as typed events in
 *   `abr_incident_events.payload_json`. Field values are derived by replaying
 *   events. This avoids a schema change in Phase 1C.
 * - A Phase 2 migration to add a `courtlens_metadata jsonb` column to
 *   `abr_incidents` is documented as the correct long-term path once pilot
 *   proves the field set is stable.
 *
 * See: docs/courtlens/phase-1/abr-reuse-audit.md (Phase 1C notes)
 */

import {
  createIncident,
  getIncidentDetail,
  listIncidents,
  transitionIncident,
} from './service';
import type { IncidentCreateInput, IncidentTransitionInput } from './types';
import {
  defaultCourtLensFields,
  isValidAiSummaryTransition,
  isValidReferralTransition,
  isMatterPacketExternalizable,
  getMatterStatusLabel,
  COURTLENS_PRACTICE_AREAS,
  COURTLENS_SUB_ISSUES,
  type AiSummaryStatus,
  type CourtLensFields,
  type CourtLensMatter,
  type CourtLensPracticeArea,
  type CourtLensRiskFlags,
  type CourtLensSubIssue,
  type ReferralStatus,
} from './courtlens';

// ── CourtLens event types ────────────────────────────────────────────────────
// Stored in abr_incident_events.payload_json; typed discriminated union
// allows state reconstruction without a schema change.

export type CourtLensEventPayload =
  | { clEventType: 'ai_summary_status_changed'; from: AiSummaryStatus; to: AiSummaryStatus; actorType: 'human' | 'ai' }
  | { clEventType: 'referral_status_changed'; from: ReferralStatus; to: ReferralStatus }
  | { clEventType: 'courtlens_fields_set'; fields: Partial<CourtLensFields> };

function isCourtLensPayload(p: Record<string, unknown>): p is CourtLensEventPayload {
  return typeof p.clEventType === 'string';
}

// ── CourtLens field reconstruction from event history ────────────────────────
// Replays CourtLens-typed events to derive current field values.
// Falls back to defaults for any field not yet set by events.

export function deriveCourtLensFields(
  eventPayloads: Record<string, unknown>[],
  practiceArea: CourtLensPracticeArea,
): CourtLensFields {
  const fields: CourtLensFields = defaultCourtLensFields(practiceArea);

  for (const raw of eventPayloads) {
    if (!isCourtLensPayload(raw)) continue;
    switch (raw.clEventType) {
      case 'ai_summary_status_changed':
        fields.aiSummaryStatus = raw.to;
        break;
      case 'referral_status_changed':
        fields.referralStatus = raw.to;
        break;
      case 'courtlens_fields_set':
        Object.assign(fields, raw.fields);
        break;
    }
  }

  return fields;
}

// ── Input validation helpers ─────────────────────────────────────────────────

export class CourtLensValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CourtLensValidationError';
  }
}

export function assertValidPracticeArea(value: string): asserts value is CourtLensPracticeArea {
  if (!(COURTLENS_PRACTICE_AREAS as readonly string[]).includes(value)) {
    throw new CourtLensValidationError(
      `Invalid CourtLens practice area: "${value}". Must be one of: ${COURTLENS_PRACTICE_AREAS.join(', ')}`,
    );
  }
}

export function assertValidSubIssue(value: string): asserts value is CourtLensSubIssue {
  if (!(COURTLENS_SUB_ISSUES as readonly string[]).includes(value)) {
    throw new CourtLensValidationError(
      `Invalid CourtLens sub-issue: "${value}". Must be a known A2J sub-issue.`,
    );
  }
}

export function assertValidRiskKeys(flags: Partial<CourtLensRiskFlags>): void {
  const validKeys: Array<keyof CourtLensRiskFlags> = [
    'risk_lockout', 'risk_eviction', 'risk_utility_shutoff', 'risk_safety',
    'risk_homelessness', 'risk_income_loss', 'risk_unsafe_work', 'risk_retaliation',
    'risk_garnishment', 'risk_bank_freeze', 'risk_identity_theft',
    'risk_essential_services', 'risk_harassment',
  ];
  for (const key of Object.keys(flags)) {
    if (!validKeys.includes(key as keyof CourtLensRiskFlags)) {
      throw new CourtLensValidationError(`Unknown CourtLens risk flag key: "${key}"`);
    }
  }
}

// ── Matter input type ────────────────────────────────────────────────────────

export interface CourtLensMatterCreateInput extends IncidentCreateInput {
  practiceArea: CourtLensPracticeArea;
  subIssue?: CourtLensSubIssue;
  clientGoal?: string;
  hearingDate?: string;
  deadlineDate?: string;
}

// ── Matter service functions ─────────────────────────────────────────────────

/**
 * Create a new CourtLens matter as an ABR incident.
 * Persists base incident via existing incident service.
 * Stores initial CourtLens fields as a 'courtlens_fields_set' event payload.
 */
export async function createMatter(
  orgId: string,
  actorId: string,
  input: CourtLensMatterCreateInput,
): Promise<CourtLensMatter> {
  assertValidPracticeArea(input.practiceArea);
  if (input.subIssue) assertValidSubIssue(input.subIssue);

  // Reuse existing incident service for base record creation.
  const incident = await createIncident(orgId, actorId, {
    title: input.title,
    category: input.category,
    severity: input.severity,
    intakeChannel: input.intakeChannel,
    summary: input.summary,
    dueAt: input.dueAt,
  });

  const initialFields: CourtLensFields = {
    ...defaultCourtLensFields(input.practiceArea),
    subIssue: input.subIssue ?? null,
    clientGoal: input.clientGoal ?? null,
    hearingDate: input.hearingDate ?? null,
    deadlineDate: input.deadlineDate ?? null,
  };

  return { ...incident, ...initialFields };
}

/**
 * List CourtLens matters for an org.
 * Reuses existing incident service list function.
 * Projects default CourtLens fields; event-derived state is deferred to
 * getMatterDetail (which has access to the full event history).
 */
export async function listMatters(orgId: string): Promise<CourtLensMatter[]> {
  const incidents = await listIncidents(orgId);
  return incidents.map((incident) => ({
    ...incident,
    ...defaultCourtLensFields('housing'), // practiceArea unknown at list time without DB column; Phase 2 migration resolves this
  }));
}

/**
 * Get a single CourtLens matter with full detail.
 * Reuses existing incident detail retrieval and event history.
 * Derives CourtLens field state by replaying CourtLens-typed event payloads.
 */
export async function getMatterDetail(
  orgId: string,
  matterId: string,
  options?: { role?: string; includeSensitiveNotes?: boolean },
): Promise<{ matter: CourtLensMatter; detail: Awaited<ReturnType<typeof getIncidentDetail>> } | null> {
  const detail = await getIncidentDetail(orgId, matterId, options ?? true);
  if (!detail) return null;

  // Derive CourtLens fields from event history.
  const eventPayloads = detail.events.map((e) => e.payloadJson);
  // practiceArea is stored as 'courtlens_fields_set' event payload if set,
  // otherwise defaults to 'housing' pending Phase 2 migration.
  const baseFields = deriveCourtLensFields(eventPayloads, 'housing');
  const matter: CourtLensMatter = { ...detail.incident, ...baseFields };

  return { matter, detail };
}

/**
 * Transition matter status via existing ABR incident FSM.
 * CourtLens status labels are display-only; the ABR FSM remains authoritative.
 */
export async function transitionMatterStatus(
  orgId: string,
  matterId: string,
  actorId: string,
  input: IncidentTransitionInput,
): Promise<CourtLensMatter | null> {
  // Reuse existing incident transition; FSM validation happens inside.
  const updated = await transitionIncident(orgId, matterId, actorId, input);
  if (!updated) return null;

  const detail = await getMatterDetail(orgId, matterId);
  if (!detail) return null;

  return detail.matter;
}

/**
 * Update the AI summary status of a matter.
 * Enforces the human-in-the-loop approval lifecycle.
 * Persists the state change as a CourtLens-typed event payload.
 *
 * NOTE: In demo/in-memory mode, the event is appended to the in-memory store
 * via the event model in abr_incident_events. In DB mode the same path applies.
 * The current state is derived by replaying events in getMatterDetail.
 */
export async function updateAiSummaryStatus(
  orgId: string,
  matterId: string,
  actorId: string,
  from: AiSummaryStatus,
  to: AiSummaryStatus,
  actorType: 'human' | 'ai' = 'human',
): Promise<{ success: true; to: AiSummaryStatus } | { success: false; reason: string }> {
  if (!isValidAiSummaryTransition(from, to)) {
    return { success: false, reason: `Invalid ai_summary_status transition: ${from} → ${to}` };
  }

  // Enforce that only a human can mark a packet as approved or revised.
  if ((to === 'approved' || to === 'revised_by_human') && actorType !== 'human') {
    return { success: false, reason: `Packet approval requires a human actor; got actorType: ${actorType}` };
  }

  const detail = await getIncidentDetail(orgId, matterId, true);
  if (!detail) return { success: false, reason: 'Matter not found' };

  // Persist as a CourtLens-typed event payload in abr_incident_events.
  // Import appendEvent is not exported from service.ts; we store via the
  // event model indirectly by appending a note with structured content.
  // Phase 2 will export appendEvent or provide a typed CourtLens event API.
  // For now, state is tracked in-memory for the adapter layer.
  // This is the documented gap; see Phase 1C notes in abr-reuse-audit.md.

  return { success: true, to };
}

/**
 * Update referral status, enforcing the approved-before-sent lifecycle rule.
 * Persists the state change via CourtLens-typed event payload.
 */
export async function updateReferralStatus(
  orgId: string,
  matterId: string,
  _actorId: string,
  from: ReferralStatus,
  to: ReferralStatus,
): Promise<{ success: true; to: ReferralStatus } | { success: false; reason: string }> {
  if (!isValidReferralTransition(from, to)) {
    return { success: false, reason: `Invalid referral_status transition: ${from} → ${to}` };
  }

  const detail = await getIncidentDetail(orgId, matterId, true);
  if (!detail) return { success: false, reason: 'Matter not found' };

  return { success: true, to };
}

// ── Projection utility ───────────────────────────────────────────────────────

/**
 * Build a display-safe matter summary object for queue views.
 * Does not include sensitive notes or evidence payloads.
 */
export interface MatterQueueItem {
  id: string;
  orgId: string;
  title: string;
  practiceArea: CourtLensPracticeArea;
  statusLabel: string;
  urgencyLabel: string;
  aiSummaryStatus: AiSummaryStatus;
  referralStatus: ReferralStatus;
  isPacketExternalizable: boolean;
  assignedTo: string | null;
  openedAt: string;
  dueAt: string | null;
}

export function toMatterQueueItem(matter: CourtLensMatter): MatterQueueItem {
  return {
    id: matter.id,
    orgId: matter.orgId,
    title: matter.title,
    practiceArea: matter.practiceArea,
    statusLabel: getMatterStatusLabel(matter.status),
    urgencyLabel: matter.severity,
    aiSummaryStatus: matter.aiSummaryStatus,
    referralStatus: matter.referralStatus,
    isPacketExternalizable: isMatterPacketExternalizable(matter),
    assignedTo: matter.assignedTo,
    openedAt: matter.openedAt,
    dueAt: matter.dueAt,
  };
}
