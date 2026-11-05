# WorkAid × Union Eyes — Product specification v0.2

**Status:** DESIGN IN PROGRESS. `DESIGN_READY` = NO. Supersedes v0.1 where stated; v0.1 (`baseline-pack-v0.1/WORKAID_PRODUCT_SPEC_v0.1.md`) remains the base text for everything not amended here.
**Baseline:** `anungis437/nzila-os` `main` `38a824918cf2e7d7cfb7fcb0e796cbde45433be8`.
**Read with:** [02 requirements](02_REQUIREMENTS_TRACEABILITY.md) (normative requirement list, WA-REQ-001…), [03 domain](03_DOMAIN_MODEL_AND_STATES.md), [04 authority](04_AUTHORITY_AND_DISCLOSURE_MATRIX.md), [11 decisions](11_WORKAID_VALIDATION_DECISIONS.md).

## 1. What changed from v0.1

### CORRECT

1. **Clio (§2, §9).** At the baseline there is no Clio connector. The integration ledger is `PROPOSED`; the pilot candidate is **Option B — split responsibility, provisional**: Clio is the professional file of record; Union Eyes coordinates referrals, controlled publication and, only if Domenic accepts a single queue, receipt follow-up. No connector, no automatic writeback. Task-of-record is **unresolved** (D-02). (WA-REQ-041, 070–072.)
2. **Three separate dimensions before any WSIB representative action (§4).** (a) technical access grant, (b) WorkAid professional acceptance, (c) a live WSIB DOA. Demo `ACCEPTED_VIEW` is none of (b) or (c). The four WorkAid intake forms are a different instrument family. (WA-REQ-010, 011.)
3. **Receipt states (§5).** Stored states are `DRAFT, REVIEWED, APPROVED, DISPATCHED, DELIVERY_ACK, RECEIPT_CONFIRMED, REJECTED, WITHDRAWN, SUPERSEDED`. v0.1's `RECEIPT_UNCONFIRMED` is derived. `DELIVERY_ACK` is system-only and never confirms receipt. (WA-REQ-031, 032.)
4. **Deadline engine (§8, §9).** The grievance deadline engine is out of bounds for WSIB obligations. WorkAid uses `DeadlineObligation` (human-confirmed, append-only, never "met") and `ReceiptFollowUpTask`. (WA-REQ-046, 050–052.)
5. **Tribunal naming (§6 J4, §5).** The pack's "Confirmation of Appeal" and the Grok source register's "Hearing Ready Form" disagree; neither is frozen. Angelo confirms the current process before any UI string ships (D-06).
6. **Permissions order (§7).** Added: CI detectors for server actions must parse both `'use server'` and `"use server"`; detection gaps are security defects (platform item, WA-REQ-080).
7. **Proof vocabulary (§2).** `PROVEN_RUNTIME` only with staging attestation. In addition, evidence rows carry a *proof level*: `SYNTHETIC_CONTRACT` (isolated pure contract), `SYNTHETIC_REPRO_OF_PLATFORM_DEFECT`, or `NONE`. Neither of the first two is runtime proof.
8. **Counts.** The Grok R3 split is 8 P0 / 15 P1 / 3 P2 (26); the verdict footer's 8/14/4 is incorrect. 91 source finding entries are not 91 defects (23 overlap groups).

### ADD

1. **Signed-URL policy.** Download URLs minted only after fresh authorization, TTL ≤ 60 minutes, never a year-long presign; irrevocability of prior downloads is stated to users. (WA-REQ-081, platform.)
2. **Revocation cascade.** Revoking an authorization instrument revokes dependent grants atomically with the audit write, advances a revocation epoch, cancels the affected user's reminders, requests *scoped* session invalidation, and returns undispatched approvals for re-review. Revoking a WSIB DOA does not revoke technical grants. (WA-REQ-015, 083.)
3. **Multi-organization specialist rule.** One active institutional context per session; specialist organization is a separate claim; queues and searches filter on both. (Contract-level; runtime T089 blocked.)
4. **Notification content contract.** Generic text by kind, opaque deep link that re-authorizes, no title or health content; previews discarded for sensitive classes. (WA-REQ-064.)
5. **Opaque storage.** Object keys and metadata carry no human-readable names; metadata keys are allow-listed. (WA-REQ-081, platform.)
6. **Search authorization.** Authorize before matching titles. (WA-REQ-082, platform.)
7. **Referral lifecycle.** `CLARIFICATION_REQUESTED`, `RETURNED_FOR_CORRECTION`, `ACCEPTED`, `DECLINED`, `WITHDRAWN`; a pending urgent review survives a return and blocks withdraw/decline until dispositioned. (WA-REQ-007.)
8. **Claim graph rules.** Letter identity by content hash; same letter under another claim is held for review; objections are idempotent per request id; an overlapping active objection needs a human. (WA-REQ-021, 022.)
9. **Cross-employer disclosure.** Only the target claim number appears by default; same-employer references need a professional validation; unknown employer fails closed. (WA-REQ-024.)
10. **Reminder reliability.** Idempotency per owner epoch, recipient snapshot **plus** supersession and delivery-time re-validation, worker lease, visible dead-letter. (WA-REQ-044.)
11. **Untrusted uploads.** Quarantine by default; filename, declared type and declared class are data, never instruction or classification. (WA-REQ-060.)
12. **Deny-by-default member publication.** No publication, no member content; stage requires matching evidence; drafts never create milestones; the records-access channel is always shown. (WA-REQ-063.)

### DELETE

1. Any wording implying a Clio integration, "pilot ready", or composite readiness scores (WA-R6-09).
2. Any use of "one ITO per denial letter" as a rule (it is a WorkAid preference; see D-05).

### UNRESOLVED (owner decision required; nothing assumed)

D-01 … D-18 in [11](11_WORKAID_VALIDATION_DECISIONS.md).

## 2. Boundaries (unchanged in spirit, restated)

- **Union Eyes:** institutional coordination, referrals, continuity, permission-controlled collaboration, accountability.
- **WorkAid:** professional representation, advice, decisions, evidence assessment, professional responsibility.
- **Clio:** WorkAid's professional case and record management.
- **WSIB / WSIAT:** external authorities and sources of procedural events.
- The system never files, never certifies a deadline, never gives legal advice, never accepts representation on a professional's behalf.

## 3. Evidence statement

The domain contracts in `tooling/workaid-prep/` are pure and synthetic-only. Their tests prove that the contracts behave as specified against fabricated data. They do not prove deployed behaviour, tenant isolation, identity, delivery, accessibility or legal correctness. Counts and per-case status are in [08](08_SYNTHETIC_TEST_REPORT.md) and the v0.2 matrix (`data/WORKAID_ACCEPTANCE_MATRIX_v0.2.csv`).

## 4. Completion forms (unchanged definitions, current values)

`DESIGN_COMPLETE`: not met (open P0/P1 findings; unresolved consequential decisions). `IMPLEMENTATION_COMPLETE`: not met. `PILOT_READY`: not met.
