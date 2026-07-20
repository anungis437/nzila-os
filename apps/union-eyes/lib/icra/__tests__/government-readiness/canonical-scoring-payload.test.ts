/**
 * ARTIFACT TYPE: Vitest Suite — Canonical Scoring Payload (byte-identical claim)
 * SPEC: docs/oci/government-readiness/IMPLEMENTATION_STATUS.md (determinism claim)
 *
 * Proves the honest determinism claim we make externally:
 *   For identical substantive inputs, the canonical scoring payload
 *   (timestamps stripped) is byte-identical and hash-identical across runs.
 */

import { describe, expect, it } from 'vitest';

import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import { scoreAssessment } from '../../scoring';
import {
  canonicalStringify,
  hashCanonicalScoringPayload,
  toCanonicalScoringPayload,
} from '../../traceability/canonicalScoringPayload';

describe('canonical scoring payload — byte-identical reproducibility', () => {
  it('two scoring runs of the same substantive input produce the same canonical bytes and hash', async () => {
    const answers = buildUniformAnswers(0);
    const { trace: t1 } = scoreAssessment('canonical-1', answers);
    // Force a wall-clock delta so scoredAt differs between runs.
    await new Promise((resolve) => setTimeout(resolve, 5));
    const { trace: t2 } = scoreAssessment('canonical-1', answers);

    // The full traces will differ (scoredAt is different wall-clock time)…
    expect(t1.scoredAt).not.toBe(t2.scoredAt);

    // …but the canonical payload and its hash must be identical.
    const bytes1 = canonicalStringify(toCanonicalScoringPayload(t1));
    const bytes2 = canonicalStringify(toCanonicalScoringPayload(t2));
    expect(bytes1).toBe(bytes2);
    expect(hashCanonicalScoringPayload(t1)).toBe(hashCanonicalScoringPayload(t2));
  });

  it('the canonical payload excludes scoredAt (the only wall-clock field on the trace)', () => {
    const { trace } = scoreAssessment('no-timestamps', buildUniformAnswers(0));
    const canonical = toCanonicalScoringPayload(trace);
    expect((canonical as Record<string, unknown>).scoredAt).toBeUndefined();
  });

  it('canonical bytes are key-order-stable (insertion order does not shift the hash)', () => {
    const a = { z: 1, a: 2, m: [{ y: 1, x: 2 }] };
    const b = { m: [{ x: 2, y: 1 }], a: 2, z: 1 };
    expect(canonicalStringify(a)).toBe(canonicalStringify(b));
  });
});
