/**
 * TEMPORARY compute-only script (kept in-tree for provenance).
 *
 * Purpose: compute the deterministic SHA-256 hash of the canonical scoring
 * payload for the illustrative fixture referenced by the Evidence Manifest.
 * Run via `pnpm --filter @nzila/union-eyes exec tsx apps/union-eyes/lib/icra/traceability/__hashfixture__/computeIllustrativeHash.ts`.
 *
 * Output: single JSON object printed to stdout with the pinned versions and
 * hash. That JSON object is what gets pasted into EVIDENCE_MANIFEST.md §3.
 */
import { scoreAssessment } from '../../scoring';
import { buildUniformAnswers } from '../../../integration/__fixtures__/ociFixtures';
import {
  hashCanonicalScoringPayload,
  canonicalStringify,
  toCanonicalScoringPayload,
} from '../canonicalScoringPayload';

const assessmentId = 'illustrative-fixture:uniform-band-2';
const answers = buildUniformAnswers(2);
const { trace } = scoreAssessment(assessmentId, answers);
const hash = hashCanonicalScoringPayload(trace);
const canonicalBytes = canonicalStringify(toCanonicalScoringPayload(trace));

process.stdout.write(
  JSON.stringify(
    {
      assessmentId,
      fixture: 'buildUniformAnswers(2) from apps/union-eyes/lib/integration/__fixtures__/ociFixtures.ts',
      scoringVersion: trace.scoringVersion,
      questionBankVersion: trace.questionBankVersion,
      composite: trace.composite,
      maturityBand: trace.maturityBand,
      questionTraceCount: trace.questionTraces.length,
      dimensionTraceCount: trace.dimensionTraces.length,
      canonicalPayloadByteLength: Buffer.byteLength(canonicalBytes, 'utf8'),
      canonicalPayloadSha256: hash,
    },
    null,
    2,
  ) + '\n',
);
