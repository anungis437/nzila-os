/**
 * ARTIFACT TYPE: Engine
 * MODULE: Governance Entropy
 * DOCTRINE_VERSION: 2.0.0
 *
 * Governance Entropy Engine — classifies governance drift between design
 * and practice across the workbook's named governance domains. Composes
 * the Governance Entropy Scale™ with per-domain attribution.
 *
 * Pure, deterministic.
 */

import {
  classifyEntropy,
  type EntropyLevel,
  type EntropyLevelId,
} from '../../oci/frameworks/governance-entropy-scale';
import type { InterpretationCell } from './governanceInterpretationMatrix';

export interface GovernanceEntropyInput {
  readonly workbookId: string;
  /** Optional scalar 0–1 drift estimate; used when no per-domain matrix supplied. */
  readonly driftEstimate?: number;
  readonly interpretationMatrix?: readonly InterpretationCell[];
}

export interface DomainEntropyAttribution {
  readonly domainId: string;
  readonly label: string;
  readonly drift: number;
  readonly level: EntropyLevel;
}

export interface GovernanceEntropyResult {
  readonly status: 'facilitated' | 'self-guided';
  readonly aggregateDrift: number;
  readonly level: EntropyLevel;
  readonly attribution: readonly DomainEntropyAttribution[];
  readonly distribution: Readonly<Record<EntropyLevelId, number>>;
  readonly reading: string;
}

export const ENGINE_VERSION = '2.0.0';

export function runGovernanceEntropy(
  input: GovernanceEntropyInput,
): GovernanceEntropyResult {
  const matrix = input.interpretationMatrix ?? [];
  const aggregateDrift =
    matrix.length === 0
      ? Math.max(0, Math.min(1, input.driftEstimate ?? 0))
      : round2(matrix.reduce((a, c) => a + c.drift, 0) / matrix.length);

  const level = classifyEntropy(aggregateDrift);
  const attribution: DomainEntropyAttribution[] = matrix.map((c) => ({
    domainId: c.id,
    label: c.label,
    drift: c.drift,
    level: classifyEntropy(c.drift),
  }));

  const distribution: Record<EntropyLevelId, number> = {
    coherent: 0,
    recognised_drift: 0,
    patterned_drift: 0,
    institutional_drift: 0,
    systemic_entropy: 0,
  };
  for (const a of attribution) {
    distribution[a.level.id] += 1;
  }

  const status: GovernanceEntropyResult['status'] = matrix.length > 0 ? 'facilitated' : 'self-guided';

  return {
    status,
    aggregateDrift,
    level,
    attribution,
    distribution,
    reading: buildReading(level, attribution),
  };
}

function buildReading(
  level: EntropyLevel,
  attribution: readonly DomainEntropyAttribution[],
): string {
  const worst = [...attribution].sort((a, b) => b.drift - a.drift)[0];
  if (!worst) return level.posture;
  return `${level.posture} The most acute drift is observed in ${worst.label.toLowerCase()}.`;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
