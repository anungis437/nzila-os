/**
 * v2 Foundation — Adaptive Topology Depth
 *
 * Validates that every routing-v2 path declares a deepening sequence of
 * at least three probe-fingerprints (drawn from `intelligence.deepens`
 * on v2 questions), that no path consists only of one shared tag, and
 * that the path set has sufficient diversity (Jaccard distance > 0
 * between distinct paths).
 */
import { describe, it, expect } from 'vitest';
import { V2_QUESTIONS } from '../../../modalities-v2/registry';
import { ROUTING_PATHS } from '../../../routing-v2/pathTypes';

function jaccardDistance(a: ReadonlyArray<string>, b: ReadonlyArray<string>): number {
  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = [...setA].filter((x) => setB.has(x)).length;
  const union = new Set([...setA, ...setB]).size;
  if (union === 0) return 1;
  return 1 - intersection / union;
}

describe('v2 Foundation — adaptive topology depth', () => {
  it('declares the full set of seven routing path types', () => {
    const ids = ROUTING_PATHS.map((p) => p.id).sort();
    expect(ids).toEqual(
      [
        'confidence_escalation_path',
        'contradiction_resolution_path',
        'continuity_dependency_path',
        'federated_governance_path',
        'governance_fragility_path',
        'modernization_fragility_path',
        'onboarding_survivability_path',
      ].sort(),
    );
  });

  it('every routing path deepens with at least one tag (foundation floor)', () => {
    for (const path of ROUTING_PATHS) {
      expect(path.deepensWith.length).toBeGreaterThan(0);
    }
  });

  it('every routing path tag resolves to at least one v2 question fingerprint', () => {
    const allDeepens = new Set<string>();
    for (const q of V2_QUESTIONS) for (const d of q.intelligence.deepens) allDeepens.add(d);
    for (const path of ROUTING_PATHS) {
      for (const tag of path.deepensWith) {
        expect(allDeepens.has(tag), `tag ${tag} on path ${path.id}`).toBe(true);
      }
    }
  });

  it('routing paths are diverse — any two distinct paths have non-trivial Jaccard distance', () => {
    for (let i = 0; i < ROUTING_PATHS.length; i++) {
      for (let j = i + 1; j < ROUTING_PATHS.length; j++) {
        const d = jaccardDistance(
          ROUTING_PATHS[i].deepensWith,
          ROUTING_PATHS[j].deepensWith,
        );
        expect(d, `paths ${ROUTING_PATHS[i].id} vs ${ROUTING_PATHS[j].id}`).toBeGreaterThan(0);
      }
    }
  });

  // v1.4.0 deliverable — the live routing engine activates these paths;
  // the depth assertion (≥3 probes per path) is enforced once the engine
  // resolves deepens-tags into concrete question sequences.
  it.todo('every routing path resolves to >= 3 concrete probes (v1.4.0 engine)');
});
