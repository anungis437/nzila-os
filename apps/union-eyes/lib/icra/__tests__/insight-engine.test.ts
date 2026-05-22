/**
 * ICRA — Insight Engine Regression Tests
 *
 * Deterministic fixtures covering:
 *  - Maturity-band resolution across the canonical spectrum
 *  - Insight cap and prioritization
 *  - Evidence basis is populated for v2+ insights
 *  - New detections: evidence_governance_gap, stewardship_concentration
 *
 * These tests anchor the elite-quality contract: the insight engine must
 * stay deterministic, capped, and traceable as it evolves.
 */

import { describe, it, expect } from 'vitest';
import { generateInsights } from '../insight-engine';
import { resolveMaturityBand } from '../maturity';
import type {
  DimensionId,
  DimensionScore,
  SectionId,
  SectionScore,
} from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Fixture helpers
// ─────────────────────────────────────────────────────────────────────────────

const DIMENSIONS: DimensionId[] = [
  'institutional_continuity',
  'governance_fragility',
  'trust_debt',
  'operational_memory',
  'transition_readiness',
];

const SECTIONS: SectionId[] = [
  'organizational_context',
  'operational_dependency',
  'governance_visibility',
  'institutional_memory',
  'transition_readiness',
  'operational_coordination',
  'explainability_trust',
  'sovereignty_governance',
];

function dims(overrides: Partial<Record<DimensionId, number>>): DimensionScore[] {
  return DIMENSIONS.map((dimension) => ({
    dimension,
    score: overrides[dimension] ?? 50,
    weight: 1,
    answeredCount: 4,
  }));
}

function sections(overrides: Partial<Record<SectionId, number>> = {}): SectionScore[] {
  return SECTIONS.map((section) => ({
    section,
    score: overrides[section] ?? 50,
    answeredCount: 4,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Maturity band resolution — anchors the scoring → narrative contract
// ─────────────────────────────────────────────────────────────────────────────

describe('icra/maturity — band resolution', () => {
  it('resolves the five canonical bands in order', () => {
    expect(resolveMaturityBand(10).id).toBe('personality_dependent');
    expect(resolveMaturityBand(40).id).toBe('fragmented_coordination');
    expect(resolveMaturityBand(60).id).toBe('structured_governance');
    expect(resolveMaturityBand(80).id).toBe('continuity_aware');
    expect(resolveMaturityBand(95).id).toBe('continuity_intelligence');
  });

  it('clamps out-of-range composites', () => {
    expect(resolveMaturityBand(-10).id).toBe('personality_dependent');
    expect(resolveMaturityBand(150).id).toBe('continuity_intelligence');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Insight engine — prioritization, cap, evidence basis
// ─────────────────────────────────────────────────────────────────────────────

describe('icra/insight-engine — output contract', () => {
  it('caps insights at 5 even when every detector fires', () => {
    // Force every detector to fire simultaneously
    const out = generateInsights(
      dims({
        institutional_continuity: 25,
        operational_memory: 20,
        governance_fragility: 25,
        trust_debt: 25,
        transition_readiness: 20,
      }),
      sections(),
    );
    expect(out.insights.length).toBeLessThanOrEqual(5);
  });

  it('emits no insights when every dimension is strong', () => {
    const out = generateInsights(
      dims({
        institutional_continuity: 85,
        operational_memory: 85,
        governance_fragility: 85,
        trust_debt: 85,
        transition_readiness: 85,
      }),
      sections(),
    );
    expect(out.insights).toHaveLength(0);
  });

  it('orders insights with material severity before notable', () => {
    const out = generateInsights(
      dims({
        institutional_continuity: 28,
        operational_memory: 26,
        governance_fragility: 30,
        trust_debt: 30,
        transition_readiness: 28,
      }),
      sections(),
    );
    const severities = out.insights.map((i) => i.severity);
    const firstNotable = severities.indexOf('notable');
    const lastMaterial = severities.lastIndexOf('material');
    if (firstNotable !== -1 && lastMaterial !== -1) {
      expect(lastMaterial).toBeLessThan(firstNotable);
    }
  });

  it('populates evidenceBasis and affectedSections for every surfaced insight', () => {
    const out = generateInsights(
      dims({
        institutional_continuity: 40,
        operational_memory: 25,
        governance_fragility: 30,
        trust_debt: 45,
        transition_readiness: 35,
      }),
      sections(),
    );
    for (const insight of out.insights) {
      expect(insight.evidenceBasis).toBeTruthy();
      expect(insight.affectedSections?.length ?? 0).toBeGreaterThan(0);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// New detections — evidence_governance_gap, stewardship_concentration
// ─────────────────────────────────────────────────────────────────────────────

describe('icra/insight-engine — evidence_governance_gap', () => {
  it('fires when governance is structured but trust_debt is weak', () => {
    const out = generateInsights(
      dims({
        institutional_continuity: 70,
        operational_memory: 65,
        governance_fragility: 75, // strong governance
        trust_debt: 30,            // weak evidence
        transition_readiness: 65,
      }),
      sections(),
    );
    const found = out.insights.find((i) => i.category === 'evidence_governance_gap');
    expect(found).toBeDefined();
    expect(found?.severity).toBe('material');
  });

  it('does not fire when governance is itself weak (drift covers it)', () => {
    const out = generateInsights(
      dims({
        governance_fragility: 30,
        trust_debt: 30,
      }),
      sections(),
    );
    const found = out.insights.find((i) => i.category === 'evidence_governance_gap');
    expect(found).toBeUndefined();
  });
});

describe('icra/insight-engine — stewardship_concentration', () => {
  it('fires when composite is structured but burden is elevated', () => {
    // IC notable+, with weak transition+memory to push burden high
    const out = generateInsights(
      dims({
        institutional_continuity: 60,
        operational_memory: 30,
        transition_readiness: 30,
        governance_fragility: 60,
        trust_debt: 60,
      }),
      sections(),
    );
    const found = out.insights.find((i) => i.category === 'stewardship_concentration');
    expect(found).toBeDefined();
    expect(found?.evidenceBasis).toMatch(/burden \d+/);
  });

  it('does not fire when continuity is weak (covered by invisible_labour)', () => {
    const out = generateInsights(
      dims({
        institutional_continuity: 40,
        operational_memory: 30,
        transition_readiness: 30,
      }),
      sections(),
    );
    const found = out.insights.find((i) => i.category === 'stewardship_concentration');
    expect(found).toBeUndefined();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Burden index — within-range and interpretable
// ─────────────────────────────────────────────────────────────────────────────

describe('icra/insight-engine — burden index', () => {
  it('produces a 0-100 score with an interpretation string', () => {
    const out = generateInsights(
      dims({
        institutional_continuity: 35,
        operational_memory: 30,
        transition_readiness: 25,
      }),
      sections(),
    );
    expect(out.burdenIndex.score).toBeGreaterThanOrEqual(0);
    expect(out.burdenIndex.score).toBeLessThanOrEqual(100);
    expect(typeof out.burdenIndex.interpretation).toBe('string');
    expect(out.burdenIndex.interpretation.length).toBeGreaterThan(0);
  });

  it('returns a lower burden score for well-distributed institutions', () => {
    const high = generateInsights(
      dims({ institutional_continuity: 20, operational_memory: 20, transition_readiness: 20 }),
      sections(),
    ).burdenIndex.score;
    const low = generateInsights(
      dims({ institutional_continuity: 85, operational_memory: 85, transition_readiness: 85 }),
      sections(),
    ).burdenIndex.score;
    expect(low).toBeLessThan(high);
  });
});
