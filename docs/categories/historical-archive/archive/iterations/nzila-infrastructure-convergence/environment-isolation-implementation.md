# 02 — Environment Isolation Implementation

**Authority:** Discovery output in [live-infrastructure-discovery.md](live-infrastructure-discovery.md).

---

## 1. Isolation Reality Matrix

| Concern              | dev | staging | demo | pilot | prod |
|----------------------|-----|---------|------|-------|------|
| Dedicated RG         | NO  | YES (`nzila-canada-staging-rg`) | YES (`nzila-canada-demo-rg`) | NO | NO |
| Dedicated ACA env    | NO  | YES (`nzila-canada-staging-env`) | YES (`nzila-canada-demo-env`) | NO | NO |
| Dedicated DB         | NO  | YES (`nzila-staging-db`) | YES (`nzila-os-union-eyes-demo-db`) | NO | NO |
| Dedicated KV         | NO  | YES (`nzila-staging-kv`) | YES (`nzila-canada-demo-kv`, but **unused** by app) | NO | NO |
| Dedicated env vars   | n/a | YES (50) | PARTIAL (24, no secrets) | n/a | n/a |
| Dedicated ingress    | n/a | YES | YES | n/a | NO (shares staging) |
| Dedicated telemetry  | n/a | YES | YES (own LAW) | n/a | n/a |
| Dedicated rollout lineage | n/a | YES | NO (mutable `:production` tag) | n/a | n/a |

---

## 2. Per-tier Honest Status

### 2.1 dev — `DEFERRED`

No Azure tier exists. Local-only via `pnpm dev`. Acceptable for an early-stage
team, NOT acceptable for procurement-grade dev/staging/prod parity.

### 2.2 staging — `LIVE / GO`

Fully isolated. 15 ACA apps. Custom domains bound. Secrets in KV.
**This is the only fully operational tier.**

### 2.3 demo — `CONDITIONAL`

Real isolated infra (RG, env, DB, KV, app). However:
- App container has zero secret-backed env vars (cannot auth, cannot DB-write
  with privileged ops, cannot send email, cannot bill).
- Single revision, never iterated.
- Image uses mutable `:production` tag.
- Only 1 of 15 apps is provisioned (UE only).

### 2.4 pilot — `LOGICAL` (no Azure tier)

CUPE pilot scaffolding exists in repo + GitHub workflow
(`cupe-pilot-readiness.yml`). At runtime, pilot users land on staging fabric
with `pilot`-tagged orgs. No physical isolation.

### 2.5 prod — `SHARED-FABRIC`

`unioneyes.app`, `nzilaventures.com`, etc. resolve to the same staging ACA
apps via custom-domain bindings. There is no separate prod fabric. This
collapses staging+prod into one runtime, with the only differentiator being
URL-level branding.

---

## 3. Required Remediation (NOT performed without operator authorization)

The following operations are destructive / shared-infra. Each requires
explicit operator sign-off before execution.

| # | Remediation                                                              | Risk     | Authorization required |
|---|--------------------------------------------------------------------------|----------|------------------------|
| R1 | Create `nzila-canada-prod-rg` + `nzila-canada-prod-env` + `nzila-canada-prod-db` + `nzila-canada-prod-kv` | Cost +; cutover | YES |
| R2 | Migrate prod custom domains from staging apps to new prod apps          | DNS / TLS reissue | YES |
| R3 | Wire all 14 secret-backed env vars on demo app from `nzila-canada-demo-kv` | Low (additive) | YES |
| R4 | Replace demo `:production` image tag with SHA-pinned tag                | Low      | YES |
| R5 | Reconcile `platform-admin` image to canonical SHA                       | Medium — revision flip | YES |
| R6 | Upgrade staging DB from PG 15 → 16 (parity with demo)                   | High — major version | YES |
| R7 | Move `nzila-staging-db` + `nzila-staging-kv` from East US RG to Canada Central RG | Medium — KV/secret refs need updating | YES |
| R8 | Provision dedicated `nzila-canada-pilot-rg` for CUPE pilot              | Cost +   | YES |
| R9 | Provision `dev` Azure tier (optional — current plan is local-only)      | Cost +   | YES (or accept current posture) |

---

## 4. Acceptance Posture

Two operationally honest paths are available:

**Path A — Procurement-grade isolation:** Execute R1, R3, R4, R5, R8.
Outcome: dedicated prod fabric, demo with secrets, pilot tier.
This is the path required for SOC 2 and enterprise procurement.

**Path B — Documented shared-fabric:** Accept current topology, disclose
shared-fabric posture explicitly to procurement, scope SOC 2 boundary to the
shared staging-env.
This is a defensible posture for institutional pilots but not for
enterprise-tier procurement.

> **Recommendation:** Path A for FY27 readiness. Path B is the current
> documented posture (acceptable for CUPE pilot).

---

**Verdict for §2:** Isolation is **PARTIAL**. Only `staging` and `demo` have
true isolation. `dev`/`pilot`/`prod` lack dedicated infrastructure.
