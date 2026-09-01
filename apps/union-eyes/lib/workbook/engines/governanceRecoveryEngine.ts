/**
 * ARTIFACT TYPE: Module Engine (Composition)
 * MODULE: Governance Survivability Recovery (Product 3 / Stabilization)
 * DOCTRINE_VERSION: 2.0.0
 *
 * Reads a Governance Survivability Recovery shape over the existing
 * continuity lineage engine (which itself composes the governance
 * interpretation matrix, the precedent continuity mapper, and the
 * institutional evolution tracker).
 *
 * Pure composition: emits a canonical signal envelope aligned to
 * OCI_STABILIZATION_SEVERITY_MODEL.md, holds the recovered material as
 * institutional record, and refuses to attribute fault to historical
 * tenure.
 *
 * Pure, deterministic. Tone: institutional, recognition-first,
 * governance-receivable, blame-free.
 *
 * Doctrine: docs/oci/superseded/stabilization/GOVERNANCE_SURVIVABILITY_RECOVERY.md
 * and docs/oci/superseded/stabilization/playbooks/GOVERNANCE_LINEAGE_RECOVERY.md.
 */

import {
  runContinuityLineage,
  type ContinuityLineageInput,
  type ContinuityLineageResult,
} from './continuityLineageEngine';

export const ENGINE_VERSION = '2.0.0';

export type GovernanceRecoveryStatus = 'facilitated' | 'self-guided';

export type GovernanceRecoverySignalCategory =
  | 'lapsed_precedent_recovery_required'
  | 'interpretation_drift_present'
  | 'living_lineage_carries_recovery'
  | 'no_lineage_surface'
  | 'governance_ratification_pending';

export type GovernanceRecoverySeverity =
  | 'note'
  | 'observation'
  | 'warning'
  | 'critical';

export interface GovernanceRecoverySignal {
  readonly signalId: string;
  readonly severity: GovernanceRecoverySeverity;
  readonly category: GovernanceRecoverySignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface GovernanceRecoveryInput {
  readonly status: GovernanceRecoveryStatus;
  readonly lineage: ContinuityLineageInput;
  /**
   * Whether the governance body has committed to ratifying the
   * recovered matrix at engagement close. The engine emits a
   * `governance_ratification_pending` signal when recovery material
   * is present without commitment to ratification.
   */
  readonly governanceRatificationCommitted: boolean;
}

export interface GovernanceRecoveryResult {
  readonly status: GovernanceRecoveryStatus;
  readonly engineVersion: typeof ENGINE_VERSION;
  readonly lineage: ContinuityLineageResult;
  readonly signals: readonly GovernanceRecoverySignal[];
  readonly preview: string;
}

const INTERPRETATION_DRIFT_THRESHOLD = 0.4;
const INTERPRETATION_DRIFT_CRITICAL = 0.7;
const LIVING_LINEAGE_HEALTHY_SHARE = 0.6;

export function runGovernanceRecovery(
  input: GovernanceRecoveryInput,
): GovernanceRecoveryResult {
  const lineage = runContinuityLineage(input.lineage);
  const signals = buildSignals(input, lineage);
  return {
    status: input.status,
    engineVersion: ENGINE_VERSION,
    lineage,
    signals,
    preview: buildPreview(lineage, signals),
  };
}

function buildSignals(
  input: GovernanceRecoveryInput,
  lineage: ContinuityLineageResult,
): readonly GovernanceRecoverySignal[] {
  const out: GovernanceRecoverySignal[] = [];

  const hasLineageSurface =
    lineage.precedents.length > 0 || lineage.interpretationMatrix.length > 0;

  if (!hasLineageSurface) {
    out.push({
      signalId: 'recovery_no_lineage_surface',
      severity: 'note',
      category: 'no_lineage_surface',
      statement:
        'No lineage surface is yet present; recognition continuation under Product 1 or Product 2 deepening is the institutionally honest next step.',
      evidence: {},
    });
    return out;
  }

  const lapsedCount = lineage.survivability.lapsed;
  if (lapsedCount >= 1) {
    out.push({
      signalId: 'recovery_lapsed_precedent_recovery_required',
      severity: lapsedCount >= 3 ? 'critical' : 'warning',
      category: 'lapsed_precedent_recovery_required',
      statement:
        'Lapsed precedents are present; reconstruct interpretation through secondary sources while institutional memory remains accessible.',
      evidence: {
        lapsedCount,
        totalPrecedents: lineage.survivability.total,
      },
    });
  }

  const drift = lineage.aggregateInterpretationDrift;
  if (drift >= INTERPRETATION_DRIFT_THRESHOLD) {
    out.push({
      signalId: 'recovery_interpretation_drift_present',
      severity: drift >= INTERPRETATION_DRIFT_CRITICAL ? 'critical' : 'warning',
      category: 'interpretation_drift_present',
      statement:
        'Interpretation drift across governance domains is present; codify a governance-receivable interpretation matrix and bring it to ratification.',
      evidence: { aggregateInterpretationDrift: drift },
    });
  }

  if (
    lineage.survivability.total > 0 &&
    lineage.survivability.livingShare >= LIVING_LINEAGE_HEALTHY_SHARE
  ) {
    out.push({
      signalId: 'recovery_living_lineage_carries_recovery',
      severity: 'note',
      category: 'living_lineage_carries_recovery',
      statement:
        'Living lineage carries a majority share; recovery work is positioned to consolidate the existing record rather than reconstruct from absence.',
      evidence: { livingShare: lineage.survivability.livingShare },
    });
  }

  if (!input.governanceRatificationCommitted) {
    out.push({
      signalId: 'recovery_governance_ratification_pending',
      severity: 'warning',
      category: 'governance_ratification_pending',
      statement:
        'Recovery material is present without governance-body commitment to ratification; defer codification until the governance body commits or close the recovery as a Product 2 deepening.',
      evidence: {
        precedentCount: lineage.precedents.length,
        interpretationCells: lineage.interpretationMatrix.length,
      },
    });
  }

  return out;
}

function buildPreview(
  lineage: ContinuityLineageResult,
  signals: readonly GovernanceRecoverySignal[],
): string {
  if (
    lineage.precedents.length === 0 &&
    lineage.interpretationMatrix.length === 0
  ) {
    return 'No lineage surface is yet present; recognition continuation is the institutionally honest next step.';
  }
  const parts: string[] = [
    `Lineage surface: ${lineage.survivability.total} precedents across ${lineage.interpretationMatrix.length} interpretation cells.`,
    `Survivability share: living ${lineage.survivability.living}, observed ${lineage.survivability.observed}, fading ${lineage.survivability.fading}, lapsed ${lineage.survivability.lapsed}.`,
  ];
  if (signals.length > 0) {
    parts.push(`${signals.length} recovery signals recorded.`);
  }
  return parts.join(' ');
}
