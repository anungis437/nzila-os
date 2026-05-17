# Union Eyes — Locale Parity Audit

**Audit date:** 2026-05-15
**Locales:** en, en-CA, fr, fr-CA, it, pt
**Source:** `apps/union-eyes/messages/{locale}.json`
**Posture:** validation-only

---

## 1. Top-level key parity

| Locale | Top-level keys | Missing vs en.json | Notes |
| --- | ---: | --- | --- |
| en | 23 | — | baseline |
| en-CA | 22 | `qcBilingualBanner` | derived from en |
| fr | 23 (+ `duesPayPage`) | — | superset |
| fr-CA | 23 (+ `duesPayPage`) | — | superset (Quebec) |
| it | 22 | `qcBilingualBanner` | extension locale |
| pt | 22 | `qcBilingualBanner` | extension locale |

**Verdict:** structurally en-aligned for fr/fr-CA. en-CA, it, pt each missing `qcBilingualBanner` (used by the Quebec bilingual disclosure component).

---

## 2. Forbidden vocabulary in locale bundles

Detected forbidden / drift terms inside translation strings:

| Locale | File line(s) | Term | Severity | Context |
| --- | --- | --- | --- | --- |
| fr | 82, 6214, 6410 | "Tableau de bord exécutif" | high | `clcDashboard`, CTC admin labels |
| fr-CA | 82, 6214, 6410 | "Tableau de bord exécutif" | high | same as fr |
| fr | 8855 | "Centre de commande" | medium | `commandCenter` key |
| fr-CA | 8869 | "Centre de commande" | medium | `commandCenter` key |
| en | 9134 | "Command Center" | medium | `commandCenter` key |
| fr | 7550 | "Notation IA" | medium | AI scoring/rating description |
| fr-CA | 7534 | "Notation" | medium | AI scoring (variant) |
| en | 7755, 8942 | "scoring" | medium | "Optional AI scoring…" |
| en-CA | 7534, 8942 | "scoring" | medium | mirror of en |
| it | 8663 | "scoring" / "Valutazione" | medium | AI scoring |
| pt | 8663 | "scoring" / "Pontuação" | medium | AI scoring |

The forbidden vocabulary list at [apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts](apps/union-eyes/tooling/marketing/config/forbidden-vocabulary.ts) covers these terms only when they appear in marketing copy. None of these locale strings is currently rendered on a marketing route, which is why narrative CI is at zero hard-fails. They will surface when the gate is extended to translation bundles.

---

## 3. Institutional vocabulary coverage

Institutional governance-safe vocabulary check (must appear in fr/fr-CA at parity with en):

| Term | en | en-CA | fr | fr-CA | it | pt |
| --- | :-: | :-: | :-: | :-: | :-: | :-: |
| continuité institutionnelle / institutional continuity | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |
| chronologie / chronology | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |
| topologie / topology | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |
| provenance | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |
| explicabilité / explainability | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |
| supervision humaine / human oversight | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |
| intelligence assistive / assistive intelligence | ◐ | ◐ | ✗ | ✗ | ✗ | ✗ |

The institutional vocabulary is currently rendered via marketing-page React copy (not bundle keys). For depth-1 institutional surfaces this is acceptable in en/en-CA, but **fr / fr-CA carry zero institutional vocabulary** — meaning the Quebec procurement reviewer sees a doctrinally weaker product than the English reviewer.

---

## 4. Non-locale duplication

The marketing tree is duplicated:

- `app/(marketing)/...` — non-localized canonical SEO surface
- `app/[locale]/(marketing)/...` — localized runtime

Both carry English-only React copy at the moment for shared pillars. Locale routing exists; locale content does not.

---

## 5. Validation-only recommendations

(Listed for sequencing; this audit applies no changes.)

1. Add `qcBilingualBanner` to `en-CA.json`, `it.json`, `pt.json` — additive, no risk.
2. Replace `Tableau de bord exécutif` / `Centre de commande` / `Command Center` / `scoring` / `Notation` strings with governance-safe equivalents (e.g. `Tableau d'administration`, `Panneau de contrôle`, `Évaluation assistée`).
3. Introduce a French institutional vocabulary block in `fr.json` and `fr-CA.json` covering the seven terms in §3 — additive only.
4. Backfill the localized marketing tree with at least the trust / governance / institutional-continuity pillar copy in fr-CA before any Quebec procurement engagement.

---

## 6. Verdict

- **Structural parity:** acceptable (fr, fr-CA at parity; three locales missing one banner key).
- **Forbidden vocabulary:** present in fr / fr-CA / en / en-CA / it / pt — surface-blocking on next gate expansion, currently dormant.
- **Institutional vocabulary:** absent from all locales except partially in en / en-CA — high-priority parity gap for Quebec readiness.
- **Localized marketing tree:** structurally exists; copy is en-only.
