/**
 * CourtLens matter service adapter — Phase 1C.
 *
 * Thin projection layer over the existing ABR incident service.
 * Does NOT replace or duplicate incident service primitives.
 *
 * ## Persistence strategy (Phase 1D — hardened)
 *
 * CourtLens additive fields are persisted as typed `'courtlens_event'` entries
 * in `abr_incident_events.payload_json`. This reuses the existing ABR event
 * infrastructure (both in-memory and DB paths) without a schema change.
 *
 * Event payloads use the `CourtLensEventPayload` discriminated union keyed on
 * `clEventType`. `deriveCourtLensFields` replays events to reconstruct state.
 *
 * Phase 1D hardening: `appendIncidentEvent` is now exported from service.ts
 * and called by every CourtLens mutation. No mutation returns success without
 * the event being written.
 *
 * `courtlens_metadata jsonb` column is deferred as a materialized projection
 * cache after pilot field stability is proven. Events remain source of truth.
 *
 * See: docs/courtlens/phase-1/abr-reuse-audit.md (Phase 1D notes)
 */

import {
  appendIncidentEvent,
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

// ── CourtLens typed event helpers ────────────────────────────────────────────
// Each helper writes a single typed `courtlens_event` into the incident event
// stream via the exported `appendIncidentEvent` primitive. No mutation in
// matter-service.ts succeeds without calling one of these helpers.

export async function recordCourtLensFieldUpdate(
  incidentId: string,
  actorId: string,
  fields: Partial<CourtLensFields>,
): Promise<void> {
  const payload: CourtLensEventPayload = { clEventType: 'courtlens_fields_set', fields };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export async function recordAiSummaryStatusChanged(
  incidentId: string,
  actorId: string,
  from: AiSummaryStatus,
  to: AiSummaryStatus,
  actorType: 'human' | 'ai',
): Promise<void> {
  const payload: CourtLensEventPayload = { clEventType: 'ai_summary_status_changed', from, to, actorType };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export async function recordReferralStatusChanged(
  incidentId: string,
  actorId: string,
  from: ReferralStatus,
  to: ReferralStatus,
): Promise<void> {
  const payload: CourtLensEventPayload = { clEventType: 'referral_status_changed', from, to };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export async function recordRiskFlagsUpdated(
  incidentId: string,
  actorId: string,
  flags: Partial<CourtLensRiskFlags>,
): Promise<void> {
  const payload: CourtLensEventPayload = { clEventType: 'courtlens_fields_set', fields: { riskFlags: { ...flags } as CourtLensRiskFlags } };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export async function recordClientProfileUpdated(
  incidentId: string,
  actorId: string,
  profile: Partial<import('./courtlens').CourtLensClientProfile>,
): Promise<void> {
  const payload: CourtLensEventPayload = { clEventType: 'courtlens_fields_set', fields: { clientProfile: profile as import('./courtlens').CourtLensClientProfile } };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export async function recordReviewPacketDrafted(
  incidentId: string,
  actorId: string,
): Promise<void> {
  const payload: CourtLensEventPayload = {
    clEventType: 'ai_summary_status_changed',
    from: 'ai_draft',
    to: 'needs_verification',
    actorType: 'ai',
  };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export async function recordReviewPacketApproved(
  incidentId: string,
  actorId: string,
  from: AiSummaryStatus,
): Promise<void> {
  const payload: CourtLensEventPayload = {
    clEventType: 'ai_summary_status_changed',
    from,
    to: 'approved',
    actorType: 'human',
  };
  await appendIncidentEvent(incidentId, actorId, 'courtlens_event', payload);
}

export interface CourtLensMatterCreateInput extends IncidentCreateInput {
  practiceArea: CourtLensPracticeArea;
  subIssue?: CourtLensSubIssue;
  clientGoal?: string;
  hearingDate?: string;
  deadlineDate?: string;
}

// ── Matter input type ────────────────────────────────────────────────────────

// ── Matter service functions ─────────────────────────────────────────────────

/**
 * Create a new CourtLens matter as an ABR incident.
 * Persists base incident via existing incident service.
 * Writes initial CourtLens fields as a 'courtlens_event' / 'courtlens_fields_set'
 * payload into the incident event stream.
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

  // Persist initial CourtLens fields as a typed event — this is the source of
  // truth for subsequent event-replay reconstruction.
  await recordCourtLensFieldUpdate(incident.id, actorId, initialFields);

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
 * Persists the state change as a typed 'courtlens_event' in the incident event
 * stream via appendIncidentEvent. No success is returned without the event
 * being written.
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

  // Persist the state change as a typed CourtLens event.
  await recordAiSummaryStatusChanged(matterId, actorId, from, to, actorType);

  return { success: true, to };
}

/**
 * Update referral status, enforcing the approved-before-sent lifecycle rule.
 * Persists the state change as a typed 'courtlens_event' in the incident event
 * stream. No success is returned without the event being written.
 */
export async function updateReferralStatus(
  orgId: string,
  matterId: string,
  actorId: string,
  from: ReferralStatus,
  to: ReferralStatus,
): Promise<{ success: true; to: ReferralStatus } | { success: false; reason: string }> {
  if (!isValidReferralTransition(from, to)) {
    return { success: false, reason: `Invalid referral_status transition: ${from} → ${to}` };
  }

  const detail = await getIncidentDetail(orgId, matterId, true);
  if (!detail) return { success: false, reason: 'Matter not found' };

  // Persist the state change as a typed CourtLens event.
  await recordReferralStatusChanged(matterId, actorId, from, to);

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
