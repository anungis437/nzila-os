# Union Eyes — Repo-Wide Readiness Recommendations

**Audit date:** 2026-05-15
**Posture:** validation-only · recommendations are non-binding until a maintainer accepts them

These recommendations are scoped to the validation findings of the eight preceding audits. They are deliberately **additive** and **doctrine-preserving**: no architecture rewrite, no schema mutation, no new module, no analytics posture, no governance-AI positioning, no surveillance semantics, no enterprise-SaaS drift.

---

## 1. Substrate adoption (additive, zero schema change)

| Recommendation | Surfaces | Source |
| --- | --- | --- |
| Adopt `topology-source-adapter` (WS H) for the topology projection currently absent from continuity cockpits and institutional-memory. | continuity-{intelligence, planning, simulation}, institutional-memory | convergence audit §2 |
| Wire `composeInstitutionalStorybook` into `/dashboard/cognition` so output is storied + redacted, not raw KPI snapshots. | /dashboard/cognition | depth audit §5 |
| Add the standard provenance + explainability footer to the four depth-2 cockpits. | continuity-{intelligence, planning, simulation}, institutional-memory | convergence audit §3 |

These three changes lift four surfaces from depth-2 → depth-1 and one surface from depth-3 → depth-1 with no architectural risk.

---

## 2. Vocabulary remediation (renames + copy reframes)

| Recommendation | Targets | Source |
| --- | --- | --- |
| Deprecate `/dashboard/rewards/leaderboard`; redirect to existing `/dashboard/rewards/recognition`. | one route | drift audit §1 |
| Remove `Executive financial command center` comment from `FinancialOverview.tsx`. | one component | drift audit §1 |
| Rename public-nav `Continuity Command Center` → `Institutional Continuity` (or `Continuity Explorer`). | site-navigation.tsx | drift audit §1 |
| Rename marketing pillar `Explainable Organizational Intelligence` → `Explainable Governance Reasoning`. | insight-article-view.tsx | drift audit §1 |
| Rename `Volunteer Leaderboard` UI label → `Top Volunteers` / `Recognition Board`. | CanvassingInterface.tsx | drift audit §1 |
| Reframe intelligence-shell tabs: `Local` / `Federation` / `Executive` → `Organization Trends` / `Movement Trends` / `Strategic Context`. | intelligence-shell.tsx | drift audit §2 |
| Reframe `/dashboard/movement-insights`, `/dashboard/cross-union-analytics`, `/dashboard/sector-analytics` from "analytics / insights" to "trends" in nav + metadata; URL change deferred to convergence. | three routes | drift audit §3 |
| Re-label `/dashboard/institutional-observability` nav as `Governance Visibility`; URL stable. | one route | observability audit §2 |
| Add "human-reviewed · assistive" subtitle to `/dashboard/cognition` and `/dashboard/longitudinal-cognition` nav. | two routes | observability audit §4 |

---

## 3. Locale parity (additive translation)

| Recommendation | Source |
| --- | --- |
| Add `qcBilingualBanner` to `en-CA.json`, `it.json`, `pt.json`. | locale audit §1 |
| Replace forbidden bundle strings: `Tableau de bord exécutif`, `Centre de commande`, `Command Center`, `scoring`, `Notation IA`, `Notation`, `Valutazione`, `Pontuação` with governance-safe equivalents. | locale audit §2 |
| Introduce a French institutional vocabulary block in `fr.json` and `fr-CA.json` covering `continuité institutionnelle`, `chronologie`, `topologie`, `provenance`, `explicabilité`, `supervision humaine`, `intelligence assistive`. | locale audit §3 |
| Backfill the localized marketing tree pillar copy for trust / governance / institutional-continuity in fr-CA before any Quebec procurement engagement. | locale audit §4 |

---

## 4. Hygiene (low-priority, non-blocking)

| Recommendation | Source |
| --- | --- |
| Exclude `/sentry-example-page` from production build. | inventory §2.13 |
| Consolidate root-level duplicate auth pages into the localized `/(auth)` tree (or document them as SEO fallbacks). | inventory §2.13 |
| De-duplicate the `/dashboard/analytics` ↔ `/(dashboard)/analytics` trees. | matrix §2 state 8 |

---

## 5. Gate hardening (defensive)

| Recommendation | Source |
| --- | --- |
| Extend the narrative-vocabulary gate beyond `/(marketing)` to also cover `/dashboard/**` page metadata, `components/**`, `messages/*.json`. | drift audit §1, locale audit §2 |
| Add a CI assertion that runs `assertNoProtectedKindsInReadSurface()` against every depth-1 cockpit's projected output (not just at module boundary). | protected audit §4 |
| Add a CI assertion that fails if `app/(marketing)/**` and `app/[locale]/(marketing)/**` diverge on protected pillar files. | matrix §2 state 8 |

---

## 6. What this audit explicitly does NOT recommend

- **No architecture rewrite.**
- **No schema mutation.**
- **No new module.**
- **No introduction of "AI governance" positioning.**
- **No analytics posture.**
- **No surveillance / scoring semantics.**
- **No URL changes** to convergence-needed routes until the substrate convergence step lands; renaming a URL before its substrate is converged would invalidate procurement deep-links without improving doctrine.
- **No removal of routes** beyond the two scaffold routes called out in §4.

All recommendations are additive and reversible.
