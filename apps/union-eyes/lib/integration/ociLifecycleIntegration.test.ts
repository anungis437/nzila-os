/**
 * ARTIFACT TYPE: Vitest Integration Suite
 * MODULE: OCI Operational Truth Hardening — Part 1
 * DOCTRINE_VERSION: 1.0.0
 *
 * End-to-end OCI lifecycle validation:
 *
 *   Product 1 (Recognition)
 *     → Product 2 (Mapping)
 *       → Product 3 (Stabilization)
 *         → Product 4 (Runtime)
 *           → Product 5 (Intelligence)
 *
 * The suite asserts that integrity survives every product boundary: maturity
 * bands propagate, narrative coherence is preserved, runtime readiness is
 * driven by stabilization inputs, and intelligence aggregation respects
 * upstream readings without inventing them.
 */

import { describe, expect, it } from 'vitest';

import {
  buildGradedAnswers,
  buildUniformAnswers,
  FIXTURE_INSTITUTION_SCOPE,
  FIXTURE_REVIEWER_REF,
  makeDebt,
  makeDrift,
  makeGrant,
  makeStewardship,
  makeSurvivability,
  makeTrajectory,
} from './__fixtures__/ociFixtures';

import { scoreAssessment } from '../icra/scoring';
import { resolveMaturityBand } from '../icra/maturity';
import { generateExecutiveSummary } from '../icra-pdf/reportNarrativeEngine';

import { readRuntimeReadiness } from '../runtime/readiness/runtimeReadinessEngine';
import { composeContinuityRuntimeContext } from '../runtime/primitives/continuityRuntimeContext';

import { createContinuityIntelligenceRegistry } from '../intelligence/network/continuityIntelligenceRegistry';
import { createIntelligenceNetworkEngine } from '../intelligence/network/intelligenceNetworkEngine';

import { K_ANONYMITY_FLOOR } from '../intelligence/ethics/intelligenceEthicsValidators';

describe('OCI lifecycle integration — Recognition → Intelligence', () => {
  it('P1 → P2: OCRA scoring produces a profile whose maturity band matches the band registry', () => {
    const answers = buildUniformAnswers(4);
    const { profile, trace } = scoreAssessment('assessment:p1-p2', answers);

    // The trace and profile must agree.
    expect(profile.maturityBand.id).toBe(trace.maturityBand.id);
    // The band must be resolvable independently to the same id.
    expect(resolveMaturityBand(profile.composite).id).toBe(profile.maturityBand.id);
    // Uniform institutional answers should resolve to the highest band.
    expect(profile.maturityBand.id).toBe('continuity_intelligence');
  });

  it('P1 → P2: profile carries everything the workbook synthesizer needs to hydrate', () => {
    const answers = buildGradedAnswers((i) => (i % 5) as 0 | 1 | 2 | 3 | 4);
    const { profile } = scoreAssessment('assessment:p1-p2-graded', answers);

    expect(profile.dimensions.length).toBeGreaterThan(0);
    expect(profile.sections.length).toBeGreaterThan(0);
    expect(profile.questionBankVersion).toBeGreaterThan(0);
    expect(profile.answeredQuestionCount).toBe(answers.length);
    // Stewardship and continuity signals are first-class on the profile.
    expect(Array.isArray(profile.stewardshipSignals)).toBe(true);
    expect(Array.isArray(profile.continuitySignals)).toBe(true);
  });

  it('P2 → P3: narrative is deterministic over the same profile', () => {
    const answers = buildUniformAnswers(2);
    const a = scoreAssessment('assessment:p2-p3', answers).profile;
    const b = scoreAssessment('assessment:p2-p3', answers).profile;
    expect(a.maturityBand.id).toBe(b.maturityBand.id);
    expect(a.composite).toBe(b.composite);
    // Narrative paragraphs derived from the same profile must be identical.
    const narrativeA = generateExecutiveSummary(
      a.maturityBand,
      a.composite,
      a.dimensions,
      a.insights,
      a.burdenIndex,
    );
    const narrativeB = generateExecutiveSummary(
      b.maturityBand,
      b.composite,
      b.dimensions,
      b.insights,
      b.burdenIndex,
    );
    expect(narrativeA).toEqual(narrativeB);
  });

  it('P3 → P4: runtime readiness collapses to not_yet_readable when stabilization is unreadable', () => {
    const reading = readRuntimeReadiness(
      {
        stabilizationMaturity: 'not_yet_readable',
        governanceRatification: 'not_yet_readable',
        redistributionPathways: 'not_yet_readable',
        continuityDebt: 'not_yet_readable',
        onboardingSurvivability: 'not_yet_readable',
        runtimeEthicsAlignment: 'not_yet_readable',
      },
      FIXTURE_INSTITUTION_SCOPE,
    );
    expect(reading.overall).toBe('not_yet_readable');
    expect(reading.sufficientCount).toBe(0);
  });

  it('P3 → P4: runtime readiness reports sufficient only when every condition is sufficient', () => {
    const reading = readRuntimeReadiness(
      {
        stabilizationMaturity: 'sufficient',
        governanceRatification: 'sufficient',
        redistributionPathways: 'sufficient',
        continuityDebt: 'sufficient',
        onboardingSurvivability: 'sufficient',
        runtimeEthicsAlignment: 'sufficient',
      },
      FIXTURE_INSTITUTION_SCOPE,
    );
    expect(reading.overall).toBe('sufficient');
    expect(reading.sufficientCount).toBe(reading.totalConditions);
  });

  it('P3 → P4: a single not_yet_sufficient condition prevents overall sufficiency', () => {
    const reading = readRuntimeReadiness(
      {
        stabilizationMaturity: 'sufficient',
        governanceRatification: 'sufficient',
        redistributionPathways: 'not_yet_sufficient',
        continuityDebt: 'sufficient',
        onboardingSurvivability: 'sufficient',
        runtimeEthicsAlignment: 'sufficient',
      },
      FIXTURE_INSTITUTION_SCOPE,
    );
    expect(reading.overall).toBe('not_yet_sufficient');
  });

  it('P4: continuity runtime context preserves institution scope and stewardship band', () => {
    const ctx = composeContinuityRuntimeContext({
      institutionScope: FIXTURE_INSTITUTION_SCOPE,
      sensitivity: 'continuity_sensitive',
      governanceLineage: [],
      stewardshipConcentrationBand: 'stabilizing',
      survivabilityBand: 'holding',
      readinessSufficient: true,
    });
    expect(ctx.institutionScope).toBe(FIXTURE_INSTITUTION_SCOPE);
    expect(ctx.stewardshipConcentrationBand).toBe('stabilizing');
    expect(ctx.readinessSufficient).toBe(true);
  });

  it('P4 → P5: intelligence engine refuses records from non-participating institutions', () => {
    const registry = createContinuityIntelligenceRegistry();
    // No grant registered for hash_unregistered.
    const engine = createIntelligenceNetworkEngine(registry);
    const result = engine.ingestTrajectories([
      makeTrajectory('unregistered', '2026-02-01T00:00:00.000Z', 'holding'),
    ]);
    expect(result.accepted).toHaveLength(0);
    expect(result.rejections).toHaveLength(1);
  });

  it('P4 → P5: intelligence engine accepts records once participation is granted', () => {
    const registry = createContinuityIntelligenceRegistry();
    registry.grant(makeGrant('participant-a'));
    const engine = createIntelligenceNetworkEngine(registry);
    const result = engine.ingestTrajectories([
      makeTrajectory('participant-a', '2026-02-01T00:00:00.000Z', 'stabilizing'),
    ]);
    expect(result.accepted).toHaveLength(1);
    expect(result.rejections).toHaveLength(0);
  });

  it('full lifecycle: P5 baseline refuses sub-floor cohorts (anti-surveillance)', () => {
    const registry = createContinuityIntelligenceRegistry();
    const engine = createIntelligenceNetworkEngine(registry);
    // Grant fewer than the k-anonymity floor.
    for (let i = 0; i < K_ANONYMITY_FLOOR - 1; i++) {
      registry.grant(makeGrant(`small-${i}`));
    }
    for (let i = 0; i < K_ANONYMITY_FLOOR - 1; i++) {
      engine.ingestTrajectories([
        makeTrajectory(`small-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestDrifts([
        makeDrift(`small-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestStewardships([
        makeStewardship(`small-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestSurvivabilities([
        makeSurvivability(`small-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestDebts([
        makeDebt(`small-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
    }
    const envelope = engine.composeBaseline(
      'labour_union',
      'baseline:sub-floor',
      '2026-02-01T00:00:00.000Z',
    );
    expect(envelope.readable).toBe(false);
  });

  it('full lifecycle: P5 baseline becomes readable once the k-anonymity floor is reached', () => {
    const registry = createContinuityIntelligenceRegistry();
    const engine = createIntelligenceNetworkEngine(registry);
    for (let i = 0; i < K_ANONYMITY_FLOOR; i++) {
      registry.grant(makeGrant(`participant-${i}`));
    }
    for (let i = 0; i < K_ANONYMITY_FLOOR; i++) {
      engine.ingestTrajectories([
        makeTrajectory(`participant-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestDrifts([
        makeDrift(`participant-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestStewardships([
        makeStewardship(`participant-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestSurvivabilities([
        makeSurvivability(`participant-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
      engine.ingestDebts([
        makeDebt(`participant-${i}`, '2026-02-01T00:00:00.000Z', 'holding'),
      ]);
    }
    const envelope = engine.composeBaseline(
      'labour_union',
      'baseline:at-floor',
      '2026-02-01T00:00:00.000Z',
    );
    expect(envelope.readable).toBe(true);
    expect(envelope.contributingInstitutions).toBeGreaterThanOrEqual(K_ANONYMITY_FLOOR);
    // The reviewer is intentionally not stamped on the envelope (anti-surveillance).
    expect(envelope).not.toHaveProperty('reviewerRefId');
    expect(envelope).not.toHaveProperty('institutionRefHash');
    // Sanity: fixture reviewer ref is held by the engine but never surfaced.
    expect(FIXTURE_REVIEWER_REF.length).toBeGreaterThan(0);
  });
});
