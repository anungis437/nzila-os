/**
 * v2 Foundation — Topology Extraction Integrity
 *
 * Validates anti-surveillance guards on topology, distribution, and
 * dependency modalities. All node / bin / category labels must reference
 * institutional functions or role categories — NEVER individuals or
 * personal identifiers.
 */
import { describe, it, expect } from 'vitest';
import { V2_QUESTIONS } from '../../../modalities-v2/registry';

const FORBIDDEN_LABEL_PATTERNS: ReadonlyArray<RegExp> = [
  /\bmr\.?\s+/i,
  /\bms\.?\s+/i,
  /\bmrs\.?\s+/i,
  /\bdr\.?\s+\w+/i,
  /@/, // email address
  /\bnamed\b/i,
  /\bspecific person\b/i,
  /\bindividual\s+staff\s+member\b/i,
];

describe('v2 Foundation — topology extraction integrity', () => {
  const topologyQuestions = V2_QUESTIONS.filter((q) => q.modality === 'topology_mapping');
  const distributionQuestions = V2_QUESTIONS.filter(
    (q) => q.modality === 'continuity_distribution',
  );
  const dependencyQuestions = V2_QUESTIONS.filter(
    (q) => q.modality === 'dependency_mapping',
  );
  const transitionExposureQuestions = V2_QUESTIONS.filter(
    (q) => q.modality === 'transition_exposure',
  );

  function assertNoIndividualIdentifier(label: string, ctx: string) {
    for (const pat of FORBIDDEN_LABEL_PATTERNS) {
      expect(pat.test(label), `${ctx}: "${label}" matched ${pat}`).toBe(false);
    }
  }

  it('topology_mapping nodes are institutional functions only', () => {
    expect(topologyQuestions.length).toBeGreaterThan(0);
    for (const q of topologyQuestions) {
      if (q.modality !== 'topology_mapping') continue;
      for (const node of q.nodes) {
        assertNoIndividualIdentifier(node.label, `${q.id}.nodes`);
      }
      // axes are bounded
      expect(q.axes.x.minLabel.length).toBeGreaterThan(0);
      expect(q.axes.y.minLabel.length).toBeGreaterThan(0);
    }
  });

  it('continuity_distribution bins reference functions, not people', () => {
    expect(distributionQuestions.length).toBeGreaterThan(0);
    for (const q of distributionQuestions) {
      if (q.modality !== 'continuity_distribution') continue;
      for (const bin of q.bins) {
        assertNoIndividualIdentifier(bin.label, `${q.id}.bins`);
      }
    }
  });

  it('dependency_mapping nodes reference functions, not people', () => {
    expect(dependencyQuestions.length).toBeGreaterThan(0);
    for (const q of dependencyQuestions) {
      if (q.modality !== 'dependency_mapping') continue;
      for (const node of [...q.fromNodes, ...q.toNodes]) {
        assertNoIndividualIdentifier(node.label, `${q.id}.nodes`);
      }
    }
  });

  it('transition_exposure categories reference role categories, not individuals', () => {
    expect(transitionExposureQuestions.length).toBeGreaterThan(0);
    for (const q of transitionExposureQuestions) {
      if (q.modality !== 'transition_exposure') continue;
      for (const cat of q.categories) {
        assertNoIndividualIdentifier(cat.label, `${q.id}.categories`);
      }
    }
  });

  it('every v2 question carries a deepens routing fingerprint', () => {
    for (const q of V2_QUESTIONS) {
      expect(q.intelligence.deepens.length).toBeGreaterThan(0);
    }
  });
});
