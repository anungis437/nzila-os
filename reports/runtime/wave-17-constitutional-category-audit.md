# Wave 17 — Constitutional Category Formation — Pre-Landing Audit

**Date:** 2026-05-11
**Wave Doctrine:** Advance Union Eyes from *institutionally inhabited continuity infrastructure* toward *constitutional category infrastructure* — i.e., a category that the institution itself constitutes, not a product purchased into a category.
**Drift Class Closed:** anti-governance-software · anti-governance-platform · anti-continuity-feature · anti-enterprise-governance · anti-governance-tooling · anti-governance-product · anti-continuity-platform
**Constraints:** calm · additive · continuity-native · provenance-aware · chronology-safe · coexistence-safe · governance-safe · archival-modern · institutionally inhabited · operationally durable · constitutionally inevitable

---

## 1. Eight-Tier Constitutional Category Matrix

| Tier | Reads As | Examples (allowed) | Drift Risk |
|------|----------|--------------------|------------|
| T1 — Constitutional Category Infrastructure | Union Eyes *is* the category | "constitutional category infrastructure", "constitutionally inevitable continuity" | None — top tier |
| T2 — Constitutional Continuity Infrastructure | Continuity surfaces are constitutional | "constitutional continuity infrastructure", "constitutional continuity substrate" | None |
| T3 — Constitutional Institutional Runtime | Runtime is constitutionally framed | "constitutional operational continuity", "constitutional federation continuity" | None |
| T4 — Institutional Continuity Infrastructure (W14–W16 baseline) | Institution inhabits continuity | "institutionally inhabited continuity", "real continuity accumulation" | None |
| T5 — Governance-Software Residue | Reads like SaaS governance product | "governance platform", "governance suite", "governance system" | **Fenced W17** |
| T6 — Enterprise-Software Residue | Reads like enterprise tooling | "enterprise governance", "governance infrastructure", "governance runtime" | **Fenced W17** |
| T7 — Governance-Sensitive | Generic governance-product framing | "governance product", "governance solution", "governance toolkit" | **Fenced W17** |
| T8 — Federation-Sensitive | Generic continuity-platform framing | "continuity platform", "continuity engine", "continuity management" | **Fenced W17** |

---

## 2. Ten Audit Questions Posed Before Landing

1. Does any surface frame Union Eyes as a "governance platform" / "system" / "suite" / "product"?
2. Does any surface frame continuity as a "feature", "capability", "module", or "engine"?
3. Does any surface call Union Eyes "enterprise governance tooling" or "governance infrastructure"?
4. Does the home brand framing assert constitutional category, or generic governance category?
5. Do meta titles / json-LD descriptions read as constitutional category infrastructure?
6. Are multilingual bundles (FR, FR-CA, IT, PT, EN-CA) doctrinally aligned with the EN constitutional shift?
7. Do governance / institutional-continuity routes use "platform" or "infrastructure" framing?
8. Does any surface read as "operational governance" instead of "constitutional operational continuity"?
9. Does any surface read as "continuity management" instead of "constitutional continuity stewardship"?
10. Does the cumulative fence preserve all W1–W16 doctrine without regression?

**Audit verdict per question:** 1–10 all surfaced collisions or were grep-clean; collisions enumerated in Part E.

---

## Part A — Recon Strategy

Word-boundary, case-insensitive regex sweep over `apps/union-eyes/app/[locale]/(marketing)/**` and `apps/union-eyes/messages/*.json` (97 files) for 20 W17 drift terms + 5 supplementals.

## Part B — Drift Targets (25 terms, 6 categories)

- **A. Governance-software / platform / suite / application / system (5):** governance software, governance platform, governance suite, governance application, governance system
- **B. Enterprise-governance / infrastructure / runtime (4):** enterprise governance, enterprise governance tooling, governance infrastructure, governance runtime
- **C. Governance-tooling / module / engine / institutional-governance-tooling (4):** governance tooling, governance module, governance engine, institutional governance tooling
- **D. Continuity-feature / capability / management / operational-governance (4):** continuity feature, governance capability, continuity management, operational governance
- **E. Continuity-engine / tooling / platform (3):** continuity engine, continuity tooling, continuity platform
- **F. Anti-governance-product / solution / stack / toolkit (5):** governance product, governance solution, continuity solution, governance stack, governance toolkit

## Part C — Rewarded Substitutes

Constitutional continuity substrate · constitutional continuity infrastructure · constitutional continuity ontology · constitutionally inevitable continuity · constitutional federation continuity · constitutional stewardship continuity · constitutional operational continuity · chronology-grounded constitutional continuity · archival constitutional continuity · governance-preserved constitutional continuity · institutionally inhabited constitutional continuity · continuity-native constitutional realism · continuity-native constitutional infrastructure · constitutional category infrastructure · constitutional continuity stewardship.

## Part D — Coexistence Doctrine

W17 is **additive**. No W1–W16 terms loosened; no rewarded vocabulary inherited from prior waves is restricted.

## Part E — Collision Inventory (14 hits surfaced pre-landing)

| # | File | Line | Phrase | Locale |
|---|------|------|--------|--------|
| 1 | `messages/en.json` | 7279 | `Institutional Governance Infrastructure for Unions` (badge) | EN |
| 2 | `messages/en.json` | 7295 | `UnionEyes is institutional governance infrastructure …` | EN |
| 3 | `messages/en.json` | 7314 | `need a governance system they can defend` | EN |
| 4 | `messages/en.json` | 11135 | `UnionEyes | Institutional Continuity & Governance Infrastructure` | EN |
| 5 | `messages/en.json` | 11140 | `…governance infrastructure for federated organizations.` | EN |
| 6 | `messages/en-CA.json` | 11149 | meta.title mirror | EN-CA |
| 7 | `messages/en-CA.json` | 11154 | jsonLd.description mirror | EN-CA |
| 8 | `messages/it.json` | 11079 | meta.title (untranslated EN) | IT |
| 9 | `messages/it.json` | 11084 | jsonLd.description (untranslated EN) | IT |
| 10 | `messages/pt.json` | 11079 | meta.title (untranslated EN) | PT |
| 11 | `messages/pt.json` | 11084 | jsonLd.description (untranslated EN) | PT |
| 12 | `messages/fr.json` | 11140 | `infrastructure de gouvernance` (FR translation) | FR |
| 13 | `messages/fr-CA.json` | 11149/11154 | FR-CA title + description mirrors | FR-CA |
| 14 | `app/[locale]/(marketing)/institutional-continuity/page.tsx` | 45, 215 | `Institutional Continuity platform` / `unified institutional continuity platform` | TSX |
| 15 | `app/[locale]/(marketing)/governance/page.tsx` | 323 | `governance infrastructure durable` | TSX |

> Heaviest collision wave since W14: 14 distinct rewrites across 7 files. Brand-level framing shifted from `governance infrastructure` → `constitutional continuity infrastructure`.

## Part F — Supplementals (grep-clean, fenced proactively)

`governance product` · `governance solution` · `continuity solution` · `governance stack` · `governance toolkit` — zero hits, fenced as preventive constitutional anchors.

## Part G — Rewrite Strategy

Heavy doctrinal rewrites preferred over fence-relaxation. Brand title rewritten EN → EN-CA → IT → PT (parity-preserving — IT/PT had untranslated English titles) → FR / FR-CA (doctrinally translated). Departure from strict W12 "FR/IT/PT untouched" rule is justified: this is a category-level constitutional shift, not stylistic.

## Part H — Risk Posture

- Scanner self-trip risk: nil (all substitutes use constitutional vocabulary outside fenced bigrams).
- Multilingual parity risk: nil (all 6 bundles aligned on new constitutional framing).
- W1–W16 fence regression risk: nil (additive only).

## Part I — Gate Forecast

8/8 gates expected GREEN. test:fast `forbidden-terms` invariant satisfied (0 hard-fails post-rewrite verified pre-landing).

## Part J — Cumulative Coverage Trajectory

| Wave | Block name | Added | Cumulative hard-fail terms |
|------|------------|------|----------------------------|
| W15 | wave15OperationalInevitability | 25 | ~500 |
| W16 | wave16RealContinuityAccumulation | 25 | ~525 |
| W17 | wave17ConstitutionalCategoryFormation | 25 | **~550** |

## Part K — Doctrinal Outcome

After W17, Union Eyes is no longer positioned in the "institutional governance software" category — it asserts a new constitutional category that the institution itself constitutes. Continuity stops reading as a feature; it reads as constitutional infrastructure.
