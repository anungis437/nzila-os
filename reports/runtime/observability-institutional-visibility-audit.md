# Union Eyes — Observability & Institutional Visibility Audit

**Audit date:** 2026-05-15
**Posture:** validation-only

"Observability" in the union-eyes runtime carries two distinct meanings that this audit deliberately separates:

1. **Operational observability** — telemetry on platform itself (latency, error rate, route volume, system integrity). Owned by `/dashboard/operations`, `/dashboard/ops/performance`, `/dashboard/analytics-admin`, `/dashboard/security`, `/dashboard/audits`, `/dashboard/trust`.
2. **Institutional visibility** — read-only projection of the institutional substrate (chronology, lineage, evidence-linked timeline, topology of governance). Owned by `/dashboard/institutional-observability`, `/dashboard/institutional-chronology`, `/dashboard/institutional-topology`, `/dashboard/governance-center`.

These two must never blur into a single "monitoring" framing. Any drift toward "monitor your organization" / "see everything" semantics on the institutional-visibility surfaces would breach the anti-surveillance doctrine.

---

## 1. Operational observability surfaces

| Surface | Substrate | Verdict |
| --- | --- | --- |
| /dashboard/operations | `db.execute` (services, incidents, SLAs, capacity) | aligned — platform-lead only |
| /dashboard/ops/performance | `performanceMonitor` (Redis analytics store) | aligned — platform ops only |
| /dashboard/analytics-admin | `db.execute` (login events, page views, features) | aligned — restricted role |
| /dashboard/security | Security telemetry | aligned |
| /dashboard/audits | Audit log surface | aligned (depth-1) |
| /dashboard/trust | `getTrustMetrics` (immutability, RLS, FSM, audit metrics) | aligned (system verification) |

All operational observability surfaces are correctly scoped to platform / ops roles. No drift into member-facing "monitor everyone" framing.

---

## 2. Institutional-visibility surfaces

| Surface | Substrate | Doctrine alignment | Risk |
| --- | --- | --- | --- |
| /dashboard/governance-center | IGG kernel + cognition registry | aligned — anti-surveillance guarantees explicit | low |
| /dashboard/institutional-observability | IGG projection | aligned in copy | medium (label) — `observability` reads as surveillance to non-technical reviewers |
| /dashboard/institutional-chronology | IGG projection | aligned | low |
| /dashboard/institutional-topology | IGG projection | aligned | low |
| /dashboard/longitudinal-cognition | Full cognition orchestration | aligned (storied output) | medium (label) — `cognition` reads as autonomous |
| /dashboard/executive-operating-intelligence | Cognition envelopes | aligned (storied) | medium (label) — `executive operating intelligence` reads as enterprise SaaS |

The substrate of these surfaces is governance-safe. The risk surface is entirely **labelling** at the navigation / metadata layer. `legacy-semantic-drift-audit.md` documents the specific renames recommended.

---

## 3. Cross-cutting visibility primitives

| Primitive | Provided by | Used by |
| --- | --- | --- |
| Provenance footer (source, queried-at, integrity) | `assertNoProtectedKindsInReadSurface()` + projection helpers | governance-center, institutional-{observability,topology,chronology}, longitudinal-cognition, executive-operating-intelligence |
| Explainability disclosure ("assistive · review-required") | reasoning envelope helpers | same six |
| Topology read | `topology-source-adapter` (WS H) | available for institutional-memory + continuity cockpits — not yet adopted |
| Snapshot counts | `observability/snapshot.ts` (now exposes topology counts) | available for observability dashboards |

---

## 4. Visibility gaps

| Gap | Surfaces | Recommended (validation-only) direction |
| --- | --- | --- |
| Topology read primitive available but not adopted | institutional-memory, continuity-{intelligence,planning,simulation}, cba-intelligence | Adopt `topology-source-adapter` (zero schema/architecture change). |
| `observability` label suggests surveillance | /dashboard/institutional-observability | Re-label nav as `Governance Visibility`; URL stable. |
| `cognition` label reads as autonomous reasoning | /dashboard/cognition, /dashboard/longitudinal-cognition | Add subtitle "human-reviewed" + "assistive · review-required" badge in nav. |
| Aggregation routes use `analytics` framing on operational + organizational data | /dashboard/movement-insights, /dashboard/cross-union-analytics, /dashboard/sector-analytics | Reframe to `trends`. Substrate is correct — only the framing carries surveillance load. |

---

## 5. Verdict

- Operational observability is **clean and correctly scoped**.
- Institutional visibility is **substrate-safe and label-risky**. Six surfaces project the substrate correctly with provenance + explainability + protected-token redaction; the residual risk is in navigation labels and metadata strings.
- No new observability primitives are required. Workstream H already provided the one missing piece (`topology-source-adapter`).
- The principal validation finding for this audit is therefore: **adopt the WS H topology adapter on the depth-2 surfaces and re-label the four risky navigation strings.** Both are additive, non-destructive, and require no schema or architectural change.
