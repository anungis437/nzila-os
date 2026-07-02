# Runtime Separation Plan — Prod / Staging Blast-Radius Closure

> **Status:** Doctrine — **implementation-ready plan** (NOT an implementation)
> **Phase:** 6 of the UE Hardening & Gate Convergence Wave
> **As of:** 2026-06-28
> **Authority:** Planning artifact only. No Azure resources were created or modified. No secrets touched. No production-readiness claim. No `final:go` promotion. No live-readiness evidence fabricated.
> **Companion report:** [reports/governance/ue-hardening-wave-phase6-runtime-separation-2026-06-28.md](../../../reports/governance/ue-hardening-wave-phase6-runtime-separation-2026-06-28.md)

## 0. Purpose and primary invariant

This plan defines **exactly how prod/staging runtime separation will be
implemented and certified** so that the known blast-radius risks in the runtime
truth reports are closed *before* sensitive multi-org production or enterprise
procurement can be claimed.

**Primary invariant:** The plan must make explicit **what must be separated
before** sensitive multi-org production or enterprise procurement can be claimed.

This is **not** an authorization to touch Azure, create certification documents,
or imply the platform is production-certified. It is the implementation contract
that a later, separately-approved execution wave will follow.

## 1. Source evidence

Current-state facts in this plan were derived by read-only inspection of:

- Runtime integrity: `docs/nzila-runtime-integrity/README.md`, `docs/nzila-runtime-integrity/final-runtime-integrity-review.md`.
- Infrastructure as code: `infrastructure/bicep/main.bicep` + `infrastructure/bicep/modules/*` + `infrastructure/bicep/parameters/*.bicepparam`.
- GitOps environment configs: `infrastructure/gitops/environments/{production,staging,pilot,ue-pilot-cupe,ue-demo-cupe4373}.yml`.
- Deployment workflows: `.github/workflows/{deploy-union-eyes,deploy-production,deploy-staging,gitops-deploy,auto-promote-union-eyes}.yml`.

Two anchor findings were verified directly against source (not inferred):

1. **UE production runs in staging-named Azure infrastructure** — confirmed at [.github/workflows/deploy-union-eyes.yml](../../../.github/workflows/deploy-union-eyes.yml#L215): *"production currently runs in staging-named Azure infrastructure; this workflow preserves that live topology intentionally."*
2. **The CUPE pilot reuses the staging PostgreSQL instance** (RLS-only isolation) — confirmed at [infrastructure/gitops/environments/ue-pilot-cupe.yml](../../../infrastructure/gitops/environments/ue-pilot-cupe.yml#L66): *"Reuses the staging PostgreSQL instance … no separate database or schema for this pilot."* (`name: nzila-staging-db`).

> **⚠️ Superseded by live verification (Runtime Separation Wave Phase A.1, 2026-06-28).** Both anchor findings above were drawn from repo config text and are **refuted by live Azure state**: (1) UE production runs in the dedicated `nzila-canada-prod-env` / `nzila-canada-prod-rg` on a dedicated production database (`nzila_os_prod`) — the workflow step-summary note was stale drift (now corrected); (2) the live UE pilot is sovereign in `nzila-canada-pilot-env` on the dedicated `nzila-canada-pilot-db`, and the `ue-pilot-cupe.yml` staging-reuse profile is latent/not-deployed (now marked DO-NOT-DEPLOY). See [reports/governance/runtime-separation-wave-phaseA1-live-verification-2026-06-28.md](../../../reports/governance/runtime-separation-wave-phaseA1-live-verification-2026-06-28.md). **BR-1 / BR-2 / BR-3 are refuted live**; the remaining open work is **BR-4** (deploy identity), **BR-5** (shared ACR), and **BR-6** (org-context substrate drift).

## 2. Current shared blast-radius surfaces (the risk being closed)

Most surfaces are already separated at the **IaC declaration** layer. The
blast-radius risk is concentrated in **three surfaces** where prod, staging, and
pilot still share a runtime substrate, plus one identity-layer concern:

| # | Shared surface | Nature of sharing | Why it is blast-radius |
| --- | --- | --- | --- |
| **BR-1** | **UE production execution topology** | Production UE Container App is deployed into the **staging-named** managed environment, not `nzila-canada-prod-env`. | An operation against the staging Container Apps environment (delete, scale, network change, revision purge) can cascade into the live production UE workload. The Bicep separation is real but the *running* topology does not honor it. |
| **BR-2** | **Pilot ↔ staging shared PostgreSQL** | CUPE pilot reuses `nzila-staging-db`; org isolation is application-layer RLS only (`app.org_id = 'cupe-local-123'`). | A staging schema migration, restore, failover, or connection-pool exhaustion directly affects live pilot data. An RLS regression is a cross-org data-exposure event. Shared backup/restore boundary means a staging PITR also rewinds pilot. |
| **BR-3** | **Shared backup/restore boundary (pilot↔staging)** | Pilot has no independent backup boundary (same instance as staging). | Restore/rollback of staging cannot be performed without affecting pilot; pilot cannot be restored independently. |
| **BR-4** | **Shared GitHub deployment identity** | One OIDC service principal (`AZURE_CLIENT_ID` / `AZURE_TENANT_ID` / `AZURE_SUBSCRIPTION_ID`) authenticates all environments; separation is enforced downstream by a resource-group name guard, not by identity scope. | A compromised or misconfigured deploy identity can in principle reach any environment; the only barrier is a string-matching guard in workflow bash. |
| **BR-5** | **Shared container registry (ACR)** | All environments pull from `nzilacanadaacr`; a single `AcrPull` grant; promotion is enforced by CI tagging, not registry boundary. | A mis-tagged image can be consumed by the wrong environment; registry access is not environment-segregated. |

Surfaces already separated (low residual risk — verified): resource groups,
declared Container App environments, Key Vaults, managed identities, infra-level
secrets (per-vault), DNS/custom domains, Log Analytics workspaces, production DB
(separate `nzila-prod-pg` with HA + 35-day geo-redundant backup). These require
**verification + drift-guarding**, not new construction.

Runtime-integrity substrate caveat (from `final-runtime-integrity-review.md`):
identity-resolution drift (org-cookie duplication, `getOrganizationIdForUser`
silently falling back to `DEFAULT_ORGANIZATION_ID`, schema-drift-induced skipped
`organization_members` inserts) is **foundational** — it can manifest
*differently* in prod vs staging and must be treated as a separation-blocking
substrate risk, not just an app bug.

## 3. Current-state vs target-state matrix

| Surface | Current state | Target state | Gap class |
| --- | --- | --- | --- |
| Resource groups | Separated (`*-prod-rg` / `*-staging-rg`) | Unchanged + drift guard | Verify-only |
| Container App **declared** envs | Separated in Bicep | Unchanged | Verify-only |
| Container App **running** topology (UE prod) | **Prod runs in staging-named env** | UE prod runs in a true `nzila-canada-prod-env`; staging-named env carries staging only | **Construct + cutover (BR-1)** |
| Key Vaults | Separated (`nzila-prod-kv` / `nzila-staging-kv`) | Unchanged + access-policy attestation | Verify-only |
| Storage accounts | Separated by env naming (declared) | Confirm no cross-env container/account reuse; attest | Verify + attest |
| Databases | Prod separate; **pilot reuses staging DB** | Dedicated `nzila-pilot-db` (or prod-grade pilot instance) with its own schema, credentials, and pool | **Construct + migrate (BR-2)** |
| DB access boundaries | Shared pool (PgBouncer) pilot↔staging | Separate pooler/credentials per environment; RLS retained as defense-in-depth, not sole boundary | **Construct (BR-2)** |
| Managed identities (runtime) | Separated (`nzila-${env}-aca-mi`) | Unchanged + least-privilege attestation | Verify-only |
| **Deployment** identities | Single shared SP, RG-guard only | Per-environment OIDC subject (separate federated credential / SP) with environment-scoped RBAC | **Construct (BR-4)** |
| Secrets & env vars | Infra: per-vault (separated); GitHub: shared deploy creds | Per-environment GitHub Environment secrets; no repo-wide deploy creds | **Construct (BR-4)** |
| Container registry | Shared `nzilacanadaacr` | Either segregated registries OR an enforced, attested image-promotion gate (prod never pulls unpromoted tags) | **Decide + construct (BR-5)** |
| DNS / custom domains | Separated (`unioneyes.app` vs `staging.*`) | Unchanged + ownership/TLS attestation | Verify-only |
| Observability / logging | Separated (`nzila-prod-logs` / `nzila-staging-logs`) | Unchanged + confirm no cross-env diagnostic routing | Verify-only |
| Backup / restore | Prod 35-day GRS; **pilot shares staging boundary** | Independent pilot backup boundary; documented restore runbook per environment | **Construct (BR-3)** |
| Promotion flow | Tag-based staging→prod; UE auto-promote fans out in parallel | Sequential gated promotion; prod cutover only after staging soak + evidence | **Process change** |
| Rollback flow | Tag re-deploy + PITR; no automated rollback | Documented, rehearsed rollback per environment incl. DB PITR within isolated boundary | **Process + rehearsal** |

## 4. Phased implementation sequence

> Every phase below is **future execution work**, gated behind separate human
> approval. Phase 6 (this document) delivers only the plan.

### Phase A — Inventory and freeze
- Produce an authoritative resource inventory per environment (RG, Container Apps env, Key Vault, storage, DB, identities, Log Analytics, DNS) from live Azure **read-only** (`az ... list`, Resource Graph) and reconcile against IaC.
- Record the exact current UE production topology (which managed environment the prod Container App actually runs in) and the exact pilot DB binding.
- **Freeze:** declare a change-freeze window for staging-named infra and `nzila-staging-db` during cutover phases.
- Exit evidence: signed inventory snapshot + reconciliation diff (IaC vs live).

### Phase B — Staging isolation
- Ensure the staging-named environment hosts **only** staging once prod is moved (depends on Phase C cutover ordering).
- Stand up a dedicated pilot data boundary plan: provision `nzila-pilot-db` (prod-appropriate SKU), separate credentials in `nzila-canada-pilot-kv`, separate PgBouncer/pool, separate backup retention.
- Migrate pilot org data (`org_id = 'cupe-local-123'`) from `nzila-staging-db` to `nzila-pilot-db` with verification + reconciliation; keep RLS as defense-in-depth.
- Exit evidence: pilot reads/writes its own instance; staging restore no longer affects pilot (proven by a restore drill in a scratch copy).

### Phase C — Production isolation
- Provision/confirm the true `nzila-canada-prod-env` managed environment.
- Cut UE production over from the staging-named environment to `nzila-canada-prod-env` (blue/green: deploy prod revision in the true prod env, validate, switch DNS `app.unioneyes.app`, retire the staging-hosted prod revision).
- Remove the "production preserves staging-named topology" note and the staging-name guard's reason-for-existence once cutover is verified.
- Exit evidence: `az containerapp show` proves UE prod's `managedEnvironmentId` is the prod env; the BR-1 guard becomes redundant (kept as belt-and-suspenders).

### Phase D — Deployment identity separation
- Create per-environment federated credentials / service principals with environment-scoped RBAC (prod SP can only touch prod RG; staging SP only staging RG).
- Move deploy credentials from repo-wide secrets to **GitHub Environment** secrets gated by environment protection rules.
- Retain the RG-name guard as defense-in-depth, not the primary control.
- Exit evidence: a staging-credential deploy attempt against the prod RG fails at the Azure RBAC layer (not just the bash guard), demonstrated in a controlled test.

### Phase E — Observability and backup separation
- Confirm prod/staging Log Analytics + App Insights have no cross-environment routing; attest retention (prod ≥ 90d, staging ≤ 30d).
- Establish independent backup/restore boundaries per environment incl. the new `nzila-pilot-db`; document per-environment PITR runbooks.
- Exit evidence: an isolated PITR drill on each environment that does not affect any other environment.

### Phase F — Rehearsal and certification evidence
- Full-chain rehearsal: build → staging deploy → soak → gated promotion → prod cutover → smoke → rollback drill, with all artifacts captured.
- Produce the certification evidence bundle listed in §6 and link it to the (still-advisory) `validate-live-readiness` / `validate-infra-convergence` / `validate-final-go` gates.
- **Only after** this evidence is real and stable may a future, separately-approved wave consider promoting those gates per the Phase 5 gate-authority rules. **This plan does not promote them.**

## 5. Risk matrix

| ID | Risk | Impact | Mitigation | Required evidence | Owner |
| --- | --- | --- | --- | --- | --- |
| **BR-1** | Prod UE shares the staging-named Container Apps environment | Staging env operation cascades to live prod (outage / data path disruption) | Phase C blue/green cutover to true `nzila-canada-prod-env`; retain RG-name guard | `az containerapp show` proving prod `managedEnvironmentId`; cutover runbook + smoke results | Platform / SRE |
| **BR-2** | Pilot reuses `nzila-staging-db` with RLS-only isolation | Cross-org data exposure on RLS regression; staging migration/restore corrupts live pilot data | Phase B dedicated `nzila-pilot-db` + separate creds/pool; RLS kept as defense-in-depth | Pilot bound to own instance; RLS contract tests; migration reconciliation log | Platform / UE data owner |
| **BR-3** | Shared backup/restore boundary pilot↔staging | Cannot restore staging without rewinding pilot; cannot restore pilot independently | Phase E independent backup boundaries + per-env PITR runbooks | Isolated PITR drill evidence per environment | SRE |
| **BR-4** | Single shared deploy identity, guarded only by bash RG name-match | Compromise/misconfig can reach any environment | Phase D per-env OIDC subjects + environment-scoped RBAC + GitHub Environment secrets | RBAC-layer denial of cross-env deploy in a controlled test | Platform security |
| **BR-5** | Shared ACR; promotion enforced by tagging only | Wrong-environment image consumption | Phase D/E: enforced+attested image-promotion gate or segregated registries | Promotion attestation; proof prod cannot pull unpromoted tags | Platform / supply chain |
| **BR-6** | Identity-resolution substrate drift differs prod vs staging (`DEFAULT_ORGANIZATION_ID` silent fallback, org-cookie duplication, schema drift) | Silent org mis-resolution in one environment only; undermines multi-org claims | Treat as separation-blocking substrate risk; add logging/alerts on fallback; converge schema before cutover | `validate-runtime-integrity` green + alerting on silent fallback | Platform / UE |
| **BR-7** | Cutover itself causes an outage or split-brain | Prod downtime or dual-write during migration | Blue/green + change-freeze + rehearsed rollback | Rehearsal log; rollback drill evidence | SRE |

## 6. Certification checklist (for future `final:go` / production-blocking promotion)

This checklist is the **evidence contract** that a later wave must satisfy. None
of these are claimed as met today.

- [ ] UE production runs in a true `nzila-canada-prod-env` (not staging-named) — proven by live resource inspection.
- [ ] Pilot data is on a dedicated instance with its own credentials, pool, and backup boundary; staging restore proven not to affect pilot.
- [ ] RLS retained as defense-in-depth with passing cross-org isolation contract tests (no reliance on RLS as the *sole* boundary for pilot↔staging).
- [ ] Per-environment deployment identities with environment-scoped RBAC; cross-environment deploy denied at the Azure RBAC layer (demonstrated).
- [ ] Deploy credentials sourced from GitHub Environment secrets with protection rules; no repo-wide deploy credentials.
- [ ] Image promotion enforced and attested; prod cannot consume unpromoted tags.
- [ ] Per-environment observability confirmed isolated; retention attested (prod ≥ 90d).
- [ ] Per-environment, rehearsed PITR/rollback runbooks with drill evidence.
- [ ] Runtime-integrity substrate drift closed (no silent `DEFAULT_ORGANIZATION_ID` fallback; converged org-cookie + schema) with alerting.
- [ ] Full-chain promotion rehearsal completed end-to-end with captured artifacts.
- [ ] Evidence bundle linked to `validate-live-readiness`, `validate-infra-convergence`, `validate-final-go`; promotion decision deferred to the Phase 5 gate-authority promotion rules.

## 7. Constraints honored by this plan

- Planning only — no Azure changes, no secrets touched, no workflow implementation.
- No production-readiness claim; production-blocking achieved remains **0**.
- No `final:go` promotion; no live-readiness artifact fabrication.
- The cutover/migration steps are described as **future, separately-approved** execution work.

## 8. Honest closing status

> Runtime separation planning is complete. Nzila OS / Union Eyes remains
> controlled-pilot safe; sensitive multi-org production remains pending
> infrastructure separation, rehearsal evidence, and final-go certification.
