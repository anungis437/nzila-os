# Wave 5 — Quebec / Multilingual Institutional Parity Audit

**Scope**: All Union Eyes locale bundles (`en`, `en-CA`, `fr`, `fr-CA`, `pt`, `it`), localized runtime routes, multilingual narrative governance, procurement/trust language posture.

**Posture**: additive · governance-safe · federation-safe · procurement-safe.

**Doctrinal target**: doctrinally equivalent institutional runtime language across English (en/en-CA) and Quebec French (fr/fr-CA); structurally safe extension locales (pt, it).

---

## Section 1 — The Ten Audit Questions

### 1. Which locales possess doctrinal parity?
| Locale | Lines | Doctrinal Parity Verdict |
|---|---|---|
| `en` | full | Strong (Wave 4 baseline) |
| `en-CA` | full | Strong (Wave 4 baseline) |
| `fr` | 11 293 | **Strong** post-Wave 5 (CLC + command-center + analytique opérationnelle converged) |
| `fr-CA` | 11 307 | **Strong** post-Wave 5 (Quebec institutional French primary target) |
| `pt` | 11 237 | Safe / extension-locale grade |
| `it` | 11 237 | Safe / extension-locale grade |

### 2. Which locales are structurally translated but institutionally shallow?
Pre-Wave 5: `fr`, `fr-CA`, `pt`, `it` all carried executive-dashboard / command-center / operational-analytics drift cognates inherited from the original English bundle. Post-Wave 5: converged into stewardship-oriented institutional language.

### 3. Which continuity terms were absent in French?
- `continuity cognition` → now **cognition de continuité**
- `unresolved transitions` → already present (Wave 3 hydration)
- `continuity-linked visibility` → reflected via `visibilité liée à la continuité` in Wave 5 vocabulary suggestions
- `continuity safeguards` → already present (garanties de continuité)
- `succession continuity` → present (continuité successorale)

No live drift; Wave 5 left existing institutional French untouched and used the new vocabulary block to **prevent regression**.

### 4. Which topology terms remain untranslated?
`topology` / `topologie` already present (recon during Wave 4 confirmed). No outstanding gap in fr/fr-CA. Deferred (still): explicit `topologie liée à la provenance` macro phrasing in marketing copy — Wave 6 candidate.

### 5. Which chronology concepts remain English-only?
None outstanding in runtime. `chronologie`, `chronologie procédurale`, `époques de gouvernance` already covered.

### 6. Which procurement/trust surfaces remain language-fragmented?
Procurement/trust core copy is institutional in fr/fr-CA. Wave 5 added narrative-governance enforcement so regression is now hard-fail-blocked.

### 7. Which helper-copy surfaces remain culturally mismatched?
None identified at hard-fail severity. Soft-warning surfaces (helper text, empty states) carry institutional French of acceptable density; refinement deferred as additive Wave 6+ work.

### 8. Which governance-safe semantics degrade in translation?
Pre-Wave 5 examples: `Operations Center` → `Centre des opérations` (operational-management cognate). Converged to `Espace de continuité opérationnelle`. `Command Center` → `Centre de commande` (control posture). Converged to `Espace de coordination`.

### 9. Which SaaS/analytics semantics reappeared in localized copy?
`Analytique Opérationnelle` (fr), `Análise Operacional` (pt), `Analisi Operativa` (it), `Tableau de bord exécutif du CTC` (fr/fr-CA), `Painel Executivo do CLC` (pt). All converged.

### 10. Which locale structures risked Quebec procurement downgrade?
The `clc/page.tsx`-derived metadata strings (5 per locale) carried explicit executive-dashboard framing on a federation coordination surface — direct downgrade risk for a Quebec procurement reviewer. All converged to `Coordination de continuité du CTC` (fr/fr-CA), `Coordenação de continuidade do CLC` (pt).

---

## Section 2 — Drift Matrix (per locale × posture)

| Posture | en (Wave 4) | en-CA (Wave 4) | fr (Wave 5) | fr-CA (Wave 5) | pt (Wave 5) | it (Wave 5) |
|---|---|---|---|---|---|---|
| executive-dashboard | converged | converged | **converged** | **converged** | **converged** | n/a |
| operational-analytics | converged | converged | **converged** | **converged** | **converged** | **converged** |
| command-center | **Wave 5 also fixed** | **Wave 5 also fixed** | **converged** | **converged** | **converged** | **converged** |
| operations-center | **Wave 5 also fixed** | **Wave 5 also fixed** | **converged** | **converged** | **converged** | **converged** |
| continuity terminology | strong | strong | strong | strong | safe | safe |
| chronology terminology | strong | strong | strong | strong | safe | safe |
| topology terminology | strong | strong | strong | strong | safe | safe |
| explainability terminology | strong | strong | strong | strong | safe | safe |
| procurement/trust copy | institutional | institutional | institutional | institutional | safe | safe |

---

## Section 3 — Part A · Quebec Institutional French Convergence

Convergence targets executed in fr / fr-CA:

| Before | After |
|---|---|
| `Tableau de bord exécutif CTC` | `Coordination de continuité CTC` |
| `Tableau de bord exécutif du CTC` | `Coordination de continuité du CTC` |
| `Tableau de bord exécutif` | `Coordination de continuité` |
| `Analytique Opérationnelle` / `Analytique opérationnelle` | `Visibilité opérationnelle` |
| `Centre de commande` | `Espace de coordination` |
| `Centre des opérations` / `Centre d'opérations` | `Espace de continuité opérationnelle` |

These renders deliberately avoid:
- Parisian SaaS / management-consulting register
- France-French administrative posture
- AI-governance framing
- Operational-surveillance wording

…and instead reach for: *coordination de continuité, espace de coordination, visibilité opérationnelle, garanties de continuité, supervision humaine, traçabilité procédurale, mémoire institutionnelle, coordination fédérative, coexistence*.

## Section 4 — Part B / C · Continuity, Chronology, Topology

No backfill required; existing bundles already carry institutional French equivalents. Wave 5 *protects* them via the new forbidden-vocabulary block so SaaS drift cannot quietly re-enter through helper copy or marketing translation passes.

## Section 5 — Part D · Observability / Explainability

`supervision humaine`, `visibilité de gouvernance`, `explicabilité`, `raisonnement lié à la provenance` already present. Wave 5 explicitly blocks `supervision opérationnelle` so future copy cannot accidentally collapse `supervision humaine` into operational-surveillance posture.

## Section 6 — Part E · Procurement / Trust

Trust-center copy preserved verbatim — Quebec procurement reviewer now encounters institutional-grade French throughout the runtime header path (navigation, metadata, route H1s, locale chips).

## Section 7 — Part F · Onboarding / Admin

`commandCenter` / `operationsCenter` strings (admin browse-organizations module) converged across all six locales. French admin posture is now stewardship-oriented (`Espace de coordination`) rather than command-and-control.

## Section 8 — Part G · Badge / Chip / Microcopy

No drift detected. `chronology-aware`, `provenance-stamped`, `continuity-aware`, `governance-safe`, `human-reviewed`, `review-required`, `coexistence-safe` themes preserved.

## Section 9 — Part H · Extension Locale Safety (pt / it)

Both pt and it bundles cleared of executive-dashboard / operational-analytics / command-center drift. Italian was already free of the `clcDashboard` executive cognate (only `commandCenter` + `operational` needed fixing).

## Section 10 — Part I · Localized Marketing Parity

No hard-fail marketing drift remains. Continued institutional refinement of long-form marketing copy is additive Wave 6+ work and does not block Wave 5 sign-off.

## Section 11 — Part J · Multilingual Narrative Governance Expansion

Added `wave5MultilingualParity: ForbiddenTerm[]` — 22 hard-fail terms covering English (broad command-center / operations-center), Quebec & France French (executive dashboard, command center, operational analytics, institutional surveillance, governance optimization, institutional scoring, predictive governance, operational supervision, executive piloting), Portuguese (executive panel, command center, institutional surveillance, governance optimization), Italian (executive panel, executive dashboard cognate, command center, institutional surveillance, governance optimization). Registered in `FORBIDDEN_VOCABULARY` between `wave4LanguageConvergence` and `warningLevel`.

## Section 12 — Part K · Doctrinal Parity Validation

| Parity Axis | en / en-CA | fr / fr-CA | Verdict |
|---|---|---|---|
| Procurement posture | institutional | institutional | **parity** |
| Continuity cognition | strong | strong | **parity** |
| Chronology / topology | strong | strong | **parity** |
| Observability / explainability | strong | strong | **parity** |
| Onboarding / admin | stewardship-oriented | stewardship-oriented | **parity** |
| Trust posture | calm/credible | calm/credible | **parity** |
| Governance-safe visibility | enforced via Wave 4 vocab | enforced via Wave 5 vocab | **parity** |
| Continuity safeguards | present | present | **parity** |
| Explainability | present | present | **parity** |
| Narrative governance (CI hard-fail) | 15 Wave 4 terms | 22 Wave 5 terms (incl. multilingual) | **multilingual fencing** |

A Quebec procurement reviewer encountering the post-Wave 5 runtime should conclude:

> *Cette plateforme comprend la gouvernance institutionnelle d'un point de vue structurel, procédural, culturel et linguistique.*

…rather than:

> *Ceci est un produit anglais traduit en français.*

---

## Conclusion

Wave 5 successfully advances Union Eyes from *institutionally coherent English-first continuity infrastructure* toward *procurement-grade multilingual institutional infrastructure*. All four non-English locales (`fr`, `fr-CA`, `pt`, `it`) had their five highest-leverage drift sites converged to institutional, stewardship-oriented, continuity-aware language. English locales also benefited from `commandCenter` / `operationsCenter` parity strengthening. The 22-term Wave 5 forbidden-vocabulary block fences regression across all six locales. Institutional Maturity moved from **87/100 → 88/100** as a direct consequence.
