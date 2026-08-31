/**
 * OCI Carrier Consent Ledger — pure event-sourced ledger of carrier
 * candidate consents during a stewardship redistribution.
 *
 * Pure. Append-only. No DB writes.
 *
 * Doctrine:
 *   docs/oci/superseded/stabilization/playbooks/STEWARDSHIP_REDISTRIBUTION.md §10
 *   docs/oci/OCI_INTERVENTION_ETHICS.md §2.5 (consent revocability)
 */

export const ENGINE_VERSION = '2.0.0';

export type CarrierConsentStatus =
  | 'proposed'
  | 'consented'
  | 'declined'
  | 'withdrawn';

export type CarrierConsentAction =
  | 'proposed_by_facilitator'
  | 'consented_by_carrier'
  | 'declined_by_carrier'
  | 'withdrawn_by_carrier';

export interface CarrierCandidate {
  readonly carrierId: string;
  readonly subjectSummary: string;
  readonly proposedAtClockTick: number;
}

export interface CarrierConsentEvent {
  readonly eventId: string;
  readonly carrierId: string;
  readonly from: CarrierConsentStatus | null;
  readonly to: CarrierConsentStatus;
  readonly producingAction: CarrierConsentAction;
  readonly recordedAtClockTick: number;
}

export interface CarrierConsentLedgerInput {
  readonly candidates: readonly CarrierCandidate[];
  readonly events: readonly CarrierConsentEvent[];
}

export interface DerivedCarrierConsentState {
  readonly candidate: CarrierCandidate;
  readonly currentStatus: CarrierConsentStatus;
  readonly lastRecordedAtClockTick: number;
  /** Withdrawn from a previously-consented carrier counts as revocation. */
  readonly hasBeenWithdrawn: boolean;
}

export interface CarrierConsentRejection {
  readonly eventId: string;
  readonly carrierId: string;
  readonly reason:
    | 'candidate_missing'
    | 'duplicate_initial_proposal'
    | 'no_prior_status'
    | 'illegal_transition'
    | 'event_out_of_order';
}

export interface DerivedCarrierConsentLedger {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly perCandidate: readonly DerivedCarrierConsentState[];
  readonly consentedIds: readonly string[];
  readonly declinedIds: readonly string[];
  readonly withdrawnIds: readonly string[];
  readonly pendingIds: readonly string[];
  readonly rejections: readonly CarrierConsentRejection[];
}

interface LegalEdge {
  readonly from: CarrierConsentStatus;
  readonly to: CarrierConsentStatus;
  readonly action: CarrierConsentAction;
}

const LEGAL_EDGES: readonly LegalEdge[] = [
  { from: 'proposed', to: 'consented', action: 'consented_by_carrier' },
  { from: 'proposed', to: 'declined', action: 'declined_by_carrier' },
  { from: 'consented', to: 'withdrawn', action: 'withdrawn_by_carrier' },
];

function isLegal(
  from: CarrierConsentStatus,
  to: CarrierConsentStatus,
  action: CarrierConsentAction,
): boolean {
  return LEGAL_EDGES.some((e) => e.from === from && e.to === to && e.action === action);
}

export function deriveCarrierConsentLedger(
  input: CarrierConsentLedgerInput,
): DerivedCarrierConsentLedger {
  const candidateById = new Map<string, CarrierCandidate>();
  for (const c of input.candidates) candidateById.set(c.carrierId, c);

  const sorted = input.events.slice().sort((a, b) => {
    if (a.recordedAtClockTick !== b.recordedAtClockTick) {
      return a.recordedAtClockTick - b.recordedAtClockTick;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  const status = new Map<string, CarrierConsentStatus>();
  const lastTick = new Map<string, number>();
  const everWithdrawn = new Set<string>();
  const rejections: CarrierConsentRejection[] = [];

  for (const ev of sorted) {
    if (!candidateById.has(ev.carrierId)) {
      rejections.push({
        eventId: ev.eventId,
        carrierId: ev.carrierId,
        reason: 'candidate_missing',
      });
      continue;
    }
    const prior = status.get(ev.carrierId);
    const priorTick = lastTick.get(ev.carrierId);
    if (priorTick !== undefined && ev.recordedAtClockTick < priorTick) {
      rejections.push({
        eventId: ev.eventId,
        carrierId: ev.carrierId,
        reason: 'event_out_of_order',
      });
      continue;
    }
    if (ev.producingAction === 'proposed_by_facilitator') {
      if (prior !== undefined) {
        rejections.push({
          eventId: ev.eventId,
          carrierId: ev.carrierId,
          reason: 'duplicate_initial_proposal',
        });
        continue;
      }
      if (ev.from !== null || ev.to !== 'proposed') {
        rejections.push({
          eventId: ev.eventId,
          carrierId: ev.carrierId,
          reason: 'illegal_transition',
        });
        continue;
      }
      status.set(ev.carrierId, 'proposed');
      lastTick.set(ev.carrierId, ev.recordedAtClockTick);
      continue;
    }
    if (prior === undefined) {
      rejections.push({
        eventId: ev.eventId,
        carrierId: ev.carrierId,
        reason: 'no_prior_status',
      });
      continue;
    }
    if (ev.from !== prior || !isLegal(prior, ev.to, ev.producingAction)) {
      rejections.push({
        eventId: ev.eventId,
        carrierId: ev.carrierId,
        reason: 'illegal_transition',
      });
      continue;
    }
    status.set(ev.carrierId, ev.to);
    lastTick.set(ev.carrierId, ev.recordedAtClockTick);
    if (ev.to === 'withdrawn') everWithdrawn.add(ev.carrierId);
  }

  const perCandidate: DerivedCarrierConsentState[] = [];
  for (const c of input.candidates) {
    const s = status.get(c.carrierId);
    if (s === undefined) continue;
    perCandidate.push({
      candidate: c,
      currentStatus: s,
      lastRecordedAtClockTick: lastTick.get(c.carrierId) ?? c.proposedAtClockTick,
      hasBeenWithdrawn: everWithdrawn.has(c.carrierId),
    });
  }
  perCandidate.sort((a, b) => a.candidate.carrierId.localeCompare(b.candidate.carrierId));

  const consentedIds = perCandidate.filter((s) => s.currentStatus === 'consented').map((s) => s.candidate.carrierId);
  const declinedIds = perCandidate.filter((s) => s.currentStatus === 'declined').map((s) => s.candidate.carrierId);
  const withdrawnIds = perCandidate.filter((s) => s.currentStatus === 'withdrawn').map((s) => s.candidate.carrierId);
  const pendingIds = perCandidate.filter((s) => s.currentStatus === 'proposed').map((s) => s.candidate.carrierId);

  return {
    engineVersion: ENGINE_VERSION,
    perCandidate,
    consentedIds,
    declinedIds,
    withdrawnIds,
    pendingIds,
    rejections,
  };
}
