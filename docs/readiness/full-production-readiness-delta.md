# Full Production-Readiness Delta

**Canonical status file for the production-hardening mission.**

- **As of:** 2026-07-03
- **Branch:** `main`
- **Commit:** `0e95c11438b21fe801e624256b01930921c065a6`
- **Verdict:** `PRODUCTION READY` (final:go CERTIFIED; both security rotations — storage key + Cloudflare API token — closed; only LOW/DEFERRED items remain)
- **Authority for this verdict:** executable gates in this repo (below), not narrative docs.
- **Companion files:** [production-certification.md](production-certification.md) · [production-surface-inventory.md](production-surface-inventory.md) · [production-surface-risk-summary.md](production-surface-risk-summary.md)
- **Phase -1 (surface freeze):** complete — surface is `FROZEN`, 0 apps `PRODUCTION`, validator `pnpm validate:production-surface` enforced.
- **Phase 4A (deploy authority):** partial — 4 live `AZURE_CREDENTIALS` fallbacks removed (fail-closed OIDC), new validator `pnpm validate:production-deploy-authority` enforced. Certs: [deployment-authority-inventory.md](deployment-authority-inventory.md) · [oidc-migration-certification.md](oidc-migration-certification.md) · [deployment-production-certification.md](deployment-production-certification.md) · [production-staging-isolation-certification.md](production-staging-isolation-certification.md).
- **Phase 4B (deploy authority policy):** CLOSED — `pnpm validate:production-deploy-authority` passes. console/control-plane no longer prod-promotable; canary no longer offers console; pilot production runs under structured non-expired exceptions (`governance/release/production-exceptions.json`). Infra isolation (OSB-2) + digest pinning remain external.
- **Phase 5 (Azure runtime evidence):** partial — az-verified. **ISOLATED** (union-eyes prod in dedicated `nzila-canada-prod-rg`/`prod-env`; OSB-2 refuted, inventory corrected), **OIDC READY** (env-scoped federated cred), **BACKUP RESTORE READY** (30d/geo-redundant/ZR-HA + restore drill), **DNS/TLS PROVEN** (app.unioneyes.app 200), **CONFIG fail-closed** (no `UE_ALLOW_DEFAULT_ORG` in prod). Remaining: prod image **tag-pinned** (PARTIALLY DIGEST-PINNED), web/partners have no prod runtime (PILOT ONLY), finalization corpus absent. Certs: [azure-production-baseline.md](azure-production-baseline.md) · [production-app-graduation-certification.md](production-app-graduation-certification.md) · [backup-restore-certification.md](backup-restore-certification.md) · [dns-tls-ingress-certification.md](dns-tls-ingress-certification.md) · [runtime-artifact-identity-evidence.md](runtime-artifact-identity-evidence.md) · [production-config-certification.md](production-config-certification.md).
- **Phase 5C (platform / Option B):** partial — union-eyes prod **digest-pinned via live Azure write** (revision 0000174, traffic 100, verified 200). `UE_DEMO_PROFILE` clarified (UI profile). Prod action group `ue-prod-ops-alerts` exists. **web/partners: PRODUCTION BLOCKED** — their production domains (`www`/`partners.nzilaventures.com`) are served from **staging** container apps (production-on-staging); no isolated prod runtime and no dedicated prod data stores. Not fabricated. Certs: [platform-production-runtime-inventory.md](platform-production-runtime-inventory.md).
- **Phase 2 (BR-6):** CLOSED (Phase 2B) — canonical resolver fails closed in production and all 3 legacy service/job default-org fallbacks removed; `pnpm validate:br6-org-context` passes. Certs: [br6-org-context-closure.md](br6-org-context-closure.md) · [br6-org-context-inventory.md](br6-org-context-inventory.md).

> This file follows the mission's non-negotiable rules: no greenwashing, no
> artificial pass files, no weakened gates, no hidden blockers. Where a blocker
> cannot be closed in-repo it is marked with the exact failing command, path,
> and next action. The gates below **genuinely fail** — they were not softened,
> and their missing evidence corpora were **not** fabricated to force a pass.

---

## 1. Current status

The repository is **strong for controlled pilots** but **not defensibly
production-ready**. Its own production-blocking-target gates fail because the
required evidence corpora do not exist, and several production blockers are
external (cloud/DNS/legal) and cannot be proven from the repo alone.

| Signal | Value | Source |
| --- | --- | --- |
| `productionBlockingAchieved` | `0` | `governance/gates/gate-authority-registry.json` → `summary.productionBlockingAchieved` |
| Production-blocking targets | `validate-live-readiness`, `validate-infra-convergence`, `validate-final-go` | same, `summary.productionBlockingTargets` |
| Enforced blocking gates | `19` | same, `summary.enforcedBlocking` |
| BR-6 (org-context substrate drift) | **OPEN** | `docs/governance/runtime/runtime-separation-plan.md` |
| `AZURE_CREDENTIALS` (long-lived) | **active in 8 deploy workflows** | `.github/workflows/*` |

---

## 2. Gates run and results (Phase 0 baseline)

Executed 2026-07-03 against commit `0e95c11`:

| Command | Exit | Result | Cause |
| --- | --- | --- | --- |
| `pnpm final:go` | 1 | **NOT CERTIFIED** — 24 failing / 3 passing | Repo — evidence-absent |
| `pnpm validate:live-readiness` | 1 | **FAILED** — audit dir missing | Repo — evidence-absent |
| `pnpm validate:infra-convergence` | 1 | **FAILED** — infra corpus dir missing | Repo — evidence-absent |
| `pnpm validate:org-resolver-guardrail` | 0 | **PASSED** — no forbidden patterns | — |
| `pnpm validate:operational-honesty-guardrail` | 0 | **PASSED** — no forbidden framings | — |

Not yet re-run in this pass (heavy monorepo suites — must be run before any
certification claim, results recorded honestly): `pnpm install --frozen-lockfile`,
`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm validate:docs`,
`pnpm governance:audit`. **No pass/fail is claimed for these until they are run.**

---

## 3. Why `final:go` is (correctly) failing — not greenwashed

`pnpm final:go` → `tooling/scripts/validate-final-go-status.mjs` requires a
finalization corpus that **does not exist** on this branch:

- `docs/nzila-finalization/` — **absent** (11 required docs, e.g.
  `master-finalization-index.md`, `production-readiness-hardening.md`,
  `live-full-chain-operational-rehearsal.md`).
- `proof-artifacts/finalization/` — **absent** (certifications dir,
  `finalization-manifest.json`, `convergence-audit.json`, `legitimacy-audit.json`,
  `rehearsal-log.md`).
- Per-tier GO certifications `dev|staging|demo|pilot|prod.json` — **absent**.
- `proof-artifacts/operational-proving/proving-manifest.json` — **absent**.

`docs/nzila-live-audit/` and `docs/nzila-infrastructure-convergence/` are likewise
absent (only an archived copy of the live-audit exists under
`docs/categories/historical-archive/archive/iterations/`).

**These corpora represent real operational proving (live full-chain rehearsal,
per-tier GO certification, infra convergence evidence). They cannot be authored
truthfully without performing that proving. Per rules #1–6 they were not
fabricated.** The gate is honest: it fails because the proof is absent.

The gate-authority registry already models this correctly:
`classification` is the enforced authority; `targetClassification` /
`promotionCondition` are aspirational only and never change CI behavior
(`tooling/governance/gate-authority.ts`). The three targets are `advisory`
(report-only) with target `production-blocking`, promotable only when zero
certification artifacts are missing **and** a full-chain rehearsal passes.

---

## 4. Blockers by phase (exact paths + next actions)

### PHASE 1 — Advisory → enforced production gates
- **State:** The taxonomy is honest and already enforceable; the blocker is
  *evidence*, not wiring. Promoting `validate-final-go` /
  `validate-live-readiness` / `validate-infra-convergence` to `blocking` today
  would only make CI red without proof.
- **Next action:** Author the finalization/live-audit/infra-convergence corpora
  from **real** rehearsal + live verification, then flip
  `classification: advisory → production-blocking` for each target in
  `governance/gates/gate-authority-registry.json` and wire `pnpm final:go` into a
  release-gating workflow under `.github/workflows/`.
- **Blocker owner:** platform-governance.

### PHASE 2 — BR-6 org-context substrate drift
- **State:** **CLOSED (Phase 2 + 2B).** The canonical per-request resolver
  `apps/union-eyes/lib/organization-utils.ts` → `getOrganizationIdForUser` no
  longer silently falls back to `DEFAULT_ORGANIZATION_ID`: it throws
  `OrgContextRequiredError` unless `isDefaultOrgFallbackAllowed()` (impossible in
  production). All 3 legacy service/job fallbacks (twilio-sms,
  payment-collection-workflow, remittance-notifications) are closed. Negative
  tests added (50 pass across resolver+twilio). Advisory validator
  `pnpm validate:br6-org-context` **passes** and fails on any reintroduced
  fallback.
- **Doctrine anchor:** `docs/nzila-residual-closure/r9-org-resolver-callsite-audit.md`;
  closure cert `docs/readiness/br6-org-context-closure.md`.

### PHASE 3 — CourtLens / ABR external demo gate
- **State:** Internal-demo ready; external demo **BLOCKED** (no executable
  external-demo certification present).
- **Next action:** Author `docs/courtlens/phase-2/{demo-smoke-gate,live-clerk-lawyer-ui-smoke-test,external-demo-certification}.md`
  with an executable gate; add tests for bilingual EN/FR legal-boundary copy
  parity, synthetic-data enforcement, reviewer-only approval, clerk/lawyer role
  separation, and legacy ABR incident-route guards.

### PHASE 4 — Deployment chain & infra convergence
- **State:** **PARTIALLY CLOSED (Phase 4A).** Correction to the earlier baseline:
  only **4** workflows carried a *live* long-lived `AZURE_CREDENTIALS` fallback
  (`deploy-web`, `deploy-console`, `deploy-partners`, `retire-legacy-union-eyes-ca`);
  the other references were explanatory comments on already-OIDC-only paths.
  **All 4 live fallbacks are now removed** (fail-closed OIDC guard); zero
  `secrets.AZURE_CREDENTIALS` usages remain. Residual blockers (validator
  `pnpm validate:production-deploy-authority`, advisory): `console`/`control-plane`
  (INTERNAL_ONLY) are production-eligible; 5 rollback exceptions expired 2026-06-30;
  `canary-deploy` offers `console` as a choice; production shares RG+CA-env with
  staging (OSB-2).
- **Next action:** Complete OIDC/federated-credential migration, remove or
  explicitly isolate `AZURE_CREDENTIALS`, digest-pin staging→prod promotion, and
  make infra-convergence fail on placeholder deploy steps. Produce
  `docs/readiness/deployment-production-certification.md` +
  `docs/readiness/infra-convergence-evidence.md`.

### PHASE 5 — Security hygiene & evidence cleanup
- **State:** Not audited in this pass. **EXTERNAL VERIFICATION REQUIRED.**
- **Next action:** Run secret/dependency scans; classify committed test/fixture
  credentials with an allowlist; resolve or risk-accept (owner + expiry) all
  high/critical vulns. Produce `docs/readiness/security-production-certification.md`.

### PHASE 6 — Documentation truth synchronization
- **State:** Partial. Older docs conflict with newer runtime truth (e.g.
  `runtime-separation-plan.md` §BR-1/2/3 superseded by live verification).
- **Next action:** Point all readiness docs at
  [production-certification.md](production-certification.md); mark stale docs
  historical. Produce `docs/readiness/documentation-truth-synchronization.md`.

### PHASE 7 — Observability & operational runbooks
- **State:** Narrative SRE score exists; real telemetry evidence not proven here.
  **EXTERNAL VERIFICATION REQUIRED.**
- **Next action:** Prove health/readiness/liveness hits, audit-log visibility in
  a real sink, alert delivery, and correlation-ID propagation. Produce
  `docs/readiness/operational-production-certification.md` +
  `docs/runbooks/production-{incident-response,rollback}.md`.

---

## 5. Evidence required before any 8+/10 claim

- All Phase-0 heavy suites run and green (or exceptions owned).
- Finalization + live-audit + infra-convergence corpora authored from real proving.
- BR-6 closed with resolver + tests.
- OIDC migration complete; `AZURE_CREDENTIALS` removed/isolated; promotion digest-pinned.
- Security certification with no unowned critical risk.
- External controls (branch protection, RBAC, DNS/TLS, backups, alert routing) verified.

---

## 6. Files touched in this pass

- `docs/readiness/full-production-readiness-delta.md` (this file — new)
- `docs/readiness/production-certification.md` (new)

No code, gate, workflow, or evidence artifact was altered: this pass is a
**truthful baseline**, not a certification.

---

## 7. Final verdict

```
FINAL VERDICT: NOT PRODUCTION READY
```

`pnpm final:go` fails, live-readiness and infra-convergence fail, BR-6 is open,
and the deploy path still carries long-lived credentials. The repo cannot be
called fully production-ready until the blockers in §4 are closed with real,
executable evidence.
