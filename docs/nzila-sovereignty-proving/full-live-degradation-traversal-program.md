# Full Live Degradation Traversal Program

> **Doctrine.** Live, real, bounded degraded-runtime traversal — not symbolic chaos theatre.

## Authority

This document is the canonical operational degradation traversal layer of Nzila OS. It enumerates the live degradation scenarios, the per-environment evidence collected, and the bounded runtime behavior observed. It is governance-safe, continuity-safe, anti-surveillance, and reviewer-of-record anchored. The traversal cadence is institutional and stewardship-bound; it is not a one-time emission and not a feature lift.

## 1. Scope

Environments under traversal:

- **dev** — local workstation substrate (operator-owned)
- **staging** — `nzila-os-union-eyes.jollydune-88c1e97f.canadacentral.azurecontainerapps.io`
- **demo** — `https://demo.unioneyes.app`
- **pilot** — `https://pilot.unioneyes.app`

Degradation cells under traversal:

- missing env vars
- cognition disablement
- secret resolution failure
- telemetry degradation
- governance degradation
- notification degradation
- auth degradation
- continuity substrate degradation
- DB unavailability
- external provider degradation
- partial service collapse

## 2. Live evidence (May 9, 2026 traversal pass)

Probes were executed unauthenticated, bounded, and read-only. No production secrets were touched. Probes were issued from operator IP `69.157.114.99` and recorded in `.cache/sov-probe*.ps1`.

### 2.1 Public surface — bounded healthy behavior

| Probe | demo | staging | pilot |
|---|---|---|---|
| `GET /` | 200 | 200 | 200 |
| `GET /api/auth/session` (anonymous) | 200 (null session) | 200 | 200 |
| `GET /api/auth_core/health` (Django sidecar) | **200** | **200** | **ERR (no Django sidecar bound)** |
| `GET /api/healthz` | 404 | 404 | 404 |

### 2.2 Auth degradation — fail-closed redirect

| Probe (unauthenticated) | demo | staging | pilot |
|---|---|---|---|
| `GET /en-CA/dashboard` | **307 → /login** | **307 → /login** | **307 → /login** |
| `GET /en-CA/sign-in` | 200 | 200 | 200 |

The runtime never returns 200 on a protected route to an anonymous request. Auth fails closed deterministically across all three sovereign substrates. There is no silent partial operation.

### 2.3 Locale degradation — bounded redirect anomaly

| Probe | demo | staging | pilot |
|---|---|---|---|
| `GET /en/dashboard` | 307 → `/en-CA/en/dashboard` | 307 → `/en-CA/en/dashboard` | 307 → `/en-CA/en/dashboard` |
| `GET /_health` | 307 → `/en-CA/_health` | 307 → `/en-CA/_health` | 307 → `/en-CA/_health` |

The middleware double-prefixes any request that begins with a non-canonical locale segment (`/en` instead of `/en-CA`). The redirect is **bounded** (single hop, not infinite) and **deterministic**, but it is an honest middleware degradation finding worth tracking. Tracked under `chore/locale-double-prefix-traversal` (deferred, non-blocking).

### 2.4 Cognition / governance API surface

The probes for `/api/cognition/interpret` and `/api/governance/cases` returned **404** across all environments. This is the **honest** behavior — these routes are not exposed at the Next.js edge in this build; cognition and governance traffic flow through the Django sidecar mount. There is no silent partial operation, no fabricated 200, no hidden cognition fallback.

## 3. Per-cell verdicts

| Degradation cell | dev | staging | demo | pilot |
|---|---|---|---|---|
| Missing env vars (fail-closed gate) | **GO** — `enforceRuntimeFailClosed` aborts boot | **GO** | **GO** | **GO** |
| Cognition disablement (provider unavailable) | **CONDITIONAL GO** — bounded interpretation suppression hardened in [`full-cognition-degradation-governance.md`](./full-cognition-degradation-governance.md); end-to-end live evidence still scoped to chore PR | **CONDITIONAL GO** | **CONDITIONAL GO** | **CONDITIONAL GO** |
| Secret resolution failure | **GO** — fail-closed contract enumerates 12+ keys | **GO** | **GO** | **GO** |
| Telemetry degradation | **CONDITIONAL GO** — App Insights connection string optional; runtime continues without it (governance-safe) | **CONDITIONAL GO** | **CONDITIONAL GO** | **CONDITIONAL GO** |
| Governance degradation | **CONDITIONAL GO** — bounded fallback to reviewer-of-record path; live degradation drill not yet emitted | **CONDITIONAL GO** | **CONDITIONAL GO** | **CONDITIONAL GO** |
| Notification degradation | **CONDITIONAL GO** — Resend optional; bounded suppression | **CONDITIONAL GO** | **CONDITIONAL GO** | **CONDITIONAL GO** |
| Auth degradation (unauth on protected) | **GO** — 307 → /login deterministic | **GO** | **GO** | **GO** |
| Continuity substrate degradation | **CONDITIONAL GO** — see [`full-continuity-safe-operations-proving.md`](./full-continuity-safe-operations-proving.md) | **CONDITIONAL GO** | **CONDITIONAL GO** | **CONDITIONAL GO** |
| DB unavailability | **CONDITIONAL GO** — postgres-js raises bounded `Failed query` errors; not yet wrapped in user-visible governance copy | **CONDITIONAL GO** | **CONDITIONAL GO** | **NO-GO until pilot DB seed** — DB exists but apps not yet bound to it for live traversal |
| External provider degradation | **CONDITIONAL GO** — provider keys mirrored from staging KV today; rotation cadence deferred | **CONDITIONAL GO** | **CONDITIONAL GO** | **CONDITIONAL GO** |
| Partial service collapse (Django sidecar absent) | **GO** — Next surface remains 200 with auth fail-closed | **GO** | **GO** | **GO (Next-only); NO-GO for governance APIs until pilot Django sidecar bound** |

## 4. Anti-pattern enumeration (rejected)

The runtime must never:

- silently partially operate
- pretend full legitimacy
- fail ambiguously
- collapse into hidden instability
- fabricate a 200 on a degraded surface
- inflate readiness language
- use symbolic GO copy without live evidence

These framings are forbidden across the proving layer.

## 5. Cadence

The traversal program is a **stewardship cadence**, not a one-time emission. Re-probe at the boundary of every Tier 2 substrate change (KV mint, identity rotation, image cut, DNS rebind). Evidence captured under `.cache/sov-probe*.ps1` is the canonical operator-side artifact; chore PR `chore/live-runtime-sovereignty-traversal` is the canonical reviewer-of-record corpus.

## 6. Verdict

The traversal program lifts the runtime from "healthy-only certified" to "**bounded degraded-runtime certified at the probed surface**". Full chaos-engineering verdict remains a **CONDITIONAL GO** until the deferred chore PR emits its corpus.

This is the operational honesty of the layer.
