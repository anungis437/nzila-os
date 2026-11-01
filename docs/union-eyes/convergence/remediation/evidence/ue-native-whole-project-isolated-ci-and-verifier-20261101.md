# Union Eyes — whole native PostgreSQL project in CI, per-file isolation, and the stale post-apply verifier (2026-11-01)

## Authority and scope
Branch `agents/ue-cursor-final-closure`; baseline `9e05782a1ec217f256d23e141477b7b8cfe41557` (CI green at that head on PostgreSQL 15 and 16). Additive engineering and CI evidence. It awards **no defect credit and no CLOSED credit**, changes no frozen register, and is not a release approval. `READY_FOR_STAGING = NO`. No production environment exists yet, so nothing here touches one.

## What was wrong
1. **The native job ran 6 of 44 files, then 11 of 47.** `ue-native-postgres.yml` named its files explicitly, so every native test written afterwards was never run by CI, on any version. A parallel change widened the list to 11 and was red on both versions (three `finance-duties` tests).
2. **Seven native files had never produced evidence.** Each skips unless a private variable is set: `authority-kernel-storage`, `authority-kernel-django-audit`, `round58-complete-production-geometry-remediation`, `p4-authority-state-attest`, and three Docker proofs (`authority-kernel-case-backfill`, `election-certificate-succession`, `authority-kernel-identity-path`). Run for real, six passed and one failed.
3. **R-37, the failing one, was a defect in a deployment gate, not in a test.** `scripts/rls-enforcement/post-apply-verifier.ts` is the read-only post-mutation gate of `union-eyes-authority-rollout.yml`. Against the *current* converged database it reported **Missing 127** on both PostgreSQL versions: every one a false positive. Three causes, all drift from the storage-authority manifest it is meant to follow:
   - it did not know the dedicated-execution-context classes (the Django framework tables `auth_group`, `auth_user`, … were flagged for lacking runtime RLS policies they are not meant to have);
   - it demanded policies for all four commands and a system `ALL` policy, although append-only and read-only tables are deliberately granted fewer commands (`claim_status_transitions`, `external_matter_access_grants`, `representation_authorities`, …);
   - it carried a hand-maintained copy of the 24 baseline tables, which the manifest index forbids and which exempted tables that the current database satisfies.
4. **Native tests shared one database.** Authority records are append-only, so file order mattered: the VP office left by `authority-kernel-combined` made `workaid-union-side` collide on `ue_authority_mandates_active_uq`, and `workaid-union-side` could not be run twice. A test left an injected audit fault armed, which failed every later test with an unrelated error.

## Corrections
- **Verifier.** New `post-apply-verifier-core.ts`: pure decision logic plus a catalog observer behind a minimal `query` interface; `post-apply-verifier.ts` is a thin command with the same environment variable, summary lines and exit code. Expectations come from the manifest entry: exact effective privileges of `union_eyes_runtime` and `union_eyes_system` in both directions; for classes that own an RLS contract, RLS enabled and forced and a **permissive** policy that applies to the role for every command it is privileged to run. The classification treatment is an exhaustive `Record<StorageAuthorityClassification, …>`: a classification added without deciding its treatment fails typecheck, which is how this drift went unnoticed. The hand-maintained baseline list is removed.
- **p4 suite, stage 5.** The frozen 2026-09 chain can never satisfy today's manifest (later migrations supply the policies and grants), so its old `Missing: 0` assertion was false by construction. It now asserts what the frozen chain can still guarantee: the verifier runs, **`Extra: 0`** (it never grants beyond the manifest), and every table the frozen SQL itself governs (261, parsed from the SQL) ends with RLS enabled and forced. Full conformance is proven on the combined database instead.
- **Per-file isolation.** `vitest.native-isolation.ts` runs before every native file; when `UE_NATIVE_TEMPLATE_URL` names the pristine converged database it gives the file a clone (`CREATE DATABASE … TEMPLATE`, about 2 s for a 38–44 MB database), points `UE_AUTHORITY_COMBINED_URL` and `UE_CENSUS_URL` at it, and drops it afterwards. Without the variable files run as before. `native-database-isolation.postgres.test.ts` proves the clone is not the template, starts from its schema and data, and that writes do not reach it.
- **CI.** `ue-native-postgres.yml` runs the whole native project, gives each gated file its environment (Django, the three Docker flags, a server URL, a dedicated scratch database for the two legacy RLS suites that drop real table names), and verifies with `tooling/scripts/lib/ue-native-results-contract.mjs` (13 `node:test` tests). The contract derives the expected files from disk, so a new native test cannot silently go unrun: every file must run and pass, no test may fail, and the only skip allowed is named, with its reason, in `ue-native-expected-skips.json`. A skip is recorded in the receipt as a skip and never counted as a pass; an expected skip that stops skipping fails the contract so the list cannot go stale.
- **`finance-duties`.** Merged with the parallel fix (`febaad0a2`): its fail-closed test for Canonical V2 without the auth-owned membership reader is kept. The hash-chained audit sink's atomicity, which that change dropped, is restored as its own test, labelled for what it proves, with the membership read pinned to the legacy source for that test only.
- **`p4-authority-state-attest`, `round58-…`:** run against a scratch database whose host reads `localhost` (the suites use that to disable TLS); never against the converged database.

## Verification (local, CI-faithful)
Brand-new PostgreSQL 15.19 and 16.15 databases (Django `migrate`, the approved Drizzle bootstrap, QA seed), then the whole native project with only the environment the workflow sets:

| | files | tests | passed | failed | skipped |
|---|---|---|---|---|---|
| PostgreSQL 16 | 49 | 459 | 458 | 0 | 1 (pinned) |
| PostgreSQL 15 | 49 | 459 | 458 | 0 | 1 (pinned) |

The results contract exits 0 on both. No clone database leaked and both templates were unchanged afterwards. The corrected verifier reports **Missing 0, Extra 0** on both converged databases (410 of 874 manifest entries in scope and checked, 12 more with no table) and **Missing 101, Extra 0** on the historical p4 fixture, so it still fails when it should. The seven formerly gated files: storage 11/11, Django audit 4/4 (Django's own `verify_audit_chain`), round58 11/11, p4 1/1, ownership backfill 1/1, election succession 1/1, identity path 9/9. Unit: `post-apply-verifier-core.test.ts` 14/14. Typecheck passes.

## Findings still open
- **Twelve manifest entries have no physical table** (`anti_scab_violations`, `cnesst_filings`, `customer_nps_surveys`, `customer_onboarding_milestones`, `joint_hs_committees`, `member_dues_issues`, `pay_equity_exercises`, `payroll_deductions`, `preventive_withdrawals`, `right_of_refusal_events`, `wcb_claims`, `wcb_employer_assessments`). The verifier skips them; `post-apply-verifier.postgres.test.ts` pins the list so a new one fails. They are the relations behind routes that answer 500.
- **The Canonical V2 topology is not built by any CI job.** One test (`message-lifecycle`: membership through the V2 conversation predicate) skips by design and is named in the receipt; the V2 definer reader is exercised only by the identity-path Docker proof, and the V2 clean-room qualification is not in any workflow.
- Needs a fresh or templated database: native files assume a clean database. CI and `UE_NATIVE_TEMPLATE_URL` provide it; pointing a single file at a used database can still fail, as `workaid-union-side` documents.

## Qualification boundary
Local runs on a developer machine. Exact-SHA PostgreSQL 15/16 CI results for the pushed commit must be read from the workflow artifacts. Synthetic disposable databases on the legacy auth topology: not real-login, Canonical V2, immutable-audit or staging acceptance.

**Accounting:** 777 provenance defects unchanged; defect credit 0; CLOSED 0; overall GO: NO.
