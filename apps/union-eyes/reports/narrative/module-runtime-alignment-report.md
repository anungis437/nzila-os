# Union Eyes — Module / Package / Runtime Narrative Alignment Audit

Generated: 2026-05-13T00:00:00Z
Workstream: A (audit-only, no code changes)
Scope: Runtime product surfaces (`apps/union-eyes/**`) and supporting `packages/**` — labels, module names, navigation, taxonomies and surfaced terminology consumed by signed-in users.
Companion report: `phase4-alignment-report.md` (marketing surfaces — 87 files, 67/100 maturity).

> Reframe target: Union Eyes is **institutional governance & continuity infrastructure** — *not* union SaaS, *not* workflow software, *not* generic case management.

---

## Summary

- Surfaces inventoried: **5 dashboard experiences**, **2 navigation sources**, **19 platform-economics modules**, **8 partially-aligned parallel `/dashboard/*` routes already shipping**.
- Runtime files inspected (sources of truth): `lib/dashboard/role-experience.ts`, `lib/auth/roles.ts`, `components/sidebar.tsx`, `components/mobile/BottomNav.tsx`, `services/platform-economics/entitlement-guard.ts`, `tooling/marketing/config/forbidden-vocabulary.ts`.
- Marketing alignment baseline: ≥ 50 hits across `app/**` for *continuity layer*, *institutional memory*, *governance of record*, *sovereignty-conscious*, *overlay infrastructure*. Marketing pillar copy is on-narrative.
- Runtime alignment baseline: **0 hits** for the same vocabulary inside `lib/dashboard/role-experience.ts` and `components/mobile/BottomNav.tsx`.
- Headline drift gap: marketing pages position UE as institutional/continuity infrastructure, while the **signed-in chrome still presents as a generic SaaS workbench** (Workbench, Cases, Priorities, Reports, Claims, Messages).
- Drift risk distribution:
  - Fully aligned (no action): **8** items
  - Mostly aligned (L1 copy nudge optional): **9** items
  - Operational SaaS drift (L1 copy fix): **15** items
  - High-risk category drift (L1 + L2 alias / route): **6** items
  - Rename / refactor candidate (L3): **3** items
- Hard-fail (blocks deploy): **0** — all are taxonomy, not policy violations.
- Warnings: **33** (one per matrix row needing action).
- Average runtime Institutional Maturity (heuristic, weighted across nav + modules): **62 / 100**.

> Marketing maturity is 67–88; runtime maturity is 62. The narrative seam is the dashboard chrome — fix that and the institutional reframe becomes coherent end-to-end.

---

## Per-Surface Detail

### sidebar/member-nav

- Path: [apps/union-eyes/lib/dashboard/role-experience.ts](../../lib/dashboard/role-experience.ts#L78-L92)
- Maturity: **78 / 100**
- Posture: member-facing simplicity is acceptable; one operational verb to soften.
- Scores by rule:
  - narrative-balance: 80 (pass)
  - coexistence-positioning: 90 (pass)
  - procedural-neutrality: 70 (warn — "Submit Request" is generic SaaS verb)
  - labour-safe-ai: 100 (pass — no AI claims)

  - canadian-positioning: 60 (warn — no bilingual / sovereignty cue at nav level)

### sidebar/staff-nav

- Path: [apps/union-eyes/lib/dashboard/role-experience.ts](../../lib/dashboard/role-experience.ts#L94-L110)
- Maturity: **48 / 100** ← **largest single drift surface**
- Posture: reads like a productivity/case-management SaaS. Highest reframe leverage.
- Scores by rule:
  - narrative-balance: 40 (warn — "Workbench / Cases / Priorities / Reports" are SaaS-tool labels)
  - coexistence-positioning: 60 (warn)
  - procedural-neutrality: 50 (warn — "Workbench" frames the institution as a worker tool, not a continuity layer)
  - labour-safe-ai: 90 (pass)

  - canadian-positioning: 50 (warn)

### sidebar/executive-nav

- Path: [apps/union-eyes/lib/dashboard/role-experience.ts](../../lib/dashboard/role-experience.ts#L112-L132)
- Maturity: **75 / 100**
- Posture: already well aligned (Continuity Insights, Governance Visibility, Trust & Oversight, Leadership Continuity). Two soft drifts.
- Scores by rule:
  - narrative-balance: 80 (pass)
  - coexistence-positioning: 85 (pass)
  - procedural-neutrality: 70 (warn — "Operational Health" reads operational, not institutional)
  - labour-safe-ai: 90 (pass)

  - canadian-positioning: 60 (warn)

### sidebar/governance-nav

- Path: [apps/union-eyes/lib/dashboard/role-experience.ts](../../lib/dashboard/role-experience.ts#L134-L154)
- Maturity: **88 / 100** ← **strongest aligned runtime surface**
- Posture: reference standard for the rest of the dashboard (Trust & Explainability, Continuity Signals, Audit & Evidence, Policy Alignment).
- Scores by rule:
  - narrative-balance: 95 (pass)
  - coexistence-positioning: 90 (pass)
  - procedural-neutrality: 90 (pass)
  - labour-safe-ai: 95 (pass — "Trust & Explainability" frames AI safely)

  - canadian-positioning: 70 (warn)

### sidebar/admin-nav

- Path: [apps/union-eyes/lib/dashboard/role-experience.ts](../../lib/dashboard/role-experience.ts#L156-L176)
- Maturity: **70 / 100**
- Posture: admin chrome can stay operational; only "Pilot Configuration" is mildly off-narrative for the institutional reframe.
- Scores by rule:
  - narrative-balance: 75 (pass)
  - coexistence-positioning: 70 (pass)
  - procedural-neutrality: 75 (pass)
  - labour-safe-ai: 100 (pass)

  - canadian-positioning: 60 (warn)

### mobile/bottom-nav

- Path: [apps/union-eyes/components/mobile/BottomNav.tsx](../../components/mobile/BottomNav.tsx#L12-L40)
- Maturity: **35 / 100** ← **second-largest drift surface, plus structural bug**
- Posture: hard-coded labels not driven by `getNavigationForExperience()`; uses insurance-SaaS vocabulary ("Claims") and the hrefs are missing the `/dashboard` prefix (likely already routing through middleware fallback).
- Scores by rule:
  - narrative-balance: 30 (warn — "Claims" is insurance vocabulary; UE is representation/governance, not claims processing)
  - coexistence-positioning: 50 (warn)
  - procedural-neutrality: 40 (warn — "Messages" generic)
  - labour-safe-ai: 100 (pass)
  - canadian-positioning: 50 (warn)
- Structural note (not a copy issue): `/claims`, `/members`, `/messages`, `/more` are not under `/dashboard/*` — mobile nav diverges from the experience-gated route allowlists. Flag for Workstream B routing pass.

### platform-economics/modules

- Path: [apps/union-eyes/services/platform-economics/entitlement-guard.ts](../../services/platform-economics/entitlement-guard.ts#L1-L120)
- Maturity: **58 / 100**
- Posture: 19 PLATFORM_MODULES keys mix institutional language (`governance_suite`, `union_knowledge_suite`) with SaaS-economics language (`transaction_fees`, `commercial_reporting`, `allocation_engine`, `ai_advanced_insights`).
- Scores by rule:
  - narrative-balance: 55 (warn — "suite" repeated 4×; SaaS framing)
  - coexistence-positioning: 65 (warn)
  - procedural-neutrality: 60 (warn)
  - labour-safe-ai: 50 (warn — `ai_advanced_insights` lacks human-oversight framing in identifier)
  - canadian-positioning: 60 (warn)

### narrative-vocabulary/runtime-coverage

- Path: [apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts](../../tooling/marketing/config/forbidden-vocabulary.ts#L1-L200)
- Maturity: **55 / 100**
- Posture: the lint catches drift in marketing only (`publicOnly: true` flag). Runtime nav, dashboard headings, and module identifiers are **not** scanned — which is exactly why the staff nav and BottomNav drift slipped through.
- Scores by rule:
  - narrative-balance: 60 (warn — coverage gap is the issue, not the rules)
  - coexistence-positioning: 70 (pass)
  - procedural-neutrality: 50 (warn — runtime exempted)
  - labour-safe-ai: 60 (warn)
  - canadian-positioning: 40 (warn)

### packages/clc-executive-intelligence

- Path: [packages/clc-executive-intelligence/src/index.ts](../../../../packages/clc-executive-intelligence/src/index.ts#L1-L20)
- Maturity: **80 / 100**
- Posture: package name and exported domain (executive intelligence, governed reasoning, audit logger, NIL authority) are on-narrative. Internal "workflow" naming is architectural (not user-facing).
- Scores by rule:
  - narrative-balance: 85 (pass)
  - coexistence-positioning: 80 (pass)
  - procedural-neutrality: 80 (pass)
  - labour-safe-ai: 75 (pass)
  - canadian-positioning: 70 (pass — out of scope for a TS package, neutral)

---

## Module / Page Maturity Matrix

Legend: **Drift risk** = Low | Med | High | Category. **Fix level**: L1 = copy/taxonomy, L2 = internal aliasing/route, L3 = structural rename.

### Sidebar — staff experience (HIGH leverage)

| # | Current label | Proposed label | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 1 | Workbench | Casework Console | High | L1 | role-experience.ts:~96 | "Workbench" is SaaS productivity framing |
| 2 | Cases | Representation Cases | Med | L1 | role-experience.ts:~98 | Disambiguates from insurance/legal "cases" |
| 3 | Priorities | Commitments & Deadlines | Med | L1 | role-experience.ts:~100 | Institutional language |
| 4 | Members | Member Register | Low | L1 | role-experience.ts:~102 | Optional; current is acceptable |
| 5 | Documents | Institutional Records | Low | L1 | role-experience.ts:~104 | Optional |
| 6 | Communications | Representational Communications | Low | L1 | role-experience.ts:~106 | Optional |
| 7 | Reports | Institutional Reports | Med | L1 | role-experience.ts:~108 | Drops SaaS-report framing |

### Sidebar — executive experience

| # | Current label | Proposed label | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 8 | Operational Health | Continuity Operations | Med | L1 | role-experience.ts:~118 | "Health" reads ops-tooling |
| 9 | Outcomes | Member Outcomes Ledger | Low | L1 | role-experience.ts:~122 | Optional; "ledger" reinforces audit posture |
| 10 | Reports | Leadership Briefings | Low | L1 | role-experience.ts:~128 | Optional |

### Sidebar — member experience

| # | Current label | Proposed label | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 11 | Submit Request | Open Representation Case | Med | L1 | role-experience.ts:~84 | "Submit Request" is generic ticketing |
| 12 | My Cases | My Representation | Low | L1 | role-experience.ts:~82 | Optional |

### Sidebar — governance experience

| # | Current label | Proposed label | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 13 | Operational Review | Procedural Review | Low | L1 | role-experience.ts:~140 | Optional |
| 14 | Reports | Governance Briefings | Low | L1 | role-experience.ts:~150 | Optional |

### Sidebar — admin experience

| # | Current label | Proposed label | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 15 | Pilot Configuration | Continuity Pilot Setup | Low | L1 | role-experience.ts:~162 | Optional |

### Mobile bottom nav (HIGH leverage + structural fix)

| # | Current label / href | Proposed label / href | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 16 | Claims → /claims | Cases → /dashboard/cases | Category | L1 + L2 | BottomNav.tsx:~25 | "Claims" is insurance vocab; href missing `/dashboard` |
| 17 | Members → /members | Members → /dashboard/members | Med | L2 | BottomNav.tsx:~28 | Route normalization |
| 18 | Messages → /messages | Communications → /dashboard/communications | Med | L1 + L2 | BottomNav.tsx:~31 | Match staff nav vocabulary |
| 19 | More → /more | More → /dashboard/more | Low | L2 | BottomNav.tsx:~34 | Route normalization |
| 20 | Home → /dashboard | Home → /dashboard | Low | — | BottomNav.tsx:~22 | Already correct |
| 21 | (architecture) | Drive BottomNav from `getNavigationForExperience()` | Category | L3 | BottomNav.tsx | Single source of truth — eliminates future drift |

### Platform-economics modules (PLATFORM_MODULES — 19 keys)

Identifier rename (L3) is high-cost. Recommendation: keep identifiers stable, add `displayName` + `narrativeTagline` fields and surface those in entitlement UI / pricing pages.

| # | Identifier | Proposed display name | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 22 | governance_suite | Governance of Record | Low | L1 | entitlement-guard.ts | Already aligned conceptually |
| 23 | grievance_case_suite | Representation Continuity | Med | L1 | entitlement-guard.ts | "Grievance + case + suite" stacks SaaS framing |
| 24 | financial_intelligence_suite | Financial Stewardship | Med | L1 | entitlement-guard.ts | "Stewardship" matches continuity pillar |
| 25 | ai_advanced_insights | Reviewer-Assisted Intelligence | Category | L1 | entitlement-guard.ts | "Advanced AI" violates labour-safe-ai posture |
| 26 | allocation_engine | Allocation Stewardship | Med | L1 | entitlement-guard.ts | "Engine" reads SaaS |
| 27 | transaction_fees | Transaction Reconciliation | Med | L1 | entitlement-guard.ts | "Fees" reads commercial-only |
| 28 | commercial_reporting | Institutional Reporting | High | L1 | entitlement-guard.ts | "Commercial" misframes the institution |
| 29 | export_suite | Evidence Export | Low | L1 | entitlement-guard.ts | Optional |
| 30 | health_safety | Health & Safety Continuity | Low | L1 | entitlement-guard.ts | Optional |
| 31 | performance_targets | Operational Commitments | Low | L1 | entitlement-guard.ts | Optional |
| 32 | employer_execution | Employer Coordination | Low | L1 | entitlement-guard.ts | "Execution" reads operational |
| 33 | union_knowledge_suite | Institutional Memory | Low | L1 | entitlement-guard.ts | Aligns to marketing pillar |

(Identifiers stay in code; only display surfaces change.)

### Vocabulary / lint coverage

| # | Concern | Proposed action | Drift risk | Fix | File / Line | Notes |
|---|---|---|---|---|---|---|
| 34 | `publicOnly: true` flag exempts runtime from forbidden-vocab linting | Add `runtime` scope flag and run lint over `lib/dashboard/**`, `components/sidebar.tsx`, `components/mobile/**`, `services/platform-economics/**` | High | L2 | forbidden-vocabulary.ts:~? | Workstream E pre-req — without this, future drift returns silently |

---

## Already-Aligned Surfaces (no action — confirm in Workstream I smoke)

Routes already present in `PILOT_EXCLUDED_PREFIXES` ([role-experience.ts](../../lib/dashboard/role-experience.ts)) — partial Phase 3/4 reframe is **already shipping** alongside the SaaS routes:

- `/dashboard/cognition`
- `/dashboard/institutional-intelligence`
- `/dashboard/institutional-operating-intelligence`
- `/dashboard/longitudinal-cognition`
- `/dashboard/continuity-simulation`
- `/dashboard/movement-insights`
- `/dashboard/cross-union-analytics`
- `/dashboard/executive-operating-intelligence`

These confirm the institutional vocabulary is *already* in code; the alignment task is to make the dashboard *chrome* point users at this language consistently.

---

## Recommended Workstream B Sequence

1. **Mobile BottomNav** (highest visible drift / smallest blast radius): items 16–21.
2. **Staff sidebar** (highest leverage on perceived institutional posture): items 1–7.
3. **Executive + member soft nudges**: items 8–12.
4. **Forbidden-vocabulary runtime scope** (item 34) — gate before Workstream E so we don't regress.
5. **PLATFORM_MODULES display names only** (items 22–33) — keep identifiers stable.

Estimated touched files for Workstream B: 4 (`role-experience.ts`, `BottomNav.tsx`, `forbidden-vocabulary.ts`, `entitlement-guard.ts` display field).

---

## Validation Plan (deferred to Workstream I)

1. `pnpm --filter @nzila/union-eyes narrative:check --ci` — must remain ≥ current baseline.
2. `pnpm --filter @nzila/union-eyes typecheck` — no API changes if matrix is followed.
3. Route smoke for the 8 already-aligned `/dashboard/*` routes listed above.
4. Re-generate `module-runtime-alignment-report.md` post-Workstream B and confirm runtime maturity ≥ 80 / 100.

---

## Out of Scope for Workstream A

- No code changes performed.
- No i18n key changes.
- No marketing surface changes (covered by `phase4-alignment-report.md`).
- No package identifier renames.
