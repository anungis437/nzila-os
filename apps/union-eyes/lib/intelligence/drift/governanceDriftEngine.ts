/**
 * ARTIFACT TYPE: Drift Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Governance Entropy Drift™ engine.
 *
 * Composes a reviewer-readable drift reading for a single institution from
 * its drift records and reviewer-attached destabilisation signals.
 *
 * Posture:
 *   - Reviewer-led. Destabilisation signals are reviewer-authored, not inferred.
 *   - Refusal-first. The engine returns `not_yet_readable` when records are
 *     insufficient. It never invents drift.
 *   - Deterministic. Signals are sorted by `signalId` before being returned.
 */

import type {
  GovernanceDriftBand,
  GovernanceEntropyDriftRecord,
} from '../contracts/intelligenceContracts';
import {
  isKnownDestabilizationSignal,
  type ContinuityDestabilizationSignal,
} from './continuityDestabilizationSignals';
import { readEntropyTrajectory } from './entropyTrajectoryModel';

export const GOVERNANCE_DRIFT_ENGINE_VERSION = '1.0.0' as const;

export interface GovernanceDriftReading {
  readonly institutionRefHash: string;
  readonly band: GovernanceDriftBand;
  readonly basedOn: number;
  readonly signals: ReadonlyArray<ContinuityDestabilizationSignal>;
}

export interface GovernanceDriftInputs {
  readonly institutionRefHash: string;
  readonly drifts: ReadonlyArray<GovernanceEntropyDriftRecord>;
  readonly destabilizationSignals: ReadonlyArray<ContinuityDestabilizationSignal>;
}

export function readGovernanceDrift(
  inputs: GovernanceDriftInputs,
): GovernanceDriftReading {
  const trajectory = readEntropyTrajectory(
    inputs.institutionRefHash,
    inputs.drifts,
  );
  // Only retain reviewer signals with a known kind; refuse unknown kinds rather
  // than coerce them into the reading.
  const acceptedSignals = inputs.destabilizationSignals
    .filter((s) => isKnownDestabilizationSignal(s.kind))
    .filter((s) => s.reviewerRefId.trim().length > 0)
    .sort((a, b) => a.signalId.localeCompare(b.signalId));
  return {
    institutionRefHash: inputs.institutionRefHash,
    band: trajectory.band,
    basedOn: trajectory.basedOn,
    signals: acceptedSignals,
  };
}
