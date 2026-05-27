# Phase 4 Alignment Report — UnionEyes Marketing Ecosystem

**Branch:** `chore/post-delta-7-orchestrator-image-fix-2026-05-12`
**Last shipped commit (Phase 3):** `bcc8c3a3e`
**Audit baseline:** 87 public surfaces · avg maturity **67/100** · **7 hard-fails** · **223 warnings** · **10 rule failures**
**Reference exemplar:** `apps/union-eyes/app/[locale]/(marketing)/conventions/page.tsx` (86/100)

---

## 1. Mandate Recap

> Complete the transition of UnionEyes from "advanced labour operations software with governance themes" into a fully coherent **institutional governance & continuity infrastructure** ecosystem.
>
> **Inversion:** the platform must read as *institutional infrastructure with operational modules*, not the inverse.

This report enumerates the residual SaaS / operations drift after Phases 1–3 and decomposes the Phase 4 cleanup into ordered workstreams (a–o).

---

## 2. Surfaces in Scope (25 marketing routes)

| Route | Status |
|---|---|
| `(marketing)/page.tsx` (home) | drift — operating-system / SaaS framing |
| `(marketing)/proof/page.tsx` | **highest drift** — 20+ "Operational" hits |
| `(marketing)/platform/page.tsx` | 8-pillar SaaS module IA |
| `(marketing)/trust/page.tsx` | hard-fail (`workforce surveillance`) |
| `(marketing)/pricing/page.tsx` | review pending |
| `(marketing)/solutions/page.tsx` | hard-fail (`worker scoring`) |
| `(marketing)/solutions/executive-leadership/page.tsx` | ✓ baseline |
| `(marketing)/solutions/governance-leadership/page.tsx` | ✓ baseline |
| `(marketing)/solutions/operations-leadership/page.tsx` | minor — "operational view" |
| `(marketing)/solutions/technology-leadership/page.tsx` | hard-fail (`worker scoring`, `workforce surveillance`) |
| `(marketing)/solutions/labour-leadership/page.tsx` | ✓ baseline |
| `(marketing)/solutions/procurement/page.tsx` | ✓ baseline |
| `(marketing)/conventions/page.tsx` | ✓✓ flagship (86/100) |
| `(marketing)/governance/page.tsx` | review pending |
| `(marketing)/institutional-continuity/page.tsx` | hard-fail (`worker scoring`) |
| `(marketing)/executive-intelligence/page.tsx` | hard-fail (`worker scoring`, `workforce surveillance`) |
| `(marketing)/insights/page.tsx` | review pending |
| `(marketing)/case-studies/[slug]/page.tsx` | warn — no pillar vocabulary |
| `(marketing)/story/page.tsx` | review pending |
| `(marketing)/features/page.tsx` | terminology drift ("Modules") |
| `(marketing)/contact/page.tsx`, `pilot-request/page.tsx` | low-drift |
| `(marketing)/legal/*`, `status/page.tsx` | low-drift |
| `(marketing)/for-{clc,federations,leadership,members,representatives}/page.tsx` | review pending |
| Layout/nav/footer (`locale-site-*.tsx`) | drift — see §3, §4 |

---

## 3. SaaS Drift Map (anchor evidence)

### 3a. Navigation — `app/[locale]/(marketing)/locale-site-navigation.tsx`

The "Modules" mega-menu still reads as a productivity SaaS:

| Pillar (current) | Drift signal |
|---|---|
| **Inbox** — "Unified intake for cases and member messages" | productivity tool framing |
| **Work** — "Active grievance and case workbench" | task-app framing |
| **Priorities** — "Deadlines, commitments, and next actions" | to-do app framing |
| **Intelligence** — "Executive, federation, and analytics views" | dashboards-as-product |
| Cognition / Governance / Corporate Memory / Trust | acceptable; align labels with new institutional pillars |

Top-level: `Solutions | Modules | Insights | Proof | Pricing | Contact` — keep "Solutions/Insights/Proof", **rename "Modules" → "Platform"** or "Continuity Layer" and demote to last position; promote "Trust" (currently buried).

### 3b. Footer — `app/[locale]/(marketing)/locale-site-footer.tsx`

- Pre-footer CTA copy: *"Ready to lead with clarity? See how UnionEyes turns **casework** into confident, data-backed decisions. Request a demo — no commitment."* → **"casework"** + **"demo"** are SaaS register.
- French-CA strips diacritics: *"Pret a diriger avec clarte?"* (should be *"Prêt à diriger avec clarté ?"*) — same in `it`/`pt` (e.g. `decisoes`, `demonstracao`).
- Footer "Capabilities" column lists Inbox/Work/Priorities/Intelligence — same SaaS pillars as nav.

### 3c. `proof/page.tsx` — strongest operational drift surface (20+ hits)

| Line | Token |
|---|---|
| 19 | `governanceOperationalWalkthroughs` |
| 29–30 | `operationalDisruptionModels`, `operationalContinuitySimulationArtifacts` |
| 35 | `from '@/lib/operational-legitimacy'` |
| 42 | "Operational proof architecture for deployment walkthroughs…" |
| 44 | heroHeading: "Operational proof systems for real deployment review." |
| 56 | "Governance Operational Walkthroughs" |
| 59 | "Operational transformation over time" |
| 76 | "Operational proof density for executive and procurement review" |
| 95–96 | "Operational Continuity Simulation Artifacts" / "Continuity simulation outputs for executive review" |
| 99 | "Operational fragmentation visibility" |
| 112 | "Briefings that read like operational guidance" |
| **122** | **"Executive Operational Dashboard Signals"** ← strongest signal |
| 184–185 | French parity strings repeat the drift |

### 3d. Messages — `messages/en-CA.json :: marketing.home`

Copy itself is SaaS-flavored (not just JSX):

- *"A Governed Operating System for Unions"*
- *"Modules Available"*, *"5+ Modules"* framing
- *"another SaaS tool"* (used as foil but reinforces register)
- *"AI-assisted triage"*
- *"platform — total transparency"*

### 3e. Messages — `messages/en-CA.json :: marketing.footer`

- `description`: *"A governed operating system for Canadian unions — contract-based deployment, **module-level entitlements**, and audit-ready operations."*
- `tagline`: *"A governed operating system for unions."*
- `features: "Modules"` (label drift)
- 4 separate `footer:` namespaces at L3519, L3791, L3837, L7448 — only L7448 is the marketing footer; the others belong to role portals and are out of scope.

---

## 4. Governance Saturation Map

Vocabulary is *present* but unevenly distributed.

| Surface | Governance density |
|---|---|
| conventions (flagship) | high — institutional, charter, doctrine, continuity |
| governance/page.tsx | high (by definition) |
| trust, executive-intelligence, institutional-continuity | medium-high but contaminated by surveillance-AI hard-fails |
| solutions/{exec,gov,labour,procurement} | medium — title-only governance |
| solutions/{operations,technology} | low — slips into "operational view" / "AI architecture" |
| **proof, platform, home, features, case-studies/[slug]** | **low — operations-first framing** |

Phase 4 must bring proof + platform + home up to ≥75/100 to match conventions.

---

## 5. Taxonomy Inconsistency Map

| Term | Variants in tree | Resolution |
|---|---|---|
| Continuity archive | "Corporate Memory" (nav, footer L72) vs `organizationalMemory` key vs `corporateMemory` key vs "Institutional Memory" (anchor) | Standardize on **"Institutional Memory"** (label) + `institutionalMemory` (key); keep "Corporate Memory" as legacy alias only |
| Top-level | "Modules" (nav, footer key, messages) | Rename to **"Platform"** |
| Capabilities column | "Capabilities" (footer) vs "Modules" (label `features`) vs "Platform" (column key) | Use **"Platform"** everywhere |
| Pillars | Inbox / Work / Priorities / Intelligence / Cognition / Governance / Corporate Memory / Trust | Re-name to: **Continuity · Governance · Coordination · Stewardship · Readiness · Trust · Resources · Discovery** |
| Hero verb | "manage / track / triage" | Replace with **steward / oversee / preserve / coordinate** |
| Buyer verb | "request a demo" | Replace with **"request a briefing"** (already used elsewhere) |

---

## 6. Coexistence Weakness Map

`narrative-audit.json :: rule = coexistence-positioning` warns at **50/100 platform-wide**.

The required vocabulary is missing almost everywhere:

- *"continuity layer"*
- *"overlay infrastructure"*
- *"alongside existing systems"*
- *"works with your existing stack"*
- *"non-displacing"*

**Action:** add a coexistence paragraph to home, platform, solutions index, trust, and every role page. Target: rule score ≥ 75/100 on every surface.

---

## 7. Operational Framing Drift Inventory

Beyond proof/page.tsx (§3c):

| Surface | Drift signature |
|---|---|
| `marketing.home` | "Operating System", "Modules Available" |
| `marketing.footer.description` | "module-level entitlements", "audit-ready operations" |
| `solutions/operations-leadership` | "operational view", "operational coherence" |
| `features/*` | per-feature "Module" framing in titles + descriptions |
| `lib/operational-legitimacy.ts` | name itself encodes operational framing — rename to `lib/institutional-legitimacy.ts` |

---

## 8. Institutional Maturity Scoring

From `apps/union-eyes/reports/narrative/narrative-audit.json` (87 files):

- **Average:** 67/100
- **Top:** conventions (86), governance, executive solutions (≈ 78–82)
- **Bottom:** proof, home, features, case-studies/[slug] (55–62)
- **Hard-fail (surveillance-ai):** 5 files / 7 violations
  - `executive-intelligence/page.tsx` L62
  - `institutional-continuity/page.tsx` L218
  - `solutions/page.tsx` L87
  - `solutions/technology-leadership/page.tsx` L22
  - `trust/page.tsx` L175

**Phase 4 exit criteria:** avg ≥ 80/100, **0 hard-fails**, no rule below 70/100 on any public surface.

---

## 9. Labour-Safe AI Scoring

5 surveillance-ai hard-fails persist (see §8). Tokens triggering: `worker scoring`, `workforce surveillance`. Replace with the pre-approved disclaimer pattern already used in conventions/page.tsx:

> *"UnionEyes does not score workers. Models surface institutional patterns — never individual behavioural ratings."*

---

## 10. Trust–Stewardship Alignment

`trust/page.tsx` carries the hard-fail above. Beyond that, the page lacks:

- explicit Canadian-sovereignty statement (`canadian-positioning` rule warning)
- coexistence paragraph (rule warning)
- pre-approved labour-safe-AI disclaimer

After cleanup, `trust/page.tsx` should be the **second flagship** (target 85/100) alongside conventions.

---

## 11. Multi-Locale Parity Gaps

| Locale | Issue |
|---|---|
| **fr-CA** | accents stripped in footer CTA; same in narrative copy ("decisions eclairees", "Pret a diriger") |
| **fr** | partial parity — some marketing keys missing relative to `en-CA` |
| **it / pt** | accents stripped (`decisoes`, `demonstracao`); coverage incomplete |
| **en** | acceptable; aligned with `en-CA` |

**Action:** restore diacritics in `locale-site-footer.tsx FOOTER_COPY` and audit `messages/{fr,fr-CA,it,pt}.json :: marketing.*` for parity with `en-CA`.

---

## 12. Phase 4 Workstream Decomposition (ordered commits)

| # | Workstream | Owner files |
|---|---|---|
| **a** | Vocabulary expansion in `tooling/marketing/config/forbidden-vocabulary.ts` (operating system, casework as buyer verb, module-level, demo) and add coexistence-positioning bonus phrases to `narrative-audit.ts` | tooling/marketing/* |
| **b** | Nav IA restructure: rename Modules → Platform; rename pillars to Continuity/Governance/Coordination/Stewardship/Readiness/Trust/Resources/Discovery; promote Trust to top-level | locale-site-navigation.tsx + messages |
| **c** | Footer copy fix: pre-footer CTA, restore fr-CA/it/pt diacritics, fix description/tagline, update Capabilities column | locale-site-footer.tsx + en-CA `marketing.footer` |
| **d** | `proof/page.tsx` operational rewrite (top priority); rename `lib/operational-legitimacy.ts` → `lib/institutional-legitimacy.ts` | proof + lib |
| **e** | Resolve 5 surveillance-ai hard-fails using the conventions disclaimer pattern | exec-intel, inst-continuity, solutions/, solutions/technology, trust |
| **f** | Trust center rebuild → second flagship; add coexistence + Canadian sovereignty paragraphs | trust/page.tsx |
| **g** | Homepage rewrite: drop "Operating System", "Modules Available", "another SaaS tool"; add coexistence + institutional opener | home page + `marketing.home` messages |
| **h** | Platform page: rename pillars (matches §b); reframe each section as institutional capability | platform/page.tsx |
| **i** | Solutions index + operations + technology: institutional reframing | solutions/* |
| **j** | Role pages (for-clc, for-federations, for-leadership, for-members, for-representatives): coexistence paragraph + governance vocabulary pass | (marketing)/for-* |
| **k** | Case studies: add pillar vocabulary to `[slug]/page.tsx` template | case-studies/[slug] |
| **l** | SEO/JSON-LD: locate sitemap.ts, robots.ts, application/ld+json blocks; align Organization + WebSite + BreadcrumbList | layout / metadata files |
| **m** | Resource hub (insights/page.tsx) institutional reframing | insights |
| **n** | Multi-locale parity audit (fr, fr-CA, it, pt) — diacritics + key parity with en-CA | messages/* |
| **o** | A11y + visual primitives sweep + final `pnpm narrative:check` (must exit 0) | global |

Each workstream → its own commit (per user pattern), pushed immediately. Lefthook bypass `$env:LEFTHOOK="0"` permitted for batch commits when justified.

---

## 13. Exit Criteria for Phase 4

- ✅ `pnpm --filter @nzila/union-eyes narrative:check` exits **0**
- ✅ Average maturity ≥ **80/100**, no public surface < **70/100**
- ✅ **0** surveillance-ai hard-fails
- ✅ `coexistence-positioning` rule ≥ 75/100 on every public surface
- ✅ Nav top-level says **Platform** (not Modules); pillars renamed
- ✅ Pre-footer CTA reads institutional, all locales accented
- ✅ `proof/page.tsx` and `trust/page.tsx` ≥ 85/100 (second & third flagships after conventions)
- ✅ JSON-LD Organization + WebSite + BreadcrumbList present on every public route
- ✅ Multi-locale parity restored

---

*Generated as Phase 4 audit deliverable; no source files modified by this commit.*
