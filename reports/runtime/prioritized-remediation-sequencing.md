# Union Eyes — Prioritized Remediation Sequencing

**Audit date:** 2026-05-15
**Posture:** validation-only · sequencing is recommended ordering, not committed work

This sequencing converts the recommendations in `repo-wide-readiness-recommendations.md` into a six-wave plan. Each wave is internally additive and reversible, and each wave's gate must pass before the next is started.

---

## Wave 1 — Vocabulary hard-fail removal (1 PR, scoped)

**Why first:** smallest blast radius, reverses the only outright-forbidden tokens in the runtime.

| Step | File | Action |
| --- | --- | --- |
| 1.1 | [components/financial/FinancialOverview.tsx](apps/union-eyes/components/financial/FinancialOverview.tsx) line 375 | Remove `Executive financial command center` comment. |
| 1.2 | [components/public/site-navigation.tsx](apps/union-eyes/components/public/site-navigation.tsx) line 39 | Rename label `Continuity Command Center` → `Institutional Continuity`. |
| 1.3 | [components/public/site-navigation.tsx](apps/union-eyes/components/public/site-navigation.tsx) line 40 | Rename label `Governance Intelligence Hub` → `Governance Transparency Hub`. |
| 1.4 | [components/marketing/insight-article-view.tsx](apps/union-eyes/components/marketing/insight-article-view.tsx) line 101 | Rename pillar `Explainable Organizational Intelligence` → `Explainable Governance Reasoning`. |
| 1.5 | [components/cope/CanvassingInterface.tsx](apps/union-eyes/components/cope/CanvassingInterface.tsx) line 406 | Rename UI label `Volunteer Leaderboard` → `Top Volunteers`. |
| 1.6 | [app/[locale]/dashboard/rewards/leaderboard/page.tsx](apps/union-eyes/app/%5Blocale%5D/dashboard/rewards/leaderboard/page.tsx) | Replace page body with permanent redirect → `/dashboard/rewards/recognition`. |

**Gates:** `pnpm --filter @nzila/union-eyes narrative:audit`, `narrative:check --ci`, `pnpm typecheck`.

---

## Wave 2 — Substrate adoption on depth-2 cockpits (1 PR per cockpit, ≤ 4 PRs)

**Why second:** lifts the four depth-2 cockpits to depth-1 using the WS H adapter that already shipped.

| Step | Surface | Adopt |
| --- | --- | --- |
| 2.1 | /dashboard/institutional-memory | `topology-source-adapter` projection + provenance footer |
| 2.2 | /dashboard/continuity-intelligence | `topology-source-adapter` + provenance footer + chronology weave |
| 2.3 | /dashboard/continuity-planning | same |
| 2.4 | /dashboard/continuity-simulation | same |

**Gates:** `pnpm --filter @nzila/institutional-governance-graph test`, `pnpm --filter @nzila/union-eyes narrative:audit`, `pnpm --filter @nzila/union-eyes narrative:check --ci`, `pnpm typecheck`.

---

## Wave 3 — Cognition convergence (1 PR)

**Why third:** /dashboard/cognition is the principal substrate-bypass surface; routing through `composeInstitutionalStorybook` is mechanical and removes the depth-3 / state-7 misalignment.

| Step | Surface | Adopt |
| --- | --- | --- |
| 3.1 | /dashboard/cognition | Route existing scoring calls through `runFullInstitutionalCognition` + `composeInstitutionalStorybook`; render storied envelopes with assistive · review-required disclosure. |

**Gates:** same as Wave 2 + `pnpm --filter @nzila/ue-cognition test`.

---

## Wave 4 — Drift label reframing (1 PR)

**Why fourth:** label-only changes; URL stable; safe to land after Wave 3 stabilizes.

| Step | Target | Action |
| --- | --- | --- |
| 4.1 | /dashboard/intelligence | Reframe metadata + tab labels per drift audit §2; URL unchanged. |
| 4.2 | /dashboard/movement-insights, /dashboard/cross-union-analytics, /dashboard/sector-analytics | Replace `analytics` / `insights` framing with `trends` in nav and metadata. URL unchanged. |
| 4.3 | /dashboard/institutional-observability | Re-label nav as `Governance Visibility`; URL unchanged. |
| 4.4 | /dashboard/cognition, /dashboard/longitudinal-cognition | Add `human-reviewed · assistive` subtitle in nav. |
| 4.5 | components/marketing/institutional-visual-systems.tsx | Reframe pillar diagrams per drift audit §4. |

**Gates:** narrative audit + ci.

---

## Wave 5 — Locale parity (1 PR per locale group, ≤ 2 PRs)

| Step | Targets | Action |
| --- | --- | --- |
| 5.1 | en-CA, it, pt | Add missing `qcBilingualBanner` key. |
| 5.2 | en, en-CA, fr, fr-CA, it, pt | Replace forbidden bundle strings (locale audit §2). |
| 5.3 | fr, fr-CA | Add French institutional vocabulary block (locale audit §3). |
| 5.4 | fr-CA marketing tree | Backfill trust / governance / institutional-continuity pillar copy. |

**Gates:** narrative audit + ci, plus a manual localization review for fr-CA before Quebec engagement.

---

## Wave 6 — Hygiene + gate hardening (1 PR)

| Step | Action |
| --- | --- |
| 6.1 | Exclude `/sentry-example-page` from production build. |
| 6.2 | Consolidate root-level duplicate auth pages or annotate as SEO fallbacks. |
| 6.3 | De-duplicate `/dashboard/analytics` ↔ `/(dashboard)/analytics` trees. |
| 6.4 | Extend narrative-vocabulary gate scope: `/dashboard/**` metadata, `components/**`, `messages/*.json`. |
| 6.5 | Add CI assertion that `app/(marketing)` and `app/[locale]/(marketing)` cannot diverge on protected pillar files. |

**Gates:** all of the above + `pnpm validate:docs`, `pnpm governance:audit`, `pnpm test:fast`.

---

## Sequencing dependencies

```
Wave 1 ──► Wave 2 ──► Wave 3 ──► Wave 4 ──► Wave 6
              │                       │
              └────────► Wave 5 ◄─────┘
```

- **Wave 1 must precede Wave 4** (label drift fixes assume vocabulary hard-fails are gone).
- **Wave 2 must precede Wave 3** (cognition convergence reads cleaner after the topology adapter is wired).
- **Wave 5 can run in parallel with Waves 2-4** (no source code overlap).
- **Wave 6 (gate hardening) must be last** so the new gates do not block in-flight waves.

---

## Validation checkpoint between every wave

After each wave, the maintainer must run the verbatim gate set (per CLAUDE.md):

```
pnpm lint
pnpm typecheck
pnpm test:fast
pnpm validate:docs
pnpm governance:audit
```

Plus the union-eyes narrative gates:

```
pnpm --filter @nzila/union-eyes narrative:audit
pnpm --filter @nzila/union-eyes narrative:check --ci
```

And, after Waves 2 / 3 specifically:

```
pnpm --filter @nzila/institutional-governance-graph test
```

A wave is not complete until all gates are green.
