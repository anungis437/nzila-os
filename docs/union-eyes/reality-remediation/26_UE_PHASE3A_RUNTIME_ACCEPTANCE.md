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
**Headline result so far:** `UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL — APPLICATION_DATABASE_ROLE_BYPASSES_RLS`
(§4). `UE_SAAS_OPERATIONAL_READINESS remains NO_GO` — this is a genuine, disclosed SaaS blocker
discovered during runtime acceptance, not a source-remediation task performed in this branch.

## 0. Scope discipline

This ledger executes file 25 §6/§9's runtime-proof queue against the actual deployed Union Eyes
staging environment. It does **not** re-open source remediation. It does **not** begin Phase 3B
(recording environment, LIUNA fixtures, recording identities, recording certification). Two
stale PRs (#699, #700) were closed as superseded by already-merged #717 and #707 in this same
pass — see the PR history for the closing comments; no commits from either stale branch were
merged.

## 1. Deployment / source parity

### `UE_RUNTIME_SOURCE_PARITY = PASS_FOR_PINNED_ACCEPTANCE_BASELINE`

**Tested source:** `0a2c9fa0bd7698baf742f5c7649019effc3ff698`

| Field | Value |
|---|---|
| Container App | `nzila-os-union-eyes-staging` (resource group `nzila-canada-staging-rg`) |
| Latest revision | `nzila-os-union-eyes-staging--0000142` |
| Provisioning state | `Succeeded` |
| Image | `nzilacanadaacr.azurecr.io/nzila-os-union-eyes@sha256:9deb89a1898c2454f8b65853651944ed193f05a46b4f1a661e600f7e599f4eff` |
| Image tags (ACR manifest) | `0a2c9fa0bd7698baf742f5c7649019effc3ff698`, `staging` |
| Image push timestamp | `2026-08-31T22:21:43Z` |
| FQDN | `nzila-os-union-eyes-staging.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` |

This gate is **PASS scoped to the pinned acceptance baseline `0a2c9fa0b`** — the exact SHA file 25
was audited against — not a claim of exact parity with current `main`. All runtime evidence in
this ledger is attached to this identified deployed artifact only.

### `CURRENT_MAIN_DEPLOYMENT_PARITY = KNOWN_DRIFT / NON_BLOCKING_FOR_INITIAL_RUNTIME_PROOF`

`git diff --stat` between `0a2c9fa0b` and current `main` (`d4f0aa0d0`) shows 82 files under
`apps/union-eyes/` changed, all 1–30 line diffs:

- 81 files: doc-comment / reference-string path updates only (`docs/oci/...` → `docs/oci/superseded/...`),
  from the #748 OCI canon collapse. Zero behavioral change — confirmed by reading full diffs of
  `lib/icra/scoring.ts`, `lib/whitepaper/library.ts`, `lib/icra/__tests__/signal-integrity/questionSignalIntegrity.test.ts`,
  and `lib/workbook/engines/workflows/continuityWorkflowRegistry.ts` (the largest diff, 30 lines).
- 1 file with real content difference: `lib/oci/frameworks/index.ts` — `OCI_METHOD.doctrineVersion`
  (`'1.0.0'` → `'1.1.0'`) and three `productFamily` taxonomy strings. Not case/grievance/deadline/
  member business logic; no gate below depends on this constant.

Current `main` is newer than what is deployed. If runtime remediation changes source, or `main`
becomes the intended release candidate, the corrected artifact must be deployed and the affected
runtime gates re-run before final `UE_SAAS_OPERATIONAL_READINESS` certification — this ledger does
not transfer evidence between unidentified image digests.

## 2. Health / readiness probe reconciliation

**Corrected classification: `INVALID_PROBE_PATH / NOT_A_PRODUCT_DEFECT`.**

An earlier draft of this ledger classified a manual `curl` to `/api/health/ready` (307→404) as a
deployed-system defect. That was wrong: Union Eyes source does not define `/api/health/ready` —
it never existed. The manual probe guessed a path that isn't real.

Inspected before correcting:

- **Actual routes in source:** `apps/union-eyes/app/api/health/route.ts` (`/api/health` — full
  dependency check: DB, auth, Redis, Django backend), `apps/union-eyes/app/api/health/liveness/route.ts`
  (`/api/health/liveness` — trivial 200), and `apps/union-eyes/app/api/ready/route.ts` (`/api/ready`
  — the real readiness probe, gated by `READY_REQUIRE_QUEUE`/`READY_REQUIRE_STORAGE` env vars).
- **Container App probe configuration:** `az containerapp show ... --query properties.template.containers[0].probes`
  returns empty — Azure Container Apps has **no platform-level liveness/readiness probe configured**
  for this app at all. Nothing in the deployment contract calls any `/api/health*` or `/api/ready`
  path; the container's own `PORT`/`NODE_ENV` env vars are the only startup contract ACA enforces.
- **Live verification of the real routes**, staging, 2026-09-01: `GET /api/health` → `200`;
  `GET /api/health/liveness` → `200`; `GET /api/ready` → `200`.

No remediation performed — there is nothing to fix. `READY_REQUIRE_QUEUE`/`READY_REQUIRE_STORAGE`
being unset (`false`/default) in the Container App's env is consistent with the code's own
`parseBoolEnv(..., false)` defaults and is not itself a finding.

## 3. Infrastructure inventory confirmed reachable this session

| Resource | State |
|---|---|
| `nzila-staging-db` (PostgreSQL Flexible Server, `nzila-staging-rg`) | `Ready`, PG 15, FQDN `nzila-staging-db.postgres.database.azure.com` |
| `workspace-nzilacanadastagingrgLHi9` (Log Analytics workspace, `nzila-canada-staging-rg`) | exists |
| `nzila-staging-kv` (Key Vault) | reachable; secret **names** enumerated (values not read) — `database-url`, `DB-HOST`, `DB-NAME`, `DB-USER`, `db-password`, `prod-azure-ad-client-secret`, `resend-api-key`/`resend-key`, `REDIS-HOST`/`REDIS-PASSWORD`, `upstash-redis-url`/`upstash-redis-token`, `voting-secret`, etc. |

## 3. Infrastructure inventory confirmed reachable this session

| Resource | State |
|---|---|
| `nzila-staging-db` (PostgreSQL Flexible Server, `nzila-staging-rg`) | `Ready`, PG 15, FQDN `nzila-staging-db.postgres.database.azure.com` |
| `workspace-nzilacanadastagingrgLHi9` (Log Analytics workspace, `nzila-canada-staging-rg`) | exists, receiving container console logs |
| `nzila-staging-kv` (Key Vault) | reachable; `database-url` retrieved into process memory only for §4 (never printed, written, or committed) |

## 4. `UE_RUNTIME_RLS_TENANT_ISOLATION` = `FAIL — APPLICATION_DATABASE_ROLE_BYPASSES_RLS`

**This is a genuine, disclosed SaaS blocker. No synthetic fixtures were created for this gate —
per the operator's own instruction, a role that bypasses RLS is not worked around to obtain a
passing test.**

### Method

1. **Preferred A (in-container exec) attempted first, as instructed, and hit real platform
   limits**, not skipped for convenience:
   - `az containerapp exec ... --command "node -v"` succeeded (confirms Node v20.20.2 available
     in the deployed revision).
   - A short recon script passed as a base64 payload of ~2400 characters via `--command` failed
     with `Handshake status 404 Not Found` on the exec websocket — the command exceeds a length
     limit on that endpoint.
   - A chunked-write workaround (writing the payload to `/tmp` across ~9 smaller `printf ... >>`
     calls) hit `Handshake status 429 Too Many Requests` on the exec websocket after a handful of
     rapid calls, and remained rate-limited after 15s and 45s cooldowns. At the volume of calls a
     full multi-domain, two-org RLS proof requires, this channel is not viable.
   - Conclusion: Preferred A is real and does connect, but Azure Container Apps' exec console is
     rate-limited/length-limited in a way that makes it impractical for scripted, multi-step
     database probing in this session. This is a platform constraint, not a shortcut.
2. **Preferred B (Entra/passwordless Postgres auth)** — `az postgres flexible-server microsoft-entra-admin list`
   returned `Bad Request`; no Entra-based admin path was confirmed available for this server in
   the time available. Not pursued further once C succeeded.
3. **Fallback C (Key Vault `database-url`, process memory only) — used.** `database-url` was
   retrieved via `az keyvault secret show --vault-name nzila-staging-kv --name database-url
   --query value -o tsv` directly into a PowerShell variable, exported only as `$env:DATABASE_URL`
   for a single local Node child process, never echoed/printed/written to a file/included in any
   commit or this document, and cleared (`Remove-Item Env:\DATABASE_URL`; variable set to `$null`)
   immediately after the probe completed. A temporary, single-IP Postgres firewall rule
   (`allow-ue-runtime-acceptance-temp`, this workstation's IP only) was required for the network
   path and was removed immediately after use (`az postgres flexible-server firewall-rule delete`,
   confirmed via a follow-up `firewall-rule list` showing only the two pre-existing rules).

### Mandatory pre-assertion check (§3 of the operator's brief) — this is what stopped the gate

Query run: `SELECT current_user, current_database()`, `SELECT rolname, rolsuper, rolbypassrls,
rolinherit, rolcreaterole, rolcreatedb FROM pg_roles WHERE rolname = current_user`, and
`relrowsecurity`/`relforcerowsecurity`/owner from `pg_class` plus `pg_policies` for the target
tables — using the **exact same `DATABASE_URL`/`PGUSER` the deployed Container App itself is
configured with** (`PGUSER=nzilaadmin`, confirmed from `az containerapp show`'s env dump), not an
elevated administrative side-channel.

Result:

```
current_user:      nzilaadmin
current_database:   nzila_os_staging
rolsuper:           false
rolbypassrls:       true      <-- the deployed app's own DB role bypasses RLS
rolinherit:         true
rolcreaterole:      true
rolcreatedb:        true
```

**`rolbypassrls: true` on `nzilaadmin` — the exact role the deployed `DATABASE_URL` secret
authenticates as — means every query the running application makes already bypasses any RLS
policy that might exist, unconditionally.** This alone is disqualifying per the operator's own
rule: *"If the deployed application DB role bypasses RLS, stop that gate and classify FAIL —
APPLICATION_DATABASE_ROLE_BYPASSES_RLS."*

### Second, independent finding: RLS is not even enabled on the target tables

Table-level inspection (`relrowsecurity`, `relforcerowsecurity` from `pg_class`; `pg_policies`)
for the representative domain tables identified from source (`organization_members` = members,
`grievances` + `claims` = grievance/case, `grievance_deadlines` = deadlines, `documents` +
`member_documents` = documents/evidence, `message_threads` = correspondence, `workplace_incidents`
= Health & Safety, `cross_org_access_log` = audit/cross-org):

| Table | `relrowsecurity` | `relforcerowsecurity` | Policies found | Domain |
|---|---|---|---|---|
| `organization_members` | `false` | `false` | 0 | members |
| `grievances` | `false` | `false` | 0 | grievances |
| `claims` | `false` | `false` | 0 | grievances (alt.) |
| `grievance_deadlines` | `false` | `false` | 0 | deadlines |
| `documents` | `false` | `false` | 0 | documents/evidence |
| `member_documents` | `false` | `false` | 0 | documents/evidence |
| `message_threads` | `false` | `false` | 0 | correspondence |
| `workplace_incidents` | `false` | `false` | 0 | Health & Safety |
| `cross_org_access_log` | `false` | `false` | 0 | audit/cross-org |
| `organization_hierarchy_audit` | — | — | table not found in this database | audit |

**Zero of the nine tables tested have Row Level Security enabled at all**, and zero policies
exist for any of them, despite several source migrations (`0051`, `0052`, `0073`, `0076`,
`apps/union-eyes/db/schema/grievance-workflow.sql`) declaring `ENABLE ROW LEVEL SECURITY` /
`CREATE POLICY` statements for some of these exact tables. Either those migrations were never
applied to this database, or RLS was later disabled — this ledger does not speculate further;
it records the live catalog state as authoritative ground truth over source-code migration
history, per the operator's own instruction to trust the live database over grep.

### Why this stops the gate rather than "still testing app-layer behavior"

Both findings are independently disqualifying, and together they mean: (a) even if RLS policies
existed, the deployed app's own role would ignore them (`rolbypassrls`), and (b) no such policies
are even present to ignore. Creating Org-A/Org-B synthetic fixtures and attempting
cross-org read/update/delete/insert probes at this point would only prove that the database
currently has no enforced tenant boundary — which is already established — so no fixtures were
created for this gate, consistent with "do not work around it to obtain a passing test."

### Verdict

`UE_RUNTIME_RLS_TENANT_ISOLATION = FAIL — APPLICATION_DATABASE_ROLE_BYPASSES_RLS` (compounded by
`RLS_NOT_ENABLED` on every tested table). This is a genuine SaaS blocker and is the dominant
finding of this Phase 3A run. It also invalidates any assumption of DB-level enforcement behind
`UE_RUNTIME_AUDIT_PERSISTENCE` (the `cross_org_access_log` audit table tested above has the same
gap) and `UE_RUNTIME_ASSIGNMENT_CONVERGENCE`/`UE_RUNTIME_EVIDENCE_REVOCATION`, both of which rely
on the same session-context RLS contract (`withRLSContext` → `app.current_org_id` →
Postgres policy). Per §11 of the operator's brief, remediation of this finding belongs in a
separate, focused fix branch off current `main` — not in this evidence branch.

## 5. Worker topology (`UE_RUNTIME_WORKER_CONCURRENCY` — partial finding, gate `NOT_RUN`)

`az containerapp list --resource-group nzila-canada-staging-rg` shows 15 Container Apps; there is
**no separate worker/queue-consumer Container App** for Union Eyes. The staging deployment is a
single Next.js process; deadline-reassignment convergence and similar background work are gated
by `CRON_SECRET_KEY` (present in the container's env as a Key Vault secret reference), implying
these run as authenticated HTTP cron-triggered routes rather than a standalone worker process with
its own lease/concurrency model to interrupt. Full concurrency-lease proof (concurrent invocation,
lease contention) was not executed this session — it requires knowing and safely invoking the
specific cron route(s) with the real `cron-secret` value, which was not pulled (no `CRON_SECRET_KEY`
value was retrieved or used). `NOT_RUN`, not `BLOCKED`: this is a scope/time constraint on this
pass, not an access blocker — the secret is available in the same Key Vault already reached.

## 6. `UE_RUNTIME_OBSERVABILITY` = `PARTIAL`

- Log Analytics workspace `workspace-nzilacanadastagingrgLHi9` (customerId
  `f5b0d5cf-bce9-437b-9297-a843fceeca11`) **is** receiving data: `ContainerAppConsoleLogs_CL`
  filtered to `nzila-os-union-eyes-staging` over the last 2 hours returned `Count: 4`. Basic
  container log shipping is confirmed working.
- A union query across `AppTraces`, `AppDependencies`, `AppRequests` (the OTEL/Application
  Insights distributed-tracing tables) returned **zero rows/no such tables** in this workspace.
  There is no confirmed distributed-tracing/OTEL span data for Union Eyes in staging — only raw
  container stdout/stderr log lines are present. Recorded as a real, disclosed gap: "observability"
  in the OTEL sense used elsewhere in this programme is not actually instrumented/flowing here.

## 7. `UE_RUNTIME_CANONICAL_ROUTE_HEALTH` = `PARTIAL` (unauthenticated spot-check only)

Two unauthenticated canonical paths checked live (2026-09-01): `GET /` → `307`; `GET
/en-CA/dashboard` → `307` (both consistent with expected auth-gate redirect behavior, not hard
404/500 failures). This is a 2-route spot-check, not the full 43-destination persona matrix — the
full matrix requires authenticated sessions for 5 personas (member/staff/executive/governance/
admin), which are not available this session. `BLOCKED_EXTERNAL_ACCESS` for the authenticated
portion; the unauthenticated portion that was checked shows no defect.

## 8. Remaining gates — status

| Gate | Status | What executing it requires |
|---|---|---|
| `UE_RUNTIME_ASSIGNMENT_CONVERGENCE` | `BLOCKED_EXTERNAL_ACCESS` (also compromised by §4's finding — same RLS contract) | Authenticated staging session (Entra) as a synthetic staff/rep user |
| `UE_RUNTIME_SUCCESSOR_REMINDER` | `BLOCKED_EXTERNAL_ACCESS` | Safe, non-production notification sink; synthetic non-deliverable destination address |
| `UE_RUNTIME_AUTH_OFFBOARDING` | `BLOCKED_EXTERNAL_ACCESS` | A synthetic Entra test identity provisioned in tenant `5082b8be-b04d-4a13-b61c-b6397670177b` with a revocable role assignment — **not created unilaterally per §8 of the operator's brief; this is the next legitimate human-controlled boundary** |
| `UE_RUNTIME_AUDIT_PERSISTENCE` | `FAIL (by association)` — same DB-level gap as §4 (`cross_org_access_log` has `relrowsecurity=false`) | N/A — already evidenced in §4 |
| `UE_RUNTIME_EVIDENCE_REVOCATION` | `BLOCKED_EXTERNAL_ACCESS` (also compromised by §4's finding) | Synthetic document/evidence record; two synthetic identities (authorized + cross-org) |

## 9. Cleanup / fixture accounting

**No synthetic fixtures were created in the staging database this session** — §4's precondition
check stopped the gate before fixture creation, per instruction not to work around a bypassed-RLS
finding. The only infrastructure changes made were: (1) a temporary single-IP Postgres firewall
rule, added and removed within this session (verified via `firewall-rule list` before/after); (2)
local scratch probe files (`.git/ue-ra-recon.*`), deleted after use, containing no secret material.
`DATABASE_URL` was held only in a local shell variable and a child process's environment for the
duration of one script execution, then cleared. Nothing was left running or provisioned.

## Next steps

1. **This finding (§4) should be triaged before continuing further Phase 3A gates that depend on
   the same RLS contract** — `UE_RUNTIME_ASSIGNMENT_CONVERGENCE`, `UE_RUNTIME_AUDIT_PERSISTENCE`,
   `UE_RUNTIME_EVIDENCE_REVOCATION` are all downstream of it.
2. Per §11 of the operator's brief: remediation (removing `BYPASSRLS` from the app's DB role and
   actually enabling/policing RLS on the nine tables above) belongs in a separate, focused fix
   branch off current `main`, followed by CI, merge, redeploy, and a rerun of the affected gates
   against the new, identified digest — not in this evidence branch.
3. `UE_RUNTIME_AUTH_OFFBOARDING` needs a decision from a human with tenant-admin authority: either
   provision a disposable synthetic Entra test identity in `onelabtech.com` for this purpose, or
   accept that gate as permanently blocked until one exists.
4. `UE_RUNTIME_SUCCESSOR_REMINDER` needs a safe notification sink (e.g., a Resend sandbox/test
   domain) identified before it can run without risk of a real email leaving the system.

