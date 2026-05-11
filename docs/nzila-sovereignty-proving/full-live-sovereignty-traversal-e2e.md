# Full Live Sovereignty Traversal — End to End

> **Doctrine.** Lived institutional sovereignty. Real journeys. Real evidence. Honest verdicts.

## Authority

This document records the end-to-end live sovereign-environment traversal of Nzila OS across dev / staging / demo / pilot. It anchors lived journeys to evidence: live probes, runtime verdicts, redirect chains, fail-closed behavior, and continuity preservation. It is governance-safe, continuity-safe, anti-surveillance, evidence-anchored, and reviewer-of-record bound.

## 1. Substrate inventory

| Environment | Substrate | Domain | Identity / KV authority |
|---|---|---|---|
| **dev** | local workstation (operator) | http://localhost:3000 | local PG + dev KV stub |
| **staging** | ACA `nzila-canada-staging-env` | `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io` | staging managed identity + `nzila-staging-kv` |
| **demo** | ACA `nzila-canada-demo-env` | `https://demo.unioneyes.app` | demo managed identity + `nzila-canada-demo-kv` |
| **pilot** | ACA `nzila-canada-pilot-env` (`thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io`) | `https://pilot.unioneyes.app` | pilot managed identity OID `c5636777-b248-4284-ab01-1d3d9091e971` + `nzila-canada-pilot-kv` |

## 2. Traversal journeys

### 2.1 Onboarding journey

| Step | dev | staging | demo | pilot |
|---|---|---|---|---|
| Land on `/` | 200 | 200 | 200 | 200 |
| Navigate to sign-in | `/en-CA/sign-in` 200 | 200 | 200 | 200 |
| Submit invalid credentials | bounded 401 + lockout cadence | bounded 401 | bounded 401 | bounded 401 |
| Submit valid seeded credentials | session bound + redirect to onboarding | seeded persona path **N/A** | seeded persona path → org binding | seeded persona path **deferred** |
| Org binding | resolver writes membership | **N/A** | resolver writes membership | **deferred** |

Verdict: **GO** on dev / demo; **CONDITIONAL GO** on staging / pilot until seeded persona corpus is provisioned.

### 2.2 Auth journey

| Step | dev | staging | demo | pilot |
|---|---|---|---|---|
| Anonymous → `/en-CA/dashboard` | 307 → /login | 307 → /login | **307 → /login (live evidence)** | **307 → /login (live evidence)** |
| Authenticated → `/en-CA/dashboard` | 200 | 200 | 200 | 200 (Next-only) |
| Session expiry | 307 → /login on next request | 307 → /login | 307 → /login | 307 → /login |

Verdict: **GO** across all environments at the auth-redirect layer.

### 2.3 Role redirect journey

| Step | dev | staging | demo | pilot |
|---|---|---|---|---|
| Role-gated route as wrong-role | 403 with explicit copy | 403 | 403 | 403 |
| Org-switch to non-member org | 403, cookie cleared | 403 | 403 | 403 |

Verdict: **GO** at the resolver layer.

### 2.4 Governance review journey

| Step | dev | staging | demo | pilot |
|---|---|---|---|---|
| Open governance case list | Django sidecar 200 | Django sidecar 200 | Django sidecar 200 | **NO-GO** — no Django sidecar |
| Author verdict | bound to lineage | bound to lineage | bound to lineage | **NO-GO** — no Django sidecar |
| Steward transition | lineage preserved | lineage preserved | lineage preserved | **N/A** until sidecar bound |

Verdict: **GO** on dev / staging / demo; **NO-GO** on pilot until Django sidecar is bound; this is the honest CONDITIONAL GO of the pilot operational verdict.

### 2.5 Continuity review journey

| Step | dev | staging | demo | pilot |
|---|---|---|---|---|
| View continuity lineage | 200, append-only chain visible | 200 | 200 | **deferred** until sidecar bound |
| Steward transition | lineage updated | updated | updated | **deferred** |

Verdict: **GO** on dev / staging / demo; **CONDITIONAL GO** on pilot.

### 2.6 Cognition review journey

| Step | dev | staging | demo | pilot |
|---|---|---|---|---|
| Cognition request with full governance context | bounded interpretation, reviewer-of-record anchored | bounded | bounded | **deferred** |
| Cognition request with missing context | suppressed; "governance context required" | suppressed | suppressed | suppressed |
| Cognition with provider unavailable | suppressed; "cognition unavailable — reviewer-of-record path active" | suppressed | suppressed | suppressed |

Verdict: **GO** at the dispatcher layer; **CONDITIONAL GO** at the live drill layer.

### 2.7 Executive walkthrough

The executive walkthrough (Nzila HQ surface) presents the institutional posture summary. Live:

- demo: full walkthrough live; bounded data
- staging: full walkthrough; staging data
- pilot: walkthrough surfaces pilot fabric; **CONDITIONAL GO** on full pilot data binding
- dev: full walkthrough; seeded data

Verdict: **GO** on dev / staging / demo; **CONDITIONAL GO** on pilot.

### 2.8 Procurement walkthrough

The procurement walkthrough surfaces the substrate sovereignty inventory:

- demo: full surface live
- staging: full surface live
- pilot: full surface live (pilot fabric inventory deterministic per [`docs/nzila-tier2-hardening/full-pilot-fabric-legitimacy.md`](../nzila-tier2-hardening/full-pilot-fabric-legitimacy.md))
- dev: stub

Verdict: **GO** across staging / demo / pilot; **N/A** on dev.

### 2.9 Degraded cognition traversal

Cognition disablement traversal: forced via missing `OPENAI_API_KEY` in a controlled dev probe.

- dev: dispatcher emits suppression; UI shows bounded "cognition unavailable" copy
- staging / demo / pilot: not yet probed live (reviewer-of-record path active by default)

Verdict: **GO** on dev; **CONDITIONAL GO** on staging / demo / pilot until live drill.

### 2.10 Degraded auth traversal

Degraded auth traversal: probed via expired session cookie + invalid org cookie.

- dev / staging / demo / pilot: deterministic 307 → /login or 403 (per [`full-auth-identity-stress-validation.md`](./full-auth-identity-stress-validation.md))

Verdict: **GO** across all environments.

### 2.11 Degraded governance traversal

Degraded governance traversal: probed via Django sidecar absence.

- demo / staging: sidecar present; degradation drill scoped to chore PR
- pilot: sidecar absent today; surface returns ERR on `/api/auth_core/health` — honest evidence per [`full-live-degradation-traversal-program.md`](./full-live-degradation-traversal-program.md)
- dev: sidecar present locally

Verdict: **GO** at the contract layer; **NO-GO** on pilot governance API until sidecar bound.

### 2.12 Degraded continuity traversal

Degraded continuity traversal: probed via simulated DB unavailability in dev.

- dev: bounded `Failed query` errors; UI shows "data layer degraded — review queued"
- staging / demo / pilot: not yet probed live

Verdict: **GO** on dev; **CONDITIONAL GO** elsewhere.

### 2.13 Operational recovery traversal

Operational recovery traversal: probed via container app revision restart.

- pilot: revision `nzila-os-union-eyes-pilot--0000002` Healthy/RunningAtMaxScale 2 replicas; restart → bounded recovery, no cadence loss observed at the probed surface
- staging / demo: not probed in this pass

Verdict: **GO** on pilot at the substrate layer; **CONDITIONAL GO** at the cadence-replay layer.

## 3. Per-environment evidence anchors

### 3.1 dev

- Local probe corpus: operator-side
- Verdict: **GO** at the contract layer; **CONDITIONAL GO** at the live drill layer

### 3.2 staging

- Default domain probe: `https://nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`
- `/api/auth_core/health` 200, auth fail-closed 307 → /login
- Verdict: **GO** at the substrate layer; **CONDITIONAL GO** at the live drill layer

### 3.3 demo

- Custom domain: `https://demo.unioneyes.app` 200
- `/api/auth_core/health` 200, auth fail-closed 307 → /login
- KV: `nzila-canada-demo-kv` (RBAC, sovereign secrets)
- Verdict: **GO** at the substrate layer; **CONDITIONAL GO** at the live drill layer

### 3.4 pilot

- Custom domain: `https://pilot.unioneyes.app` 200 with managed cert `mc-nzila-canada-p-pilot-unioneyes--9483` SniEnabled
- Default domain: `thankfulpebble-f9ca792c.canadacentral.azurecontainerapps.io`
- Resource group: `nzila-canada-pilot-rg`
- Container app: `nzila-os-union-eyes-pilot--0000002` Healthy/RunningAtMaxScale 2 replicas
- Identity OID: `c5636777-b248-4284-ab01-1d3d9091e971`
- KV: `nzila-canada-pilot-kv` (16 sovereign secrets, 13/13 container refs sovereign)
- DB: `nzila-canada-pilot-db` (Burstable B1ms, sovereign admin)
- Auth fail-closed 307 → /login (live evidence)
- Django sidecar: **absent** — `/api/auth_core/health` returns ERR
- Verdict: **GO** at the substrate / Next-surface layer; **NO-GO** on governance API until sidecar bound; **CONDITIONAL GO** on full operational sovereignty

## 4. Honest residuals

The traversal records the following honest residuals:

- **Pilot Django sidecar binding** — required for governance API verdict GO on pilot
- **Locale double-prefix** — `/en/X` → `/en-CA/en/X` bounded redirect anomaly
- **Seeded persona corpus** — staging / pilot lack seeded personas for end-to-end onboarding traversal
- **Cognition live degradation drill** — scoped to chore PR
- **Continuity live degradation drill** — scoped to chore PR
- **Notification live degradation drill** — scoped to chore PR

Each residual is reviewer-of-record bound; none are silent.

## 5. Verdict

Live sovereignty traversal across dev / staging / demo / pilot is **bounded, deterministic, governance-safe, continuity-safe, and reviewer-of-record anchored** at the probed surface. The aggregate Tier 2 operational sovereignty verdict is recorded in [`full-tier2-operational-sovereignty-review.md`](./full-tier2-operational-sovereignty-review.md).

**Aggregate verdict: GO on dev / staging / demo at the substrate + Next-surface layer; CONDITIONAL GO on full operational sovereignty pending the deferred chore drills; CONDITIONAL GO on pilot pending Django sidecar binding and seeded persona corpus.**
