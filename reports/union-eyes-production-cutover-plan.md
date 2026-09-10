# Union Eyes — Production Cutover Plan (Post-Round-59 Release Governance)

**Status: PLANNING ONLY. No production DB mutation, no role provisioning, no secret
mutation, and no production deployment has been performed under this plan.**

**PR:** #752 (`fix/ue-runtime-rls-foundation`), reviewed remediation SHA
`f09b610a541cc34234b049f133742e191bdd1db0`
**Companion PR:** #760 (`fix/ue-production-promotion-gate`) — decouples `main`-push
promotion from production; must merge and be verified **before** #752 merges (see §7).
**Prepared:** 2026-09-10, as part of the post-Round-59 merge-governance / production
cutover preflight. This plan is read-only preparation; every DB-mutating, secret-mutating,
or production-dispatching step below requires separate, explicit operator authorization.

---

## 0. Governance decision this plan operates under

```
ROUND58 = CLOSED / REMOTE VALIDATED
ROUND59 = CLOSED / REMOTE VALIDATED
STAGING_AUTHORITY_ENFORCEMENT = PROVEN
PR752_MERGE_READINESS (technical) = GO

PR752_OPERATOR_MERGE_GATE = BLOCKED
  BLOCKER_1 = human security review not yet approved
  BLOCKER_2 = merge currently auto-dispatches production (fix prepared in PR #760,
              not yet merged/verified)

SECURITY_INCIDENT = production admin credential exposed in operator session output;
                     rotation required (see §1)

PRODUCTION_PREFLIGHT = PARTIAL
PRODUCTION_DB_CATALOG_PREFLIGHT = NOT PERFORMED (no safe credential path — see §1.4)
PRODUCTION_MUTATION_PERFORMED = NO
```

These technical conclusions (Round 58/59 closure, staging proof) remain valid and are not
reopened by anything in this document. This is release-governance containment, not a new
remediation round.

---

## 1. Security incident record (sanitized — no secret values)

```
INCIDENT:
  production PostgreSQL admin credential exposed in operator session output

credential:
  nzilaadmin / production db-password (Container App secret, nzila-os-union-eyes-prod)

secret value:
  REDACTED / NEVER STORED in any report, commit, issue, or comment

how it was exposed:
  `az containerapp secret show --secret-name db-password` returns Container App
  native secret VALUES in plaintext to any caller with read access — unlike Key
  Vault secret references, there is no additional read-protection. This command
  was run to verify whether Container App secrets are retrievable via CLI (they
  are), not to intentionally retrieve the value.

use after exposure:
  none — the value was not used to open any database connection, was not written
  to any file, report, or persistent log by this session, and is not reproduced
  anywhere in this document or in reports/union-eyes-round59-staging-attestation.*

production DB connection with exposed credential:
  none

temporary firewall rule added for the (abandoned) read-only census:
  `temp-prod-readonly-preflight` on nzila-os-union-eyes-prod-db — removed
  immediately once the incident was recognized; confirmed removed (only
  `AllowAllAzureServices` remains on that server)
```

### 1.1 Rotation is mandatory before further production DB work

**Required operator action (not performed by this session):**

```
rotate production nzilaadmin PostgreSQL password
update the corresponding production secret reference/value
invalidate the exposed password
```

This plan prepares the exact procedure below but does not execute it. Do not perform
this rotation without explicit operator authorization.

### 1.2 Dependency map — who/what consumes the current admin credential

Traced without revealing any secret value, via `az containerapp show` (env var
structure only) against `nzila-os-union-eyes-prod`:

| Consumer | How it references the credential | Notes |
|---|---|---|
| `nzila-os-union-eyes-prod` container `nzila-os-union-eyes-prod` (frontend/Next.js) | `PGUSER=nzilaadmin` (plain env var, not a secret), `PGHOST`/`PGDATABASE`/`PGSSLMODE` plain env vars, `DATABASE_URL` → `secretRef: database-url` (native Container App secret, **not** Key Vault-backed — `keyVaultUrl: null` confirmed via `az containerapp secret show --query keyVaultUrl`) | Ordinary tenant request path today authenticates as `nzilaadmin` — the same admin-as-runtime pattern Round 58/59 closed in staging |
| `nzila-os-union-eyes-prod` container `django-backend` | `PGUSER=nzilaadmin` (plain env var), `PGPASSWORD` → `secretRef: db-password` (same native secret), `PGHOST`/`PGDATABASE` plain env vars | Same admin credential, second consumer |
| Migration/deployment workflows | `deploy-union-eyes.yml`'s `ensure_kv_backed_secret()` helper checks for `union-eyes-runtime-database-url` / `union-eyes-system-database-url` in the environment's Key Vault before wiring `DATABASE_URL`/`SYSTEM_DATABASE_URL` — **neither secret exists yet in `nzila-canada-prod-kv`**, so this helper currently only warns and leaves the prior `database-url` secretRef (the admin credential) in place for production | Confirmed via `az keyvault secret list --vault-name nzila-canada-prod-kv` — only `evidence-storage-key`, `upstash-redis-token`, `upstash-redis-url` exist; zero DB-credential secrets |
| Manual tooling | None identified in this session — no evidence of a human-run `psql`/tool profile referencing this credential was found in repo scripts targeting production specifically (scripts are environment-parameterized, not production-hardcoded) | Not exhaustively provable without a broader audit; flagged as an open item below |
| Other Azure resources | None identified — `nzila-ue-prod-db-drill-20260520` (a DR-drill Postgres server) is a separate resource; no evidence it shares this credential (out of scope to verify without DB access) | Flagged as an open item below |

**Open items for the operator before rotation:**
- Confirm no other Azure Automation runbook, Logic App, or external integration holds
  this same `nzilaadmin` password (this session found no such reference in the
  repository, but the repository cannot prove the absence of an out-of-band consumer).
- Confirm whether `nzila-ue-prod-db-drill-20260520` (the DR-drill server) was seeded
  from a snapshot that carries the same admin password, and whether it also needs
  rotation.

### 1.3 Rotation sequencing principle

Two candidate sequences exist; the choice matters because rotating the password alone,
without addressing *who uses it*, simply re-arms the same exposure surface with a new
value indefinitely:

```
PREFERRED (default — coordinated least-privilege cutover):
  provision union_eyes_runtime / union_eyes_system (§2 in the main plan / §6)
  → validate the new Key-Vault-backed secret references resolve correctly
  → move the application off nzilaadmin onto the new roles (§7 cutover sequence)
  → THEN rotate/invalidate the exposed nzilaadmin password (it is no longer the
    runtime credential at that point — rotating it is a clean invalidation, not a
    live-traffic-affecting change)

ALTERNATE (only if exposure severity requires immediate invalidation before the
above can be completed):
  rotate nzilaadmin now, while both application containers still depend on it
  → accept a brief availability risk during the rotation window (§1.4 below)
  → the role-provisioning/least-privilege cutover proceeds afterward, unchanged,
    just against the NEW admin password in the interim
```

**Do not simply rotate the admin password and leave the admin-as-runtime pattern in
place indefinitely** — that re-arms the exact same exposure surface (a plaintext-
retrievable Container Apps secret backing the sole runtime credential) with a new
value. The preferred sequence closes both the credential exposure AND the underlying
architectural gap in one coordinated change window; the alternate sequence only
becomes necessary if the exposed value must be invalidated faster than the
role-provisioning work can be completed.

### 1.4 Rotation atomicity (prepared procedure, NOT executed)

The plan must prevent a "DB password changed while every production app instance still
depends on the old value" outage. Exact sequence, whichever of §1.3's two orderings is
chosen for the *admin* password specifically:

```
1. SECRET UPDATE POINT: generate the new password; write it to the production
   Container App's `db-password` secret via `az containerapp secret set` — this does
   NOT yet change the live Postgres role's password, so existing connections/replicas
   are unaffected at this instant.
2. DB ROLE/PASSWORD UPDATE POINT: `az postgres flexible-server update
   --admin-password <new>` (or `ALTER ROLE nzilaadmin PASSWORD ...` via a controlled
   session) — this DOES immediately invalidate the old password for new connections;
   existing open connections in the running containers may continue until they
   naturally cycle, depending on Postgres connection-pool behavior.
3. APPLICATION REVISION UPDATE: trigger a new Container App revision (even a no-op
   env-var touch is sufficient) so both `nzila-os-union-eyes-prod` containers restart
   and re-establish connections using the just-updated secret — do not assume the
   running containers will pick up the new secret value without a revision change.
4. HEALTH CHECK: verify `/api/health`, `/api/health/liveness`, `/api/ready` all return
   healthy on the new revision before considering the step complete.
5. ROLLBACK WINDOW: if step 3's new revision fails health checks, the previous
   revision/secret combination is no longer valid (the DB password already changed in
   step 2) — the only rollback path at that point is to immediately redo step 1 with
   the OLD password value restored to the DB role (effectively rolling back step 2),
   not a Container App revision rollback alone. This is why steps 1-2 should happen in
   immediate succession, minimizing the window where secret and role are out of sync.
```

No step above prints, stores, or logs the plaintext value anywhere this session can
persist it — the operator executes this directly.

### 1.5 Long-term secret-storage correction

Production currently uses native Container App secrets for the DB credential(s)
(`db-password`, `database-url`) — retrievable in plaintext by any principal with
`listSecrets` authority (§1.6). Target state, matching the pattern staging already uses
successfully: Container App secrets should reference Azure Key Vault
(`keyvaultref:https://<vault>.vault.azure.net/secrets/<name>,identityref:system`) rather
than storing values natively, for both the new `union_eyes_runtime`/`union_eyes_system`
credentials (already planned this way — see §6/§7) and, opportunistically, the
migration-admin credential's ephemeral usage. **No mass migration of existing
production secrets is proposed or performed here** — this is a target-state note for
the operator to weigh once the least-privilege cutover is underway.

### 1.6 RBAC review plan for `Microsoft.App/containerApps/listSecrets/action` (plan only, not executed)

`az containerapp secret show` returns Container App secret VALUES in plaintext to any
identity holding this permission on the resource (confirmed the hard way during this
preflight — see §1). This is a genuine, separate finding from the credential exposure
itself: **any future holder of this permission can reproduce the same exposure**,
regardless of whether `nzilaadmin` is rotated. Recommended read-only review, to be
performed by the operator (not this session, and not by enumerating specific human
identities without cause):

```
1. Enumerate role assignments scoped to nzila-os-union-eyes-prod (and its resource
   group / subscription, since a broader-scoped role also grants this action):
     az role assignment list --scope <containerapp-resource-id> --all
     az role assignment list --resource-group nzila-canada-prod-rg --all
2. For each assigned role, check whether its permissions include
   Microsoft.App/containerApps/listSecrets/action — built-in roles that do:
   Owner, Contributor, and any custom role explicitly granting it (Reader does NOT).
     az role definition list --name "<role name>" --query "[].permissions"
3. Cross-reference the resulting principal list against who/what actually NEEDS this
   permission (CI/CD service principals performing legitimate secret rotation via
   deploy-union-eyes.yml, versus human operators who could instead use narrower,
   read-only roles for day-to-day access).
4. Record findings; do not revoke or modify any role assignment as part of this
   review without separate operator authorization — this is a visibility exercise,
   not a remediation, and revoking a CI/CD service principal's access without
   verifying it isn't required by an active deploy workflow could break deployments.
```

This session did not enumerate specific identities (only the class of permission and
the review methodology), consistent with not naming individuals without operational
need.



### 1.4 Why the production DB catalog census was not performed

`PRODUCTION_DB_CATALOG_PREFLIGHT = NOT PERFORMED`. After the credential exposure, the
only credential capable of a live census (the `nzilaadmin` admin password) had just been
inadvertently displayed in this session's own output. Continuing to use it — even
read-only — would have compounded the exposure and violated the immediate
incident-containment instruction. No Entra ID / Microsoft Entra PostgreSQL
authentication is currently configured for this server (`az postgres flexible-server
ad-admin`/`microsoft-entra-admin` calls returned no admin), so no passwordless
alternative existed either. **Do not infer production catalog state from staging** —
the two are structurally different today (see §3), so staging's 986/986 RLS preflight
result says nothing about production's actual current catalog.

### 1.5 Safe future DB preflight mechanism (design, not yet built)

Before resuming direct production DB inspection, prefer, in order:

1. **Ephemeral, controlled CI/Azure job** — a `workflow_dispatch`-gated job (mirroring
   `apply-django-migrations`'s pattern already proven in staging) that fetches a
   Key-Vault-scoped credential directly into the job's environment, runs
   `scripts/rls-verify.ts --mode=preflight` (or a read-only subset), and emits only
   sanitized pass/fail counts as job output/artifact — the credential never reaches an
   interactive human or agent session.
2. **Dedicated read-only production attestation principal** — a Postgres role with
   only `pg_read_all_stats`/catalog-read privileges (roles, ACLs, RLS policies,
   relation inventory, migration state), no application data access, provisioned once
   role separation exists (§2), used only by the ephemeral job above.
3. **Managed identity / Entra ID PostgreSQL authentication**, if/when configured for
   this server, as a longer-term replacement for password-based admin access entirely.

Future production DB preflight output must be limited to: database fingerprint, role
names/attributes, table/policy/ACL counts, migration state, RLS/FORCE flags, and
unexpected-object names if necessary. **Never**: passwords, connection strings, secret
values, row contents, or PII.

### 1.6 Container Apps secret-governance finding (separate from the credential incident)

`az containerapp secret show <name>` returns the secret **value** in plaintext to any
principal holding `Microsoft.App/containerApps/listSecrets/action` on the resource —
structurally different from Key Vault references, which are read-protected by Key
Vault's own RBAC/access-policy layer. This is a platform-level property, not something
this session introduced. Recommended follow-up (operator-owned, not performed here):

- Review who currently holds `Microsoft.App/containerApps/listSecrets/action` (or
  broader Contributor) on `nzila-os-union-eyes-prod` and the other production Container
  Apps.
- Where practical, migrate native Container App secret **values** to Key Vault
  references (`keyvaultref:...,identityref:system` — the same pattern
  `deploy-union-eyes.yml` already uses for `union-eyes-runtime-database-url` once that
  secret exists) so secret lifecycle/audit/rotation is centralized in Key Vault. This
  does not eliminate the need for correct Azure RBAC on the Key Vault itself, and no
  mass migration of existing production secrets is proposed or performed here.

---

## 2. Critical merge-coupling finding and fix

`auto-promote-union-eyes.yml` (triggers on push to `main` for union-eyes-relevant
paths) fanned out to `[production, demo, pilot, staging]` via
`gh workflow run deploy-union-eyes.yml -f emergency_ack=EMERGENCY -f environment=<env>`
— a hardcoded acknowledgement string, not human approval. The repository's `production`
GitHub Environment exists but has `protection_rules: []` (confirmed via
`gh api repos/.../environments` — zero required reviewers), so `environment: production`
in the deploy workflow was a no-op gate. **Net effect: merging PR #752 to `main` would
have automatically deployed to production with zero human approval step**, immediately
after merge, via the exact code path this whole programme exists to close.

**Fix:** PR #760 (`fix/ue-production-promotion-gate`, branched from `main`, does not
touch #752):
- Removes `production` from `auto-promote-union-eyes.yml`'s matrix (`[demo, pilot,
  staging]` only) + a runtime guard that fails the job if `matrix.environment` ever
  resolves to `production` again.
- Removes `deploy-union-eyes.yml`'s `elif github.ref_name == 'main' -> DEPLOY_ENV=
  production` fallback — any non-`workflow_dispatch` trigger now always resolves to
  `staging`. Production is reachable **only** via an explicit `workflow_dispatch` with
  `environment=production`.
- Adds `tooling/contract-tests/union-eyes-production-promotion-gate.test.ts` (5
  structural assertions, confirmed to fail against pre-fix `origin/main` content) as a
  permanent regression ratchet.

**Still required, not done in PR #760 (operator action):** configure actual
`required_reviewers` protection rules on the `production` GitHub Environment. The
code-level fix prevents *automatic* dispatch; an authorized human explicitly running
`workflow_dispatch` with `environment=production` today still hits an environment with
no required-reviewer gate. This is a repository-settings action needing named reviewer
identities from the operator — not performed here.

**Dependency order (must not be reordered):**

```
A. PR #760 reviewed, CI green (pre-existing main-level Dependency Audit/Trivy/Ops
   Documentation Pack failures are known, pre-existing on `main` itself — see §2.1 —
   and are not new failures introduced by #760), merged to main
B. verify main no longer auto-dispatches production for union-eyes changes
   (re-run the contract test against post-merge main; confirm no auto-promote run
   targets production on the next qualifying push)
C. rotate the exposed production admin credential (§1.3), operator-authorized
D. complete human security review for #752 (§4)
E. rebase/update #752 against the new main if required (§2.2)
F. rerun materially affected #752 CI
G. merge #752
H. verify merge did NOT trigger production deployment
I. separately authorize production cutover (§5 onward)
```

### 2.1 Pre-existing main-level CI state (not introduced by PR #760) — Release Gate A verified

**`PR760_TECHNICAL_GATE = CLEAN_WITH_PROVEN_BASELINE_FAILURES`**, established with
exact-command, base-vs-head reproduction (not narrative assertion):

| Check | Failing step | PR #760 head | `main` baseline | Attribution |
|---|---|---|---|---|
| `Nzila Governance Gate / Dependency Audit` | `Enforce vulnerability waiver policy` | fails: 40 vulns, 11 unwaived (IDs 1158520/1158523/1158526/1158529/1193676/1193725/1193732/1193790/1193791/1193793/1193945) | fails, **byte-identical** vulnerability IDs (verified directly against `main`'s own scheduled Dependency Audit run) | BASELINE_INHERITED |
| `Nzila GA Gate / Governance Baseline / Dependency Audit` | same | same | same underlying job (reused via `nzila-governance.yml`) | BASELINE_INHERITED |
| `Nzila GA Gate / Governance Baseline / Trivy Container Scan` | `Run Trivy (filesystem mode) [BLOCKING]` | fails: known CVEs in `next`/`sharp`/`@tiptap/core`/`toml` | PR #760's diff touches **zero** dependency manifests (verified via `git diff origin/main..HEAD --name-only`) — Trivy's scan input is byte-identical to `main`, so its output must be identical | BASELINE_INHERITED |
| `CI / Ops Documentation Pack` | `Validate ops pack completeness` | fails: `reports/ops/snapshot.json is stale (15.1 days old; max 7)` | time-based staleness on a file this PR doesn't touch — fails identically regardless of branch | BASELINE_INHERITED |
| `Nzila Governance Gate / Governance Gate` | `Check all governance jobs passed` | fails | workflow source confirms `needs: [..., dependency-audit, ...]` + explicit `if needs.dependency-audit.result == 'failure': exit 1` | AGGREGATE_DOWNSTREAM_OF_BASELINE |
| `Nzila GA Gate / Governance Baseline / Governance Gate` | same | fails | same dependency chain, reused workflow | AGGREGATE_DOWNSTREAM_OF_BASELINE |

Zero checks are `PR_ATTRIBUTABLE`, `FLAKY/INFRASTRUCTURE`, or `UNKNOWN`. GitHub itself
reports 70 known vulnerabilities (27 high, 36 moderate, 7 low) on the default branch —
consistent with the Dependency Audit/Trivy findings above. These are **not** new
failures caused by the two-workflow-file change or the new contract test, and fixing
repository-wide dependency vulnerabilities is intentionally out of scope for this narrow
safety PR. Full evidence posted to PR #760 itself.

### 2.2 Consequence for #752 if #760 merges first — empirically verified

Once #760 merges into `main`, PR #752 may become behind its base. **Verified via
`git merge-tree` (no branches mutated) rather than assumed:** both
`.github/workflows/auto-promote-union-eyes.yml` and
`.github/workflows/deploy-union-eyes.yml` merge **cleanly, with zero conflicts** —
the two PRs' changed regions in `deploy-union-eyes.yml` are non-overlapping (#760
touches only the `plan` job's `DEPLOY_ENV` `if/elif/else`, lines ~62-70 of the base
file; #752's diff hunks in that file start at lines 20, 54, 179, 199, 215, ... none
inside that range). The **only** merge conflicts found are in the 4 generated
`tooling/repo-inventory/output/*` files (differing `tsTestFileCount`/
`pythonTestFileCount` between the two branches, since each independently regenerated
the inventory) — a trivial, mechanical conflict resolved by re-running
`pnpm inventory:generate` after integration, not a semantic conflict requiring manual
resolution. **Do not assume the old final SHA (`f09b610a5...`) can merge unchanged
without re-running this check** if either branch moves before the actual merge —
this verification is only valid as of the exact SHAs recorded in this document.
Preserve Round-59 security semantics regardless — do not let a mechanical rebase
silently alter any RLS/authority code.

---

## 3. Production topology (read-only findings, pre-cutover state — not regressions)

```
production resource group:        nzila-canada-prod-rg
production Container App:         nzila-os-union-eyes-prod
production Container Apps env:    nzila-canada-prod-env
production DB:                    nzila-os-union-eyes-prod-db (PostgreSQL 16,
                                   Standard_D2s_v3, 256 GiB)
production Key Vault:              nzila-canada-prod-kv

production ordinary DB principal:  nzilaadmin (legacy admin-as-runtime — both the
                                    frontend and django-backend containers connect
                                    as this role today)
production SYSTEM_DATABASE_URL:    absent (not set on either container)
production dedicated runtime/system
  KV secrets (union-eyes-runtime-database-url /
  union-eyes-system-database-url / migration-admin): absent from nzila-canada-prod-kv
production RLS architecture:       not yet cut over to the Round-58/59 model
```

**These are pre-cutover production state, not unexpected regressions** — production has
simply not yet received the role-provisioning + RLS-foundation + authority-enforcement
work this PR proves out in staging.

### 3.1 Staging vs. production distinctness (proven)

| | Staging | Production |
|---|---|---|
| Resource group | `nzila-staging-rg` / `nzila-canada-staging-rg` | `nzila-canada-prod-rg` |
| Container App | `nzila-os-union-eyes-staging` (FQDN `...jollydune-88c1e97f...`) | `nzila-os-union-eyes-prod` (FQDN `...bluesand-c3ac2d8c...`) |
| Database server | `nzila-staging-db` | `nzila-os-union-eyes-prod-db` |
| Key Vault | `nzila-staging-kv` | `nzila-canada-prod-kv` |

Distinct names, distinct resource groups, distinct Container Apps environments (distinct
default-domain suffixes confirm distinct underlying environments) — a production
workflow cannot silently resolve to staging infrastructure or vice versa.

### 3.2 Backup / PITR posture (preserved, not mutated)

```
backup retention:      30 days
geo-redundant backup:  enabled
high availability:     zone-redundant, healthy
earliest restore point (at time of preflight): 2026-08-12T06:57:43Z
```

No production backup configuration was changed by this preflight.

---

## 4. Human security review status

```
HUMAN_SECURITY_REVIEW = REQUIRED / NOT YET APPROVED
```

Evidence (repository-sourced, not inferred):
- `gh pr view 752 --json reviewDecision` → empty string (no formal review decision).
- Only review activity on #752: a single `github-advanced-security[bot]` COMMENTED
  review (CodeQL) — no human `APPROVED` review exists.
- The `security-design-reviewed` and `governance-approved` labels on #752 were applied
  by a human (`anungis437`) on **2026-09-03T14:15:00Z** — but the bulk of the
  RLS/storage-authority programme (rounds 40 through 59E, the entire authority-
  convergence/enforcement/principal-separation body of work) was committed **between
  2026-09-05 and 2026-09-10**, i.e., entirely *after* that label was applied. The label
  therefore cannot be read as certifying the current reviewed head.
- The automated "Security Design Review Gate" check passes on #752 only because none of
  this PR's changed files match that gate's narrow trigger paths (`packages/ai-core`,
  `auth/`, `middleware.ts`, etc.) — an automated gate PASS is not equivalent to a human
  security approval, per the PR's own narrative, which explicitly states the human
  review requirement "still stands... independent of the automated evidence."

**Human review must occur after the meaningful final diff.** If #752 requires a
rebase/update once PR #760 merges (§2.2), the human security approval should cover the
final mergeable diff — do not obtain approval and then materially change the PR
afterward without re-evaluation.

---

## 5. Migration lineage and production apply order

### 5.1 Inventory (from repository source, not yet applied to production)

| Migration / step | Current production state | Disposition |
|---|---|---|
| Django migrations (`backend/*/migrations/`) | Applied via the persistent container's own startup today (production has not adopted the ephemeral migration-job pattern) | **Required** — production needs to move to the ephemeral `apply-django-migrations` CI job pattern (Round 59C), removing `DJANGO_MIGRATE_EXTRA_ARGS`/migrate-on-boot from the persistent `django-backend` container |
| ICRA scoped migration (`db/migrations-cache/0005_...`) | Unknown without DB access — likely NOT applied (no evidence of a production dispatch of `apply-icra-capability-migration`) | **Required**, mandatory gate already exists in `deploy-union-eyes.yml` for future deploys |
| `0108_rls_tenant_isolation_foundation.sql` (RLS foundation) | NOT applied (`nzilaadmin` is still the sole runtime principal; no RLS-foundation-specific roles exist without provisioning) | **Required**, first-in-sequence |
| Authority-enforcement migration (`20260910_rls_enforcement_expansion_round58.sql`, PART C/E) | NOT applied | **Required**, after 0108 |
| Round-58 grant-order correction | N/A until enforcement migration is applied once | **Conditionally required** — see §5.3 on consolidation |
| Round-59 `congress_memberships` grant correction | N/A until enforcement migration is applied once | **Conditionally required** — see §5.3 |

### 5.2 Critical ordering invariants (must hold for production, as they did for staging)

```
schema exists                    before policy references schema
roles exist (union_eyes_runtime,
  union_eyes_system)              before grants/policies require roles
RLS policies ready                before broad (blanket) grants are removed
exact per-table grants active     after broad-authority (blanket grant) removal
congress_memberships corrective
  grant included                  in the same enforcement pass, not a forgotten follow-up
Django migrations complete        before the application revision that expects the
                                   resulting schema is deployed
```

### 5.3 Whether staging's corrective-step sequence should be replayed or consolidated

Staging required corrective steps (Round 58's grant-order regression, Round 59D's
`congress_memberships` gap) because those defects were discovered incrementally during
staged rollout. **For production, the safer default is a single, source-controlled,
already-corrected migration sequence** — i.e., apply `0108`, then a *version* of the
authority-enforcement migration that already includes the Round-58 grant-order fix and
the Round-59 `congress_memberships` grant in the correct order, rather than
intentionally reproducing the broken-then-fixed staging sequence.

This requires, before production apply:
- Confirming the enforcement migration file in the repository today already reflects
  the corrected PART C → PART E ordering (grant-order fix folded in) — **not verified
  in this session** (would require reading the current migration SQL end-to-end and
  diffing against the three corrective scripts; flagged as a pre-apply verification
  step, not assumed true).
- Confirming the `congress_memberships` grant is either already part of the manifest-
  driven grant generation (since the manifest was corrected in Round 59E) or is applied
  as an explicit, source-controlled additional step in the same change window — not as
  an afterthought discovered by a failing production request.
- If consolidation is used, it must independently prove: same final catalog state, same
  exact grants, same policies, transactional application, idempotency where required,
  and a clean policy oracle + ACL oracle run against the result — matching the rigor
  staging's own corrective sequence was eventually held to. **If this cannot be proven
  ahead of time, use the already-proven staged sequence (apply enforcement migration,
  then the Round-58 grant-fix, then the Round-59 congress_memberships fix, each as
  their own gated `workflow_dispatch` step) rather than inventing an unverified
  shortcut.**

### 5.4 Deployment DAG (production path, `deploy-union-eyes.yml`, read-only inspection)

Production is reachable only through explicit `workflow_dispatch` (post PR #760):

```
environment: production (workflow_dispatch input)
  ↓
plan (resolves RESOURCE_GROUP=nzila-canada-prod-rg,
      CONTAINERAPP_ENVIRONMENT=nzila-canada-prod-env, etc.)
  ↓
[gated, opt-in, one-time steps — each its own workflow_dispatch boolean input]
  apply-rls-foundation-migration        (if apply_rls_foundation_migration=true)
  apply-authority-enforcement-migration (if apply_authority_enforcement_migration=true)
  apply-round58-grant-fix-migration     (if apply_round58_grant_fix_migration=true)
  apply-round59-congress-memberships-grant-fix (if apply_round59_congress_memberships_grant_fix=true)
  ↓
build-push (image build — no DB dependency, can run in parallel with the above)
  ↓
deploy (replaces the live Container App revision — depends on whichever of the above
        gated jobs were requested; `ensure_kv_backed_secret()` wires DATABASE_URL/
        SYSTEM_DATABASE_URL to Key Vault-backed secrets IF they exist, else warns and
        keeps the prior secretRef — currently the admin-backed one for production)
  ↓
post-deploy smoke (existing job — health/liveness/ready checks)
```

No `workflow_dispatch` was performed in this session. This DAG description is from
static inspection of `deploy-union-eyes.yml` only.

---

## 6. Target end-state architecture (mirrors staging)

```
runtime app        → union_eyes_runtime   (NOSUPERUSER, NOBYPASSRLS, tenant-scoped)
system paths        → union_eyes_system    (NOSUPERUSER, NOBYPASSRLS, named-role RLS
                                             policies, separate SYSTEM_DATABASE_URL
                                             connection)
migration/deployment → migration-admin credential, EPHEMERAL ONLY (one-off CI job,
                                             never a persistent container env var)
persistent application
  containers          → NO admin or migration credential residency (0, matching the
                                             staging-proven invariant)
```

Rotation (§1) and this least-privilege cutover must be **coordinated, not conflated**:
rotate the existing admin password first as an isolated, low-risk change; provision the
new roles and cut the application over to them as a separate, later, fully-planned
change window. Do not attempt both in one step.

---

## 7. Production cutover sequence (future execution — NOT authorized by this plan)

Each numbered step below is a distinct, separately-authorized operator decision. This
plan does not authorize any of them.

```
1.  Confirm PR #760 merged to main; confirm (via the new contract test re-run against
    post-merge main, and/or observing the next qualifying push) that auto-promote no
    longer dispatches production.
2.  Rotate the production nzilaadmin credential (§1.3), independent of any other change.
3.  Provision union_eyes_runtime / union_eyes_system in production
    (scripts/provision-runtime-db-roles.ts, mirroring staging) — writes new Key Vault
    secrets in nzila-canada-prod-kv (union-eyes-runtime-database-url,
    union-eyes-system-database-url), does not touch the application yet.
4.  Apply 0108 (RLS foundation) to production via the gated workflow_dispatch step.
5.  Run the read-only RLS preflight (scripts/rls-verify.ts --mode=preflight) against
    production via the ephemeral-job pattern (§1.5) — must show 0 missing/unexpected
    before proceeding.
6.  Apply the authority-enforcement migration (ideally already including the Round-58
    grant-order fix and Round-59 congress_memberships grant per §5.3's consolidation
    analysis; otherwise the three-step staged sequence).
7.  Re-run the RLS preflight + an independent ACL oracle (live pg_class.relacl query,
    as used in Round 59D) — require 0 missing, 0 extra, 0 wrong-role, 0 wrong-command
    grants before proceeding.
8.  Deploy the application revision referencing the release candidate identity (§7.2)
    — this is the first point `DATABASE_URL`/`SYSTEM_DATABASE_URL` actually flip to the
    new roles for production traffic.
9.  Bounded canary smoke (§7.1) before full promotion, if the current single-revision
    deployment model supports it — see below.
10. Full-traffic post-deploy proof (§7.3) — catalog + principal + application-level
    evidence, not just "deployment succeeded".
11. Remove the old admin-as-runtime secretRef reliance once the new secrets are
    confirmed live and stable (do not leave both wired indefinitely).
```

### 7.1 Canary strategy

Azure Container Apps supports revision-mode traffic splitting, but
`nzila-os-union-eyes-prod` is currently configured with
`activeRevisionsMode: Single` (confirmed via `az containerapp show --query
properties.configuration.activeRevisionsMode` — read-only, no secrets). **A bounded
canary is not available today without first changing the app to multi-revision mode as
its own separate, deliberate prerequisite change** — do not improvise a canary
mechanism during the cutover itself. In `Single` mode, a new revision fully replaces
the prior one and receives 100% of traffic immediately; the safety net for a bad
cutover deploy is therefore the rollback path (§7.5: revert to the previous known-good
revision/image digest), not a traffic-splitting canary.

### 7.2 Release candidate identity

Once #752 merges, production rollout must be tied to explicit, recorded identifiers —
not `latest`:
```
main merge commit SHA
image digest(s) (frontend + django-backend)
migration digest(s) (0108, authority-enforcement, grant-fix scripts)
authority manifest digest (db/rls-storage-authority/)
topology digest (this document's §3, re-verified at cutover time)
```

### 7.3 Post-deploy proof requirements (deployment success is not sufficient)

A green `deploy-union-eyes.yml` run is necessary but not sufficient. Required
additionally, using the same evidence standard proven in staging (Round 59D):
- **Catalog proof**: live ACL/policy oracle re-run against production post-apply.
- **Principal proof**: ordinary traffic authenticates as `union_eyes_runtime`; system
  paths (cron, webhooks, offboarding) authenticate as `union_eyes_system`; no persistent
  application session ever authenticates as the migration-admin credential.
- **Application proof**: bounded, production-safe smoke — own-tenant read, cross-tenant
  negative read, same-user read, `SYSTEM_ONLY` runtime denial, system safe read,
  no-context fail-closed — using dedicated synthetic/approved test identities, never
  probing real customer records. Any finance-touching smoke must be read-only or an
  explicit no-op mechanism — never a real charge/refund/payout/remittance/tax filing.
- **Secret posture proof**: production runtime environment contains runtime/system
  Key-Vault-backed secret references and does **not** contain a migration-admin secret,
  `PGADMIN_*`, a Supabase credential, or a legacy plain admin connection string.

### 7.4 Abort criteria (any one → ABORT PRODUCTION CUTOVER)

```
production schema differs materially from the reviewed canonical surface
runtime/system roles are unsafe (SUPERUSER, BYPASSRLS, or unexpected memberships)
migration digest mismatch against the reviewed source
unexpected RLS policy found that isn't in the manifest
a migration step fails
post-apply ACL oracle mismatch
post-apply policy oracle mismatch
runtime still authenticates as admin after the cutover step that should have changed it
runtime container still contains a migration/admin credential
health checks fail
tenant smoke fails
a cross-tenant probe succeeds (i.e., isolation fails)
```

### 7.5 Roll-forward vs. rollback doctrine

For **database** migrations: prefer transactional abort *before* commit (the migrations
in this programme are written to run inside a transaction where possible) and
forward-compatible correction over speculative reverse SQL — do not claim database
rollback is trivial when it is not; a failed mid-migration state may require restoring
from the PITR window (§3.2) rather than a hand-written down-migration, depending on
where the failure occurred.

For the **application**: identify the previous stable Container App revision/image
digest before the cutover deploy begins, so a revision-level rollback (reverting traffic
to the prior, known-good image while the admin-as-runtime credential path is still
intact) is possible if the application-level cutover step (7 step 8 above) fails
health/smoke checks, independent of whether the database-side steps have already been
committed.

---

## 8. Residual backlog (ordinary backlog, not a continuation of the remediation programme)

| # | Item | Risk | Impact | Trigger for becoming release-blocking | Owner/domain | Recommended next action |
|---|---|---|---|---|---|---|
| 1 | Django CI test-execution gap — no CI workflow runs `manage.py check`/tests today | Low (caught manually this round; a real regression could ship undetected between manual checks) | Medium if a Django-side security regression ships silently | A production incident traced to an untested Django change | Platform/CI | Add a CI job running `manage.py check`, `makemigrations --check --dry-run`, and the backend security regression tests on the supported Python version — do not bolt on before #752 merges unless governance requires it |
| 2 | `billing.tasks.run_billing_scheduler_task`'s `_process_org_billing` remains a no-op stub | None today (stub performs zero mutations) | High if activated without a system-principal execution primitive first | Any PR that wires real mutation logic into this function | Billing/Django | Build a Django-side system-principal equivalent to `withSystemContext()`, with cross-org system-authority tests, financial idempotency, and transaction semantics, before activating |
| 3 | `organizations` cross-org sharing functionality gap — congress/federation sharing tiers never resolve a positive-visibility case for non-owner callers | None (fails CLOSED — denies, does not leak) | Functional only — blocks claiming congress/federation sharing as operational | Any commitment to ship congress/federation sharing as a supported feature | Union Eyes / clause-library | Build a bounded, trusted cross-org relationship query (a specific, scoped system-principal read path) — do not grant broad organization visibility to solve this |
| 4 | `finance.ts` remains `PARTIAL / NOT LOCKED` (mandate §52) | Independently scoped, does not block PR #752 | N/A — separate acceptance programme | Its own acceptance criteria, tracked separately | Finance | No change here; do not expand finance authority beyond the already-reviewed manifest during production cutover |
| 5 | Production Container Apps secrets are native (plaintext-retrievable), not Key-Vault-backed | Medium — depends entirely on RBAC scope of who holds `listSecrets` | Confirmed exposure risk (this session) | Any further plaintext exposure, or a scheduled access review | Platform/Security | Review current RBAC holders of `Microsoft.App/containerApps/listSecrets/action` on production; migrate to Key-Vault-backed secretRefs opportunistically, starting with the DB credential once the new roles exist |
| 6 | `production` GitHub Environment has no required-reviewer protection rule | Medium (closed for *automatic* dispatch by PR #760; still open for a manually-mistaken `workflow_dispatch`) | Same class of risk as the merge-coupling finding, smaller blast radius | Any future manual dispatch mistake | Platform/Release governance | Configure `required_reviewers` on the `production` environment (repo Settings → Environments), operator-named reviewers |
| 7 | Production not yet verified for multi-revision/canary support | Low (confirmed `Single` revision mode — no traffic-splitting canary available today) | A cutover deploy is all-or-nothing traffic-wise; rollback (not canary) is the safety net | The actual cutover execution, or a future decision to invest in blue/green deploys | Platform | If a lower-risk cutover is desired, evaluate switching to `Multiple` revision mode ahead of the cutover as its own change, independent of the RLS work |

Do not turn any of these into another RLS/security remediation round — they are ordinary
backlog, tracked here for visibility.

---

## 9. Final status

```
POST_ROUND59_TRANSITION = PARTIAL

RELEASE_GATE_A = COMPLETE

PR760_TECHNICAL_GATE = CLEAN_WITH_PROVEN_BASELINE_FAILURES
PR760_HUMAN_REVIEW = REQUIRED (no review, human or otherwise, exists on #760;
                      CODEOWNERS: /.github/** and /tooling/contract-tests/** are
                      owned by @nzila/platform @nzila/security)

PR752_OPERATOR_MERGE_GATE = BLOCKED
  BLOCKER_1 = human security review not yet approved
  BLOCKER_2 = merge currently auto-dispatches production (fix in PR #760, pending
              merge + verification)
PR752_HUMAN_SECURITY_REVIEW = REQUIRED (labels predate the bulk of the reviewed
                      work; no human-authored APPROVED review exists; CODEOWNERS:
                      /apps/union-eyes/** owned by @nzila/eng @nzila/ue, and
                      /.github/** owned by @nzila/platform @nzila/security since
                      #752 also modifies deploy-union-eyes.yml/nzila-governance.yml/
                      trivy.yml)

SECURITY_INCIDENT = production admin credential exposed; rotation required (operator
                     action, not yet performed)

PRODUCTION_PREFLIGHT = PARTIAL
PRODUCTION_DB_CATALOG_PREFLIGHT = NOT PERFORMED
PRODUCTION_DB_CONNECTION_PERFORMED = NO
PRODUCTION_MUTATION_PERFORMED = NO
```

**Next operator decisions, in order:**

```
A. review/merge PR #760 (technical gate is CLEAN_WITH_PROVEN_BASELINE_FAILURES —
   all 6 red checks traced to exact failing substeps with reproducible base-vs-head
   evidence in PR #760 itself and §2.1 above; none PR-attributable; human review
   from @nzila/platform / @nzila/security still required per CODEOWNERS)
B. verify main no longer auto-dispatches production for union-eyes changes
C. approve and execute production credential rotation (§1.3-§1.4), operator-authorized
D. complete human security approval of #752 (from @nzila/eng, @nzila/ue, and
   @nzila/platform/@nzila/security given its .github/ changes), covering the final
   mergeable diff
E. rebase/update #752 against post-#760 main if required — predicted clean per §2.2's
   empirical merge-tree proof (only trivial inventory-file regeneration expected)
F. rerun materially affected #752 CI
G. merge #752
H. verify the merge did NOT trigger a production deployment
I. separately authorize production cutover (§7), starting from step 1
```

No automatic actions were taken beyond what is documented in this report and in PR
#760 (including its updated description with the full CI attribution table and
conflict assessment). This session did not and will not merge PR #752, merge PR #760,
rotate any credential, connect to production PostgreSQL, or dispatch any production
workflow.
