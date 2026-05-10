# Repo-Wide Intelligence Audit

> Canonical convergence inventory of intelligence-related systems across Nzila OS.

## 1. Audit Scope

Audited surfaces:

- package directories
- API routes
- UX surfaces and component names
- prompts and assistant flows
- onboarding and recommendation surfaces
- assistant / copilot / AI-personality semantics
- surveillance-risk semantics
- behavioral optimization semantics

## 2. Drift Findings (Inventory)

### 2.1 Package-Level Drift

Packages currently named with AI-first or assistant-first semantics:

- `packages/ai-core` — primitive providers; needs cognition-substrate framing.
- `packages/ai-control` — governance over AI execution; needs cognition-control framing.
- `packages/ai-registry` — model card registry; reframe as cognition-asset registry.
- `packages/ai-sdk` — client SDK; reframe as cognition-output SDK.
- `packages/clc-executive-intelligence` — executive narrative engine; reframe as executive cognition substrate.
- `packages/clc-decision-intelligence` — strategic recommendation engine; reframe as decision cognition substrate.
- `packages/cfo-intelligence` — CFO insight engine; reframe as financial operational cognition.
- `packages/platform-intelligence` — cross-platform aggregator; reframe as platform cognition aggregator.
- `packages/workload-intelligence`, `packages/zonga-intelligence`, `packages/agri-intelligence`, `packages/agrimo-intelligence`, `packages/policy-intelligence`, `packages/trustops-intelligence` — all carry intelligence framing; reframe per substrate doctrine.

> Renames are non-blocking and may be rolled in over multiple PRs. Live surfaces must converge first; package renames second.

### 2.2 UX Surface Drift

User-facing surfaces with AI-first or assistant-first framing:

- `apps/cfo/app/[locale]/dashboard/advisory-ai/page.tsx` — "Advisory AI" heading; reframe as operational financial cognition.
- `apps/cfo/app/[locale]/dashboard/ai-insights/page.tsx` — "AI Insights" heading; reframe as financial operational interpretations.
- `apps/console/components/command-section-guide.tsx` — "RevOps Agent" / "AI-powered" framing; reframe toward operational cognition.
- `apps/console/lib/autopilot-engine.ts` — "Autopilot recommendations" semantics; reframe as bounded operational suggestions with human approval gate.

### 2.3 Assistant / Copilot Drift

Surfaces using assistant or copilot semantics (already reframed in labor continuity refactor):

- UE steward / officer onboarding wizards (already converged to continuity guidance).
- UE CBA-intelligence client (already converged to continuity intelligence).

### 2.4 Surveillance-Risk Findings

No active surveillance, scoring, or ranking surfaces detected at the user-facing layer. Doctrinally prohibited; enforced via validator.

### 2.5 Authority-Drift Findings

Surfaces that previously framed AI as authoritative:

- CFO advisory-ai page used "AI-powered financial intelligence" framing. Reframed to "bounded institutional interpretation; final authority remains with accountable financial operators."
- Console weekly-review already includes "Interpretive support only; final authority remains with accountable human operators." — keep as canonical phrasing.

### 2.6 Operational Legitimacy Risks

- "Autopilot" semantics in console must always present a human approval gate and explicit confidence-bounded language.
- "Agent" semantics anywhere in the repo must present bounded scope, escalation path, and human authority of record.

## 3. Convergence Inventory (Action Set)

| Area | Current Posture | Target Posture | Status |
|------|------------------|------------------|--------|
| UE labor intelligence | converged | governance-safe labor continuity intelligence | ✅ |
| Console weekly review | partially converged | interpretive support only | ✅ |
| Console autopilot framing | drift | bounded operational suggestions | 🟡 pending |
| CFO Advisory AI | drift | operational financial cognition | ✅ this phase |
| CFO AI Insights | drift | financial operational interpretations | ✅ this phase |
| Package names (`ai-*`, `*-intelligence`) | drift | cognition-substrate naming | 🟡 deferred to follow-on PRs |
| Cross-app posture validator | absent | validator-enforced | ✅ this phase |

## 4. Authority

This audit is the canonical convergence inventory. Subsequent doctrine documents and live refactors must reference it as the source of truth for what has converged and what remains.
