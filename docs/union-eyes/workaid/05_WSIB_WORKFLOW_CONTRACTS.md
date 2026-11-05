# 05 — WSIB workflow contracts

Module: [`src/submission.ts`](../../../tooling/workaid-prep/src/submission.ts), [`src/claims.ts`](../../../tooling/workaid-prep/src/claims.ts), [`src/deadlines.ts`](../../../tooling/workaid-prep/src/deadlines.ts). WSIB/WSIAT procedure is **not** encoded as fact; everything that depends on it is either human-attested or configured and listed as an open decision. Official sources are those named in the v0.1 pack and the Grok source register; none was independently re-verified in this slice.

## Outbound submission states

"Sending is not receipt. Receipt is not acceptance. Receipt is not valid filing."

```
DRAFT ⇄ REVIEWED → APPROVED → DISPATCH_ATTEMPTED → DISPATCHED → DELIVERY_ACK → RECEIPT_CONFIRMED → SUPERSEDED
   │        │          │  ↑          │  ↑                │            │
   │        │          └──┘          │  └ DISPATCH_FAILED (retry with a new request id; or WITHDRAWN/SUPERSEDED)
   │        │       (invalidate)     │                    └→ REJECTED → SUPERSEDED
   └────────┴──────────→ WITHDRAWN   (reachable from every state before RECEIPT_CONFIRMED except REJECTED; sent states may be SUPERSEDED)
```

The authoritative table is `ALLOWED_SUBMISSION_TRANSITIONS` (11 states). The test `[WA-T039][WA-T040] exhaustive matrix` runs all 121 (from, to) pairs against it; anything not listed is forbidden. Mapping to the lifecycle stages (the full evidence and authority table is [17](17_RECEIPT_VS_FILING_AUTHORITY.md)):

| Stage | State | Who or what causes it |
|---|---|---|
| Document created | `DRAFT` | Preparer |
| Document authorized for submission | `REVIEWED` then `APPROVED` | WorkAid professional; identity must equal the authenticated principal; live professional authorization; configurable separate-approver rule |
| Dispatch attempted | `DISPATCH_ATTEMPTED` | WorkAid professional (human only); request id gives idempotency; needs live authority to act as WSIB representative except for a DOA |
| Dispatch confirmed | `DISPATCHED` | Professional or the dispatch provider, with a transmission reference matching the attempt. A failed attempt is `DISPATCH_FAILED`, visible and recoverable, and never starts a follow-up |
| Dispatch acknowledged by the sending service | `DELIVERY_ACK` | Dispatch provider (system actor) only; never receipt |
| Receipt acknowledgement obtained from WSIB | `RECEIPT_CONFIRMED` | WorkAid professional: recognized method (`PHONE_CALL`, `WSIB_PORTAL_CONFIRMATION`, `WSIB_WRITTEN_CONFIRMATION`, `WSIB_EMAIL_REPLY`), WSIB contact or evidence reference, and the received-at time stated by the human |
| Valid filing determined | **not a submission state** | A separate append-only `FilingRecord`; `UNDETERMINED` until a professional determines it against a reviewed requirement source |
| Authority accepted or rejected | **not a submission state** | `FilingRecord.authorityResponses`, from the authority's own document |
| Follow-up completed | Task `RECEIPT_CONFIRMED` | Derived from the submission; there is no "done without receipt" |

`isReceiptUnconfirmed` (derived) is true for `DISPATCHED`/`DELIVERY_ACK` without a receipt record. `receiptDocumented` and `dispatchConfirmed` are the only derived facts; **`submissionCountsAsFiled` was removed in Slice C (WA-C-001)** because a receipt record is not a legal conclusion that the filing was valid. A dispatch that is never confirmed stays unconfirmed indefinitely (`[WA-ADV-09]`).

### Forbidden transitions (all tested)

Any pair not in `ALLOWED_SUBMISSION_TRANSITIONS`, including: `DRAFT/REVIEWED → DISPATCHED`; `APPROVED → DISPATCHED` (an attempt must come first); `DISPATCH_ATTEMPTED → RECEIPT_CONFIRMED`; `DISPATCHED → APPROVED`; `REJECTED → DISPATCHED` (a rejected document is superseded by a new version, never revived); `WITHDRAWN` and `SUPERSEDED` are terminal; a second dispatch under a different request id is refused.

## Typed instruments

`DOA`, `WRF`, `ITO`, `ARF`, `WRITTEN_SUBMISSION`, `WSIAT_NOA`, `WSIAT_FOLLOW_ON`, `OTHER`. `ITO`, `ARF` and written submissions must link claim, decision, objection and disputed issues; `WRF` must name a claim. The four WorkAid intake instruments are a different type family from the DOA (`AuthorizationType`) and never substitute for it.

## Authority prerequisites (PROPOSED for validation)

| Event | Requires |
|---|---|
| Approve (any kind) | WorkAid professional in the approval policy; live matter grant, acceptance, open matter; ARF also needs an attested ARF-readiness gate; NOA needs an attested NOA-readiness gate |
| Dispatch DOA | Professional authorization only (the DOA is how authority is established) |
| Dispatch WRF / ITO / ARF / written / NOA | Professional authorization **and** a live WSIB DOA (**decision D-17**: confirm with Domenic whether WSIB must first acknowledge the DOA; the contract only requires a live recorded DOA, and urgent objection preparation is unaffected because drafting is not dispatching) |

## Claim, decision, objection

- One member has many claims; one claim many decisions; one decision many issues; an objection has exactly one claim and decision and a subset of that decision's issues.
- ITO grouping is a **strategy with no default**: `PER_CLAIM`, `PER_DECISION_LETTER` or `PER_ISSUE`. Groups never span claims; the count never equals the letter count by formula (`[WA-T073]`). WSIB's per-claim requirement is a floor, not a recommendation of one grouping.
- Cross-employer disclosure: outbound claim references include only the target claim by default; another claim needs a known identical employer **and** a professional work-context validation; unknown employer fails closed (`[WA-T071]`, `[WA-T072]`). Which prior-claim numbers may appear on which form is decision D-12.

## Deadlines

`DeadlineObligation` never calculates a due date and never says "met". A professional confirms a date with: source document, a rule source from a registry (dated window, named reviewer), reasoning (≥ 20 characters), and — for mixed issue kinds or an exception window — an explicit manual affirmation. Letter date and received date are both kept. Confirmations are append-only. The confirmed date ends at local midnight in the matter's time zone; the viewer's zone is not an input (`[WA-ADV-12]`, tested across the 2026-11-01 DST change). A disposition requires a receipt-confirmed submission and records only that a professional addressed it.

The rule-source registry is **empty by design**: nothing in this harness states or approximates a limitation period.

## Urgent objection path

Drafting and preparing an ITO is never blocked by an incomplete referral (the exception path) or by missing new evidence (`[WA-T076]`); dispatching as WSIB representative still needs a live DOA. This keeps the "urgent objection preparation" track separate from "representation completeness" (WA-R4-03).

## Tribunal boundary

A `WSIAT_NOA` is a distinct submission kind. Approval needs `noaReady`, an attested gate that the final WSIB decision is attached and the worker signature/disclosure steps were human-reviewed (`[WA-T079]`). Nothing auto-files; later steps (Confirmation of Appeal / Hearing Ready Form — naming is in dispute between the pack and the Grok source register) are not modelled until Angelo validates the current process (WA-R2-08, WA-R5-06 stay `OPEN`).

## Not in this contract

Persistence, UI, any real dispatch, any connector, ARF packet content, WSIAT workflow, WSIB rule data.
