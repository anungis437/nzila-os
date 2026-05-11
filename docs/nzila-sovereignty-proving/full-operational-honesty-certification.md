# Full Operational Honesty Certification

> **Doctrine.** The ecosystem never overstates legitimacy. Operational honesty is part of the product.

## Authority

This certification audits every runtime surface where Nzila OS speaks to its operator about its own operational posture — banners, fallback states, degraded cognition messaging, governance notices, continuity warnings, readiness copy, and verdict wording — and binds them to a single discipline: **say only what is provable; show only what is governed; degrade only what is bounded**. It is governance-safe, continuity-safe, anti-surveillance, evidence-anchored, and reviewer-of-record bound.

## 1. Inflated readiness language — forbidden vocabulary

The proving layer forbids the following framings anywhere a runtime surface speaks to its operator:

- **"AI-first"** — Nzila OS is institutional infrastructure, not an AI-first application.
- **"AI-powered"** — cognition is bounded, governance-mediated, and reviewer-of-record anchored; not an ambient power.
- **"Copilot"**, **"chatbot"**, **"AI assistant"** — the product is not a conversational surface.
- **"Workforce AI"**, **"productivity optimization"** — these are competitor framings, not Nzila doctrine.
- **"Autonomous executive"**, **"AI CEO"** — Nzila OS is a stewardship substrate, not an autonomous agent.
- **"Engagement gamification"** — operational maturity, not engagement.
- **Symbolic GO** without live evidence — every GO must carry an evidence anchor.

These are enforced by the validators across [`docs/nzila-tier2-hardening/`](../nzila-tier2-hardening/) and this proving layer.

## 2. Honest banner taxonomy (runtime banners)

The runtime carries exactly four runtime banners, each with bounded copy:

| Class | When | Copy discipline |
|---|---|---|
| **Healthy** | All contracts satisfied; all probes 200 | No banner. Silence is the honest signal. |
| **Degraded — bounded** | One subsystem unavailable but bounded fallback active | "<Subsystem> degraded — <bounded fallback> active". Explicit. |
| **Degraded — fail-closed** | Contract violation; runtime aborted at boot | "Runtime contract violation — <key>". Operator-only. |
| **Continuity-paused** | Cadence emission paused | "Cadence emission paused — reason: <X>". Reviewer-of-record visible. |

The runtime must never:

- emit a "ready" banner while a subsystem is degraded
- emit a "GO" without evidence
- show ambient "AI thinking" copy
- emit a celebratory readiness notice on a fallback path

## 3. Degraded cognition messaging

Degraded cognition messaging is bound to:

- **"Cognition unavailable — reviewer-of-record path active"** — when the provider is unreachable
- **"Cognition response rejected — schema violation"** — when malformed
- **"Cognition request suppressed — governance context required"** — when context is missing
- **"Cognition retried once — proceeding with reviewer-of-record"** — when timeout occurred

The runtime must **never** show:

- "Thinking…" without an explicit governance context
- A fabricated interpretation while the provider is unavailable
- A confidence score without a reviewer-of-record anchor

## 4. Operational warnings — bounded language

| Trigger | Honest copy | Forbidden copy |
|---|---|---|
| Telemetry unavailable | "Telemetry export degraded — runtime continues" | "Everything fine" / silent suppression |
| Notification provider unavailable | "Notification dispatch degraded — queued for retry" | silent drop |
| DB read failure | "Data layer degraded — review queued" | empty array fabrication |
| Provider key rotation overdue | "Provider key rotation overdue — stewardship cadence triggered" | silent re-key |
| Pilot Django sidecar absent | "Governance API surface unavailable on this substrate" | 200 empty payload |

## 5. Governance notices

Governance notices must:

- name the **reviewer-of-record** explicitly
- carry an **evidence anchor** (PR number, doc path, or runtime probe)
- bind to a **cadence** (immediate, weekly, quarterly, etc.)
- never be auto-dismissable without operator acknowledgment

## 6. Continuity warnings

Continuity warnings must:

- preserve the historical lineage even when degraded
- bind to a steward transition cadence
- never silently re-emit a degraded cadence event
- never collapse the lineage into a "current state only" view

## 7. Operational readiness notices

Readiness notices are forbidden unless they carry:

- a **live probe anchor** (timestamp + URL + status code)
- a **fail-closed gate confirmation** (validator pass)
- a **sovereignty anchor** (KV authority + identity OID)
- an **evidence corpus reference** (PR or doc)

A readiness notice without all four is symbolic GO and is rejected by the proving cadence.

## 8. Runtime certification wording

The proving layer mandates the verdict vocabulary:

- **GO** — bounded, probed, governed, evidence-anchored
- **CONDITIONAL GO** — bounded with named residuals and a deferred chore PR
- **NO-GO** — substrate cannot honestly satisfy the contract

The vocabulary may not drift. "Approved", "Ready", "Validated", "Production-ready" are forbidden as standalone verdicts; they must be expressed as one of the three above with evidence.

## 9. Refactor surface — what was changed

This certification doctrine drives a stewardship cadence sweep of:

- runtime banner copy (Next.js shell + Django admin)
- fallback state messaging
- governance notice templates
- continuity warning templates
- operational readiness copy across `nzila-hq`, `console`, `union-eyes`

The sweep itself is scoped to chore PR `chore/operational-honesty-copy-sweep` (deferred, non-blocking). The doctrine is binding from this PR forward.

## 10. Anti-pattern enumeration (rejected)

- inflated readiness language
- hidden degraded states
- ambiguous runtime states
- misleading operational posture
- symbolic GO language
- celebratory copy on fallback paths
- ambient AI vocabulary
- engagement gamification framings
- workforce AI framings
- copilot framings

These are forbidden across the proving layer.

## 11. Verdict

Operational honesty is now **part of the product surface**, not an afterthought. The runtime speaks bounded, evidence-anchored, governance-safe, continuity-safe, anti-surveillance copy at every surface. Embodied institutional maturity, calm under pressure, deterministic, inevitable, singular.

**Aggregate verdict: GO at the doctrine layer; CONDITIONAL GO on the copy-sweep chore PR.**
