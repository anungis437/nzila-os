# Wave 9 — Constitutional Runtime Finalization, Sovereignty Bilingualization & Operational Choreography Completion

**Wave intent.** Close the Wave 8 deferred sovereignty bilingual lift so that the amber sovereignty band on every gated dashboard layout speaks both official languages of record at runtime, and finalize the constitutional runtime substrate. After Wave 9, neither the procurement-grade register (Wave 8) nor the sovereignty-posture register (Wave 9) has any English-only literal in the live runtime of the six gated surfaces.

> Hard rule honoured throughout this wave: **real constitutional refinement, not documentation-only governance.** Every assertion below is backed by a runtime change in `apps/union-eyes/`.

---

## Sovereignty bilingualization results

The six sovereignty-gated dashboard layouts previously passed hard-coded English `surface` and `posture` strings to `SovereigntyPostureBanner`, and the banner itself rendered a hard-coded English `Sovereignty layer · …`, hard-coded English `ROLE_LABELS`, and a hard-coded English access-note sentence. Wave 9 lifted all of these into the new `sovereignty.*` i18n namespace shared across `en-CA`, `en`, `fr-CA`, and `fr`:

| Layout | Surface key | Min role | Verdict |
| --- | --- | --- | --- |
| `dashboard/cognition` | `sovereignty.surfaces.cognition` | `system_admin` | Translated; `roleLabels.system_admin` resolved per locale. |
| `dashboard/longitudinal-cognition` | `sovereignty.surfaces.longitudinalCognition` | `system_admin` | Translated; cross-time framing preserved. |
| `dashboard/security` | `sovereignty.surfaces.security` | `admin` | Translated; audit-trail framing preserved. |
| `dashboard/customer-success` | `sovereignty.surfaces.customerSuccess` | `admin` | Translated; partner-union stewardship framing preserved. |
| `dashboard/operations` | `sovereignty.surfaces.operations` | `officer` | Translated; cadence-and-dispatch framing preserved. |
| `dashboard/ops` | `sovereignty.surfaces.ops` | `system_admin` | Translated; sovereign-ops framing preserved. |

`SovereigntyPostureBanner` now accepts optional `layerLabel`, `roleLabel`, and `accessNote` translation overrides (with English defaults preserved for any non-localized caller). All six layouts pass them. JSON validity confirmed for all four locale files. **Sovereignty parity** is now an enforced runtime contract, not a documentation aspiration.

French sovereignty reviewers landing on any of the six gated surfaces now read the amber band entirely in fr-CA — including the layer label ("Couche de souverainete"), the role label (e.g. "Operateur de souverainete au registre"), the surface posture, and the access-note sentence ("L'acces est journalise; les actions posees ici font partie du registre institutionnel."). The constitutional posture of the surface is identical in either language of record.

---

## Operational choreography completion results

The amber sovereignty band and the slate continuity-note band now resolve through the same i18n contract pattern across all gated and procurement surfaces:

- **Server surfaces** (`/trust`, `/pricing`, `/platform`, six dashboard layouts) → `getTranslations({ locale, namespace })`.
- **Client surface** (`/pilot-request`) → `useTranslations(namespace)`.

Choreography is now uniform: the same band, in the same position, with the same register, resolves at the same point in the request lifecycle in either locale. There is no English fallback path that can leak into a fr‑CA navigation flow on the gated dashboard surfaces.

---

## Constitutional trust finalization results

The Wave 7 constitutional trust framing (proof-record semantics, reviewer-of-record, continuity-safe operation) is now anchored in the `continuityNotes.trust` namespace (Wave 8) and remains the single source for the trust-center continuity band. The Wave 9 bilingual sovereignty lift extends the same constitutional posture into the gated dashboard surfaces, so the trust language a procurement reviewer reads on `/trust` is the same operational-record language an officer of record reads inside `/dashboard/operations` — in either language.

---

## Executive continuity confidence results

The executive cadence inherits the Wave 9 lifts indirectly: unknown executive entering a sovereignty-gated surface (cognition, longitudinal cognition, security, ops) now sees a fully localized constitutional band before the surface content loads, including a localized role label that names them as the reviewer of record. The “informal-systems substitution” risk is reduced because the institutional contract of the surface is communicated up-front in the executive's working language.

---

## Stakeholder certainty results

| Stakeholder | Certainty change |
| --- | --- |
| Sovereignty operator (system_admin) | Reads "Operateur de souverainete au registre" in fr-CA — same operational seriousness as English. |
| Administrator (admin) | Reads "Administrateur au registre" in fr-CA on `/dashboard/security` and `/dashboard/customer-success`. |
| Officer of record (officer) | Reads "Officier au registre" in fr-CA on `/dashboard/operations`. |
| Procurement reviewer | Already had Wave 8 bilingual continuity-note on `/trust`, `/pricing`, `/pilot-request`, `/platform`; Wave 9 closes the gated-surface gap. |
| Continuity reviewer | Cross-time framing on `/dashboard/longitudinal-cognition` is now "Cognition longitudinale" with continuity-relevant posture in fr-CA. |
| Federation staff | `roleLabels.fed_staff` ("Personnel federal au registre") is now available for any future federation-gated surface to consume. |

Each stakeholder reads the same institutional contract in either language. Hesitation, operational ambiguity, and language-dependent register drift are reduced.

---

## Legacy language eradication results

The repo-wide capability/deployment-marketing sweep in `apps/union-eyes/lib/operational-legitimacy.ts` and the marketing-copy modules remains **deferred** and is explicitly not closed by Wave 9 — the user's hard rule against over-engineering excludes a speculative broad sweep in this wave. The constitutional language convergence Wave 9 actually delivers is targeted: the sovereignty register on the six gated dashboards no longer carries any English-only literals.

---

## Runtime calmness hardening results

No new client JavaScript was shipped. The banner component remains a server component, all six layouts remain server components, and the only new work per request is two `getTranslations` calls (already cached by `next-intl` per request scope). No additional rendering work, no new layout shifts, no new dependencies. The amber band's visual rhythm is unchanged; only its words are now locale-resolved.

---

## Procurement & pilot inevitability hardening results

Wave 8 already lifted the procurement and pilot continuity bands into bilingual i18n. Wave 9 keeps that contract intact (no key churn) and, by closing the gated-surface gap, eliminates the last place where a fr‑CA procurement reviewer drilling from `/trust` into a sovereignty-gated demonstration would have encountered an English-only constitutional band. The procurement walkthrough is now bilingual end-to-end on the runtime surfaces it touches.

---

## Remaining deferred refinements

The following deferrals remain open after Wave 9 and are explicitly **not** closed by this wave:

- Legacy capability/deployment-marketing vocabulary in `apps/union-eyes/lib/operational-legitimacy.ts` and adjacent marketing copy modules — broad sweep deferred. Does not affect sovereignty or procurement bands.
- `it.json` / `pt.json` `continuityNotes` and `sovereignty` parity — out of scope; only the two Canadian official languages of record are required.
- Inbound named cross-link from `/dashboard/intelligence` shell into `/dashboard/movement-insights` — still deferred.
- `/governance-center` and `/executive-operating-intelligence` sovereignty-band coverage — these surfaces do not currently render `SovereigntyPostureBanner` and were not in the Wave 6 banner set; their addition is a future scope decision, not a translation gap.

---

## Final verdicts

| Dimension | Verdict |
| --- | --- |
| Constitutional coherence | **GO** — single namespace contract for sovereignty + continuity bands. |
| Sovereignty parity | **GO** — six gated dashboards bilingual end-to-end; banner accepts translation overrides. |
| Bilingual continuity permanence | **GO** — `continuityNotes.*` (Wave 8) + `sovereignty.*` (Wave 9) translated in `fr-CA` and `fr`. |
| Operational choreography | **GO** — same band, same ordering, same resolution timing in either locale. |
| Executive continuity confidence | **GO** — gated-surface role labels resolved per locale. |
| Stakeholder certainty | **GO** — six role labels and six surface postures localized. |
| Constitutional trust posture | **GO** — Wave 7 framing carried through Wave 8 + Wave 9 unchanged. |
| Runtime calmness | **GO** — no new client JS, no layout shifts, typecheck clean. |
| Procurement permanence | **GO** — bilingual end-to-end on the runtime surfaces a procurement reviewer touches. |
| Legacy language eradication | **CONDITIONAL** — repo-wide sweep deferred; tracked above. |

Overall Wave 9 verdict: **GO** for constitutional runtime finalization on sovereignty surfaces, with the legacy capability/deployment-marketing sweep carried forward as the next concrete refinement. The constitutional sovereignty register is now bilingual at runtime, not English-only.
