# OCI Doctrine — Superseded / Parked Ledger

**Status:** Canonical index of everything under `docs/oci/superseded/**` (and the two-file/twelve-
directory move described below). Nothing listed here has been deleted. As of this pass, every
file in this ledger has been **physically relocated** to `docs/oci/superseded/` using `git mv`
(history preserved), and every markdown cross-reference and code doc-comment that pointed at the
old location has been rewritten to the new one — verified by a repo-wide link pass (3,591
markdown files scanned; zero unresolved links remain that reference a moved `docs/oci` path).
[`docs/oci/README.md`](./README.md) points here as the index.

Four dispositions are used below:

- **`superseded`** — actively replaced by one of the six canonical files; do not read for current doctrine.
- **`premature`** — describes a capability (certification, government-readiness, benchmarking) that does not exist yet; gated by [`OCI_METHOD.md` §9](./OCI_METHOD.md#9-certification-pathway) or §6.5.
- **`internal/engineering`** — implementation detail for engineers; not doctrine, not procurement-facing.
- **`derived`** — still current, but must quote the six canonical files rather than restate them.

## Superseded

| File | Reason |
| --- | --- |
| `oci-method.md` | Duplicate "canonical" method file. Redirect stub now points to `OCI_METHOD.md`. |

## Premature (certification / government-readiness / benchmarking not yet earned)

| File / directory | Reason |
| --- | --- |
| `OCI_FACILITATOR_CERTIFICATION_RUBRIC.md` | Certification gate not met (needs two completed engagements + second facilitator). |
| `OCI_FACILITATOR_TRAINING_CURRICULUM.md` | Same gate. Not written further this pass. |
| `assessment/OCRA_WORLD_CLASS_COMPLEXITY_VALIDATION_2026-06-13.md` | Uses the banned phrase "world-class"; internal validation note, not a doctrine or marketing claim. |
| `government-readiness/**` (entire directory, ~20 files incl. `OCI_OCRA_GOVERNMENT_READINESS_MASTER_BLUEPRINT.md`, `OCI_OCRA_ASSESSOR_CERTIFICATION_STANDARD.md`, `OCI_OCRA_INTER_RATER_RELIABILITY_MODEL.md`, `OCI_OCRA_OBLIGATION_TAXONOMY.md`, `OCI_OCRA_CONSEQUENCE_MODEL.md`, `OCI_OCRA_EXPLAINABILITY_MODEL.md`, `OCI_OCRA_POLICY_TRACEABILITY_ARCHITECTURE.md`, `richard-packet/`) — now `docs/oci/superseded/government-readiness/` | Self-described as "documentation-only... whether these properties are established in practice depends on empirical gates." Not required for a paying engagement in the next two quarters. Banner retained on the directory README, which moved with it. |
| `intelligence/**` (5 files) — now `docs/oci/superseded/intelligence/` | P5 Intelligence Network doctrine. P5 is not sold — see `OCI_METHOD.md` §6.5. Retained as roadmap. |

## Internal/engineering (implementation detail, not public doctrine) — all now under `docs/oci/superseded/`

| File / directory (new location) | Reason |
| --- | --- |
| `ai/` → `superseded/ai/` (5 files) | Describe the AI implementation, not the public boundary. `OCI_AI_BOUNDARY.md` is the only canonical AI document; banners on each file point back to it. |
| `audit/` → `superseded/audit/` (15 files) | Internal question-architecture and signal-model audit trail. Engineering history, not method doctrine. |
| `compliance/` → `superseded/compliance/` (8 files) | Reference crosswalks for a specific procurement conversation. Not required to answer any `CANON.md` acceptance test. |
| `methodology/` → `superseded/methodology/` | Statistical/engineering backing for the scoring core. Engineers only. |
| `migration/OCI_OCRA_CONVERGENCE_PLAN.md` → `superseded/migration/` | Documents an already-executed ICRA→OCRA technical rename. Useful engineering history; kept as-is, not restated in doctrine. |
| `procurement/` → `superseded/procurement/` (4 files) | Field guides for a specific reviewer conversation. Derived from the six; not restated. |
| `runtime/` → `superseded/runtime/` (11 files) | P4 (Infrastructure / Platform Activation) architectural roadmap. Implementation detail for the runtime layer named in `oci-product-ladder.md`. |
| `stabilization/` → `superseded/stabilization/` (~24 files + `playbooks/`, `workflows/`) | P3 (Stabilization) architectural roadmap and engine-facing vocabulary (Continuity Debt™, severity model, playbooks). Live code under `apps/union-eyes/lib/workbook/engines/**` still cites these paths in doc comments (now updated to the `superseded/` location); the engines themselves were not changed. |

All code doc-comments and one runtime data structure (`continuityWorkflowRegistry.ts`'s `docPath` /
`playbookPaths` fields, which the app itself may render as clickable doctrine links) were updated
to the new `superseded/` paths as part of this move — 72 TypeScript/TSX files touched, comments
and string literals only, no logic changed. See [`CODE_AUDIT_NOTE.md`](./CODE_AUDIT_NOTE.md).

## Stale (diverges from the renamed method; not verified line-by-line this pass)

| File | Reason |
| --- | --- |
| `whitepapers/OCI_METHOD_WHITEPAPER_v1.md`, `.fr-CA.md`, `_fr-CA.md` | Predates this collapse; likely still uses "Operational Continuity Intelligence" and the old phase/ladder shape. Flagged `stale` rather than corrected line-by-line — do not cite for current pricing, naming, or phase claims. |
| `whitepapers/OCI_METHOD_COMPANION_WHITEPAPER.md`, `.fr-CA.md`, `_fr-CA.md`, `_STRUCTURE.md` | Same. Also note: three files claim the same French filename pattern with two different separators (`.fr-CA.md` vs `_fr-CA.md`) — a duplicate-file defect in its own right, unresolved this pass. |
| `whitepapers/OCI_OCRA_EXECUTIVE_WHITEPAPER_STRUCTURE.md`, `OCI_OCRA_WHITEPAPER_ARCHITECTURE_v2.md` | Structure/architecture docs for whitepapers not reconciled this pass. |
| `whitepapers/THE_CONTINUITY_GAP_OPERATIONAL_REALITY_EDITION.md`, `.fr-CA.md`, `_fr-CA.md` | Same duplicate-filename defect and same staleness risk. |
| `infotech/nzila_os_doctrine_and_positioning_master_pack.md`, `infotech/The_Continuity_Gap_Master_Whitepaper_Evidence_Enhanced_v3.pdf` | Outside `docs/oci/`; external/legacy positioning material not reconciled this pass. Do not cite for current pricing or naming. |

## Derived (current; must quote the six canonical files, not restate them)

| File | Quotes |
| --- | --- |
| `OCI_PILOT_FRAMEWORK.md` | `OCI_METHOD.md` (phase cross-walk), `OCI_DELIVERY_MODEL.md` (cadence) |
| `OCI_INSTITUTIONAL_ACTIVATION.md` | `OCI_METHOD.md` §6.4 (kill criteria), `OCI_DELIVERY_MODEL.md` |
| `OCI_PILOT_SCOPE_TEMPLATE.md` | `OCI_METHOD.md` §6.3 (information boundary) |
| `OCI_PRIVACY_POSITION.md`, `OCI_DATA_HANDLING.md`, `OCI_SECURITY_OVERVIEW.md` | `OCI_ANTI_SURVEILLANCE_POSITION.md`, `OCI_AI_BOUNDARY.md` |
| `OCI_BOARD_OVERVIEW.md`, `OCI_EXECUTIVE_BRIEFING_DECK.md`, `OCI_EXECUTIVE_EMAIL_SEQUENCE.md`, `OCI_WORKSHOP_OPENING_SCRIPT.md`, `OCI_PILOT_INTRODUCTION_GUIDE.md` | `oci-product-ladder.md` (pricing), `OCI_METHOD.md` §6.1 (the one sentence) — these have not been re-read line-by-line this pass for stale pricing/ban-list language; treat any pricing or category claim in them as superseded by `oci-product-ladder.md` and `OCI_METHOD.md` §6.1 until individually checked. |

## Commercial copy outside `docs/oci/`

| File | Disposition |
| --- | --- |
| `infotech/Nzila Ventures Business Plan — Revised (August 26, 2026).docx` | External, bank-submitted financing document. **Not a source of truth for pricing.** `oci-product-ladder.md` is the one owner of prices (see `CANON.md` — "One price table, one owner"). The plan's own cover page now says so: "Method and prices: see docs/oci/CANON.md. This plan's offer table is a snapshot as of 26 Aug 2026." Still uses legacy "ICRA" label in one line item (`Free Readiness Check (ICRA entry)`); that is a stale label inside the external document itself and is out of edit scope for this pass, but is covered by the same snapshot disclaimer. |
| `README.business.md`, `artifacts/commercial/*.md`, `docs/categories/stakeholders/commercial/**` | No OCI/OCRA pricing or naming conflicts found in this pass (checked by keyword search). Nothing to reconcile today; re-check if OCI pricing is ever added there. |
