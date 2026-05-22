/**
 * ARTIFACT TYPE: Engine
 * MODULE: Governance Lineage
 * DOCTRINE_VERSION: 2.0.0
 *
 * Continuity Lineage Engine — reconstructs the institutional governance
 * lineage from named precedents and governance domains. Produces:
 *   - Precedent continuity mappings
 *   - Governance Interpretation Matrix™ cells
 *   - Institutional evolution arc
 *   - Lineage signals consumable by the workbook narrative
 *
 * Pure, deterministic.
 */

import {
  mapPrecedentContinuity,
  aggregateLineageHealth,
  type PrecedentInput,
  type PrecedentMapping,
} from './precedentContinuityMapper';
import {
  buildInterpretationMatrix,
  aggregateInterpretationDrift,
  type GovernanceDomainInput,
  type InterpretationCell,
} from './governanceInterpretationMatrix';
import {
  trackInstitutionalEvolution,
  type InstitutionalEvolutionResult,
} from './institutionalEvolutionTracker';

export interface ContinuityLineageInput {
  readonly workbookId: string;
  readonly precedents: readonly PrecedentInput[];
  readonly governanceDomains: readonly GovernanceDomainInput[];
}

export type LineageSignalSeverity = 'note' | 'observation' | 'warning' | 'critical';

export type LineageSignalCategory =
  | 'lapsed_precedent_concentration'
  | 'interpretation_divergence'
  | 'contradictory_governance_domain'
  | 'living_lineage_healthy'
  | 'founding_era_fading';

export interface LineageSignal {
  readonly signalId: string;
  readonly severity: LineageSignalSeverity;
  readonly category: LineageSignalCategory;
  readonly statement: string;
  readonly evidence: Readonly<Record<string, unknown>>;
}

export interface PrecedentSurvivabilityLayer {
  readonly total: number;
  readonly living: number;
  readonly observed: number;
  readonly fading: number;
  readonly lapsed: number;
  readonly livingShare: number;
}

export interface ContinuityLineageResult {
  readonly status: 'facilitated' | 'self-guided';
  readonly precedents: readonly PrecedentMapping[];
  readonly interpretationMatrix: readonly InterpretationCell[];
  readonly evolution: InstitutionalEvolutionResult;
  readonly survivability: PrecedentSurvivabilityLayer;
  readonly aggregateInterpretationDrift: number;
  readonly signals: readonly LineageSignal[];
  readonly preview: string;
}

export const ENGINE_VERSION = '2.0.0';

export function runContinuityLineage(
  input: ContinuityLineageInput,
): ContinuityLineageResult {
  const precedents = mapPrecedentContinuity(input.precedents);
  const interpretationMatrix = buildInterpretationMatrix(input.governanceDomains);
  const evolution = trackInstitutionalEvolution(precedents, interpretationMatrix);
  const survivability = aggregateLineageHealth(precedents);
  const aggregateDrift = aggregateInterpretationDrift(interpretationMatrix);

  const signals = synthesizeSignals(precedents, interpretationMatrix, survivability, aggregateDrift);
  const status: ContinuityLineageResult['status'] =
    input.precedents.length === 0 && input.governanceDomains.length === 0
      ? 'self-guided'
      : 'facilitated';

  return {
    status,
    precedents,
    interpretationMatrix,
    evolution,
    survivability,
    aggregateInterpretationDrift: aggregateDrift,
    signals,
    preview: buildPreview(survivability, evolution),
  };
}

function synthesizeSignals(
  precedents: readonly PrecedentMapping[],
  matrix: readonly InterpretationCell[],
  survivability: PrecedentSurvivabilityLayer,
  drift: number,
): readonly LineageSignal[] {
  const signals: LineageSignal[] = [];

  if (survivability.total > 0 && survivability.lapsed / survivability.total >= 0.3) {
    signals.push({
      signalId: 'lapsed_precedent_concentration',
      severity: survivability.lapsed / survivability.total >= 0.5 ? 'critical' : 'warning',
      category: 'lapsed_precedent_concentration',
      statement: `${survivability.lapsed} of ${survivability.total} precedents are no longer carried in practice.`,
      evidence: { lapsed: survivability.lapsed, total: survivability.total },
    });
  }

  if (drift >= 0.5) {
    signals.push({
      signalId: 'interpretation_divergence',
      severity: drift >= 0.7 ? 'warning' : 'observation',
      category: 'interpretation_divergence',
      statement: 'Interpretation of governance design diverges measurably from documented design.',
      evidence: { aggregateDrift: drift },
    });
  }

  const contradictory = matrix.filter((c) => c.alignment === 'contradictory');
  if (contradictory.length >= 1) {
    signals.push({
      signalId: 'contradictory_governance_domain',
      severity: contradictory.length >= 2 ? 'warning' : 'observation',
      category: 'contradictory_governance_domain',
      statement: `${contradictory.length} governance domain${contradictory.length === 1 ? '' : 's'} show${contradictory.length === 1 ? 's' : ''} contradictory interpretation.`,
      evidence: { domains: contradictory.map((c) => c.id) },
    });
  }

  const foundingFading = precedents.filter(
    (p) => p.era === 'founding' && (p.continuity === 'fading' || p.continuity === 'lapsed'),
  );
  if (foundingFading.length >= 1) {
    signals.push({
      signalId: 'founding_era_fading',
      severity: 'observation',
      category: 'founding_era_fading',
      statement: `${foundingFading.length} founding-era precedent${foundingFading.length === 1 ? '' : 's'} ${foundingFading.length === 1 ? 'is' : 'are'} no longer routinely carried in practice.`,
      evidence: { count: foundingFading.length },
    });
  }

  if (
    survivability.total > 0 &&
    survivability.livingShare >= 0.7 &&
    drift <= 0.25 &&
    contradictory.length === 0
  ) {
    signals.push({
      signalId: 'living_lineage_healthy',
      severity: 'note',
      category: 'living_lineage_healthy',
      statement: 'Governance lineage appears living, observed in practice, and broadly aligned with design.',
      evidence: { livingShare: survivability.livingShare, drift },
    });
  }

  return signals;
}

function buildPreview(
  survivability: PrecedentSurvivabilityLayer,
  evolution: InstitutionalEvolutionResult,
): string {
  if (survivability.total === 0) {
    return 'No governance precedents have been named yet — the lineage module will populate as precedents are surfaced.';
  }
  return evolution.reading;
}
