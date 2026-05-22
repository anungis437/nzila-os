/**
 * ARTIFACT TYPE: Engine
 * MODULE: OCI Executive Stabilization Operations
 * DOCTRINE_VERSION: 2.0.0
 *
 * Executive stabilization model — composes the progression band, the
 * maturity placement, the evolution direction, the state engine reading,
 * and the intervention ledger summary into an 8-domain executive reading.
 *
 * Categorical only. No numeric scores. No individual signals.
 *
 * Pure, deterministic.
 */

import type { StabilizationState } from '../state/stabilizationStateMachine';
import type { ProgressionReading } from '../progression/stabilizationScoringEngine';
import type { MaturityProgressionReading } from '../progression/continuityMaturityProgression';
import type { StabilizationEvolutionReading } from '../progression/stabilizationEvolutionModel';

export const ENGINE_VERSION = '2.0.0';

export type ExecutiveDomainId =
  | 'stabilization_state'
  | 'progression_direction'
  | 'maturity_placement'
  | 'intervention_ledger_health'
  | 'stewardship_redistribution'
  | 'governance_recovery'
  | 'onboarding_survivability'
  | 'continuity_operational_health';

export type ExecutiveDomainBand =
  | 'not_yet_readable'
  | 'holding'
  | 'stabilizing'
  | 'regressing';

export interface ExecutiveStabilizationInput {
  readonly currentState: StabilizationState | null;
  readonly progression: ProgressionReading;
  readonly maturity: MaturityProgressionReading;
  readonly evolution: StabilizationEvolutionReading;
  readonly interventionLedger: {
    readonly irreversiblyRatifiedCount: number;
    readonly regressedCount: number;
    readonly withdrawnCount: number;
    readonly activeCount: number;
    readonly awaitingRatificationStaleCount: number;
  };
  readonly stewardshipRedistribution: {
    readonly offeredCount: number;
    readonly refusedCount: number;
    readonly consentWithdrawnCount: number;
  };
  readonly governanceRecovery: {
    readonly ratifiedMovesCount: number;
    readonly pendingMovesCount: number;
  };
  readonly onboardingSurvivability: {
    readonly workflowsCompletedCount: number;
    readonly workflowsActiveCount: number;
  };
}

export interface ExecutiveDomainReading {
  readonly domain: ExecutiveDomainId;
  readonly band: ExecutiveDomainBand;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface ExecutiveStabilizationResult {
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly domains: readonly ExecutiveDomainReading[];
  readonly compositeBand: ExecutiveDomainBand;
  readonly reading: string;
}

export function runExecutiveStabilizationModel(
  input: ExecutiveStabilizationInput,
): ExecutiveStabilizationResult {
  const domains: ExecutiveDomainReading[] = [
    readStateDomain(input),
    readProgressionDomain(input),
    readMaturityDomain(input),
    readInterventionLedgerDomain(input),
    readStewardshipDomain(input),
    readGovernanceRecoveryDomain(input),
    readOnboardingDomain(input),
  ];

  const compositeBand = composeBand(domains);
  const composite: ExecutiveDomainReading = {
    domain: 'continuity_operational_health',
    band: compositeBand,
    statement: compositeStatement(compositeBand),
    evidence: { contributingDomains: domains.map((d) => d.domain) },
  };

  const all = [...domains, composite];
  return {
    engineVersion: ENGINE_VERSION,
    domains: all,
    compositeBand,
    reading: composite.statement,
  };
}

function readStateDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  if (!i.currentState) {
    return {
      domain: 'stabilization_state',
      band: 'not_yet_readable',
      statement: 'Stabilization state has not been declared.',
      evidence: {},
    };
  }
  const band: ExecutiveDomainBand =
    i.currentState === 'continuity_stabilized' || i.currentState === 'longitudinal_monitoring'
      ? 'stabilizing'
      : i.currentState === 'continuity_debt_elevated'
        ? 'regressing'
        : 'holding';
  return {
    domain: 'stabilization_state',
    band,
    statement: `The institution is in the ${humanize(i.currentState)} state.`,
    evidence: { state: i.currentState },
  };
}

function readProgressionDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  const band: ExecutiveDomainBand =
    i.progression.band === 'advancing'
      ? 'stabilizing'
      : i.progression.band === 'regressing'
        ? 'regressing'
        : i.progression.band === 'holding'
          ? 'holding'
          : 'not_yet_readable';
  return {
    domain: 'progression_direction',
    band,
    statement: i.progression.reading,
    evidence: {
      progressionBand: i.progression.band,
      contributingSources: i.progression.contributingSources,
    },
  };
}

function readMaturityDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  return {
    domain: 'maturity_placement',
    band: i.maturity.currentStage === 'unknown' ? 'not_yet_readable' : 'holding',
    statement: i.maturity.reading,
    evidence: {
      currentStage: i.maturity.currentStage,
      nextStage: i.maturity.nextStage,
      atTerminalStage: i.maturity.atTerminalStage,
    },
  };
}

function readInterventionLedgerDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  const l = i.interventionLedger;
  const total = l.irreversiblyRatifiedCount + l.regressedCount + l.withdrawnCount + l.activeCount;
  if (total === 0) {
    return {
      domain: 'intervention_ledger_health',
      band: 'not_yet_readable',
      statement: 'No interventions have been recorded.',
      evidence: { ...l },
    };
  }
  const band: ExecutiveDomainBand =
    l.regressedCount > l.irreversiblyRatifiedCount
      ? 'regressing'
      : l.irreversiblyRatifiedCount > 0 && l.regressedCount === 0
        ? 'stabilizing'
        : 'holding';
  return {
    domain: 'intervention_ledger_health',
    band,
    statement: `${l.irreversiblyRatifiedCount} interventions are irreversibly ratified; ${l.regressedCount} have regressed; ${l.activeCount} remain active; ${l.awaitingRatificationStaleCount} are awaiting ratification past threshold.`,
    evidence: { ...l },
  };
}

function readStewardshipDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  const s = i.stewardshipRedistribution;
  const total = s.offeredCount + s.refusedCount;
  if (total === 0) {
    return {
      domain: 'stewardship_redistribution',
      band: 'not_yet_readable',
      statement: 'No stewardship redistribution executions have been read.',
      evidence: { ...s },
    };
  }
  const band: ExecutiveDomainBand =
    s.offeredCount > 0 && s.refusedCount === 0 ? 'stabilizing' : s.refusedCount > 0 ? 'holding' : 'holding';
  return {
    domain: 'stewardship_redistribution',
    band,
    statement: `${s.offeredCount} redistributions have been offered; ${s.refusedCount} have been refused at the reciprocity gate; ${s.consentWithdrawnCount} consents have been withdrawn.`,
    evidence: { ...s },
  };
}

function readGovernanceRecoveryDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  const g = i.governanceRecovery;
  const total = g.ratifiedMovesCount + g.pendingMovesCount;
  if (total === 0) {
    return {
      domain: 'governance_recovery',
      band: 'not_yet_readable',
      statement: 'No governance recovery moves have been read.',
      evidence: { ...g },
    };
  }
  const band: ExecutiveDomainBand = g.ratifiedMovesCount > 0 ? 'stabilizing' : 'holding';
  return {
    domain: 'governance_recovery',
    band,
    statement: `${g.ratifiedMovesCount} governance recovery moves have been ratified; ${g.pendingMovesCount} are pending.`,
    evidence: { ...g },
  };
}

function readOnboardingDomain(i: ExecutiveStabilizationInput): ExecutiveDomainReading {
  const o = i.onboardingSurvivability;
  const total = o.workflowsCompletedCount + o.workflowsActiveCount;
  if (total === 0) {
    return {
      domain: 'onboarding_survivability',
      band: 'not_yet_readable',
      statement: 'No onboarding stabilization workflows have been read.',
      evidence: { ...o },
    };
  }
  const band: ExecutiveDomainBand = o.workflowsCompletedCount > 0 ? 'stabilizing' : 'holding';
  return {
    domain: 'onboarding_survivability',
    band,
    statement: `${o.workflowsCompletedCount} onboarding stabilization workflows have been completed; ${o.workflowsActiveCount} are active.`,
    evidence: { ...o },
  };
}

function composeBand(domains: readonly ExecutiveDomainReading[]): ExecutiveDomainBand {
  const readable = domains.filter((d) => d.band !== 'not_yet_readable');
  if (readable.length === 0) return 'not_yet_readable';
  if (readable.some((d) => d.band === 'regressing')) return 'regressing';
  if (readable.every((d) => d.band === 'holding' || d.band === 'stabilizing')) {
    return readable.some((d) => d.band === 'stabilizing') ? 'stabilizing' : 'holding';
  }
  return 'holding';
}

function compositeStatement(band: ExecutiveDomainBand): string {
  switch (band) {
    case 'not_yet_readable':
      return 'Composite continuity operational health is not yet readable; too few domains have been read.';
    case 'holding':
      return 'Composite continuity operational health is holding; recovery is preserved across read domains.';
    case 'stabilizing':
      return 'Composite continuity operational health is stabilizing; ratified moves are producing forward progression on at least one domain.';
    case 'regressing':
      return 'Composite continuity operational health is regressing; recovery has been lost on at least one domain.';
  }
}

function humanize(s: string): string {
  return s.replace(/_/g, ' ');
}
