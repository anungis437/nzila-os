/**
 * ARTIFACT TYPE: Intelligence Engine
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * OCI Intelligence Network™ engine.
 *
 * The engine sits between contributing institutions and the longitudinal
 * intelligence layer. Every ingest call passes through the participation
 * registry; every aggregation call passes through the ethics validators.
 *
 * Posture:
 *   - Opt-in only. The engine refuses records whose handles are not in the
 *     registry for the requested scope.
 *   - K-anonymous. Aggregation envelopes below the floor are refusal envelopes.
 *   - Anti-surveillance. The engine never emits institution-level intelligence.
 *     Per-institution reads remain inside the contributing institution.
 *   - Reviewer-led. Every accepted record carries the reviewer reference that
 *     authored the underlying institutional reading.
 */

import type {
  ContinuityDebtEvolutionRecord,
  ContinuityTrajectoryRecord,
  GovernanceEntropyDriftRecord,
  IntelligenceSector,
  SectorBaselineEnvelope,
  StewardshipEvolutionRecord,
  SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';
import {
  checkAnonymisationIntegrity,
  checkParticipation,
  checkReviewerReference,
  type EthicsRejectionReason,
} from '../ethics/intelligenceEthicsValidators';
import {
  composeSectorBaseline,
  type AggregationInputs,
} from './networkAggregationModel';
import type { ContinuityIntelligenceRegistry } from './continuityIntelligenceRegistry';

export const INTELLIGENCE_NETWORK_VERSION = '1.0.0' as const;

export interface IngestRejection {
  readonly recordId: string;
  readonly reasons: ReadonlyArray<EthicsRejectionReason>;
}

export interface IngestResult<T> {
  readonly accepted: ReadonlyArray<T>;
  readonly rejections: ReadonlyArray<IngestRejection>;
}

export interface IntelligenceNetworkEngine {
  ingestTrajectories(
    records: ReadonlyArray<ContinuityTrajectoryRecord>,
  ): IngestResult<ContinuityTrajectoryRecord>;
  ingestDrifts(
    records: ReadonlyArray<GovernanceEntropyDriftRecord>,
  ): IngestResult<GovernanceEntropyDriftRecord>;
  ingestStewardships(
    records: ReadonlyArray<StewardshipEvolutionRecord>,
  ): IngestResult<StewardshipEvolutionRecord>;
  ingestSurvivabilities(
    records: ReadonlyArray<SurvivabilityProgressionRecord>,
  ): IngestResult<SurvivabilityProgressionRecord>;
  ingestDebts(
    records: ReadonlyArray<ContinuityDebtEvolutionRecord>,
  ): IngestResult<ContinuityDebtEvolutionRecord>;

  composeBaseline(
    sector: IntelligenceSector,
    baselineId: string,
    composedAt: string,
  ): SectorBaselineEnvelope;
}

interface EngineState {
  trajectories: ContinuityTrajectoryRecord[];
  drifts: GovernanceEntropyDriftRecord[];
  stewardships: StewardshipEvolutionRecord[];
  survivabilities: SurvivabilityProgressionRecord[];
  debts: ContinuityDebtEvolutionRecord[];
}

function validateCommon(
  registry: ContinuityIntelligenceRegistry,
  recordId: string,
  scope:
    | 'continuity_trajectory'
    | 'governance_drift'
    | 'stewardship_evolution'
    | 'survivability_progression'
    | 'continuity_debt',
  handle: ContinuityTrajectoryRecord['handle'],
  reviewerRefId: string,
): IngestRejection | null {
  const reasons: EthicsRejectionReason[] = [];

  const anon = checkAnonymisationIntegrity(handle);
  if (!anon.readable) reasons.push(...anon.reasons);

  const grants = registry.listActiveGrants();
  const participation = checkParticipation(
    grants,
    handle.institutionRefHash,
    scope,
  );
  if (!participation.readable) reasons.push(...participation.reasons);

  const reviewer = checkReviewerReference(reviewerRefId);
  if (!reviewer.readable) reasons.push(...reviewer.reasons);

  if (reasons.length === 0) return null;
  return { recordId, reasons };
}

export function createIntelligenceNetworkEngine(
  registry: ContinuityIntelligenceRegistry,
): IntelligenceNetworkEngine {
  const state: EngineState = {
    trajectories: [],
    drifts: [],
    stewardships: [],
    survivabilities: [],
    debts: [],
  };

  return {
    ingestTrajectories(records) {
      const accepted: ContinuityTrajectoryRecord[] = [];
      const rejections: IngestRejection[] = [];
      for (const record of records) {
        const rejection = validateCommon(
          registry,
          record.trajectoryId,
          'continuity_trajectory',
          record.handle,
          record.reviewerRefId,
        );
        if (rejection) {
          rejections.push(rejection);
          continue;
        }
        accepted.push(record);
        state.trajectories.push(record);
      }
      return { accepted, rejections };
    },

    ingestDrifts(records) {
      const accepted: GovernanceEntropyDriftRecord[] = [];
      const rejections: IngestRejection[] = [];
      for (const record of records) {
        const rejection = validateCommon(
          registry,
          record.driftId,
          'governance_drift',
          record.handle,
          record.reviewerRefId,
        );
        if (rejection) {
          rejections.push(rejection);
          continue;
        }
        accepted.push(record);
        state.drifts.push(record);
      }
      return { accepted, rejections };
    },

    ingestStewardships(records) {
      const accepted: StewardshipEvolutionRecord[] = [];
      const rejections: IngestRejection[] = [];
      for (const record of records) {
        const rejection = validateCommon(
          registry,
          record.evolutionId,
          'stewardship_evolution',
          record.handle,
          record.reviewerRefId,
        );
        if (rejection) {
          rejections.push(rejection);
          continue;
        }
        accepted.push(record);
        state.stewardships.push(record);
      }
      return { accepted, rejections };
    },

    ingestSurvivabilities(records) {
      const accepted: SurvivabilityProgressionRecord[] = [];
      const rejections: IngestRejection[] = [];
      for (const record of records) {
        const rejection = validateCommon(
          registry,
          record.progressionId,
          'survivability_progression',
          record.handle,
          record.reviewerRefId,
        );
        if (rejection) {
          rejections.push(rejection);
          continue;
        }
        accepted.push(record);
        state.survivabilities.push(record);
      }
      return { accepted, rejections };
    },

    ingestDebts(records) {
      const accepted: ContinuityDebtEvolutionRecord[] = [];
      const rejections: IngestRejection[] = [];
      for (const record of records) {
        const rejection = validateCommon(
          registry,
          record.debtId,
          'continuity_debt',
          record.handle,
          record.reviewerRefId,
        );
        if (rejection) {
          rejections.push(rejection);
          continue;
        }
        accepted.push(record);
        state.debts.push(record);
      }
      return { accepted, rejections };
    },

    composeBaseline(sector, baselineId, composedAt) {
      const inputs: AggregationInputs = {
        trajectories: state.trajectories,
        drifts: state.drifts,
        stewardships: state.stewardships,
        survivabilities: state.survivabilities,
        debts: state.debts,
      };
      return composeSectorBaseline(sector, baselineId, composedAt, inputs);
    },
  };
}
