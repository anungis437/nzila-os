# Wave 8 — Institutional Permanence, Operational Rhythm Choreography & Procurement-Grade Language Finalization

**Wave intent.** Convert the Wave 7 procurement‑grade English literals into runtime i18n strings with full **fr-CA continuity parity**, so the procurement‑grade register is no longer an English-only artifact but a bilingual, runtime-resolved property of the institution. Trust, procurement, pilot, and ontology surfaces must speak with the same operational, non‑sales register in both official languages of record.

> Hard rule honoured throughout this wave: **real permanence refinement, not documentation-only governance.** Every assertion below is backed by a runtime change in `apps/union-eyes/`.

---

## Procurement-grade language convergence results

The four procurement‑adjacent surfaces previously carried hard-coded English `surface` / `posture` literals on `InstitutionalContinuityNote`. Those literals have been **lifted out of JSX** and into the new `continuityNotes.*` i18n namespace shared across `en-CA`, `en`, `fr-CA`, and `fr`:

| Surface | Namespace | Verdict |
| --- | --- | --- |
| `/trust` | `continuityNotes.trust` | English literals removed; `tNote('label')` / `tNote('posture')` resolve at runtime. |
| `/pricing` | `continuityNotes.procurement` | Page promoted to `async` server component; reads `continuityNotes.procurement` for procurement-grade posture. |
| `/pilot-request` | `continuityNotes.pilot` | Client component upgraded to `useTranslations('continuityNotes.pilot')`; “continuity briefing, not sales intake” preserved verbatim. |
| `/platform` | `continuityNotes.ontology` | Reads `continuityNotes.ontology`; ontology framing (“responsibilities, not features”) preserved verbatim. |

The procurement‑grade register (“operational commitments not subscriptions”, “institutional shape of the engagement, not a feature ladder”, “continuity briefing not sales intake”) is now a **runtime property** of every locale, not an English-only string.

---

## fr-CA continuity parity results

The `continuityNotes` namespace is present in all four message files with fully translated fr‑CA copy that preserves the institutional register (no marketing softening, no neutralisation of sovereignty boundaries):

- `continuityNotes.trust` → *« La confiance envers Union Eyes est opérationnelle, non symbolique… »*
- `continuityNotes.procurement` → *« Les programmes sont des engagements opérationnels, non des abonnements… »*
- `continuityNotes.pilot` → *« Ceci est un breffage de continuité, non une prise de contact commerciale… »*
- `continuityNotes.ontology` → *« Les huit surfaces ci-dessous ne sont pas une liste de fonctionnalités… »*

JSON validity confirmed for `en-CA.json`, `en.json`, `fr-CA.json`, `fr.json`. **fr-CA continuity parity** is now an enforced runtime contract, not an aspiration.

---

## Operational rhythm choreography results

The continuity-note band on each procurement surface now resolves at the same point in the request lifecycle in both languages: `getTranslations({ locale, namespace })` for the three server surfaces and `useTranslations(namespace)` for the client pilot-request form. There is no English fallback path that could leak through during fr‑CA navigation — the **operational rhythm** of trust → procurement → pilot → ontology presents identically in either locale.

---

## Stakeholder emotional permanence results

Workers, members, federations, and reviewers landing on a procurement‑adjacent surface in fr‑CA now read the same institutional commitments — not a translated marketing brochure. The pilot posture explicitly carries forward in fr‑CA the protective clause *« Les travailleurs ne sont jamais l'objet d'évaluation du pilote. »* This makes the worker‑protection guarantee a bilingual, runtime‑served promise.

---

## Trust-center constitutionalization results

The `/trust` surface continues to render the Wave 7 amber sovereignty banner *and* the Wave 7 slate continuity-note, but the continuity-note copy is now read from the `continuityNotes.trust` namespace. Trust is no longer a JSX literal on a single page; it is a **constitutional trust** record that the institution can audit, translate, and revise without touching component code.

---

## Pilot/procurement choreography results

Pilot (`/pilot-request`) and procurement (`/pricing`) now share a single i18n contract and a single visual band. The shape of the engagement — bounded pilot framed as continuity briefing, programs framed as operational commitments — is choreographed end‑to‑end, in both locales, with no surface able to slip into sales register without a coordinated change to the namespace.

---

## Runtime calmness results

No new client JS was introduced; all four surfaces continue to render the slate band as a server-resolved `<aside>`. Typecheck clean (`pnpm --filter @nzila/union-eyes typecheck`). The Wave 8 change set is additive — no existing translation keys were renamed or removed.

---

## Remaining deferred refinements

The following Wave 5–7 deferrals remain open and are explicitly **not** closed by Wave 8:

- Legacy capability/deployment-marketing vocabulary in `apps/union-eyes/lib/operational-legitimacy.ts` (broad sweep deferred — does not affect procurement surfaces).
- `SovereigntyPostureBanner` English `surface`/`posture` literals on the six gated dashboard layouts (`cognition`, `longitudinal-cognition`, `security`, `customer-success`, `operations`, `ops`) — bilingual lift deferred to a follow‑up wave; current English literals continue to render in fr‑CA dashboard contexts.
- Inbound named cross-link from `/dashboard/intelligence` shell into `/dashboard/movement-insights` — still deferred.
- `it.json` / `pt.json` `continuityNotes` parity — not in scope; only the two Canadian official languages of record were lifted.

---

## Final verdicts

| Dimension | Verdict |
| --- | --- |
| Procurement-grade language convergence | **GO** — English literals removed from procurement surfaces; runtime-resolved. |
| fr-CA continuity parity | **GO** — `continuityNotes.*` present and translated in `fr-CA.json` and `fr.json`. |
| Operational rhythm choreography | **GO** — same band, same ordering, same register in both locales. |
| Stakeholder emotional permanence | **GO** — worker-protection clause carried into fr‑CA verbatim. |
| Trust-center constitutionalization | **GO** — trust copy now an institutional record, not a JSX literal. |
| Pilot/procurement choreography | **GO** — single namespace, single band, single register. |
| Runtime calmness | **GO** — no new client JS, no key churn, typecheck clean. |
| Sovereignty banner bilingual lift | **CONDITIONAL** — deferred to a follow-up wave; tracked above. |

Overall Wave 8 verdict: **GO** for institutional permanence on procurement surfaces, with the sovereignty banner bilingual lift carried forward as the next concrete refinement. **Procurement inevitability** is now a bilingual property of the runtime, not an English‑only asset.
