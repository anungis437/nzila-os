/**
 * ARTIFACT TYPE: Runtime Engine
 * MODULE: OCI Onboarding Runtime
 * DOCTRINE_VERSION: 1.0.0
 *
 * Successor Stewardship Runtime.
 *
 * Reads onboarding survivability and stewardship transfer records together
 * and composes a refusable observation about successor stewardship — i.e.
 * whether successor stewards are inheriting the context they need.
 *
 * The runtime never ranks individual stewards. It reports the organizational
 * reading only.
 */

import type {
  ContinuityRuntimeBand,
  RuntimeContinuitySignal,
} from '../contracts/runtimeContracts';
import { RUNTIME_CONTRACT_VERSION } from '../contracts/runtimeContracts';
import type { OnboardingSurvivabilityReading } from './onboardingRuntime';
import type { TransferContinuityReading } from './continuityTransferRuntime';

export const SUCCESSOR_STEWARDSHIP_RUNTIME_VERSION = '1.0.0' as const;

export interface SuccessorStewardshipReading {
  readonly engineVersion: typeof SUCCESSOR_STEWARDSHIP_RUNTIME_VERSION;
  readonly institutionScope: string;
  readonly survivabilityBand: ContinuityRuntimeBand;
  readonly continuityCarriedBand: ContinuityRuntimeBand;
  readonly successorReadinessBand: ContinuityRuntimeBand;
  readonly signals: readonly RuntimeContinuitySignal[];
  readonly statement: string;
}

function weakest(a: ContinuityRuntimeBand, b: ContinuityRuntimeBand): ContinuityRuntimeBand {
  const order: Readonly<Record<ContinuityRuntimeBand, number>> = {
    regressing: 0,
    not_yet_readable: 1,
    stabilizing: 2,
    holding: 3,
  };
  return order[a] <= order[b] ? a : b;
}

export function readSuccessorStewardship(
  onboarding: OnboardingSurvivabilityReading,
  transfer: TransferContinuityReading,
): SuccessorStewardshipReading {
  if (onboarding.institutionScope !== transfer.institutionScope) {
    return {
      engineVersion: SUCCESSOR_STEWARDSHIP_RUNTIME_VERSION,
      institutionScope: onboarding.institutionScope,
      survivabilityBand: 'not_yet_readable',
      continuityCarriedBand: 'not_yet_readable',
      successorReadinessBand: 'not_yet_readable',
      signals: [
        {
          contractVersion: RUNTIME_CONTRACT_VERSION,
          signalId: 'successor_stewardship:institution_scope_mismatch',
          severity: 'warning',
          category: 'successor_stewardship_scope_mismatch',
          statement: 'Onboarding and transfer readings are scoped to different institutions; the runtime refuses to compose them.',
          evidence: {
            onboardingScope: onboarding.institutionScope,
            transferScope: transfer.institutionScope,
          },
        },
      ],
      statement: 'Successor stewardship is not readable when readings are scoped to different institutions.',
    };
  }

  const successorReadinessBand =
    onboarding.survivabilityBand === 'not_yet_readable' && transfer.continuityCarriedBand === 'not_yet_readable'
      ? 'not_yet_readable'
      : weakest(onboarding.survivabilityBand, transfer.continuityCarriedBand);

  const signals: RuntimeContinuitySignal[] = [
    {
      contractVersion: RUNTIME_CONTRACT_VERSION,
      signalId: 'successor_stewardship:readiness',
      severity: successorReadinessBand === 'regressing' ? 'warning' : 'observation',
      category: 'successor_stewardship_readiness',
      statement: `Successor stewardship readiness presents as ${successorReadinessBand} on the available reading.`,
      evidence: {
        survivabilityBand: onboarding.survivabilityBand,
        continuityCarriedBand: transfer.continuityCarriedBand,
      },
    },
  ];
  signals.sort((a, b) => a.signalId.localeCompare(b.signalId));

  return {
    engineVersion: SUCCESSOR_STEWARDSHIP_RUNTIME_VERSION,
    institutionScope: onboarding.institutionScope,
    survivabilityBand: onboarding.survivabilityBand,
    continuityCarriedBand: transfer.continuityCarriedBand,
    successorReadinessBand,
    signals,
    statement:
      successorReadinessBand === 'not_yet_readable'
        ? 'Successor stewardship is not yet readable for this institution scope.'
        : `Successor stewardship readiness presents as ${successorReadinessBand}.`,
  };
}
