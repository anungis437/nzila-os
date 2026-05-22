/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Runtime Readiness
 * DOCTRINE_VERSION: 1.0.0
 *
 * The Runtime Readiness Engine reads six conditions and composes a refusable
 * readiness reading. Readiness is binary at the structural level (sufficient
 * or not yet sufficient); the institution decides whether to act on it.
 *
 * The six conditions:
 *   1. Stabilization maturity sufficient
 *   2. Governance ratification present
 *   3. Redistribution pathways stable
 *   4. Continuity debt reduced
 *   5. Onboarding survivability active
 *   6. Runtime ethics alignment verified
 *
 * Posture:
 *   - Refusal-first: missing inputs collapse to not_yet_sufficient.
 *   - Deterministic.
 *   - The engine reports conditions; it never recommends action.
 */

import type { RuntimeContinuitySignal } from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';

export const RUNTIME_READINESS_ENGINE_VERSION = '1.0.0' as const;

export type ReadinessConditionKey =
  | 'stabilization_maturity_sufficient'
  | 'governance_ratification_present'
  | 'redistribution_pathways_stable'
  | 'continuity_debt_reduced'
  | 'onboarding_survivability_active'
  | 'runtime_ethics_alignment_verified';

export type ReadinessConditionState = 'sufficient' | 'not_yet_sufficient' | 'not_yet_readable';

export interface ReadinessConditionInputs {
  readonly stabilizationMaturity: ReadinessConditionState;
  readonly governanceRatification: ReadinessConditionState;
  readonly redistributionPathways: ReadinessConditionState;
  readonly continuityDebt: ReadinessConditionState;
  readonly onboardingSurvivability: ReadinessConditionState;
  readonly runtimeEthicsAlignment: ReadinessConditionState;
}

export interface ReadinessConditionReading {
  readonly key: ReadinessConditionKey;
  readonly state: ReadinessConditionState;
  readonly statement: string;
}

export interface RuntimeReadinessReading {
  readonly engineVersion: typeof RUNTIME_READINESS_ENGINE_VERSION;
  readonly institutionScope: string;
  readonly conditions: readonly ReadinessConditionReading[];
  readonly sufficientCount: number;
  readonly totalConditions: number;
  readonly overall: 'sufficient' | 'not_yet_sufficient' | 'not_yet_readable';
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

const CONDITION_STATEMENTS: Readonly<Record<ReadinessConditionKey, Readonly<Record<ReadinessConditionState, string>>>> = {
  stabilization_maturity_sufficient: {
    sufficient: 'Stabilization maturity is sufficient on the available reading.',
    not_yet_sufficient: 'Stabilization maturity is not yet sufficient on the available reading.',
    not_yet_readable: 'Stabilization maturity is not yet readable.',
  },
  governance_ratification_present: {
    sufficient: 'Governance ratification is present on the available reading.',
    not_yet_sufficient: 'Governance ratification is not yet present on the available reading.',
    not_yet_readable: 'Governance ratification is not yet readable.',
  },
  redistribution_pathways_stable: {
    sufficient: 'Redistribution pathways present as stable on the available reading.',
    not_yet_sufficient: 'Redistribution pathways are not yet stable on the available reading.',
    not_yet_readable: 'Redistribution pathways are not yet readable.',
  },
  continuity_debt_reduced: {
    sufficient: 'Continuity debt has been reduced on the available reading.',
    not_yet_sufficient: 'Continuity debt has not yet been reduced on the available reading.',
    not_yet_readable: 'Continuity debt is not yet readable.',
  },
  onboarding_survivability_active: {
    sufficient: 'Onboarding survivability is active on the available reading.',
    not_yet_sufficient: 'Onboarding survivability is not yet active on the available reading.',
    not_yet_readable: 'Onboarding survivability is not yet readable.',
  },
  runtime_ethics_alignment_verified: {
    sufficient: 'Runtime ethics alignment has been verified on the available reading.',
    not_yet_sufficient: 'Runtime ethics alignment has not yet been verified on the available reading.',
    not_yet_readable: 'Runtime ethics alignment is not yet readable.',
  },
};

export function readRuntimeReadiness(
  inputs: ReadinessConditionInputs,
  institutionScope: string,
): RuntimeReadinessReading {
  const pairs: readonly { key: ReadinessConditionKey; state: ReadinessConditionState }[] = [
    { key: 'stabilization_maturity_sufficient', state: inputs.stabilizationMaturity },
    { key: 'governance_ratification_present', state: inputs.governanceRatification },
    { key: 'redistribution_pathways_stable', state: inputs.redistributionPathways },
    { key: 'continuity_debt_reduced', state: inputs.continuityDebt },
    { key: 'onboarding_survivability_active', state: inputs.onboardingSurvivability },
    { key: 'runtime_ethics_alignment_verified', state: inputs.runtimeEthicsAlignment },
  ];

  const conditions: ReadinessConditionReading[] = pairs.map((p) => ({
    key: p.key,
    state: p.state,
    statement: CONDITION_STATEMENTS[p.key][p.state],
  }));

  const sufficientCount = conditions.filter((c) => c.state === 'sufficient').length;
  const allNotYetReadable = conditions.every((c) => c.state === 'not_yet_readable');
  const overall =
    allNotYetReadable
      ? 'not_yet_readable'
      : sufficientCount === conditions.length
        ? 'sufficient'
        : 'not_yet_sufficient';

  const signals: RuntimeContinuitySignal[] = [
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'runtime_readiness:overall',
      severity: overall === 'sufficient' ? 'observation' : overall === 'not_yet_sufficient' ? 'warning' : 'note',
      category: 'runtime_readiness_overall',
      statement:
        overall === 'sufficient'
          ? 'Runtime readiness presents as sufficient on the available reading.'
          : overall === 'not_yet_sufficient'
            ? 'Runtime readiness is not yet sufficient on the available reading.'
            : 'Runtime readiness is not yet readable for this institution scope.',
      evidence: {
        sufficientCount,
        totalConditions: conditions.length,
        institutionScope,
      },
    },
    ...conditions.map((c) => ({
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: `runtime_readiness:condition:${c.key}`,
      severity:
        c.state === 'sufficient'
          ? ('observation' as const)
          : c.state === 'not_yet_sufficient'
            ? ('warning' as const)
            : ('note' as const),
      category: 'runtime_readiness_condition',
      statement: c.statement,
      evidence: { condition: c.key, state: c.state },
    })),
  ];
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: RUNTIME_READINESS_ENGINE_VERSION,
    institutionScope,
    conditions,
    sufficientCount,
    totalConditions: conditions.length,
    overall,
    signals,
    statement:
      overall === 'sufficient'
        ? `Runtime readiness presents as sufficient (${sufficientCount}/${conditions.length}).`
        : overall === 'not_yet_sufficient'
          ? `Runtime readiness is not yet sufficient (${sufficientCount}/${conditions.length}).`
          : 'Runtime readiness is not yet readable for this institution scope.',
  };
}
