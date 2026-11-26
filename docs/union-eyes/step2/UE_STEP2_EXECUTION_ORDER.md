# Union Eyes V2 Step 2 execution order

`STEP_2_PLANNING_COMPLETE = YES`

`STEP_2_ENGINEERING_COMPLETE = NO`

`STEP_2_ACCEPTED = NO`

`STAGING_GO = HELD`

`PRODUCTION_GO = HELD`

`UE_SAAS_OPERATIONAL_READINESS = NO_GO`

`fullReadiness = NOT_YET_PROVEN`

The work-breakdown file is the package list. This page is the order, the branch rule and the stops.

## Order

1. S2.00-PLAN. This package. No runtime mutation.
2. Founder merge approval. External dependency `FOUNDER_MERGE_APPROVAL`.
3. Lane A, serial: S2.01-INTEGRATE, S2.01-REQUALIFY, S2.01-IMAGE, S2.01-BIND.
4. S2.02-PREIMAGE may start as soon as S2.00 is accepted. It is read-only. It does not wait for the merge, and it blocks every rehearsal.
5. S2.02-LEGACY-GATE, then S2.02-REHEARSAL after both the legacy gate and S2.01-BIND. Then S2.02-FORWARD.
6. Founder apply approval. External dependency `FOUNDER_STAGING_APPLY_APPROVAL`. CHG-2026-0114 does not supply it for this source.
7. Lane A, serial: S2.03-WHATIF, S2.03-ZERO-TRAFFIC, S2.03-CUTOVER.
8. After cutover readback, Lane B and Lane C may run in parallel. Lane B order is S2.04-ENTRA, then membership, mandate and external denials, then the C-family packages. S2.05-MAIL waits for S2.06-INBOX. S2.05-DEADLINE waits for S2.06-WORKERS. S2.05-ASSIGN waits for S2.05-CASE. Lane C is S2.07-PERF, S2.07-OPS, S2.07-UX and S2.07-TRUTH.
9. S2.08-ADVERSARIAL, then S2.08-CRITERIA. Nothing in this order sets a GO flag.

O09 and O10 do not appear in the order. They are deferred.

## Branches

Planning branch: `cursor/ue-step2-s200-plan-cfc5`, based on the Step 1 head `b00a3624619be09aa77cd201fa7fe8a8c16b21f3`, stacked on draft PR #1309.

After founder approval and a normal merge, one integration branch is cut from that merge commit. Lane branches cut from the integration branch:

- `cursor/ue-step2-lane-a-cfc5` for S2.01–S2.03
- `cursor/ue-step2-lane-b-cfc5` for S2.04–S2.06
- `cursor/ue-step2-lane-c-cfc5` for S2.07

Only the integration branch edits `apps/union-eyes/lib/authority/`, the Union Eyes migration sequence, `tooling/scripts/lib/ue-v2-staging-candidate.json`, the release manifest, and `docs/union-eyes/step2/UE_STEP2_ACCEPTANCE_REGISTER.json`. Lane branches that need a kernel or migration change land that change on the integration branch before the next lane starts. S2.08 lands last, on the integration branch.

## Preflights

- S2.01-INTEGRATE: PR #1309 is still the reviewed draft, its head is still the accepted SHA or the difference is reread, and founder merge approval is recorded.
- S2.01-REQUALIFY: required checks are read on the merge SHA. The `b00a362` runs are not reused. Required workflows are CI, Union Eyes Full Regression, E2E, CUPE Pilot Readiness Gates, Native PostgreSQL Acceptance, Disposable HTTP and Browser Acceptance, Security Regression, Security Design Review, Secret Scan, CodeQL, Bootstrap V2 Provenance and Publish required checks.
- S2.01-BIND: source-plan digest is compared with `6ec71d4631810207ffad4e5b78046be219528d27608a3da13170f3bb96c41161`. A change requires a reviewed regeneration. A silent SQL drift stops the bind.
- S2.02-PREIMAGE: commands are read-only. The receipt replaces `CONFLICTED_HISTORICAL`.
- S2.02-LEGACY-GATE: applicability `APPLICABLE_UNTIL_DISPROVEN` is decided from that preimage.
- S2.03-WHATIF: the deploy workflow refuses deletes, and the apply-time what-if matches the reviewed fingerprint.
- Every Lane B and Lane C package: the serving revision, image digest and source SHA match the bound candidate.

## Stop conditions

Stop and do not continue to the next package when any of these is true:

- A required check on the current SHA failed, is pending, or was cancelled.
- The preimage is missing, or it disagrees with the revision that would receive traffic.
- The legacy gate says the four installer cases apply, and any of them has not passed on authentic provenance.
- The rehearsal cannot show the same row counts, sequences and unrelated ACLs after rollback.
- The what-if contains a delete, or it drifts at apply time.
- The new revision receives traffic before it is healthy.
- An audit failure is returned as a successful write.
- A finance or dues write commits.
- A deferred family, O09, O10 or PM05 is marked passed.
- Evidence names any SHA other than the package's bound SHA.

The legacy cases remain the responsibility of `team-union-eyes-engineering@nzila.ai` when they apply. Skipping them in `ue-native-expected-skips.json` is not a pass.
