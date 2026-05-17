# Wave 1 — Vocabulary Hard-Fail Removal & Governance Semantics Stabilization

**Project:** Union Eyes
**Wave:** 1 of 6 (per `prioritized-remediation-sequencing.md`)
**Scope:** Semantic hardening only. No architecture changes, no schema mutations,
no new modules, no URL renames, no IGG fence modifications.
**Authority:** Human reviewers remain authoritative; all assistive reasoning
outputs are review-required.

---

## 1. Doctrine Rationale

Wave 1 closes the last 5 hard-fail vocabulary leaks identified in
`legacy-semantic-drift-audit.md` and stabilizes assistive-reasoning framing
across 4 dashboard surfaces flagged in `final-module-readiness-matrix.md`.
Every change is additive at the semantic layer:

- "Command center" / "intelligence hub" / "leaderboard" framing → replaced
  with continuity, visibility, recognition and trend language consistent with
  the institutional doctrine.
- "Cognition" surfaces explicitly framed as **human-reviewed, review-required,
  assistive reasoning**.
- "Analytics" / "insights" framing on aggregate surfaces re-cast as
  **trends / overview / institutional patterns** to avoid surveillance posture.
- Class-B / Reserved Matter protected fence (`packages/institutional-governance-graph`)
  was not touched — verified by `protected-governance-semantics-audit.md`.

---

## 2. Per-File Before / After

### Task 1 — `apps/union-eyes/components/financial/FinancialOverview.tsx` (line 375)
| Before | After |
|---|---|
| `// FinancialOverview — Executive financial command center` | `// FinancialOverview — institutional finance visibility surface` |

Rationale: removes "command center" framing; aligns with "institutional finance
visibility" governance-safe wording.

### Task 2 — `apps/union-eyes/components/public/site-navigation.tsx` (lines 39, 44)
| Before | After |
|---|---|
| `name: 'Continuity Command Center'` | `name: 'Institutional Continuity'` |
| `name: 'Governance Intelligence Hub'` | `name: 'Governance Transparency Hub'` |

Rationale: removes both hard-fail terms ("Command Center", "Intelligence Hub").
Hrefs preserved → no nav fracture, no link rot, no SEO regression.

### Task 3 — `apps/union-eyes/components/marketing/insight-article-view.tsx` (line 101)
| Before | After |
|---|---|
| `'Explainable Organizational Intelligence': [ ... ]` | `'Explainable Governance Reasoning': [ ... ]` |

Supporting changes for parser consistency:

- `apps/union-eyes/lib/insights-parser.ts` — added new canonical key
  `'Explainable Governance Reasoning'` in both `categoryDescriptions` and
  `categorySlugByName`. Legacy `'Explainable Organizational Intelligence'`
  key kept as alias mapping to the same `explainable-intelligence` slug, so
  procurement deep links and any unmigrated article frontmatter continue to
  resolve.
- `apps/union-eyes/scripts/articles/union_eyes_insights_markdown_library_phase_1.md`
  (5 occurrences) and `apps/union-eyes/scripts/articles/institutional-intelligence-defined.md`
  (1 occurrence) — frontmatter category lines updated to the canonical name.

### Task 4 — `apps/union-eyes/components/cope/CanvassingInterface.tsx` (line 406)
| Before | After |
|---|---|
| `Volunteer Leaderboard` (heading + comment) | `Volunteer Recognition` |

Rationale: removes ranking/leaderboard semantics; centers recognition framing.
Card body still presents top contributors but no longer signals competition.

### Task 5 — `apps/union-eyes/app/[locale]/dashboard/rewards/leaderboard/page.tsx`
| Before | After |
|---|---|
| Full Server Component (`force-dynamic`, metadata, raw SQL `getLeaderboardData()`, Tabs UI) | Permanent redirect → `/${locale}/dashboard/rewards/recognition` |

Behavioral guarantees:

- URL preserved → existing bookmarks and procurement deep links continue to resolve.
- Locale preserved → reads `{ locale }` from `await params` and reflects it in
  the redirect target.
- Permanent redirect (`permanentRedirect` from `next/navigation`) → HTTP 308,
  signaling canonical relocation to crawlers and link checkers without breaking
  navigation.
- `redirect()` fallback call after `permanentRedirect()` is type-only — the first
  call throws and never returns. No redirect loop because the target route
  (`/dashboard/rewards/recognition`) exists at
  `apps/union-eyes/app/[locale]/dashboard/rewards/recognition/page.tsx`.
- Auth expectations unchanged: the destination route enforces its own auth gate.

### Task 6 — `apps/union-eyes/components/intelligence/intelligence-shell.tsx`
JSDoc header reframed:

| Before | After |
|---|---|
| `Local → AnalyticsOverviewConsole (local union analytics)` | `Local → Organization Trends (local union analytics)` |
| `Federation → AI forecasts & insights (officer+)` | `Federation → Movement Trends (federation-wide forecasts — officer+)` |
| `Executive → Executive dashboard + strategic planning (secretary_treasurer+)` | `Executive → Strategic Context (executive briefing surface — secretary_treasurer+)` |

Plus an explicit "All outputs are assistive and human-reviewed; no autonomous
governance" sentence in the JSDoc.

Visible tab labels (TabsTrigger):

| Before | After |
|---|---|
| `{t("sidebar.insights")}` | `Organization Trends` |
| `{t("sidebar.federation")}` | `Movement Trends` |
| `Executive` | `Strategic Context` |

Executive briefing card heading reframed `Executive Briefing` →
`Strategic Briefing`, and the descriptive paragraph now explicitly states the
surface is "assistive context for human review" and that "strategic decisions
remain with leadership."

**Critically preserved**: `defaultTab` string values (`"local"`, `"federation"`,
`"executive"`) and the `?scope=` query-param routing. Component imports
(`ExecutiveDashboard`, `StrategicPlanningBoard`) and the `EXEC_ROLES` /
`AI_INSIGHT_ROLES` gating sets are untouched. No URL or state-key drift.

### Task 7 — `apps/union-eyes/components/marketing/institutional-visual-systems.tsx`
| Before | After |
|---|---|
| `title="Institutional Continuity Intelligence Framework"` | `title="Institutional Continuity Reasoning Framework"` |
| `'Explainable Intelligence'` (PillarDiagram node) | `'Explainable Governance Review'` |
| `'… how institutional intelligence stays coordinated.'` | `'… how institutional context stays coordinated.'` |

Rationale: governance reasoning / institutional context language reframes the
diagrams away from a generic "intelligence" posture toward
explainable-governance-review semantics consistent with the doctrine.

### Task 8 — Cognition page assistive framing
`apps/union-eyes/app/[locale]/dashboard/cognition/page.tsx` — added an explicit
header subline:

> *Assistive reasoning · Human-reviewed · Review-required — governance support
> tooling. Outputs on this surface inform human decision-making and never act
> autonomously.*

`apps/union-eyes/app/[locale]/dashboard/longitudinal-cognition/page.tsx`:

- Metadata title: `Longitudinal Institutional Cognition · UnionEyes` →
  `Longitudinal Institutional Context · UnionEyes`.
- Metadata description gained `Human-reviewed, review-required assistive reasoning — institutional context support for governance leaders.`
- Header eyebrow: `Institutional Operating Intelligence · Longitudinal Surface`
  → `Institutional Context Support · Longitudinal Surface · Human-reviewed`.
- Body description now reads "fully attributed reasoning envelope. Assistive
  only — governance authority remains with humans; all signals below are
  review-required."

### Task 9 — `apps/union-eyes/app/[locale]/dashboard/institutional-observability/page.tsx`
URL **unchanged** (`/dashboard/institutional-observability`).

| Before | After |
|---|---|
| Metadata title `Institutional Observability` | `Institutional Visibility` |
| Eyebrow `Institutional Observability` | `Institutional Visibility` |
| Description (metadata) appended: `Governance visibility surface — not monitoring, not scoring.` |

H1 ("Inspectable institutional states") kept verbatim — it already encoded the
non-monitoring posture.

### Task 10 — Trends i18n reframing (URL **unchanged**)
`apps/union-eyes/messages/en-CA.json` and `apps/union-eyes/messages/en.json`:

| Namespace | Before | After |
|---|---|---|
| `sectorAnalyticsPage.title` | `Sector Analytics` | `Sector Overview` |
| `sectorAnalyticsPage.subtitle` | `… and strategic intelligence across all sectors` | `… and sector context across the federation` |
| `crossUnionAnalyticsPage.metaTitle` | `Cross-Union Analytics | UnionEyes` | `Federation Trends | UnionEyes` |
| `crossUnionAnalyticsPage.metaDescription` | `Compare trends and performance across unions and locals` | `Compare institutional patterns and trends across unions and locals` |
| `movementInsightsPage.title` | `Movement Insights` | `Movement Trends` |

Routes (`/dashboard/sector-analytics`, `/dashboard/cross-union-analytics`,
`/dashboard/movement-insights`) are unchanged so all bookmarks, deep links and
demo flows keep resolving. fr / fr-CA / it / pt locale message files were left
untouched to keep Wave 1 scope tight; a follow-up wave can mirror the en
changes once en-CA is validated in QA.

---

## 3. Procurement-Risk Assessment

| Surface | Risk Category | Risk Level | Mitigation |
|---|---|---|---|
| FinancialOverview comment | Internal-only | None | Comment swap, no UX impact |
| Site navigation labels | Marketing UX | Low | Hrefs preserved; nav structure identical |
| Insight category | Content metadata | Low | Slug preserved; legacy parser alias kept |
| Volunteer recognition card | Operator UI | Low | Card layout identical; only label change |
| Leaderboard route → recognition redirect | Operator navigation | Low | Permanent redirect; URL preserved; locale preserved |
| Intelligence shell tabs | Operator UI | Low | `defaultTab` values preserved; ?scope routing intact |
| Visual systems diagrams | Marketing UX | Low | Diagram structure identical; only node labels reframed |
| Cognition / longitudinal-cognition headers | Operator UI | None (additive) | Explicit assistive framing strengthens governance posture |
| Institutional observability heading | Operator UI | Low | URL preserved; H1 unchanged; only eyebrow + metadata |
| Trends i18n labels | Marketing + operator UX | Low | Routes preserved; en + en-CA updated |

No protected governance fencing modified; no IGG schema mutations; no
substrate-bypassing edits.

---

## 4. Validation Snapshot

See `wave-1-drift-verification.md` for the full gates log.

| Gate | Result |
|---|---|
| `pnpm --filter @nzila/union-eyes narrative:audit` | 0 hard-fail · 231 warnings · maturity 87/100 |
| `pnpm --filter @nzila/union-eyes narrative:check --ci` | 0 hard-fail · 231 warnings · maturity 87/100 |
| `pnpm typecheck` | 225 / 225 successful |
| `pnpm --filter @nzila/union-eyes lint` | 0 errors (warnings only — pre-existing) |
| `pnpm test:fast` | 983 / 983 files · 17,153 passed · 1 skipped |
| `pnpm validate:docs` | 0 errors |
| `pnpm governance:audit` | Runs cleanly (advisory trends, no Wave-1 regressions) |

Pre-existing unrelated failure (NOT introduced by Wave 1):
`@nzila/healthcare-surveys` lint fails because it ships no
`eslint.config.{js,mjs,cjs}` — that package is in-progress scaffolding from a
prior uncommitted branch.
