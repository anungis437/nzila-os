/**
 * ARTIFACT TYPE: Cross-Module Synthesis Engine
 * DOCTRINE_VERSION: 2.0.0
 *
 * Composes cross-module continuity signals + OCI operational profile
 * into a single workbook synthesis result. Pure, deterministic.
 */

import {
  deriveCrossModuleSignals,
  type CrossModuleAggregates,
  type CrossModuleSignal,
} from './crossModuleContinuitySignals';
import {
  composeOciOperationalProfile,
  type OciOperationalProfile,
  type OciOperationalProfileInput,
} from './ociOperationalProfile';

export const ENGINE_VERSION = '2.0.0';

export type WorkbookSynthesisStatus = 'facilitated' | 'self-guided';

export interface WorkbookSynthesisInput {
  readonly status: WorkbookSynthesisStatus;
  readonly aggregates: CrossModuleAggregates;
  readonly profileInput: OciOperationalProfileInput;
}

export interface WorkbookSynthesisResult {
  readonly status: WorkbookSynthesisStatus;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly crossModuleSignals: readonly CrossModuleSignal[];
  readonly profile: OciOperationalProfile;
  readonly preview: string;
}

export function runWorkbookSynthesis(
  input: WorkbookSynthesisInput,
): WorkbookSynthesisResult {
  const crossModuleSignals = deriveCrossModuleSignals(input.aggregates);
  const profile = composeOciOperationalProfile(input.profileInput);

  return {
    status: input.status,
    engineVersion: ENGINE_VERSION,
    crossModuleSignals,
    profile,
    preview: buildPreview(profile, crossModuleSignals),
  };
}

function buildPreview(
  profile: OciOperationalProfile,
  signals: readonly CrossModuleSignal[],
): string {
  const parts: string[] = [profile.reading];
  if (signals.length > 0) {
    parts.push(`${signals.length} cross-module continuity signals recorded.`);
  }
  return parts.join(' ');
}
