/**
 * OCI Continuity Intervention Ledger — pure event-sourced ledger of
 * per-intervention status events.
 *
 * Pure. Append-only. Deterministic. No DB writes.
 *
 * Doctrine: docs/oci/stabilization/OCI_CONTINUITY_INTERVENTION_TRACKING.md
 */

import {
  evaluateInterventionTransition,
  isActive,
  isTerminal,
  type InterventionStatus,
  type ProducingAction,
} from './interventionLifecycle';

export const ENGINE_VERSION = '2.0.0';

export type WorkflowKey =
  | 'continuity_capture'
  | 'governance_clarification'
  | 'stewardship_redistribution'
  | 'onboarding_stabilization'
  | 'modernization_remediation'
  | 'operational_reconstruction';

export interface InterventionDefinition {
  readonly interventionId: string;
  readonly workflow: WorkflowKey;
  readonly subjectSummary: string;
  readonly proposedAtClockTick: number;
}

export interface InterventionStatusEvent {
  readonly eventId: string;
  readonly interventionId: string;
  readonly from: InterventionStatus | null;
  readonly to: InterventionStatus;
  readonly producingAction: ProducingAction | 'initial_proposal';
  readonly recordedAtClockTick: number;
}

export interface InterventionLedgerInput {
  readonly definitions: readonly InterventionDefinition[];
  readonly events: readonly InterventionStatusEvent[];
}

export interface DerivedInterventionState {
  readonly definition: InterventionDefinition;
  readonly currentStatus: InterventionStatus;
  readonly lastRecordedAtClockTick: number;
  readonly active: boolean;
  readonly terminal: boolean;
}

export interface LedgerRejection {
  readonly eventId: string;
  readonly interventionId: string;
  readonly reason:
    | 'definition_missing'
    | 'duplicate_initial_proposal'
    | 'no_prior_status'
    | 'illegal_transition'
    | 'event_out_of_order';
}

export interface DerivedLedger {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly perIntervention: readonly DerivedInterventionState[];
  readonly activeIds: readonly string[];
  readonly terminalIds: readonly string[];
  readonly rejections: readonly LedgerRejection[];
}

export function deriveLedger(input: InterventionLedgerInput): DerivedLedger {
  const defById = new Map<string, InterventionDefinition>();
  for (const d of input.definitions) defById.set(d.interventionId, d);

  const sortedEvents = input.events.slice().sort((a, b) => {
    if (a.recordedAtClockTick !== b.recordedAtClockTick) {
      return a.recordedAtClockTick - b.recordedAtClockTick;
    }
    return a.eventId.localeCompare(b.eventId);
  });

  const currentStatus = new Map<string, InterventionStatus>();
  const lastTick = new Map<string, number>();
  const rejections: LedgerRejection[] = [];

  for (const ev of sortedEvents) {
    const def = defById.get(ev.interventionId);
    if (!def) {
      rejections.push({
        eventId: ev.eventId,
        interventionId: ev.interventionId,
        reason: 'definition_missing',
      });
      continue;
    }
    const existing = currentStatus.get(ev.interventionId);
    const priorTick = lastTick.get(ev.interventionId);
    if (priorTick !== undefined && ev.recordedAtClockTick < priorTick) {
      rejections.push({
        eventId: ev.eventId,
        interventionId: ev.interventionId,
        reason: 'event_out_of_order',
      });
      continue;
    }
    if (ev.producingAction === 'initial_proposal') {
      if (existing !== undefined) {
        rejections.push({
          eventId: ev.eventId,
          interventionId: ev.interventionId,
          reason: 'duplicate_initial_proposal',
        });
        continue;
      }
      if (ev.to !== 'proposed' || ev.from !== null) {
        rejections.push({
          eventId: ev.eventId,
          interventionId: ev.interventionId,
          reason: 'illegal_transition',
        });
        continue;
      }
      currentStatus.set(ev.interventionId, 'proposed');
      lastTick.set(ev.interventionId, ev.recordedAtClockTick);
      continue;
    }
    if (existing === undefined) {
      rejections.push({
        eventId: ev.eventId,
        interventionId: ev.interventionId,
        reason: 'no_prior_status',
      });
      continue;
    }
    if (ev.from !== existing) {
      rejections.push({
        eventId: ev.eventId,
        interventionId: ev.interventionId,
        reason: 'illegal_transition',
      });
      continue;
    }
    const evalRes = evaluateInterventionTransition(existing, ev.to, ev.producingAction);
    if (evalRes.disposition !== 'permitted') {
      rejections.push({
        eventId: ev.eventId,
        interventionId: ev.interventionId,
        reason: 'illegal_transition',
      });
      continue;
    }
    currentStatus.set(ev.interventionId, ev.to);
    lastTick.set(ev.interventionId, ev.recordedAtClockTick);
  }

  const perIntervention: DerivedInterventionState[] = [];
  for (const def of input.definitions) {
    const status = currentStatus.get(def.interventionId);
    if (status === undefined) continue;
    perIntervention.push({
      definition: def,
      currentStatus: status,
      lastRecordedAtClockTick: lastTick.get(def.interventionId) ?? def.proposedAtClockTick,
      active: isActive(status),
      terminal: isTerminal(status),
    });
  }
  perIntervention.sort((a, b) => a.definition.interventionId.localeCompare(b.definition.interventionId));

  const activeIds = perIntervention.filter((s) => s.active).map((s) => s.definition.interventionId);
  const terminalIds = perIntervention
    .filter((s) => s.terminal)
    .map((s) => s.definition.interventionId);

  return {
    engineVersion: ENGINE_VERSION,
    perIntervention,
    activeIds,
    terminalIds,
    rejections,
  };
}
