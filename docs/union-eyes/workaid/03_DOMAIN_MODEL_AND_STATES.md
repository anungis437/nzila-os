# 03 — Domain model and states

Independent concepts; no generic `caseId`. Every identifier is a distinct branded type in [`src/ids.ts`](../../../tooling/workaid-prep/src/ids.ts), so substituting one for another is a compile-time error. "Authority" means who may change the record. Status: **C** = contract implemented and tested in the isolated harness; **P** = proposed only.

| # | Concept | Owner (system of record) | Identifier | Cardinality | Lifecycle states | Authority to change | Status |
|---|---|---|---|---|---|---|---|
| 1 | Institutional organization | Union Eyes (platform) | `OrganizationId` | Union N ↔ specialist M via referral | not modelled | UE platform ops; union admin for its own users | C (id only) |
| 2 | Member / represented worker | Union (institutional record); member for own data | `MemberId` (internal, per organization) | 1 member record per organization context; the same person in two unions is two records | not modelled | Union; member for self-service data | C (id only) |
| 3 | Referral | Union Eyes | `ReferralId` | member 1..N; 1 offer per specialist | `DRAFT → AWAITING_REQUIRED_ITEMS ⇄ PACKET_COMPLETE_FOR_REVIEW → OFFERED ⇄ CLARIFICATION_REQUESTED`; `OFFERED/CLARIFICATION_REQUESTED → RETURNED_FOR_CORRECTION → (update) → OFFERED`; terminal `ACCEPTED`, `DECLINED`, `WITHDRAWN` | Union reps: update, offer, answer, withdraw. WorkAid professionals: clarify, return, accept (policy roles), decline | C `referral.ts` |
| 4 | Representation matter | WorkAid professional engagement boundary, coordinated in UE | `MatterId` | referral 0..1 → matter; matter 1 member | `OPEN → CLOSED` (+ acceptance fact) | WorkAid principal (open decision D-13) | C (fields on `Matter`) |
| 5 | WSIB claim | WSIB (external); recorded in UE and Clio | `ClaimId` (internal) + `WsibClaimNumber` (opaque string, leading zeros kept) | member 1..N; flags `historical`, `closed`; `employerKey` provenance | not modelled | WorkAid professional; union supplies at intake | C `claims.ts` |
| 6 | Decision | WSIB (letter) | `DecisionId`; identity of the letter = content hash | claim 1..N; letter bytes ↔ exactly one claim | outcome `DENIED/ALLOWED/PARTIAL/OTHER`; `letterDate` and `receivedDate` kept separately | WorkAid professional | C |
| 7 | Disputed issue | WSIB decision content | `IssueId` | decision 1..N | kind label only (never drives a timer) | WorkAid professional | C |
| 8 | Objection | WorkAid | `ObjectionId` | one claim, one decision, ≥1 issues of that decision; many objections per decision over time | `DRAFT → PREPARED → SUBMITTED → RESOLVED`, `WITHDRAWN`, `SUPERSEDED`; active = draft/prepared/submitted | WorkAid professional | C |
| 9 | Appeal (ARF/ARO; WSIAT) | WSIB / WSIAT | `AppealId` (type only) | per objection outcome; separate tribunal appeal | **P** — ARF readiness and NOA readiness are attested gates; no appeal entity | WorkAid professional; Angelo for WSIAT | P |
| 10 | Representation authorization (instrument) | Signed instruments; WSIB for the DOA | `RepresentationAuthorizationId`, typed `WSIB_DOA`, `WORKAID_CLIENT_INTAKE`, `WORKAID_RETAINER`, `MEDICAL_AUTHORIZATION`, `SHARE_INFORMATION_RELEASE` | member 0..N per type per matter | `PENDING → ACTIVE → REVOKED/EXPIRED` | WorkAid professional records; member/union revokes | C `authorization.ts`, `revocation.ts` |
| 11 | Document artifact | UE store for coordination copies; Clio for the professional file | `DocumentId` | matter 0..N | classes `QUARANTINED, RESTRICTED_PROFESSIONAL, MEDICAL, IDENTITY, WSIB_CORRESPONDENCE, APPROVED_STATUS`; optional professional `restrictionHold` | Classification and holds: WorkAid professionals only | C |
| 12 | Document disclosure grant | UE | `DisclosureGrantId` | document 0..N, per audience (member / union / specialist) | `ACTIVE → REVOKED/EXPIRED` | WorkAid release roles (policy, D-03) | C |
| 13 | Matter access grant (technical) | UE | `MatterGrantId` | specialist user ↔ matter; `sourceAuthorizationId` | `ACTIVE → REVOKED/EXPIRED` | UE on behalf of the union; revoked by cascade | C |
| 14 | Professional acceptance | WorkAid | embedded `{acceptedBy, at}` on referral and matter | 0..1 per matter | present / absent | Policy roles only | C (embedded). **Proposed:** first-class record with withdrawal |
| 15 | Task | UE **only if** task-of-record = `UNION_EYES` (D-02) | `TaskId`; key `receipt-followup:{submissionId}:v{n}` | exactly 1 per dispatched submission version | `OPEN → SNOOZED_WITH_REASON → IN_PROGRESS → RECEIPT_CONFIRMED`, `EXCEPTION_ESCALATED`, `CANCELLED_SUPERSEDED`, `CANCELLED_MATTER_CLOSED` | Owner (snooze, confirm date, escalate); principal (reassign); receipt only via confirmed submission | C `followup.ts` |
| 16 | Reminder | UE | `ReminderId`; key `reminder:{task}:e{ownerEpoch}:{offset}` | task 0..N | `SCHEDULED → DELIVERED_SINK` or `FAILED_RETRYABLE → DEAD_LETTER`, `CANCELLED_*` | System worker with lease | C |
| 17 | External dispatch (outbound submission) | WorkAid sends; UE records | `SubmissionId` (+ version) | matter 0..N; per kind DOA/WRF/ITO/ARF/written/NOA | `DRAFT → REVIEWED → APPROVED → DISPATCHED → DELIVERY_ACK → RECEIPT_CONFIRMED`; `REJECTED`, `WITHDRAWN`, `SUPERSEDED` | See [05](05_WSIB_WORKFLOW_CONTRACTS.md) | C `submission.ts` |
| 18 | Receipt confirmation | WSIB (external fact); a WorkAid human records it | embedded `ReceiptRecord` | 0..1 per submission version | recorded once | WorkAid professional only | C |
| 19 | External dependency | External authority | `DependencyId` | matter 0..N (claim file, ARF disposition, ARO decision, tribunal step) | waiting (within / past expected window) → received (completeness unassessed / assessed) | Owner (required) | C `dependency.ts` |
| 20 | Deadline obligation | WorkAid professional confirmation; rule source | `DeadlineObligation.id` | decision/issue 0..N | `UNCONFIRMED… → CONFIRMED_OPEN → CONFIRMED_DATE_PASSED… → PROFESSIONAL_DISPOSITION_RECORDED` (no "met") | WorkAid professional; append-only | C `deadlines.ts` |
| 21 | Member status publication | UE (projection) | `{matterId, version}` | matter 0..N versions | published → withdrawn | WorkAid professional with matching evidence | C `publication.ts` |
| 22 | Audit event | UE | `AuditEventId` | append-only | none | System | C `audit.ts` |

## Invariants proved by tests

- A claim number never relates or authorizes records (`[WA-T015]`, `[WA-T099]`).
- One decision letter belongs to exactly one claim; the same letter twice is one decision (`[WA-ADV-07]`).
- An objection's claim equals its decision's claim (`[WA-ADV-06]`).
- Submission transitions are exactly the allow-list (exhaustive 9×9 matrix test).
- Receipt is confirmed only by a human with evidence (`[WA-T041]`); provider acknowledgement never confirms it (`[WA-T040]`).
- A task completes only from a receipt of its own submission version (`[WA-T041]`).
- No status named "met" exists for a deadline (`[WA-T028]`).

## Kernel versus specialization

Primitives that other external specialists would reuse: referral lifecycle, grants and revocation, document classes and holds, publication, durable task/reminder semantics, audit. WorkAid/Ontario-specific content: form kinds (DOA, WRF, ITO, ARF, NOA), required intake forms, the Ontario calendar, human-confirmed WSIB obligations. In the harness the split is by file, not yet by an enforced configuration boundary (WA-R6-06 remains `OPEN`).
