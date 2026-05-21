/**
 * ARTIFACT TYPE: Vitest Suite
 * MODULE: OCI Intelligence Network
 * DOCTRINE_VERSION: 1.0.0
 *
 * Comprehensive Product 5 vitest coverage.
 *
 * Covers ethics floors, anonymisation invariants, k-anonymity, longitudinal
 * coherence, trajectory integrity, refusal-first paths, sector baselines,
 * cross-institution patterns, reporting tone discipline, and determinism.
 */

import { describe, expect, it } from 'vitest';

import {
  INTELLIGENCE_CONTRACT_VERSION,
  type AnonymisedInstitutionHandle,
  type ContinuityDebtEvolutionRecord,
  type ContinuityTrajectoryRecord,
  type GovernanceEntropyDriftRecord,
  type IntelligenceParticipationGrant,
  type StewardshipEvolutionRecord,
  type SurvivabilityProgressionRecord,
} from '../contracts/intelligenceContracts';

import {
  K_ANONYMITY_FLOOR,
  checkAgainstRanking,
  checkAnonymisationIntegrity,
  checkKAnonymity,
  checkParticipation,
  checkReviewerReference,
  checkSectorCoherence,
  validateSectorBaseline,
} from '../ethics/intelligenceEthicsValidators';

import { createContinuityIntelligenceRegistry } from '../network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../network/intelligenceNetworkEngine';
import { composeSectorBaseline } from '../network/networkAggregationModel';

import { composeContinuityEvolutionTimeline } from '../longitudinal/continuityEvolutionTimeline';
import { readResilienceTrajectory } from '../longitudinal/resilienceTrajectoryEngine';
import { readLongitudinalContinuity } from '../longitudinal/longitudinalContinuityEngine';

import { readGovernanceDrift } from '../drift/governanceDriftEngine';
import { readEntropyTrajectory } from '../drift/entropyTrajectoryModel';
import {
  CONTINUITY_DESTABILIZATION_SIGNAL_KINDS,
  isKnownDestabilizationSignal,
} from '../drift/continuityDestabilizationSignals';

import { readContinuityPersistence } from '../resilience/continuityPersistenceModel';
import { readSurvivabilityTrajectory } from '../resilience/survivabilityTrajectoryEngine';
import { readInstitutionalResilience } from '../resilience/institutionalResilienceModel';

import {
  getSectorContinuityProfile,
  listSectorContinuityProfiles,
} from '../sector/sectorContinuityProfiles';
import { readSectorArchetype } from '../sector/sectorArchetypeModel';
import { readSectorBaseline } from '../sector/sectorBaselineEngine';

import { readDependencyRecurrence } from '../stewardship/dependencyRecurrenceModel';
import { readRedistributionDurability } from '../stewardship/continuityRedistributionIntelligence';
import { readStewardshipEvolution } from '../stewardship/stewardshipEvolutionEngine';

import {
  listContinuityPatterns,
  type ContinuityPatternKind,
} from '../cross-institution/continuityPatternRegistry';
import { readCrossInstitutionPatterns } from '../cross-institution/crossInstitutionIntelligence';

import { composeInstitutionalTrajectoryNarrative } from '../reporting/institutionalTrajectoryNarrative';
import { composeContinuityEvolutionReport } from '../reporting/continuityEvolutionReporting';

// ─────────────────────────────────────────────────────────────────────────────
// Tone discipline assertion
// ─────────────────────────────────────────────────────────────────────────────

const FORBIDDEN_TONE =
  /\b(optimize|optimise|optimization|optimisation|productivity|autonomous|disrupt|automation|automate|ai-led|ai-driven|ai-powered|demo|modules available|all-in-one|frictionless|seamless|behavioural analytics|behavioral analytics|scoring|rip and replace)\b/i;

const BLAME_TONE = /why do you (not|fail to|never)/i;

function assertToneDiscipline(text: string): void {
  expect(text).not.toMatch(FORBIDDEN_TONE);
  expect(text).not.toMatch(BLAME_TONE);
}

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const REVIEWER = 'reviewer:001';

function handle(
  hashSuffix: string,
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
  contributedAt = '2026-01-01T00:00:00.000Z',
): AnonymisedInstitutionHandle {
  return {
    institutionRefHash: `hash_${hashSuffix.padEnd(8, '0')}`,
    sector,
    contributedAt,
  };
}

function trajectory(
  hashSuffix: string,
  observedAt: string,
  band: ContinuityTrajectoryRecord['band'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): ContinuityTrajectoryRecord {
  return {
    trajectoryId: `traj:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    band,
    reviewerRefId: REVIEWER,
  };
}

function drift(
  hashSuffix: string,
  observedAt: string,
  driftBand: GovernanceEntropyDriftRecord['drift'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): GovernanceEntropyDriftRecord {
  return {
    driftId: `drift:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    drift: driftBand,
    reviewerRefId: REVIEWER,
  };
}

function stewardship(
  hashSuffix: string,
  observedAt: string,
  evolution: StewardshipEvolutionRecord['evolution'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): StewardshipEvolutionRecord {
  return {
    evolutionId: `stew:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    evolution,
    reviewerRefId: REVIEWER,
  };
}

function survivability(
  hashSuffix: string,
  observedAt: string,
  progression: SurvivabilityProgressionRecord['progression'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): SurvivabilityProgressionRecord {
  return {
    progressionId: `surv:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    progression,
    reviewerRefId: REVIEWER,
  };
}

function debt(
  hashSuffix: string,
  observedAt: string,
  trend: ContinuityDebtEvolutionRecord['trend'],
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): ContinuityDebtEvolutionRecord {
  return {
    debtId: `debt:${hashSuffix}:${observedAt}`,
    handle: handle(hashSuffix, sector),
    observedAt,
    trend,
    reviewerRefId: REVIEWER,
  };
}

function grantAll(
  hashSuffix: string,
  sector: AnonymisedInstitutionHandle['sector'] = 'labour_union',
): IntelligenceParticipationGrant {
  return {
    institutionRefHash: handle(hashSuffix).institutionRefHash,
    sector,
    grantedScopes: [
      'continuity_trajectory',
      'governance_drift',
      'stewardship_evolution',
      'survivability_progression',
      'continuity_debt',
    ],
    grantedAt: '2026-01-01T00:00:00.000Z',
    reviewerRefId: REVIEWER,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Versions
// ─────────────────────────────────────────────────────────────────────────────

describe('Product 5 — version stamps', () => {
  it('intelligence contract version is 1.0.0', () => {
    expect(INTELLIGENCE_CONTRACT_VERSION).toBe('1.0.0');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Ethics validators
// ─────────────────────────────────────────────────────────────────────────────

describe('intelligence ethics validators', () => {
  it('refuses cohorts below the k-anonymity floor', () => {
    const v = checkKAnonymity(K_ANONYMITY_FLOOR - 1);
    expect(v.readable).toBe(false);
    expect(v.reasons).toContain('cohort_below_k_anonymity_floor');
  });

  it('accepts cohorts at and above the floor', () => {
    expect(checkKAnonymity(K_ANONYMITY_FLOOR).readable).toBe(true);
    expect(checkKAnonymity(K_ANONYMITY_FLOOR + 1).readable).toBe(true);
  });

  it('refuses participation when no grant exists', () => {
    const v = checkParticipation([], 'hash_unknown', 'continuity_trajectory');
    expect(v.readable).toBe(false);
    expect(v.reasons).toContain('institution_not_opted_in');
  });

  it('refuses participation when scope not granted', () => {
    const grant = grantAll('a');
    const partialGrant: IntelligenceParticipationGrant = {
      ...grant,
      grantedScopes: ['governance_drift'],
    };
    const v = checkParticipation(
      [partialGrant],
      grant.institutionRefHash,
      'continuity_trajectory',
    );
    expect(v.readable).toBe(false);
    expect(v.reasons).toContain('scope_not_granted');
  });

  it('refuses handles carrying additional keys', () => {
    const malformed = {
      ...handle('a'),
      institutionName: 'should-not-be-here',
    } as AnonymisedInstitutionHandle;
    const v = checkAnonymisationIntegrity(malformed);
    expect(v.readable).toBe(false);
    expect(v.reasons).toContain('institution_handle_exposed');
  });

  it('refuses ranking payloads', () => {
    const v = checkAgainstRanking({ rank: 1, sector: 'labour_union' });
    expect(v.readable).toBe(false);
    expect(v.reasons).toContain('ranking_payload_detected');
  });

  it('refuses missing reviewer reference', () => {
    expect(checkReviewerReference('').readable).toBe(false);
    expect(checkReviewerReference(undefined).readable).toBe(false);
    expect(checkReviewerReference(REVIEWER).readable).toBe(true);
  });

  it('refuses sector mismatch', () => {
    const v = checkSectorCoherence('labour_union', ['labour_union', 'healthcare']);
    expect(v.readable).toBe(false);
    expect(v.reasons).toContain('sector_mismatch');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

describe('continuity intelligence registry', () => {
  it('honours opt-in grants', () => {
    const r = createContinuityIntelligenceRegistry();
    r.grant(grantAll('a'));
    expect(r.isOptedIn('hash_a0000000', 'continuity_trajectory')).toBe(true);
  });

  it('refuses unknown institutions', () => {
    const r = createContinuityIntelligenceRegistry();
    expect(r.isOptedIn('hash_unknown', 'continuity_trajectory')).toBe(false);
  });

  it('removes institution on withdrawal', () => {
    const r = createContinuityIntelligenceRegistry();
    r.grant(grantAll('a'));
    r.withdraw({
      institutionRefHash: 'hash_a0000000',
      withdrawnAt: '2026-06-01T00:00:00.000Z',
      reviewerRefId: REVIEWER,
    });
    expect(r.isOptedIn('hash_a0000000', 'continuity_trajectory')).toBe(false);
    expect(r.listActiveGrants()).toHaveLength(0);
  });

  it('returns active grants sorted by institutionRefHash', () => {
    const r = createContinuityIntelligenceRegistry();
    r.grant(grantAll('c'));
    r.grant(grantAll('a'));
    r.grant(grantAll('b'));
    const hashes = r.listActiveGrants().map((g) => g.institutionRefHash);
    expect(hashes).toEqual([...hashes].sort());
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Aggregation
// ─────────────────────────────────────────────────────────────────────────────

describe('network aggregation model', () => {
  it('returns refusal envelope when cohort below k-anonymity floor', () => {
    const env = composeSectorBaseline('labour_union', 'b1', '2026-01-01T00:00:00.000Z', {
      trajectories: [trajectory('a', '2026-01-01T00:00:00.000Z', 'holding')],
      drifts: [],
      stewardships: [],
      survivabilities: [],
      debts: [],
    });
    expect(env.readable).toBe(false);
    expect(env.contributingInstitutions).toBeLessThan(K_ANONYMITY_FLOOR);
  });

  it('composes a readable envelope at the floor', () => {
    const trajectories = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
    );
    const env = composeSectorBaseline(
      'labour_union',
      'b2',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    expect(env.readable).toBe(true);
    expect(env.contributingInstitutions).toBe(K_ANONYMITY_FLOOR);
    expect(env.trajectoryDistribution.holding).toBe(5);
  });

  it('filters cross-sector pollution out of the cohort', () => {
    const trajectories = [
      trajectory('a', '2026-01-01T00:00:00.000Z', 'holding', 'labour_union'),
      trajectory('b', '2026-01-02T00:00:00.000Z', 'holding', 'labour_union'),
      trajectory('c', '2026-01-03T00:00:00.000Z', 'holding', 'healthcare'),
      trajectory('d', '2026-01-04T00:00:00.000Z', 'holding', 'healthcare'),
    ];
    const env = composeSectorBaseline(
      'labour_union',
      'b3',
      '2026-01-05T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    expect(env.contributingInstitutions).toBe(2);
    expect(env.readable).toBe(false);
  });

  it('passes the ethics ranking scan', () => {
    const env = composeSectorBaseline(
      'labour_union',
      'b4',
      '2026-01-01T00:00:00.000Z',
      {
        trajectories: ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
          trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
        ),
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const verdict = validateSectorBaseline(env);
    expect(verdict.readable).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Network engine
// ─────────────────────────────────────────────────────────────────────────────

describe('intelligence network engine', () => {
  it('refuses records without a participation grant', () => {
    const r = createContinuityIntelligenceRegistry();
    const engine = createIntelligenceNetworkEngine(r);
    const result = engine.ingestTrajectories([
      trajectory('z', '2026-01-01T00:00:00.000Z', 'holding'),
    ]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]!.reasons).toContain('institution_not_opted_in');
  });

  it('refuses records with malformed handles', () => {
    const r = createContinuityIntelligenceRegistry();
    r.grant(grantAll('a'));
    const engine = createIntelligenceNetworkEngine(r);
    const malformed: ContinuityTrajectoryRecord = {
      ...trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
      handle: { ...handle('a'), institutionName: 'x' } as AnonymisedInstitutionHandle,
    };
    const result = engine.ingestTrajectories([malformed]);
    expect(result.rejections).toHaveLength(1);
  });

  it('refuses records missing a reviewer reference', () => {
    const r = createContinuityIntelligenceRegistry();
    r.grant(grantAll('a'));
    const engine = createIntelligenceNetworkEngine(r);
    const record: ContinuityTrajectoryRecord = {
      ...trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
      reviewerRefId: '',
    };
    const result = engine.ingestTrajectories([record]);
    expect(result.rejections).toHaveLength(1);
  });

  it('accepts compliant records and composes a readable baseline at the floor', () => {
    const r = createContinuityIntelligenceRegistry();
    ['a', 'b', 'c', 'd', 'e'].forEach((h) => r.grant(grantAll(h)));
    const engine = createIntelligenceNetworkEngine(r);
    const result = engine.ingestTrajectories(
      ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
        trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
      ),
    );
    expect(result.rejections).toHaveLength(0);
    const env = engine.composeBaseline('labour_union', 'b5', '2026-01-06T00:00:00.000Z');
    expect(env.readable).toBe(true);
    expect(env.contributingInstitutions).toBe(K_ANONYMITY_FLOOR);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Longitudinal engine
// ─────────────────────────────────────────────────────────────────────────────

describe('longitudinal continuity engine', () => {
  it('composes a sorted, readable timeline', () => {
    const t = composeContinuityEvolutionTimeline('hash_a0000000', [
      trajectory('a', '2026-03-01T00:00:00.000Z', 'stabilizing'),
      trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
      trajectory('a', '2026-02-01T00:00:00.000Z', 'holding'),
    ]);
    expect(t.readable).toBe(true);
    expect(t.points.map((p) => p.observedAt)).toEqual([
      '2026-01-01T00:00:00.000Z',
      '2026-02-01T00:00:00.000Z',
      '2026-03-01T00:00:00.000Z',
    ]);
  });

  it('returns a refusal timeline when no readings exist', () => {
    const t = composeContinuityEvolutionTimeline('hash_a0000000', []);
    expect(t.readable).toBe(false);
    expect(t.points).toHaveLength(0);
  });

  it('refuses resilience trajectory with fewer than 2 readings', () => {
    const t = composeContinuityEvolutionTimeline('hash_a0000000', [
      trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
    ]);
    const r = readResilienceTrajectory(t);
    expect(r.band).toBe('not_yet_readable');
  });

  it('reads resilience as persisting when window stays positive', () => {
    const t = composeContinuityEvolutionTimeline('hash_a0000000', [
      trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
      trajectory('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
      trajectory('a', '2026-03-01T00:00:00.000Z', 'holding'),
    ]);
    const r = readResilienceTrajectory(t);
    expect(r.band).toBe('persisting');
  });

  it('reads resilience as eroding when the last reading regresses', () => {
    const t = composeContinuityEvolutionTimeline('hash_a0000000', [
      trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
      trajectory('a', '2026-02-01T00:00:00.000Z', 'regressing'),
    ]);
    const r = readResilienceTrajectory(t);
    expect(r.band).toBe('eroding');
  });

  it('composes a longitudinal reading across all eight domains', () => {
    const reading = readLongitudinalContinuity({
      institutionRefHash: 'hash_a0000000',
      trajectories: [
        trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
        trajectory('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
      ],
      drifts: [
        drift('a', '2026-01-01T00:00:00.000Z', 'holding'),
        drift('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
      ],
      stewardships: [
        stewardship('a', '2026-01-01T00:00:00.000Z', 'holding'),
        stewardship('a', '2026-02-01T00:00:00.000Z', 'redistributing'),
      ],
      survivabilities: [
        survivability('a', '2026-01-01T00:00:00.000Z', 'holding'),
        survivability('a', '2026-02-01T00:00:00.000Z', 'strengthening'),
      ],
      debts: [
        debt('a', '2026-01-01T00:00:00.000Z', 'holding'),
        debt('a', '2026-02-01T00:00:00.000Z', 'reducing'),
      ],
    });
    expect(reading.maturityEvolution).toBe('stabilizing');
    expect(reading.governanceDrift).toBe('stabilizing');
    expect(reading.stewardshipEvolution).toBe('redistributing');
    expect(reading.onboardingSurvivability).toBe('strengthening');
    expect(reading.continuityDebtTrend).toBe('reducing');
    expect(reading.resilienceTrajectory.band).toBe('persisting');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Drift engine
// ─────────────────────────────────────────────────────────────────────────────

describe('governance drift engine', () => {
  it('refuses entropy trajectory with only one meaningful reading', () => {
    const t = readEntropyTrajectory('hash_a0000000', [
      drift('a', '2026-01-01T00:00:00.000Z', 'holding'),
      drift('a', '2026-02-01T00:00:00.000Z', 'not_yet_readable'),
    ]);
    expect(t.band).toBe('not_yet_readable');
  });

  it('reads stabilizing when the last band improves over the first', () => {
    const t = readEntropyTrajectory('hash_a0000000', [
      drift('a', '2026-01-01T00:00:00.000Z', 'holding'),
      drift('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
    ]);
    expect(t.band).toBe('stabilizing');
  });

  it('reads regressing when the last band regresses', () => {
    const t = readEntropyTrajectory('hash_a0000000', [
      drift('a', '2026-01-01T00:00:00.000Z', 'stabilizing'),
      drift('a', '2026-02-01T00:00:00.000Z', 'regressing'),
    ]);
    expect(t.band).toBe('regressing');
  });

  it('accepts only known destabilisation signal kinds and sorts deterministically', () => {
    for (const kind of CONTINUITY_DESTABILIZATION_SIGNAL_KINDS) {
      expect(isKnownDestabilizationSignal(kind)).toBe(true);
    }
    expect(isKnownDestabilizationSignal('unknown_kind')).toBe(false);
    const reading = readGovernanceDrift({
      institutionRefHash: 'hash_a0000000',
      drifts: [
        drift('a', '2026-01-01T00:00:00.000Z', 'holding'),
        drift('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
      ],
      destabilizationSignals: [
        {
          signalId: 'sig:b',
          kind: 'fragmentation_evolution',
          observedAt: '2026-01-01T00:00:00.000Z',
          reviewerRefId: REVIEWER,
          note: '',
        },
        {
          signalId: 'sig:a',
          kind: 'onboarding_deterioration',
          observedAt: '2026-01-02T00:00:00.000Z',
          reviewerRefId: REVIEWER,
          note: '',
        },
      ],
    });
    expect(reading.signals.map((s) => s.signalId)).toEqual(['sig:a', 'sig:b']);
    expect(reading.band).toBe('stabilizing');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Resilience layer
// ─────────────────────────────────────────────────────────────────────────────

describe('resilience layer', () => {
  it('persists when window stays positive', () => {
    expect(readContinuityPersistence(['holding', 'stabilizing']).band).toBe(
      'persisting',
    );
  });

  it('erodes when last reading is regressing', () => {
    expect(readContinuityPersistence(['holding', 'regressing']).band).toBe('eroding');
  });

  it('refuses persistence with insufficient meaningful readings', () => {
    expect(readContinuityPersistence(['not_yet_readable', 'holding']).band).toBe(
      'not_yet_readable',
    );
  });

  it('reads survivability trajectory as strengthening when window improves', () => {
    const t = readSurvivabilityTrajectory('hash_a0000000', [
      survivability('a', '2026-01-01T00:00:00.000Z', 'holding'),
      survivability('a', '2026-02-01T00:00:00.000Z', 'strengthening'),
    ]);
    expect(t.band).toBe('strengthening');
  });

  it('refuses institutional resilience with insufficient readable capabilities', () => {
    const r = readInstitutionalResilience({
      institutionRefHash: 'hash_a0000000',
      capabilities: {
        continuityStabilizationPersistence: 'not_yet_readable',
        governanceRecoverySustainability: 'not_yet_readable',
        onboardingSurvivabilityDurability: 'not_yet_readable',
        stewardshipRedistributionDurability: 'not_yet_readable',
        modernizationContinuityRetention: 'not_yet_readable',
        institutionalCoherenceResilience: 'holding',
      },
      reviewerSignals: [],
    });
    expect(r.band).toBe('not_yet_readable');
  });

  it('reads institutional resilience as the weakest readable capability', () => {
    const r = readInstitutionalResilience({
      institutionRefHash: 'hash_a0000000',
      capabilities: {
        continuityStabilizationPersistence: 'stabilizing',
        governanceRecoverySustainability: 'stabilizing',
        onboardingSurvivabilityDurability: 'weakening',
        stewardshipRedistributionDurability: 'redistributing',
        modernizationContinuityRetention: 'strengthening',
        institutionalCoherenceResilience: 'holding',
      },
      reviewerSignals: [],
    });
    expect(r.band).toBe('eroding');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Sector layer
// ─────────────────────────────────────────────────────────────────────────────

describe('sector layer', () => {
  it('exposes a profile for every recognised sector', () => {
    const profiles = listSectorContinuityProfiles();
    expect(profiles.length).toBe(6);
    for (const p of profiles) {
      assertToneDiscipline(p.continuityCharacter);
      assertToneDiscipline(p.continuityFragilityNote);
      assertToneDiscipline(p.stewardshipPattern);
      assertToneDiscipline(p.onboardingFragility);
      assertToneDiscipline(p.modernizationPosture);
      expect(getSectorContinuityProfile(p.sector)).toEqual(p);
    }
  });

  it('returns a not_yet_readable archetype for refusal envelopes', () => {
    const env = composeSectorBaseline(
      'labour_union',
      'arch:1',
      '2026-01-01T00:00:00.000Z',
      {
        trajectories: [],
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    expect(readSectorArchetype(env).archetype).toBe('not_yet_readable');
  });

  it('reads fragmenting_continuity when regressing share is high', () => {
    const trajectories = [
      ...['a', 'b', 'c'].map((h, idx) =>
        trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'regressing'),
      ),
      ...['d', 'e'].map((h, idx) =>
        trajectory(h, `2026-01-0${idx + 4}T00:00:00.000Z`, 'holding'),
      ),
    ];
    const env = composeSectorBaseline(
      'labour_union',
      'arch:2',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const arch = readSectorArchetype(env);
    expect(arch.archetype).toBe('fragmenting_continuity');
  });

  it('readSectorBaseline returns a refusal reading when envelope is below floor', () => {
    const env = composeSectorBaseline(
      'labour_union',
      'arch:3',
      '2026-01-01T00:00:00.000Z',
      {
        trajectories: [trajectory('a', '2026-01-01T00:00:00.000Z', 'holding')],
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const reading = readSectorBaseline(env);
    expect(reading.readable).toBe(false);
    expect(reading.refusalReason).toBe('cohort_below_k_anonymity_floor');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Stewardship evolution
// ─────────────────────────────────────────────────────────────────────────────

describe('stewardship evolution intelligence', () => {
  it('refuses redistribution durability with insufficient readings', () => {
    const r = readRedistributionDurability('hash_a0000000', [
      stewardship('a', '2026-01-01T00:00:00.000Z', 'redistributing'),
    ]);
    expect(r.band).toBe('not_yet_readable');
  });

  it('detects reconcentration_observed', () => {
    const r = readRedistributionDurability('hash_a0000000', [
      stewardship('a', '2026-01-01T00:00:00.000Z', 'redistributing'),
      stewardship('a', '2026-02-01T00:00:00.000Z', 'reconcentrating'),
    ]);
    expect(r.band).toBe('reconcentration_observed');
  });

  it('detects recurring dependency recurrence', () => {
    const r = readDependencyRecurrence([
      { tag: 'role:x', observedAt: '2026-01-01T00:00:00.000Z', reviewerRefId: REVIEWER },
      { tag: 'role:x', observedAt: '2026-02-01T00:00:00.000Z', reviewerRefId: REVIEWER },
      { tag: 'role:y', observedAt: '2026-01-01T00:00:00.000Z', reviewerRefId: REVIEWER },
      { tag: 'role:y', observedAt: '2026-02-01T00:00:00.000Z', reviewerRefId: REVIEWER },
    ]);
    expect(r.band).toBe('recurring_recurrence');
    expect(r.recurringTagCount).toBe(2);
  });

  it('composes a readable stewardship evolution reading', () => {
    const r = readStewardshipEvolution({
      institutionRefHash: 'hash_a0000000',
      stewardships: [
        stewardship('a', '2026-01-01T00:00:00.000Z', 'holding'),
        stewardship('a', '2026-02-01T00:00:00.000Z', 'redistributing'),
      ],
      dependencyObservations: [],
    });
    expect(r.readable).toBe(true);
    expect(r.redistribution.band).toBe('durable_redistribution');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Cross-institution
// ─────────────────────────────────────────────────────────────────────────────

describe('cross-institution intelligence', () => {
  it('refuses pattern reading when envelope is below the floor', () => {
    const env = composeSectorBaseline(
      'labour_union',
      'x:1',
      '2026-01-01T00:00:00.000Z',
      {
        trajectories: [trajectory('a', '2026-01-01T00:00:00.000Z', 'holding')],
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const r = readCrossInstitutionPatterns(env);
    expect(r.readable).toBe(false);
    expect(r.patterns).toHaveLength(0);
  });

  it('recognises cohesive_holding_archetype when majority is holding/stabilizing', () => {
    const trajectories = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, idx < 3 ? 'holding' : 'stabilizing'),
    );
    const env = composeSectorBaseline(
      'labour_union',
      'x:2',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const r = readCrossInstitutionPatterns(env);
    const kinds = r.patterns.map((p) => p.kind);
    expect(kinds).toContain('cohesive_holding_archetype');
  });

  it('returns patterns sorted by kind for determinism', () => {
    const trajectories = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
    );
    const survivabilities = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      survivability(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'strengthening'),
    );
    const debts = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      debt(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'reducing'),
    );
    const env = composeSectorBaseline(
      'labour_union',
      'x:3',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities,
        debts,
      },
    );
    const r = readCrossInstitutionPatterns(env);
    const kinds = r.patterns.map((p) => p.kind) as ContinuityPatternKind[];
    expect(kinds).toEqual([...kinds].sort());
  });

  it('continuity pattern registry exposes 6 stable patterns', () => {
    const patterns = listContinuityPatterns();
    expect(patterns).toHaveLength(6);
    for (const p of patterns) assertToneDiscipline(p.description);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Reporting tone discipline
// ─────────────────────────────────────────────────────────────────────────────

describe('continuity evolution reporting', () => {
  it('narrative paragraphs pass tone discipline', () => {
    const reading = readLongitudinalContinuity({
      institutionRefHash: 'hash_a0000000',
      trajectories: [
        trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
        trajectory('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
      ],
      drifts: [],
      stewardships: [],
      survivabilities: [],
      debts: [],
    });
    const n = composeInstitutionalTrajectoryNarrative(reading);
    expect(n.paragraphs.length).toBeGreaterThanOrEqual(8);
    for (const para of n.paragraphs) assertToneDiscipline(para);
  });

  it('continuity evolution report is readable for executive when reading is meaningful', () => {
    const reading = readLongitudinalContinuity({
      institutionRefHash: 'hash_a0000000',
      trajectories: [
        trajectory('a', '2026-01-01T00:00:00.000Z', 'holding'),
        trajectory('a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
      ],
      drifts: [],
      stewardships: [],
      survivabilities: [],
      debts: [],
    });
    const report = composeContinuityEvolutionReport({
      reading,
      composedAt: '2026-03-01T00:00:00.000Z',
      reviewerRefId: REVIEWER,
    });
    expect(report.readableForExecutive).toBe(true);
    expect(report.institutionRefHash).toBe('hash_a0000000');
    for (const para of report.narrative.paragraphs) assertToneDiscipline(para);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Anti-surveillance invariants
// ─────────────────────────────────────────────────────────────────────────────

describe('anti-surveillance invariants', () => {
  it('aggregation envelope never exposes a handle', () => {
    const trajectories = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
    );
    const env = composeSectorBaseline(
      'labour_union',
      'inv:1',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const serialised = JSON.stringify(env);
    expect(serialised).not.toContain('institutionRefHash');
    expect(serialised).not.toContain('hash_');
  });

  it('cross-institution reading never exposes a handle', () => {
    const trajectories = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
    );
    const env = composeSectorBaseline(
      'labour_union',
      'inv:2',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const reading = readCrossInstitutionPatterns(env);
    const serialised = JSON.stringify(reading);
    expect(serialised).not.toContain('institutionRefHash');
    expect(serialised).not.toContain('hash_');
  });

  it('aggregation envelope refuses ranking payload structure', () => {
    const trajectories = ['a', 'b', 'c', 'd', 'e'].map((h, idx) =>
      trajectory(h, `2026-01-0${idx + 1}T00:00:00.000Z`, 'holding'),
    );
    const env = composeSectorBaseline(
      'labour_union',
      'inv:3',
      '2026-01-06T00:00:00.000Z',
      {
        trajectories,
        drifts: [],
        stewardships: [],
        survivabilities: [],
        debts: [],
      },
    );
    const keys = Object.keys(env);
    const forbidden = ['rank', 'ranking', 'leaderboard', 'percentile', 'peerScore'];
    for (const f of forbidden) expect(keys).not.toContain(f);
  });
});
