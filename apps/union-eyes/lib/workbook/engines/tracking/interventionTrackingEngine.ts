/**
 * OCI Continuity Intervention Tracking Engine — composition over the
 * intervention lifecycle FSM and the derived ledger. Emits canonical
 * signal envelopes naming the institution's position per intervention.
 *
 * Pure. No DB writes. No analytics. No scoring.
 *
 * Doctrine: docs/oci/stabilization/OCI_CONTINUITY_INTERVENTION_TRACKING.md
 */

import {
  deriveLedger,
  type DerivedInterventionState,
  type InterventionLedgerInput,
  type WorkflowKey,
} from './interventionLedger';
import type { StabilizationState } from '../state/stabilizationStateMachine';

export const ENGINE_VERSION = '2.0.0';

export type TrackingSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type TrackingSignalCategory =
  | 'intervention_awaiting_ratification'
  | 'intervention_in_reversibility_window'
  | 'intervention_awaiting_irreversible_ratification'
  | 'intervention_regressed_without_recovery'
  | 'active_intervention_count_by_workflow'
  | 'terminal_intervention_distribution'
  | 'ledger_event_rejected';

export interface TrackingSignal {
  readonly signalId: string;
  readonly severity: TrackingSignalSeverity;
  readonly category: TrackingSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface InterventionTrackingThresholds {
  readonly awaitingRatificationStaleTicks: number;
  readonly awaitingIrreversibleRatificationStaleTicks: number;
  readonly reversibilityWindowSoonClosingTicks: number;
}

export const DEFAULT_TRACKING_THRESHOLDS: InterventionTrackingThresholds = {
  awaitingRatificationStaleTicks: 14,
  awaitingIrreversibleRatificationStaleTicks: 14,
  reversibilityWindowSoonClosingTicks: 7,
};

export interface InterventionTrackingEngineInput {
  readonly currentClockTick: number;
  readonly declaredState: StabilizationState;
  readonly ledger: InterventionLedgerInput;
  /** Intervention ids that had a regression event followed by no proposal of a recovery intervention. */
  readonly regressedWithoutRecoveryIds?: readonly string[];
  readonly thresholds?: InterventionTrackingThresholds;
}

export interface InterventionTrackingEngineResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly signals: readonly TrackingSignal[];
  readonly activeIds: readonly string[];
  readonly terminalIds: readonly string[];
  readonly preview: string;
}

function severityFor(category: TrackingSignalCategory): TrackingSignalSeverity {
  switch (category) {
    case 'intervention_awaiting_ratification':
      return 'warning';
    case 'intervention_in_reversibility_window':
      return 'observation';
    case 'intervention_awaiting_irreversible_ratification':
      return 'warning';
    case 'intervention_regressed_without_recovery':
      return 'critical';
    case 'active_intervention_count_by_workflow':
      return 'note';
    case 'terminal_intervention_distribution':
      return 'note';
    case 'ledger_event_rejected':
      return 'warning';
  }
}

function elapsed(currentTick: number, lastTick: number): number {
  return Math.max(0, currentTick - lastTick);
}

function workflowCounts(states: readonly DerivedInterventionState[]): Readonly<Record<WorkflowKey, number>> {
  const out: Record<WorkflowKey, number> = {
    continuity_capture: 0,
    governance_clarification: 0,
    stewardship_redistribution: 0,
    onboarding_stabilization: 0,
    modernization_remediation: 0,
    operational_reconstruction: 0,
  };
  for (const s of states) out[s.definition.workflow]++;
  return out;
}

function terminalCounts(states: readonly DerivedInterventionState[]): {
  readonly irreversibly_ratified: number;
  readonly regressed: number;
  readonly withdrawn: number;
} {
  let irreversibly_ratified = 0;
  let regressed = 0;
  let withdrawn = 0;
  for (const s of states) {
    if (s.currentStatus === 'irreversibly_ratified') irreversibly_ratified++;
    else if (s.currentStatus === 'regressed') regressed++;
    else if (s.currentStatus === 'withdrawn') withdrawn++;
  }
  return { irreversibly_ratified, regressed, withdrawn };
}

export function runInterventionTrackingEngine(
  input: InterventionTrackingEngineInput,
): InterventionTrackingEngineResult {
  const thresholds = input.thresholds ?? DEFAULT_TRACKING_THRESHOLDS;
  const derived = deriveLedger(input.ledger);

  const signals: TrackingSignal[] = [];

  for (const s of derived.perIntervention) {
    const age = elapsed(input.currentClockTick, s.lastRecordedAtClockTick);

    if (s.currentStatus === 'proposed' && age >= thresholds.awaitingRatificationStaleTicks) {
      signals.push({
        signalId: `tracking:awaiting_ratification:${s.definition.interventionId}`,
        severity: severityFor('intervention_awaiting_ratification'),
        category: 'intervention_awaiting_ratification',
        statement: `Intervention ${s.definition.interventionId} (${s.definition.workflow}) has been awaiting ratification for ${age} clock tick(s).`,
        evidence: {
          interventionId: s.definition.interventionId,
          workflow: s.definition.workflow,
          subjectSummary: s.definition.subjectSummary,
          ageClockTicks: age,
          threshold: thresholds.awaitingRatificationStaleTicks,
        },
      });
    }

    if (s.currentStatus === 'in_reversible_execution') {
      const remainingHint = thresholds.reversibilityWindowSoonClosingTicks;
      signals.push({
        signalId: `tracking:in_reversibility:${s.definition.interventionId}`,
        severity: severityFor('intervention_in_reversibility_window'),
        category: 'intervention_in_reversibility_window',
        statement: `Intervention ${s.definition.interventionId} (${s.definition.workflow}) is in the reversibility window; wind-back remains available.`,
        evidence: {
          interventionId: s.definition.interventionId,
          workflow: s.definition.workflow,
          ageClockTicks: age,
          windowSoonClosingHintTicks: remainingHint,
        },
      });
    }

    if (
      s.currentStatus === 'awaiting_irreversible_ratification' &&
      age >= thresholds.awaitingIrreversibleRatificationStaleTicks
    ) {
      signals.push({
        signalId: `tracking:awaiting_irreversible:${s.definition.interventionId}`,
        severity: severityFor('intervention_awaiting_irreversible_ratification'),
        category: 'intervention_awaiting_irreversible_ratification',
        statement: `Intervention ${s.definition.interventionId} (${s.definition.workflow}) is awaiting irreversible ratification (${age} clock tick(s) elapsed).`,
        evidence: {
          interventionId: s.definition.interventionId,
          workflow: s.definition.workflow,
          ageClockTicks: age,
          threshold: thresholds.awaitingIrreversibleRatificationStaleTicks,
        },
      });
    }
  }

  const regressedWithoutRecovery = input.regressedWithoutRecoveryIds ?? [];
  for (const id of regressedWithoutRecovery) {
    signals.push({
      signalId: `tracking:regressed_no_recovery:${id}`,
      severity: severityFor('intervention_regressed_without_recovery'),
      category: 'intervention_regressed_without_recovery',
      statement: `Intervention ${id} has regressed without a recorded recovery proposal. Recognition of this is a method outcome; it is not organizational fault.`,
      evidence: { interventionId: id },
    });
  }

  const wc = workflowCounts(derived.perIntervention.filter((s) => s.active));
  signals.push({
    signalId: 'tracking:active_count_by_workflow',
    severity: severityFor('active_intervention_count_by_workflow'),
    category: 'active_intervention_count_by_workflow',
    statement: `Active intervention counts surfaced by workflow.`,
    evidence: { declaredState: input.declaredState, countsByWorkflow: wc },
  });

  const tc = terminalCounts(derived.perIntervention);
  signals.push({
    signalId: 'tracking:terminal_distribution',
    severity: severityFor('terminal_intervention_distribution'),
    category: 'terminal_intervention_distribution',
    statement: `Terminal intervention distribution surfaced for organizational record.`,
    evidence: tc,
  });

  for (const rej of derived.rejections) {
    signals.push({
      signalId: `tracking:rejection:${rej.eventId}`,
      severity: severityFor('ledger_event_rejected'),
      category: 'ledger_event_rejected',
      statement: `Ledger event ${rej.eventId} for intervention ${rej.interventionId} rejected: ${rej.reason}.`,
      evidence: { ...rej },
    });
  }

  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: ENGINE_VERSION,
    signals,
    activeIds: derived.activeIds,
    terminalIds: derived.terminalIds,
    preview: `Continuity intervention tracking — ${derived.activeIds.length} active, ${derived.terminalIds.length} terminal at declared state ${input.declaredState}.`,
  };
}
