# 26 — Union Eyes Phase 3A Runtime Acceptance

**Programme:** Union Eyes Reality & World-Class Remediation — Phase 3A Runtime Acceptance
**Gate under evaluation:** `UE_SAAS_OPERATIONAL_READINESS`
**Prior ruling:** `NO_GO — RUNTIME_PROOF_REQUIRED` (`25_UE_SAAS_OPERATIONAL_READINESS_RERUN.md`, audited SHA `0a2c9fa0b`)
**Source SHA for this ledger:** `d4f0aa0d0ee798d5f30d913b32768e362a416e90` (`main`)
**Branch:** `docs/ue-runtime-acceptance`
**Started:** 2026-09-01
**Status of this document:** IN PROGRESS. This is a live evidence ledger, not a final ruling. Do not
treat any row below as `PASS` unless it cites durable evidence. Do not begin Phase 3B while any
`REQUIRED_BEFORE_SAAS_PASS` row reads anything other than `PASS`.

## 0. Scope discipline

This ledger executes file 25 §6/§9's runtime-proof queue against the actual deployed Union Eyes
staging environment. It does **not** re-open source remediation. It does **not** begin Phase 3B
(recording environment, LIUNA fixtures, recording identities, recording certification). Two
stale PRs (#699, #700) were closed as superseded by already-merged #717 and #707 in this same
pass — see the PR history for the closing comments; no commits from either stale branch were
merged.

## 1. Deployment / source parity — `UE_RUNTIME_SOURCE_PARITY`

**Verdict: `PASS`, with one documented non-blocking caveat.**

| Field | Value |
|---|---|
| Container App | `nzila-os-union-eyes-staging` (resource group `nzila-canada-staging-rg`) |
| Latest revision | `nzila-os-union-eyes-staging--0000142` |
| Provisioning state | `Succeeded` |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:9deb89a1898c2454f8b65853651944ed193f05a46b4f1a661e600f7e599f4eff` |
| Image tags (ACR manifest) | `0a2c9fa0bd7698baf742f5c7649019effc3ff698`, `staging` |
| Image push timestamp | `2026-08-31T22:21:43Z` |
| FQDN | `nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |

**Finding:** the deployed image is tagged with commit `0a2c9fa0b` — the exact SHA file 25 was
audited against. This is a known, identified artifact corresponding to the intended source
baseline; no redeploy/promotion is required before proceeding.

**Divergence check (`0a2c9fa0b` → `d4f0aa0d0`, current `main`):** `git diff --stat` shows 82
files under `apps/union-eyes/` changed, all 1–30 line diffs. Spot-checked the full diff of every
file with more than 2 changed lines plus a sample of the 2-line ones:

- 81 files: doc-comment / reference-string path updates only (`docs/oci/...` → `docs/oci/superseded/...`),
  from the #748 OCI canon collapse. Zero behavioral change — confirmed by reading full diffs of
  `lib/icra/scoring.ts`, `lib/whitepaper/library.ts`, `lib/icra/__tests__/signal-integrity/questionSignalIntegrity.test.ts`,
  and `lib/workbook/engines/workflows/continuityWorkflowRegistry.ts` (the largest diff, 30 lines —
  all `docPath`/`playbookPaths` reference-string updates in a module whose own docstring says
  "This module is pure data. It introduces no analytics.").
- **1 file with real content difference:** `lib/oci/frameworks/index.ts` — the exported
  `OCI_METHOD` constant's `doctrineVersion` (`'1.0.0'` → `'1.1.0'`) and three `productFamily`
  strings (`'ICRA'` → `'OCRA'`, `'OCI Diagnostic'` → `'OCI Diagnostic & Stabilization'`,
  `'OCI Runtime Infrastructure'` → `'OCI Runtime'`). This is OCI/OCRA naming-taxonomy metadata
  (part of the #748 canon collapse), not case/grievance/deadline/member business logic. No
  runtime-proof gate below depends on this constant.

**No redeploy performed or required for this ledger** — the one divergence found is
non-substantive to every gate in this document.

## 2. Basic reachability check (evidence, not a gate on its own)

- `GET /api/health` → `200` (curl, 2026-09-01).
- `GET /api/health/ready` → `307` to `/en-CA/api/health/ready` (locale-prefix middleware
  redirect), which then resolves `404`. **This is a discovered, real, deployed-system defect**:
  the readiness endpoint is being caught by the `[locale]` redirect middleware and 404s once
  redirected. Recorded here per this ledger's own discipline ("the next failure we want to find
  is a real deployed-system failure") — **not fixed in this pass** (source remediation is closed
  per the operator's own instruction; this is flagged for the next remediation cluster, not
  patched here).

## 3. Infrastructure inventory confirmed reachable this session

| Resource | State |
|---|---|
| `nzila-staging-db` (PostgreSQL Flexible Server, `nzila-staging-rg`) | `Ready`, PG 15, FQDN `nzila-staging-db.postgres.database.azure.com` |
| `workspace-nzilacanadastagingrgLHi9` (Log Analytics workspace, `nzila-canada-staging-rg`) | exists |
| `nzila-staging-kv` (Key Vault) | reachable; secret **names** enumerated (values not read) — `database-url`, `DB-HOST`, `DB-NAME`, `DB-USER`, `db-password`, `prod-azure-ad-client-secret`, `resend-api-key`/`resend-key`, `REDIS-HOST`/`REDIS-PASSWORD`, `upstash-redis-url`/`upstash-redis-token`, `voting-secret`, etc. |

## 4. Gates 5–13 — status before any live-data operation

**None of the remaining gates have been executed yet.** Every one of them (§5–§13 below) requires
either (a) direct connection to the live staging Postgres database using the `db-password` /
`database-url` secret in `nzila-staging-kv`, (b) an authenticated Entra session against the
staging app, or (c) triggering real notification-provider sends (Resend) and real Azure Monitor
trace generation. Pulling raw database credentials and creating/mutating synthetic test rows in a
shared staging database is a consequential action on shared infrastructure — before doing that,
this ledger pauses here for an explicit go-ahead rather than proceeding silently.

| Gate | Status | What executing it requires |
|---|---|---|
| `UE_RUNTIME_RLS_TENANT_ISOLATION` | `NOT_RUN` | `db-password`/`database-url` from `nzila-staging-kv`; create 2 synthetic orgs + test rows; direct `psql`/query access |
| `UE_RUNTIME_ASSIGNMENT_CONVERGENCE` | `NOT_RUN` | Authenticated staging session (Entra) as a synthetic staff/rep user; direct DB read to verify convergence rows |
| `UE_RUNTIME_WORKER_CONCURRENCY` | `NOT_RUN` | DB access to observe lease/claim rows; ability to interrupt a worker process (Container App exec or scale action) |
| `UE_RUNTIME_SUCCESSOR_REMINDER` | `NOT_RUN` | `resend-api-key`/safe notification sink; synthetic non-deliverable destination address |
| `UE_RUNTIME_AUTH_OFFBOARDING` | `NOT_RUN` | A synthetic Entra test identity provisioned in the tenant (`5082b8be-b04d-4a13-b61c-b6397670177b`) with revocable role assignment |
| `UE_RUNTIME_CANONICAL_ROUTE_HEALTH` | `NOT_RUN` | Authenticated sessions for all 5 personas (member/staff/executive/governance/admin); browser or scripted HTTP walk of all 43 destinations |
| `UE_RUNTIME_AUDIT_PERSISTENCE` | `NOT_RUN` | Perform one real governed mutation (e.g. assignment) + DB read of `audit_events`/hash-chain table |
| `UE_RUNTIME_EVIDENCE_REVOCATION` | `NOT_RUN` | Synthetic document/evidence record; two synthetic identities (authorized + cross-org) |
| `UE_RUNTIME_OBSERVABILITY` | `NOT_RUN` | Generate known traffic, then query `workspace-nzilacanadastagingrgLHi9` (Log Analytics) for the resulting traces |

## 5–13. (reserved — populated once execution resumes)

Each gate above gets its own numbered subsection with method, exact commands/queries run,
timestamps, sanitized evidence, and PASS/FAIL/BLOCKED/NOT_RUN once executed. Not written yet —
see §4.

## Next step

Confirm whether to proceed with pulling the `nzila-staging-kv` DB credentials and creating
synthetic Org-A/Org-B test fixtures in the live staging database to execute
`UE_RUNTIME_RLS_TENANT_ISOLATION` next (§5 of the operator's brief). Everything in §1–§3 above
required no secret material and no data mutation, so it proceeded without a checkpoint.
