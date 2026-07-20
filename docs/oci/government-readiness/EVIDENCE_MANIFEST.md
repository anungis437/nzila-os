# Evidence Manifest — OCI/OCRA government-readiness corpus

> **Purpose.** Bind the wording of the corpus (brief, packet, binder,
> workbook, blueprints) to a **specific commit, artifact versions, and a
> reproducible fixture** so any external reviewer can confirm what they are
> looking at and reproduce the worked-finding example.
>
> **Doctrine version:** 1.0.0 · **As of:** 2026-07-20
> **Commit base:** `a51911e2270e474d2368c363213d245bf08b5e2b` (branch `main`).
> New work in this session sits on top of that commit and will produce a new
> SHA when committed; the exact SHA at the moment of external send **must**
> be re-recorded here immediately before the packet leaves the building.

---

## 1. Commit bindings

| Item | Value |
| --- | --- |
| Repository | `anungis437/nzila-os` |
| Branch at time of prep | `main` |
| Base commit SHA (pre-remediation) | `a51911e2270e474d2368c363213d245bf08b5e2b` |
| Final commit SHA (fill in immediately before send) | `TBD` |
| Doctrine version tag | `oci-doctrine-v1.0.0` (planned; not yet cut) |

## 2. Artifact versions referenced by the brief

| Artifact | File | Version stamp source |
| --- | --- | --- |
| Scoring core | [`apps/union-eyes/lib/icra/scoring.ts`](../../apps/union-eyes/lib/icra/scoring.ts) | `ScoringTrace.scoringVersion` |
| Question bank | [`apps/union-eyes/lib/icra/questions.ts`](../../apps/union-eyes/lib/icra/questions.ts) | `ScoringTrace.questionBankVersion` |
| Obligation taxonomy | [`apps/union-eyes/lib/icra/obligations/obligationTaxonomy.ts`](../../apps/union-eyes/lib/icra/obligations/obligationTaxonomy.ts) | `TraceabilityRecord.obligationTaxonomyVersion` |
| Consequence model | [`apps/union-eyes/lib/icra/consequences/consequenceModel.ts`](../../apps/union-eyes/lib/icra/consequences/consequenceModel.ts) | `TraceabilityRecord.consequenceModelVersion` |
| Source-instrument catalogue | [`apps/union-eyes/lib/icra/obligations/sourceInstruments.ts`](../../apps/union-eyes/lib/icra/obligations/sourceInstruments.ts) | `TraceabilityRecord.sourceCatalogueVersion` |
| Confidence envelope | [`packages/oci-confidence/`](../../packages/oci-confidence/) | package.json `version` |
| Canonical scoring payload helper | [`apps/union-eyes/lib/icra/traceability/canonicalScoringPayload.ts`](../../apps/union-eyes/lib/icra/traceability/canonicalScoringPayload.ts) | shipped with the scoring core commit above |

> **How to fill in the version stamps at the moment of send.** From the
> repository root, run the reproducible fixture (see §3) and copy the
> `scoringVersion`, `questionBankVersion`, `obligationTaxonomyVersion`,
> `consequenceModelVersion`, and `sourceCatalogueVersion` fields from the
> emitted `TraceabilityRecord` into the table above.

## 3. Reproducible fixture for the worked finding (illustrative → exact)

The worked-finding example in
[`richard-packet/external-send/02_INDEPENDENT_REVIEW_BRIEF.md §4`](./richard-packet/external-send/02_INDEPENDENT_REVIEW_BRIEF.md)
and in Part 2 of the [Richard Validation Packet](./richard-packet/RICHARD_VALIDATION_PACKET.md)
is marked *illustrative*. When we go to send, we bind it to an exact,
reproducible fixture:

1. **Fixture** — the uniform-answer set used by the government-readiness
   test suite, held at
   [`apps/union-eyes/lib/icra/integration/__fixtures__/ociFixtures.ts`](../../apps/union-eyes/lib/icra/integration/__fixtures__/ociFixtures.ts).
2. **Reproduce** — from the repository root:

   ```powershell
   # 1. Run the deterministic canonical-payload test
   pnpm --filter @nzila/union-eyes exec vitest run `
     apps/union-eyes/lib/icra/__tests__/government-readiness/canonical-scoring-payload.test.ts

   # 2. Run the full government-readiness suite
   pnpm --filter @nzila/union-eyes exec vitest run `
     apps/union-eyes/lib/icra/__tests__/government-readiness
   ```

3. **Canonical-payload hash of the fixture (fill in at send time).**
   `sha256(canonicalStringify(toCanonicalScoringPayload(trace))) = TBD`
   — recorded by running the canonical-payload test with a temporary
   `console.log(hashCanonicalScoringPayload(t1))` line and pasting the
   resulting hex here immediately before send. This hash **must** be
   byte-identical across runs; if it drifts, the send is aborted and the
   drift is investigated.

## 4. Test-run bindings for every claim in the brief

The Independent Review Brief says "internally tested" against the following
test files. Any external reviewer can rerun each with the pnpm/vitest
commands in §3.

| Claim in the brief | Test file(s) |
| --- | --- |
| Byte-identical canonical scoring payload | `apps/union-eyes/lib/icra/__tests__/government-readiness/canonical-scoring-payload.test.ts` |
| Additive layer never mutates trace | `apps/union-eyes/lib/icra/__tests__/government-readiness/backward-compat-scores.test.ts` |
| Seven-answer finding-completeness contract | `apps/union-eyes/lib/icra/__tests__/government-readiness/finding-completeness.test.ts` |
| Obligation-module isolation from scoring | `apps/union-eyes/lib/icra/__tests__/government-readiness/obligation-mapping-isolation.test.ts` |
| Confidence evidence-floor discipline | `apps/union-eyes/lib/icra/__tests__/government-readiness/confidence-evidence-floor.test.ts` |
| Traceability record + no-orphan-recommendation | `apps/union-eyes/lib/icra/__tests__/government-readiness/no-orphan-recommendations.test.ts` |
| Source-instrument traceability + authority-level | `apps/union-eyes/lib/icra/__tests__/government-readiness/source-instrument-traceability.test.ts`, `…/source-instrument-authority.test.ts` |
| IRR harness (measurement not yet performed) | `apps/union-eyes/lib/icra/__tests__/government-readiness/inter-rater-reliability.test.ts` |
| Assessor governance machinery | `apps/union-eyes/lib/icra/__tests__/government-readiness/assessor-governance.test.ts` |
| Benchmark publication guard (K=5) | `apps/union-eyes/lib/oci/benchmark/__tests__/publicationGuard.test.ts` |
| PII-free telemetry regression | `adaptiveTelemetryPrivacyRegression.test.ts` (in the OCI adaptive test tree) |

## 5. Send-time protocol

1. Confirm the tree matches the committed SHA (`git status` clean).
2. Run §3 commands; confirm all tests pass and the canonical hash matches
   the value pinned above.
3. Update the *Final commit SHA*, version stamps, and canonical hash in
   this file. Commit the update. Record the new SHA here.
4. Rebuild PDFs of the four files in
   [`richard-packet/external-send/`](./richard-packet/external-send/) from
   the pinned commit.
5. Verify that the internal pre-mortem
   ([INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md](./INTERNAL_PRE_MORTEM_HYPOTHETICAL_REVIEWER_CHALLENGES.md))
   is **not** in the attachment set.
6. Send.

## 6. Change log

| Date | SHA | Change |
| --- | --- | --- |
| 2026-07-20 | `a51911e` (base) | Initial manifest; introduces reproducible-fixture pattern and send-time protocol. Doctrine v1.0.0. |
