# CIVIC / CLEAR / SAGE — Cursor execution mandate

**Authority:** Founder C0 product design accepted 2026-11-23. **Status:** executable engineering handoff; no customer-data, general CIVIC runtime, staging deployment or production GO is implied.

**Primary branch:** `main` (read fresh on every lane). **Baseline reference:** merge commit `d491622468ffc66af6c110902e64084e3a6b32ed` for the accepted design freeze. Current `main` may have advanced; never reset or overwrite another integrator's work.

## Zero-rediscovery entry point

Do not restart product ideation, solicit the owner's approval again, ask for mockups before repairing code, or open replacement PRs for already-completed work. Read these canonical files first:

- [Accepted D01–D34 ceiling](CIVIC_CLEAR_SAGE_CEILING_FREEZE_2026-11-23.md)
- [A–H parallel delivery roadmap](CIVIC_CLEAR_SAGE_PARALLEL_DELIVERY_ROADMAP_2026-11-23.md)
- [Adversarial acceptance and synthetic journeys](CIVIC_CLEAR_SAGE_ADVERSARIAL_ACCEPTANCE_2026-11-23.md)
- `docs/oci/OCI_METHOD.md`, `docs/oci/CANON.md`, `docs/oci/oci-product-ladder.md`, `docs/oci/OCI_AI_BOUNDARY.md`, `docs/oci/OCI_ANTI_SURVEILLANCE_POSITION.md`
- `docs/public-service/clear-method-canonical.md`, `docs/public-service/sage-workspace-canonical.md`
- `governance/foundations/civic-oci-doctrine.contract.json`; `scripts/lib/civic-oci-doctrine.ts`
- `docs/public-service/operations/sage-acceptance/B005_STAGING_DEPLOY_PROCEDURE.md` and latest SAGE proof receipts.

**Canonical product mapping:** OCI is the sole method; CIVIC the public-service product front door, CLEAR its five-domain evidence method overlay (Continuity, Legitimacy, Evidence, Accountability, Readiness), SAGE the authorized institutional workspace. OCRA is Recognition/P1. P5 Intelligence is opt-in, not saleable until the two paid engagements and second certified facilitator constraints in canonical doctrine are met. Prices belong only to the canonical OCI ladder. Institutional scores/rankings, people surveillance, AI judgment, unreviewed legal/HR/clinical conclusions, prospect-specific kernel forks and fabricated completeness are prohibited.

## Existing work — integrate rather than duplicate

| PR | Verified scope | Current disposition to re-check |
|---|---|---|
| #1289 | Accepted C0 design, 34 decisions and adversarial acceptance | **MERGED** at `d4916224` |
| #1290 | Propagate server-attested actor context across **six** SAGE workspace pages; regression test | Source changes committed; updated generated snapshots; latest CI and merge pending |
| #1291 | Independent time/resource/action/instrument-bound institutional mandate evaluator and P01 monetary ceiling tests | **Pure evaluator, unwired**; latest CI and merge pending |
| #1292 | Fail closed on claim source/classification mismatch, cross-tenant leakage and duplicate evidence; mark submitted claim narratives unverified | Source guard committed; latest CI and merge pending |
| #1296 | Evidence-bound executive/accountability **draft** with comparable expected/observed outcome variance, missing spend, delivery acceptance and interpretation paths | **Pure draft, unwired**; latest CI and merge pending |
| #1297 | Read-only, exact-SHA staging HTTP preflight | **Anonymous auth boundary only**, *NOT proof the SAGE route exists*; latest CI and merge pending |
| #1298 | Export UI no longer displays evidence lifecycle as an invented authorization level | Source fix committed; latest CI and merge pending |
| #1299 | Test-only UE triager notification fixture clock repair, plus expired-designation refusal regression | Broad UE Full Regression PASS at inspected head; remaining CI/merge pending |

Related GitHub issues: #1293 protected CIVIC C1 synthetic runtime; #1294 SAGE B-005 isolated staging; #1295 R/D/T end-to-end journeys.

The source branches were created in isolation and have **canonical generated inventory snapshots synchronized to the corresponding CI diffs**. Regenerate via `tooling/repo-inventory` after integrating multiple branches; do not accept stale counts or remove inventory enforcement. Multiple PRs edit the same generated files, so **merge sequentially**, rebase/merge from fresh `main`, regenerate once per actual merge, and validate each head. Avoid speculative wholesale re-generation or repeated 27k-test runs before the known targeted errors are resolved.

### UE failure root cause — already resolved in PR #1299; no bypass

`apps/union-eyes/lib/messaging/thread-assignment.pglite.test.ts` fixed its test clock at `2026-10-24T12:00Z`, issued 30-day grants expiring **2026-11-23T12:00Z**, then called real-clock `createMemberThread → notifyTriagers → liveDesignees`. Post-expiry CI reported zero triagers rather than two. PR #1299 freezes **Date only for that transaction** and separately tests that expired designations are denied. It changes no production entitlement. The earlier failures in PRs #1290–#1292 and #1296–#1298 must be assessed against #1299 before claiming clean full-suite closure. Never disable UE security or acceptance suites or invent waivers.

## Execution order: implement, verify, integrate, advance

**Phase 0 — close the foundation PRs.**

1. Snapshot live `main` and in-flight UE Step 1 heads; review collisions with UE migrations and authority packages.
2. Verify #1299 required checks and targeted PGlite test; integrate the *test-only* fix under normal policy. Do not modify UE runtime or bypass the actual expiry check.
3. Take #1290 (signed-in SAGE index/detail/evidence/governance/exports/delivery) through clean CI and merge. If an authenticated page drops `authenticationType`, fix all call sites permanently; never default to `human`.
4. Take #1292, then #1291, then #1296, then #1298 through required SAGE + global test gates and merges. #1297 may merge independently after native `node --test tooling/scripts/sage-staging-http-preflight.test.mjs` and all repository checks. Resolve each PR's current CI evidence, not earlier stale heads. Review generated inventory conflicts sequentially.

**Phase 1 — make institutional authority real (Lane B).**

- Keep independent floors: authenticated user, active tenant and SAGE workspace membership, application permission, permitted evidence level, **versioned institutionally attested and holder-accepted mandate**, current office/position, exact resource and permitted action, conflict/recusal, effective/expiry/revocation, records holds and decision separation.
- Implement a server-only institutional instrument repository/attestation adapter with institution-controlled source verification. Browser requests may select an ID but can NEVER submit trusted `verificationStatus`, issuer, effective date, monetary commitment total or authority material. Do not let platform superadmin or an OCI facilitator mint institutional decisions.
- Wire the mandate check inside the SAME authoritative transaction as the consequential decision write and append-only audit, with a concurrency/revocation race test. For `resource.commit`, compute accumulated resource commitment from the authoritative ledger using minor units and currency; reject missing ledger, splitting, old delegated authority, expired/revoked grants, cross-organization and cross-resource substitutions.
- Choose a correct additive, namespaced `@nzila/sage-core` implementation; do not import UE-specific labor roles or change active Step 1 code without coordination.
- Prove both authorized success and each fail-closed scenario with isolated PostgreSQL/RLS tests; source tests alone do not establish institutionally valid grants.

**Phase 2 — turn CLEAR accountability into an operator workflow (Lane C).**

- Keep `buildSageAccountabilityDraft` as a reviewed draft only until a human adoption mutation is explicitly authorized, auditable and institutionally attested. Bind every question/intervention/commitment/observation/source version/competing interpretation/human decision/successor to exact provenance and point-in-time permissions.
- Source consistency is NOT attestation. Existing client `claimRegister` and `annotations` are merely unverified overlay until an authoritative institutional source and reviewer attest them. Do not silently promote caller text or compute causal conclusions.
- Build the persistent workflow, typed source contracts, positive and denial-path tests and concise decision brief. Distinguish historical approval from current authority; distinguish received deliverables from accepted deliverables and actual spend from commitment ceiling.
- Support multiple competing, dated and attributable interpretations without false reconciliation or inferred 'truth'.

**Phase 3 — CIVIC C1 restricted synthetic client application (Lane D).**

- Preserve `runtimeAuthorization.authorized=false`, `CIVIC_PRODUCT_GO_LIVE = NO_GO`, historical Slice 0/1/2 grants and archival hashes exactly. New founder-accepted C0 is **not** a new C1 machine-readable grant.
- Implement a narrowly scoped C1 authorization packet and guard amendment only through the canonical `scripts/lib/civic-oci-doctrine.ts`/contract-test path: explicit allowed source paths, immutable baseline, synthetic-only fixtures, fresh bounded expiry/revocation, branch/worktree allowance, no deployment/production/real data, no runtime alias. This gate must deny all unauthorized states before CIVIC runtime files execute.
- Build CIVIC mobile-first bilingual EN-CA/FR-CA desktop-compatible interface, institutional personas and CLEAR journeys on authorized synthetic fixtures only. User-facing writing is concise, credible, institutional and positive, with visually disciplined UX and no AI-tell explanatory clutter.
- Don't adopt a new method or charge a new SAGE SKU. No superadmin spoofing of client decisions.

**Phase 4 — staging, operations and restore (Lanes A/F/E).**

- Reverify, do not assume, the previous historical B-005 finding: `platform-admin` staging image `24b2be66` (pre-SAGE) and zero `sage_%` tables. Confirm current Azure resources and actual SHAs **read-only first**.
- Qualify root SAGE migrations `migrations/0032*`–`0044*` against an **isolated staging PostgreSQL** data plane with recorded checksum, transaction order, migration ledger, non-owner role, RLS, negative tenant proof and rollback/recovery. Keep UE production and shared migration tracks isolated.
- Deploy SAGE-enabled `platform-admin` to approved staging only after qualified images/config and credentials; prove image/revision digest, exact health commit, authenticated routes, audit events, wrong-tenant refusal, export/revocation, delivery and records lifecycle. The PR #1297 preflight is read-only/anonymous only and explicitly CANNOT prove route existence.
- Close G11 manual accessibility (keyboard, screen reader, bilingual/mobile), G12 incident and telemetry with human acknowledgement, and G13 **actual isolated restore plus non-resurrection of revoked access**; never label these PASS from code inspection or a scripted placeholder.

**Phase 5 — full synthetic R/D/T (Lane H/G).**

Execute, record immutable receipts, and adversarially retest all:
- **P01 procurement:** fictional CAD 40k historic authorization, current CAD 30k delegation, CAD 15k requested extension, cumulative ledger limit, contested source and absent training acceptance.
- **R01 regulatory merger:** two different institutions, no accidental inherited grants, policies or custody, historic source integrity, verified successor adoption.
- **S01 rotating secretariat:** old decisions and rejected options, what changed and why, successor capacities and non-disclosing sensitive sources.
- **T01 executive chain:** fictional CAD 80k cap, 4 expected/3 received deliverables, 10 vs 14 working days (+4/+40%) with correct denominator, missing actual spend and missing acceptance; conflicting source accounts, accountable human intervention and succession.
For each: authenticated success, wrong-tenant, wrong-role, expired/suspended/revoked mandate, recusal, duplicate/replayed request, source spoof, protected records, EN/FR, mobile and desktop, audit/restore. Show `SOURCE_IMPLEMENTED`, `LOCAL_PROVEN`, `STAGING_PROVEN`, `PRODUCTION_PROVEN` as *independent* observed states; never conflate them.

## Parallelism without UE collisions

Use separate worktrees for SAGE source authority, CLEAR/accountability, CIVIC C1/UX, staging/operations, and integration acceptance. Multiple lanes may work simultaneously when file and migration ownership is disjoint; serialize `packages/sage-core/index.ts`, `packages/sage-core/package.json`, shared PostgreSQL migration chronology, generated inventory, PR integration and mainline merges through a single coordinator. Never reset an active UE worktree or cherry-pick unreviewed partials into it.

Keep data in Canada and honor applicable client-level privacy, records, language and sector controls. No real client onboarding, public release, customer emails, OCI certification, external methodological endorsement or billing without distinct evidence and approval. Daphnée's earlier exploratory feedback is not an institutional acceptance or paid deal.

## Definition of DONE and autonomous behavior

Finish fully where the environment and authority permit. No owner interaction for resolved architectural choices or ordinary source/security remediation. Ask only for a verified external permission blocker (e.g. interactive Azure auth/MFA, institution-signed mandate/ATIP instruction, customer data authority, C1 exact bounded grant, or production GO); log the exact blocked action and continue independent lanes.

Report concisely with:
1. merged PRs and current SHAs; no fake merges;
2. exact targeted + broad tests, CI links and outstanding failures by **root cause**;
3. source vs deployed behaviour, real staging image/migration receipts and refusal proofs;
4. which R/D/T scenarios pass with executable evidence and which remain unproven;
5. remaining external blockers requiring a human, separately from engineering defects.

**Stop conditions:** no bypass of CIVIC guard, UE Step 1 governance/security gates, legal client consent, sensitive source authorization, operational restores, or production release controls. A test script's existence, a passed CI subset, a source-level 'security-design-reviewed' label, or an authenticated login redirect alone is NEVER deployment proof.

**Owner directive:** implement permanent fixes programmatically and systematically to the approved ceiling. Close all engineering defects in the authorized scope, not another planning wave.
