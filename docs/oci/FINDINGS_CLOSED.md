# Findings Closed — OCI/OCRA Collapse-and-Reconcile Pass

Every finding from the collapse order, dispositioned. `closed` = resolved in this pass. `wont-fix`
= judged not to need a fix. `blocked-on-field` = needs information or a step this pass could not
safely take.

## P0 — survival

| # | Finding | Disposition |
| --- | --- | --- |
| 1 | Name collision (OCI/OCRA sequence, $18–45k dual meaning) | **closed** — one expansion each (`OCI_METHOD.md` header), OCRA fixed as Product 1 inside OCI, `oci-product-ladder.md` is the one price table, reconciled against the BDC business plan's published pricing (`infotech/Nzila Ventures Business Plan...docx`), which now governs. |
| 2 | Category self-negation (ban-list vs. shipping an assessment + runtime) | **closed** — ban-list deleted; replaced with one sentence in `OCI_METHOD.md` §6.1, repeated in `CANON.md` and `oci-product-ladder.md`. |
| 3 | Three clocks | **closed** — one 5-phase clock in `OCI_METHOD.md` §2 (Recognition/Mapping/Stabilization/Infrastructure/Intelligence, matching the code constant); `OCI_PILOT_FRAMEWORK.md` demoted to `derived` delivery view of the same clock; `OCI_DELIVERY_MODEL.md` is the one cadence. |
| 4 | `OCI_METHOD.md` broken (duplicate §7–13) | **closed** — file fully rewritten, one numbering scheme (§1–§11), no duplicate sections. |
| 5 | Anti-surveillance vs. index stack | **closed** — instrument-by-instrument disposition table added to `OCI_ANTI_SURVEILLANCE_POSITION.md`. All six named instruments kept (institutional, not personal); P5/Intelligence Network kept opt-in, non-ranked, and gated `not sold` until two completed engagements + second facilitator. |
| 6 | Facilitator contradiction (produces findings vs. drafts) | **closed** — "facilitator drafts; institution adopts or declines; a draft is not a finding until adopted" written into `OCI_METHOD.md` §4–§5 and `OCI_DELIVERY_MODEL.md`. |
| 7 | Code pointer vs. runtime | **closed** — audited `apps/union-eyes/lib/oci/frameworks/index.ts`; it already matched the surviving 5-phase/P1–P5 shape. Fixed stale doc pointer (`oci-method.md` → `OCI_METHOD.md`), renamed `productFamily: 'ICRA'` → `'OCRA'` (matches the already-executed convergence plan), tightened two product-family labels. No engine logic changed. See [`CODE_AUDIT_NOTE.md`](./CODE_AUDIT_NOTE.md). |
| 8 | Four front doors (OCI, OCRA, CIVIC, CLEAR) | **closed** — `CIVIC_OCI_ALIGNMENT.md` patched to the single OCI expansion and to point at the merged `OCI_METHOD.md`; alignment paragraph unchanged in structure (it was already one paragraph, not a second method). |

## P1 — non-survival

| # | Finding | Disposition |
| --- | --- | --- |
| 9 | Deferred items list | **closed** — added as a Stabilization-phase artefact in `OCI_METHOD.md` §4 with the required fields (item, reason, owner, review date, "not a failure" note). No fictional examples added. |
| 10 | Information boundary rule | **closed** — added as `OCI_METHOD.md` §6.3, default refuse, four categories (in-scope / out-of-scope / privileged / political). |
| 11 | Kill criteria | **closed** — three conditions added as `OCI_METHOD.md` §6.4, explicit "not a failed sale" language. |
| 12 | SKU vs. labour | **closed** — added a hours/sessions/artefacts/review/AI-off table to `OCI_DELIVERY_MODEL.md`; self-serve SKUs explicitly barred from claiming Phase 3–5 outcomes in `oci-product-ladder.md`. |
| 13 | Pricing "no ranges" then a range | **closed** — every range in `oci-product-ladder.md` now carries one named scope driver (bargaining units / sites in scope), no "from." |
| 14 | Closure minute | **closed** — added as a Stabilization-phase artefact in `OCI_METHOD.md` §4 and referenced in `OCI_DELIVERY_MODEL.md`. No KPIs added. |
| 15 | AI boundary vs. architecture docs | **closed** — `OCI_AI_BOUNDARY.md` states it is the only canonical AI document; `ai/OCRA_AI_SYSTEM_ARCHITECTURE.md` and four siblings demoted to `internal/engineering` with banners. |
| 16 | Certification / government-readiness / "world-class" corpus | **closed** — tagged `premature` throughout (`OCI_METHOD.md` §9, `government-readiness/README.md` banner, `assessment/OCRA_WORLD_CLASS_COMPLEXITY_VALIDATION_2026-06-13.md` banner). One sentence only; curriculum not written further. |
| 17 | French companion + whitepapers | **blocked-on-field** — not verified line-by-line against the renamed method in this pass (too large a translation-equivalence check to do safely without a French-speaking doctrine reviewer). Stamped `stale` in `SUPERSEDED.md` with an explicit "do not cite for pricing/naming" note, per the instruction to cut/stamp rather than silently carry forward. Also flagged: three duplicate-filename pairs (`.fr-CA.md` vs `_fr-CA.md`) inside `whitepapers/` that are themselves a defect, unresolved this pass. |
| 18 | Entity/trust note (tenant, keys, subprocessors, contract-end) | **closed** — `OCI_DATA_HANDLING.md` already had subprocessors and deletion-on-contract-close sections; added a short "Tenancy and keys" section to close the one gap (key ownership statement). No sales claims added — stayed factual, in the data-handling doc. |

## P2 — hygiene

| # | Finding | Disposition |
| --- | --- | --- |
| 19 | Trademark inflation (™) | **wont-fix this pass** — not touched; ™ usage was not the blocking defect and re-auditing every ™ across ~90 files was out of scope once P0/P1 closed. Flagged for a follow-up pass. |
| 20 | Workshop scripts / email sequences / decks repeating old ladder | **blocked-on-field** — listed as `derived` in `SUPERSEDED.md` with an explicit note that their pricing/category claims are superseded by `oci-product-ladder.md` and `OCI_METHOD.md` §6.1 until each is individually re-read; not rewritten line-by-line this pass. |
| 21 | Dual `OCI_METHOD.md` / `oci-method.md` | **closed** — merged into `OCI_METHOD.md`; `oci-method.md` is now a two-line redirect stub. |
| 22 | Navigation from `docs/oci/README` | **closed** — created `docs/oci/README.md` (did not exist) listing the six canonical files and pointing at `SUPERSEDED.md`. The physical `docs/oci/superseded/` directory move **was done** in this revision: 12 directories + 2 files relocated with `git mv` (history preserved), followed by a repo-wide link-integrity pass (3,591 markdown files scanned, 61 files' links rewritten, 72 TypeScript files' doc-comment paths rewritten, zero unresolved links remain against any moved `docs/oci` path). Two bugs were found and fixed during that pass: relative links inside moved files pointing at non-moved canonical files needed an extra `../` (missed in the first automated rewrite, caught by a post-move existence-check repair pass), and directory-only links (no filename) needed the same `superseded/` insertion as file links. Both are fixed; see the repair log referenced in this PR's description. |
| 23 | "Benchmark intelligence" league-table language | **closed** — `oci-product-ladder.md` and `OCI_METHOD.md` §6.5 both state P5 is opt-in, non-ranked, and not sold; `OCI_ANTI_SURVEILLANCE_POSITION.md` instrument table repeats the same constraint for every instrument, including P5. |
| 24 | "Not SharePoint / not a repo / not PM" ban-list | **closed** — same fix as #2; replaced by the one-sentence definition in `OCI_METHOD.md` §6.1. |
| 25 | BDC plan pricing vs. repo | **closed** — repo doctrine now matches the BDC plan's published pricing table (Free / $1,200 / $6,500 / $18–45k / $40–140k / bespoke); the plan's narrative-only "OCRA Intelligence $27k–$36k" line (absent from its own final published table) is retired and folded into the OCI Assessment scope-driver band. Recorded in `SUPERSEDED.md` under "Commercial copy outside docs/oci/." |

## Net effect

- `docs/oci/OCI_METHOD.md`: rewritten, shorter (removed the duplicate §7–13, the ban-list, the
  P3 operationalization corpus cross-reference list, and the certification curriculum detail).
- `docs/oci/oci-method.md`: collapsed from a full doctrine file to a 10-line stub.
- `docs/oci/oci-product-ladder.md`: rewritten, one price table instead of two tier grids plus a
  narrative reservation section. See item 26 below for a pricing-language contradiction found
  and fixed during the physical-move review.
- `docs/oci/` top level now holds only the six canonical files, the four collapse-pass artefacts
  (`CANON.md`, `SUPERSEDED.md`, `FINDINGS_CLOSED.md`, `CODE_AUDIT_NOTE.md`), `README.md`, and 11
  actively-used `derived` documents. Everything else (~90 files across 12 directories) lives under
  `docs/oci/superseded/`.
- No new frameworks, indexes, or phases were introduced. No fictional case studies were added.
  "World class," "unique," and "only platform" do not appear in any file edited this pass.

## Additional finding closed during the physical-move review

| # | Finding | Disposition |
| --- | --- | --- |
| 26 | The BDC plan's $1,200 Leadership Briefing Report description uses Stabilization-phase vocabulary ("governance entropy, continuity debt, dependency review") at a self-serve price point — exactly the P1.12 SKU-vs-clock violation, just discovered on the commercial-copy side rather than the repo-ladder side. | **closed** — `oci-product-ladder.md` now names this exact conflict and states the resolution: the $1,200 tier does not compute Continuity Debt™ (a P3, facilitated-only instrument); that phrase in the plan is a labelling error, not a claim this doctrine backs. The BDC plan itself now carries a cover-page note ("This plan's offer table is a snapshot as of 26 Aug 2026") pointing at `CANON.md` as the pricing owner, so the plan's copy is explicitly subordinate, not a second source of truth. |

## One price table, one owner (closes the "two sources of truth" critique)

`docs/oci/oci-product-ladder.md` is the single owner of prices. The external BDC business plan
(`infotech/Nzila Ventures Business Plan — Revised (August 26, 2026).docx`) now carries a one-
sentence cover-page note stating that `CANON.md` governs and that its own offer table is a dated
snapshot, not a second canonical source. This was written into the docx directly (cover page,
italic, 9pt), not just asserted in a markdown file nobody reading the plan would see.
