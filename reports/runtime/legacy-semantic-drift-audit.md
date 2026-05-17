# Union Eyes — Legacy Semantic Drift Audit

**Audit date:** 2026-05-15
**Posture:** validation-only · no rename or refactor performed

This audit catalogues residual SaaS / enterprise-dashboard semantic drift detected in the union-eyes runtime. Findings are graded for follow-up sequencing. **No changes were applied.** Renames are *recommendations* only; route mutations require a separate convergence change set governed by the convergence audit.

---

## 1. Hard-fail vocabulary findings

These are direct violations of the doctrine vocabulary lists (`apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts`) or carry equivalent semantic load. Each is currently **shippable** because the narrative gate covers marketing copy only — they will surface in any future audit expansion.

| File | Line | Term | Severity | Recommended direction |
| --- | ---: | --- | --- | --- |
| [apps/union-eyes/app/[locale]/dashboard/rewards/leaderboard/page.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/rewards/leaderboard/page.tsx) | 7 | `leaderboard` (route + component + title) | high | Move recognition UX into `/dashboard/rewards/recognition` (already exists); deprecate route after 1 release with redirect. |
| [apps/union-eyes/components/financial/FinancialOverview.tsx](apps/union-eyes/components/financial/FinancialOverview.tsx) | 375 | `Executive financial command center` (comment) | high | Remove comment; component description already aligned. |
| [apps/union-eyes/components/public/site-navigation.tsx](apps/union-eyes/components/public/site-navigation.tsx) | 39 | `Continuity Command Center` (public nav label) | high | Rename label to `Institutional Continuity` or `Continuity Explorer`. |
| [apps/union-eyes/components/marketing/insight-article-view.tsx](apps/union-eyes/components/marketing/insight-article-view.tsx) | 101 | `Explainable Organizational Intelligence` | high | Rename pillar to `Explainable Governance Reasoning`. |
| [apps/union-eyes/components/cope/CanvassingInterface.tsx](apps/union-eyes/components/cope/CanvassingInterface.tsx) | 406 | `Volunteer Leaderboard` (UI label) | medium | Rename to `Top Volunteers` or `Recognition Board`; copy must emphasize voluntary recognition, not ranking. |

Cross-reference: the marketing copy guarantee at [components/marketing/human-centered-callout.tsx](apps/union-eyes/components/marketing/human-centered-callout.tsx) line 152 explicitly promises "no productivity scoring, no leaderboards, no weaponized metrics." All findings above contradict that guarantee externally and must be reconciled before procurement reviewers compare the marketing claim to the runtime label set.

---

## 2. Soft drift findings (enterprise SaaS posture without forbidden token)

These do not violate the forbidden list but read as enterprise-SaaS positioning rather than institutional-substrate framing.

| File | Line | Pattern | Severity | Recommended direction |
| --- | ---: | --- | --- | --- |
| [apps/union-eyes/app/[locale]/dashboard/intelligence/page.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/intelligence/page.tsx) | 1–20 | `intelligence` as primary URL + tabbed `Executive` surface | medium | Reframe in metadata to `Research`/`Insights`; rename `Executive` tab to `Strategic Briefing`. URL change only after convergence-state assessment. |
| [apps/union-eyes/app/[locale]/dashboard/movement-insights/page.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/movement-insights/page.tsx) | 30+ | `movement-insights` route + "movement-wide analytics" copy | medium | Reframe as `movement-trends`; copy → "trends across federated locals." |
| [apps/union-eyes/app/[locale]/dashboard/sector-analytics/page.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/sector-analytics/page.tsx) | 7+ | `sector-analytics` route | medium | Reframe to `sector-trends` (`Sector Overview`). |
| [apps/union-eyes/components/intelligence/intelligence-shell.tsx](apps/union-eyes/components/intelligence/intelligence-shell.tsx) | 15–25 | `Local`, `Federation`, `Executive` tabs + `ExecutiveDashboard` component reference | medium | Rename: `Local Research` → `Organization Trends`; `Federation` → `Movement Trends`; `Executive` → `Strategic Context`. |
| [apps/union-eyes/components/public/site-navigation.tsx](apps/union-eyes/components/public/site-navigation.tsx) | 40 | `Governance Intelligence Hub` nav label | medium | Rename to `Governance Transparency Hub`. |
| [apps/union-eyes/components/marketing/institutional-visual-systems.tsx](apps/union-eyes/components/marketing/institutional-visual-systems.tsx) | 82–90 | `Institutional Continuity Intelligence Framework`, `Explainable Intelligence`, `institutional intelligence` | medium | Reframe as `continuity reasoning`, `governance transparency`, `decision visibility`. |

---

## 3. Route-name drift candidates

| Route | Drift type | Severity | Recommended direction |
| --- | --- | --- | --- |
| /dashboard/rewards/leaderboard | forbidden vocabulary | high | Deprecate. |
| /dashboard/intelligence | label drift on primary route | medium | Reframe metadata; defer URL change. |
| /dashboard/cross-union-analytics | label drift | medium | Reframe to `cross-union-trends` after substrate convergence. |
| /dashboard/sector-analytics | label drift | medium | Reframe to `sector-overview`. |
| /dashboard/movement-insights | label drift | medium | Reframe to `movement-trends`. |
| /dashboard/institutional-observability | label drift (`observability` ≈ surveillance) | low–medium | Re-label nav as `Governance Visibility` while keeping URL stable. |
| /dashboard/cognition | label drift (`cognition` reads as autonomous) | medium | Reframe nav as `Assistive Reasoning` / `Cognition Workspace (review-only)`; ensure copy reasserts assistive posture. |
| /dashboard/longitudinal-cognition | label drift | low | Add subtitle "human-reviewed institutional storybook"; already governance-safe in copy. |
| /dashboard/executive-operating-intelligence | label drift | low–medium | Reframe nav label; URL change unsafe (linked from marketing pillar). |

---

## 4. Marketing pillar drift

| File | Line | Issue | Fix |
| --- | ---: | --- | --- |
| [components/marketing/institutional-visual-systems.tsx](apps/union-eyes/components/marketing/institutional-visual-systems.tsx) | 82–83 | "for governance committees and executive briefings ... institutional operating infrastructure" | Reframe → "for governance review and leadership transition briefings ... institutional infrastructure." |
| /(marketing)/platform/explainable-intelligence | label | `intelligence` framing on a procurement pillar | Reframe to `Explainable Reasoning` or `Explainable Governance`. |
| /(marketing)/executive-intelligence | label | `executive-intelligence` framing | Reframe to `Executive Decision Visibility` or `Executive Briefing Surface`. |

---

## 5. Drift not found (verified safe)

These surfaces are explicitly governance-safe and should be used as templates:

- [/dashboard/governance-center](apps/union-eyes/app/%5Blocale%5D/dashboard/governance-center)
- [/dashboard/priorities](apps/union-eyes/app/%5Blocale%5D/dashboard/priorities)
- [/dashboard/inbox](apps/union-eyes/app/%5Blocale%5D/dashboard/inbox)
- [/dashboard/knowledge-base](apps/union-eyes/app/%5Blocale%5D/dashboard/knowledge-base)
- [/dashboard/reports](apps/union-eyes/app/%5Blocale%5D/dashboard/reports)
- [(marketing)/trust](apps/union-eyes/app/%28marketing%29/trust)
- [(marketing)/governance](apps/union-eyes/app/%28marketing%29/governance)
- [(marketing)/institutional-continuity](apps/union-eyes/app/%28marketing%29/institutional-continuity)

---

## 6. Executive summary

1. Five hard-fail vocabulary occurrences remain (`leaderboard` x2, `command center` x2, `Organizational Intelligence` x1). All are internal-tree only (none in narrative-gated marketing copy), which is why narrative CI is currently green at zero hard-fails — but they will fail any expansion of the gate to dashboard / nav / component surfaces.
2. Highest concentration of label drift is on a small number of analytic-flavoured routes: `intelligence`, `cross-union-analytics`, `sector-analytics`, `movement-insights`, and `cognition`. None of these mutates substrate; all are renameable / re-framable.
3. Procurement risk is contained: marketing pillars correctly disclaim surveillance and scoring, and the only contradicting hard-fail (`Volunteer Leaderboard`, `Continuity Command Center` nav) lives in components that procurement reviewers can reach via deep links from the demo.
