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

## 9. Release Gate B — Human-Review Handoff & Merge Sequence Readiness

Prepared 2026-09-11. Confirmed live boundaries: #760 head `0c960b74504d5a1ddf6caa92053afb1a0d08c66a`
(base `09063f97258c576f55a61269ae2d6bf69d6da118` == current `origin/main`, unchanged since
Release Gate A); #752 head `2116dadda9bc0a2f716867a3419ac141d4ebb0a8` (same base, unchanged).
Neither branch moved — all Release Gate A technical evidence (contract test 5/5, full
suite 278/278 files 9536/9536 tests, the 6-check attribution table, the empirical
merge-tree conflict proof) is directly reused, not re-derived, and re-confirmed live: the
6 failing checks on #760 are the exact same job run IDs as Release Gate A (no new CI
execution occurred). Production environment `protection_rules` reconfirmed still `[]`.

### 9.1 Actual repository merge enforcement (GitHub-mechanical vs. internal governance)

**GitHub does NOT mechanically block merging either PR today.** Checked directly:

```
classic branch protection on `main`:  404 Not Found (none configured)

repository rulesets:  exactly one, named "default", targeting ~DEFAULT_BRANCH
  (main), with enforcement: "disabled" — i.e. inactive. Its (dormant) rule
  content, if ever enabled, would require:
    - deletion protection, non-fast-forward (no force-push)
    - pull_request rule: required_approving_review_count = 1,
      dismiss_stale_reviews_on_push = true,
      require_code_owner_review = FALSE (!),
      required_review_thread_resolution = false,
      allowed_merge_methods = [merge, squash, rebase]
  None of this is active. There is also no "required_status_checks" rule
  present even in the dormant ruleset — no CI job is configured as a required
  check today, active or dormant.
```

**Distinction, precisely:**
- **GitHub mechanically blocks merge:** NO — an authorized human could click "Merge" on
  either #760 or #752 right now; nothing in repository configuration prevents it, and
  even the one (disabled) ruleset would not require CODEOWNERS review if it were enabled.
- **Internal governance says do not merge:** YES — via this document, the PR #752
  containment notice, and the human-review requirement stated in both PR descriptions.
  This is a procedural/documentation control, not a platform-enforced one.

This is itself a residual backlog item worth the operator's attention (added to §8) —
if a mechanically-enforced required-review/required-status-check gate is desired going
forward, the existing "default" ruleset would need `enforcement` flipped to `"active"`
and `require_code_owner_review` set `true`, plus required status checks added.

### 9.2 Human review packets (posted to each PR, not duplicated here)

- **PR #760** now opens with a concise "Review Packet (quick reference)" block
  (purpose, risk, files of interest, core invariant, validation summary, known-red-CI
  summary, production-mutation statement, CODEOWNERS coverage) above the full
  Release-Gate-A evidence, so a reviewer is not required to read the whole forensic
  trail to approve.
- **PR #752** now opens with a "Human Security Review Packet" (root defects closed,
  final architecture, live staging proof summary, security-sidecar dispositions, final
  CI status, residual non-blocking backlog, and an explicit note on what changed since
  any earlier partial read of the PR) directly above the pre-existing release-governance
  containment notice — without deleting or duplicating the round-by-round history below
  it, which remains as audit record.

### 9.3 Reviewer coverage (CODEOWNERS-sourced, no individuals named)

```
PR #760 changed paths -> CODEOWNERS owners:
  .github/**                    -> @nzila/platform @nzila/security
  tooling/contract-tests/**     -> @nzila/platform @nzila/security
  => PR760_RECOMMENDED_REVIEW_COVERAGE = platform + security

PR #752 changed paths -> CODEOWNERS owners:
  apps/union-eyes/**             -> @nzila/eng @nzila/ue
  .github/** (deploy-union-eyes.yml, nzila-governance.yml, trivy.yml)
                                  -> @nzila/platform @nzila/security
  security/redteam/**            -> @nzila/security @nzila/platform
  tooling/contract-tests/**      -> @nzila/platform @nzila/security
  (apps/union-eyes/middleware.ts is CODEOWNERS-flagged for
   @nzila/security @nzila/platform, but #752 does NOT touch that file —
   confirmed absent from its diff)
  => PR752_RECOMMENDED_REVIEW_COVERAGE = eng + ue (app ownership) AND
     platform + security (workflow/red-team/contract-test ownership) —
     both domains apply, not either/or
```

`REVIEW_REQUEST_READY = YES` for both PRs, with the exact team targets above. No review
request was submitted (`gh pr edit --add-reviewer` or equivalent) — that requires
separate operator authorization naming which specific team/human to request, not
performed here.

### 9.4 Post-#760-merge integration procedure for #752 (prepared, NOT executed)

```bash
# Only after the operator has merged #760 into main:
git fetch origin
git checkout fix/ue-runtime-rls-foundation
git fetch origin main
git merge origin/main            # or: git rebase origin/main, per repo convention
                                  # for this shared branch (prior sessions have used
                                  # merge/fetch+compare, not rebase, to avoid
                                  # rewriting shared history — see repo memory)

# Expected: .github/workflows/auto-promote-union-eyes.yml and
# .github/workflows/deploy-union-eyes.yml merge cleanly (verified via git
# merge-tree in Release Gate A — the two PRs' changed regions in
# deploy-union-eyes.yml do not overlap). The ONLY expected conflict is in the
# 4 generated inventory files:
#   tooling/repo-inventory/output/{inventory,repo-inventory}.{json,md}
# Resolve by regenerating, not by hand-editing:
pnpm inventory:generate
git add tooling/repo-inventory/output/
git diff --check                 # confirm no leftover conflict markers anywhere
git status --short                # confirm only the expected files changed
```

Must preserve after integration (verify explicitly, not just "no conflict markers"):
- #760's production-exclusion (matrix `[demo, pilot, staging]`, runtime guard, the
  hardened `DEPLOY_ENV` fallback) — re-run
  `tooling/contract-tests/union-eyes-production-promotion-gate.test.ts` post-merge.
- #752's migration/RLS jobs (`apply-rls-foundation-migration`,
  `apply-authority-enforcement-migration`, `apply-round58-grant-fix-migration`,
  `apply-round59-congress-memberships-grant-fix`) still present and still gated behind
  their respective `workflow_dispatch` boolean inputs.
- #752's ephemeral migration authority (`apply-django-migrations` job pattern) intact.
- #752's exact secret handling (`ensure_kv_backed_secret()` conditional wiring) intact.

Then rerun the materially affected #752 CI (at minimum: the full check matrix, since
the base moved) before requesting final human security sign-off on the resulting diff.

### 9.5 Post-#760-merge verification (prepared query set, NOT executed now)

Run immediately after the operator merges #760, before doing anything else:

```bash
# 1. Confirm main contains the change
git fetch origin main && git log --oneline -1 origin/main
git show origin/main:.github/workflows/auto-promote-union-eyes.yml | grep -A3 "environment:"

# 2. Confirm the production-promotion-gate contract test passes against main directly
git worktree add /tmp/verify-post-merge origin/main
cp tooling/contract-tests/union-eyes-production-promotion-gate.test.ts /tmp/verify-post-merge/tooling/contract-tests/ 2>/dev/null || true
# (the test file itself will already be on main post-merge; the copy above is only
# a fallback if verifying against a commit before the test file lands)
cd /tmp/verify-post-merge && npx vitest run tooling/contract-tests/union-eyes-production-promotion-gate.test.ts
cd - && git worktree remove /tmp/verify-post-merge --force

# 3. Structural re-confirmation (matches Release Gate A's own method)
python3 -c "
import yaml
doc = yaml.safe_load(open('.github/workflows/auto-promote-union-eyes.yml'))
assert 'production' not in doc['jobs']['fanout']['strategy']['matrix']['environment']
print('OK: production excluded from auto-promote matrix')
"
```

### 9.6 Verifying #760's merge itself did not dispatch production (prepared, NOT executed)

```bash
# Find the merge commit SHA for #760 on main, then check what it triggered:
gh api repos/anungis437/nzila-os/commits/<merge-sha>/check-runs --jq '.check_runs[].name'

# Look specifically for Auto-promote Union Eyes and its downstream deploy-union-eyes
# dispatches:
gh run list --repo anungis437/nzila-os --workflow=auto-promote-union-eyes.yml --branch main --limit 3 \
  --json databaseId,headSha,createdAt

# For the run matching the merge SHA, list its dispatched jobs/matrix entries:
gh run view <run-id> --repo anungis437/nzila-os --json jobs --jq '.jobs[].name'
# Expected matrix entries: demo, pilot, staging
# PROHIBITED: production
```

Expected result to record: `PR760_POSTMERGE_PRODUCTION_DISPATCH = NONE`. This step is
prepared only — not run, since #760 has not been merged.

### 9.7 Production GitHub Environment required-reviewer change procedure (prepared, NOT executed)

Documented mechanics for the operator (real GitHub features, no invented reviewer IDs):

```bash
# Via API (reviewer IDs/team slugs must be supplied by the operator — not guessed here):
gh api --method PUT repos/anungis437/nzila-os/environments/production \
  -f 'wait_timer=0' \
  -F 'reviewers[][type]=Team' -F 'reviewers[][id]=<platform-team-id>' \
  -F 'reviewers[][type]=Team' -F 'reviewers[][id]=<security-team-id>' \
  -f 'deployment_branch_policy=null'

# Or via the GitHub UI: Settings -> Environments -> production -> "Required reviewers"
# -> add @nzila/platform and/or @nzila/security (or specific named approvers per
# organizational policy) -> Save protection rules.
```

Required reviewers should be selected from real, currently-authorized security/platform
governance (e.g. the same `@nzila/platform`/`@nzila/security` teams CODEOWNERS already
designates for `.github/**` and deployment-adjacent paths) — this document does not
invent or assume specific team/user IDs. **No production deployment should be
authorized before this protection exists**, independent of and in addition to #760's
code-level fix (which closes *automatic* dispatch; this closes unprotected *manual*
dispatch).

### 9.8 Credential-rotation authorization package (decision-ready, NOT executed)

```
OPTION A — PREFERRED (coordinated least-privilege cutover first)
  1. Provision union_eyes_runtime / union_eyes_system in production (§6/§7 step 3).
  2. Validate the new Key-Vault-backed secret references resolve correctly (§7 step 5).
  3. Cut the application over to the new roles (§7 steps 4-8).
  4. ONLY THEN rotate/invalidate the exposed nzilaadmin password — at this point it
     is no longer the runtime credential, so rotating it is a clean invalidation with
     no live-traffic impact.
  Tradeoff: the exposed credential remains technically valid (though unused by this
  session and not connected-to) for the duration of steps 1-3.

OPTION B — EMERGENCY (rotate first, cutover after)
  1. Rotate nzilaadmin immediately (§1.4's atomicity procedure: secret update point ->
     DB role/password update point -> forced application revision -> health check ->
     defined rollback window).
  2. Complete the least-privilege cutover afterward, unchanged, against the NEW
     admin password in the interim.
  Tradeoff: a brief availability risk during the rotation window (§1.4), and the
  admin-as-runtime pattern still exists immediately after rotation — only the specific
  exposed value is invalidated, not the underlying architectural exposure.

RECOMMENDATION: Option A, unless the operator's own risk assessment concludes the
exposed value must be invalidated faster than the role-provisioning work (§7 steps 1-3)
can safely complete. This document does not make that risk-tolerance decision — it is
the operator's call, informed by:
  - credential value appeared in this session's tool output/transcript (confirmed)
  - no production DB connection was made with it (confirmed)
  - the temporary firewall rule used during the aborted read-only census was removed
    (confirmed)
  - the value was never committed, logged, or persisted to this repository (confirmed)
  - RESIDUAL RISK: the credential should be assumed compromised until invalidated —
    this is not downgraded to optional by the mitigating facts above.
```

### 9.9 RBAC review package (for `Microsoft.App/containerApps/listSecrets/action`)

Command plan only — not executed, no identities enumerated:

```bash
# Which built-in/custom roles grant this action at all:
az role definition list --query "[?permissions[0].actions[?contains(@, 'Microsoft.App/containerApps/listSecrets')]].{name:roleName, custom:roleType}" -o table

# How many assignments exist at each scope (counts only, not identity detail,
# unless the operator specifically requests identity-level detail as a follow-up):
az role assignment list --scope /subscriptions/<sub-id> --query "length(@)" -o tsv
az role assignment list --resource-group nzila-canada-prod-rg --query "length(@)" -o tsv
az role assignment list --scope <containerapp-resource-id> --query "length(@)" -o tsv

# For each assignment, cross-reference role name against the "which roles grant
# this action" list above to determine which assignments actually carry the
# capability (Owner and Contributor do; Reader does not; custom roles vary).
```

Report only: which roles grant the capability, how many relevant assignments exist at
each scope, and — without naming individuals — whether each assignment *class* (e.g.
"CI/CD service principal used by deploy-union-eyes.yml" vs. "human operator with
standing Owner/Contributor access") appears to have a legitimate operational need.
Detailed identity-level remediation (narrowing specific human access) is a separate,
operator-authorized action, not performed here.

## 10. Release Gate C — Operator Approval Confirmed & Merge Execution Readiness

### 10.1 Operator governance decision

The operator explicitly reviewed and approved PR #760 in the controlling session
(2026-09-11). This is treated as authoritative programme governance evidence:

```
PR760_HUMAN_REVIEW = APPROVED_BY_OPERATOR
PR760_TECHNICAL_GATE = CLEAN_WITH_PROVEN_BASELINE_FAILURES
PR760_OPERATOR_MERGE_GATE = READY
```

No separate GitHub `APPROVED` review object, reviewer request, CODEOWNERS approval
metadata, bot review, or `reviewDecision` value is required to re-prove this approval.
GitHub's lack of mechanical review enforcement on this repository was already
established in Release Gate B (§9.1 / see the ruleset and branch-protection findings
above): no active branch protection, one disabled ruleset (id 12952284), no required
status checks. Requiring a second approval mechanism for the same operator decision
would be governance theatre, not additional safety.

This does **not** extend to PR #752 — the operator's statement was scoped to #760 in
context. `PR752_FINAL_HUMAN_SECURITY_REVIEW` remains `REQUIRED_POST_760_INTEGRATION`
(§10.8).

### 10.2 Exact-head and base reconfirmation

```
PR #760: state=OPEN, mergeable=MERGEABLE, mergeStateStatus=UNSTABLE (expected —
  its own known baseline-failure checks, unchanged from Gate A/B)
head = 0c960b74504d5a1ddf6caa92053afb1a0d08c66a  (matches the reviewed/approved SHA)
base = 09063f97258c576f55a61269ae2d6bf69d6da118  == current origin/main
```

`origin/main` has **not** advanced since Release Gate A — no base-movement
materiality assessment is required. The approval was granted against the exact head
above; if that head changes before merge, this approval must be re-confirmed against
the new diff (do not carry approval across new functional commits).

### 10.3 Invariant reconfirmed (diff inspection at current head)

Diff footprint unchanged: 7 files (`auto-promote-union-eyes.yml`,
`deploy-union-eyes.yml`, the new contract test, and 4 generated repo-inventory
output files).

```
auto-promote-union-eyes.yml:
  matrix.environment = [demo, pilot, staging]  (production absent)
  runtime guard: exit 1 if matrix.environment == "production"

deploy-union-eyes.yml:
  workflow_dispatch -> DEPLOY_ENV = requested input (may be production)
  any other trigger  -> DEPLOY_ENV = "staging"  (no ref_name==main -> production
    fallback; that branch was removed by this PR)
```

Explicit `workflow_dispatch` remains the only code path capable of selecting
`production`. No architectural expansion beyond what Gate A/B already reviewed.

### 10.4 Focused contract test (re-run at exact head)

```
tooling/contract-tests/union-eyes-production-promotion-gate.test.ts
Test Files  1 passed (1)
     Tests  5 passed (5)
```

Run directly on `fix/ue-production-promotion-gate` at head
`0c960b74504d5a1ddf6caa92053afb1a0d08c66a` (checked out, verified, and returned to
`fix/ue-runtime-rls-foundation` afterward — no branch content mutated).

### 10.5 Current CI surface (reconfirmed, not re-attributed)

Identical failing checks, identical job run IDs, to Gate A and Gate B — no new CI
execution has occurred on this PR since Gate A:

```
Dependency Audit                        job 102974873900  BASELINE_INHERITED
Governance Baseline / Dependency Audit  job 102974874184  BASELINE_INHERITED
Governance Baseline / Trivy Container Scan  job 102974874006  BASELINE_INHERITED
Ops Documentation Pack                  job 102974871869  BASELINE_INHERITED
Governance Gate                         job 102975674625  AGGREGATE_DOWNSTREAM_OF_BASELINE
Governance Baseline / Governance Gate   job 102975451727  AGGREGATE_DOWNSTREAM_OF_BASELINE
```

Zero `PR_ATTRIBUTABLE`, zero `UNKNOWN`. No re-attribution work required.

### 10.6 Merge method

Repository allows all three merge methods (`allow_merge_commit`,
`allow_squash_merge`, `allow_rebase_merge` all `true`; `delete_branch_on_merge` is
`false`). Empirical convention check of the 10 most recent commits reachable from
`origin/main` (`git log origin/main --oneline -10`): 9 of 10 are single-parent
squash-style commits carrying a trailing `(#NNN)`; only older history uses explicit
`Merge pull request #NNN` merge commits. **Current convention = squash.**

Chosen method for #760: **SQUASH** — matches current convention, and this is a
small, single-commit, narrow safety PR.

### 10.7 Prepared merge command — NOT EXECUTED

```bash
gh pr merge 760 --squash --match-head-commit 0c960b74504d5a1ddf6caa92053afb1a0d08c66a
```

`--match-head-commit` is a real `gh` CLI flag (confirmed via `gh pr merge --help`):
the merge aborts if #760's head has moved since this gate. This command is prepared
only; it is not executed by this gate. It requires a separate, explicit merge
authorization ("merge #760" or equivalent).

### 10.8 Mandatory post-merge verification plan (prepared, not executed)

1. Capture the resulting merge SHA on `main`.
2. `gh run list --workflow=auto-promote-union-eyes.yml --branch main --limit 5` —
   locate the run triggered by the merge SHA; confirm its per-environment jobs cover
   exactly `{demo, pilot, staging}` and none for `production`.
3. For each downstream `deploy-union-eyes.yml` run dispatched by that run:
   `gh run list --workflow=deploy-union-eyes.yml --limit 10` then
   `gh run view <id> --json name,headSha,event,displayTitle` — confirm the
   environment inputs are `demo`/`pilot`/`staging` only.
4. Read-only Azure check (no secrets read):
   `az containerapp revision list -g nzila-canada-prod-rg -n nzila-os-union-eyes-prod
   --query "[].{name:name, createdTime:properties.createdTime}" -o table` — confirm
   no new revision was created at/after the merge timestamp for the production
   Container App.
5. On `main`: re-run the focused contract test; confirm the merged
   `auto-promote-union-eyes.yml` / `deploy-union-eyes.yml` content matches #760's
   reviewed diff (no drift introduced by the merge itself).
6. Record `PR760_POSTMERGE_PRODUCTION_DISPATCH = NONE` (or flag immediately if
   otherwise) and `MAIN_PRODUCTION_AUTOPROMOTION = DISABLED / PROVEN`.

### 10.9 Explicit non-actions preserved after #760 merges

- `PR752_OPERATOR_MERGE_GATE` remains `BLOCKED`.
- `PR752_FINAL_HUMAN_SECURITY_REVIEW` remains `REQUIRED_POST_760_INTEGRATION` — the
  operator's #760 approval is not read as #752 approval.
- `PRODUCTION_ENVIRONMENT_APPROVAL_GATE` remains `NOT_CONFIGURED` — #760 prevents
  *automatic* dispatch; it does not itself constitute a human-approval gate for a
  future *explicit* production dispatch. Required reviewers must still be configured
  on the `production` GitHub Environment before any production rollout.
- `PRODUCTION_CREDENTIAL_ROTATION` remains `REQUIRED / NOT PERFORMED` — no production
  DB connection, password retrieval, Key Vault mutation, or Container App secret
  mutation performed or planned in this gate.
- The `#752` integration procedure (post-#760-merge) is unchanged from the empirical
  merge-tree proof in §2.2: expected clean workflow-file merge, with only the 4
  generated `tooling/repo-inventory/output/*` files conflicting (mechanical, resolved
  by `pnpm inventory:generate`). After integrating, re-verify on the integrated
  branch that `production` is still absent from the auto-promote matrix, the runtime
  guard is still present, and the non-dispatch fallback is still `staging` — the
  integration must not accidentally reintroduce the old production fanout.

## 11. Release Gate D — PR #760 Merge Executed & Zero-Production-Dispatch Proof

### 11.1 Explicit operator authorization

The operator explicitly authorized, and only authorized, merging PR #760 at its
approved head using the SQUASH strategy. No other action (merging #752, production
deployment, credential rotation, Key Vault/Container App mutation, RLS/grant changes
in production, or GitHub production Environment settings changes) was authorized or
performed.

### 11.2 Final expected-head guard (immediately before merge)

```
head   = 0c960b74504d5a1ddf6caa92053afb1a0d08c66a  (exact match)
state  = OPEN
mergeable = MERGEABLE
```

Unchanged from Release Gate C — merge proceeded.

### 11.3 Merge executed

```
gh pr merge 760 --squash --match-head-commit 0c960b74504d5a1ddf6caa92053afb1a0d08c66a
```

Result: squashed and merged successfully.

```
PR760_MERGE_SHA        = 008a65bf6ab292745de04b94184e0ee027cbe0dd
MAIN_SHA_AFTER_PR760   = 008a65bf6ab292745de04b94184e0ee027cbe0dd
PR #760 state           = MERGED (mergedAt 2026-09-11T12:20:27Z)
```

### 11.4 Code-level production gate reverified on merged `main`

Inspected `origin/main` at the merge SHA directly (`git show origin/main:<path>`):

```
auto-promote-union-eyes.yml: matrix.environment = [demo, pilot, staging]
  (production absent); runtime guard (exit 1 if matrix.environment == "production")
  present.
deploy-union-eyes.yml: non-workflow_dispatch trigger -> DEPLOY_ENV = "staging";
  no ref_name==main -> production fallback present anywhere in the file.
```

Focused contract test re-run against the merged `main` HEAD (local `main` branch
fast-forwarded to `origin/main`, then restored to `fix/ue-runtime-rls-foundation`
afterward — no branch content mutated):

```
tooling/contract-tests/union-eyes-production-promotion-gate.test.ts
Test Files  1 passed (1)
     Tests  5 passed (5)
```

```
MAIN_PRODUCTION_AUTOPROMOTION = DISABLED / PROVEN
```

### 11.5 Auto-promote run triggered by the merge

```
Workflow   : Auto-promote Union Eyes
Run ID     : 34598417174
Trigger    : push, headSha = 008a65bf6ab292745de04b94184e0ee027cbe0dd
Conclusion : success
Jobs       : "Dispatch deploy-union-eyes for pilot"   -> success
             "Dispatch deploy-union-eyes for staging" -> success
             "Dispatch deploy-union-eyes for demo"    -> success
```

Exactly 3 matrix jobs ran (pilot, staging, demo) — **no `production` job exists or
could exist**, since the matrix literal itself no longer contains `production`
(§11.4). No manual dispatch was performed.

### 11.6 Downstream `deploy-union-eyes.yml` runs

Confirmed via each run's own job logs (`DEPLOY_ENV="..."` resolution line, sourced
from the `workflow_dispatch` `environment` input):

| Run ID | Source SHA | Environment |
| --- | --- | --- |
| 34598426199 | 008a65bf6ab292745de04b94184e0ee027cbe0dd | pilot |
| 34598427843 | 008a65bf6ab292745de04b94184e0ee027cbe0dd | demo |
| 34598428712 | 008a65bf6ab292745de04b94184e0ee027cbe0dd | staging |

No `environment=production` run exists for this SHA. Hard blocker condition (any
production dispatch) was **not** triggered.

### 11.7 Read-only production revision check

```
az containerapp revision list -g nzila-canada-prod-rg -n nzila-os-union-eyes-prod \
  --query "[].{name:name, createdTime:properties.createdTime, active:properties.active}" -o table

Name                               CreatedTime                Active
nzila-os-union-eyes-prod--0000241  2026-08-31T22:21:19+00:00  True
```

Only one revision exists, created **2026-09-11T12:20:27Z minus ~10 days earlier**
(2026-08-31), i.e. well before the merge (2026-09-11T12:20:27Z). No new revision was
created for `nzila-os-union-eyes-prod` (the only union-eyes Container App in
`nzila-canada-prod-rg`) as a consequence of the merge. No secret values, DB
credentials, or connection strings were read for this check.

```
PR760_POSTMERGE_PRODUCTION_REVISION = NONE
```

### 11.8 Production zero-mutation verdict

Both GitHub Actions evidence (§11.5-§11.6) and Azure evidence (§11.7) agree:

```
PR760_POSTMERGE_PRODUCTION_DISPATCH  = NONE
PR760_POSTMERGE_PRODUCTION_REVISION  = NONE
MERGE_TO_MAIN != PRODUCTION_ROLLOUT   (proven)
```

This is the actual acceptance test for PR #760, and it holds.

### 11.9 Non-production deployment health (secondary evidence)

At the time of this report, the 3 downstream demo/pilot/staging deploy runs
(34598426199, 34598427843, 34598428712) were still `in_progress` (normal — these are
multi-stage build/push/deploy workflows). This is operational evidence only and is
explicitly not the primary Gate D criterion; their eventual pass/fail does not change
the zero-production-dispatch verdict above, which is already conclusively established
by the matrix contents and the confirmed environment inputs.

### 11.10 Retained non-actions

```
PRODUCTION_CREDENTIAL_ROTATION = REQUIRED / NOT PERFORMED
PRODUCTION_ENVIRONMENT_APPROVAL_GATE = NOT_CONFIGURED
```

No production PostgreSQL connection, no credential retrieval/use, no Key Vault
mutation, no Container App secret mutation, and no GitHub production Environment
settings change occurred in this gate. PR #760 prevents *unattended* production
deployment; it does not yet protect an explicitly initiated production
`workflow_dispatch` with required human reviewers — that gap must close before any
production rollout.

### 11.11 Explicit next step (not started in this gate)

Per operator instruction, #752 is not merged next. The required sequence is:
integrate the new `main` (containing #760's fix) into `fix/ue-runtime-rls-foundation`,
resolve only the mechanical `tooling/repo-inventory/output/*` conflicts via
`pnpm inventory:generate`, re-prove #760's production-gate invariant survived the
integration, rerun materially affected #752 CI, then obtain/freeze final human
security approval on the integrated #752 head — only then does #752 reach its own
operator merge gate.

## 12. Final status

```
RELEASE_GATE_A = COMPLETE
RELEASE_GATE_B = COMPLETE
RELEASE_GATE_C = COMPLETE
RELEASE_GATE_D = COMPLETE
PR760_TECHNICAL_GATE = CLEAN_WITH_PROVEN_BASELINE_FAILURES
PR760_HUMAN_REVIEW = APPROVED_BY_OPERATOR
PR760_MERGE_PERFORMED = YES
PR760_MERGE_SHA = 008a65bf6ab292745de04b94184e0ee027cbe0dd
MAIN_PRODUCTION_AUTOPROMOTION = DISABLED_PROVEN
PR760_POSTMERGE_PRODUCTION_DISPATCH = NONE
PR760_POSTMERGE_PRODUCTION_REVISION = NONE
PR752_HUMAN_SECURITY_REVIEW = REQUIRED (not yet approved — 0 reviews, 0 review requests)
PR752_OPERATOR_MERGE_GATE = BLOCKED_PENDING_MAIN_INTEGRATION
PR752_FINAL_HUMAN_SECURITY_REVIEW = REQUIRED_POST_760_INTEGRATION
PRODUCTION_ENVIRONMENT_APPROVAL_GATE = NOT_CONFIGURED (protection_rules: [] —
  confirmed across Gate A, B, C, and D)
PRODUCTION_CREDENTIAL_ROTATION = REQUIRED / NOT PERFORMED
PRODUCTION_CUTOVER_AUTHORIZED = NO
PRODUCTION_DB_CONNECTION_PERFORMED = NO
PRODUCTION_MUTATION_PERFORMED = NO
```

**Next operator decisions, in order:**

```
1. integrate new main (containing #760) into fix/ue-runtime-rls-foundation;
   resolve only mechanical tooling/repo-inventory/output/* conflicts via
   pnpm inventory:generate
2. re-verify #760's production-gate invariant survives the integration (§11.4
   checks, re-applied to the integrated branch)
3. rerun materially affected #752 CI on the integrated head
4. obtain/freeze final human security approval of #752 on the integrated head
   (from @nzila/eng, @nzila/ue, and @nzila/platform/@nzila/security given its
   .github/ changes)
5. merge #752 once approved
6. verify the #752 merge did NOT trigger a production deployment (same method
   as §11.5-§11.7)
7. approve and execute production credential rotation (§1.3-§1.4), operator-authorized
8. configure required reviewers on the production GitHub Environment
9. separately authorize production cutover (§7), starting from step 1
```

No automatic actions were taken beyond what is documented in this report and in PR
#760. This session merged PR #760 (explicitly authorized) and proved zero production
dispatch resulted. It did not merge PR #752, did not rotate any credential, did not
connect to production PostgreSQL, and did not dispatch any production workflow.
