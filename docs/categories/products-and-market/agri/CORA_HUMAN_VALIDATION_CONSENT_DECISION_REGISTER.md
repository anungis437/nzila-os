# Cora Round 1 Consent Decision Register

**Version:** `cora-round1-consent-decisions-1.0`
**Date:** 2026-10-10
**Status:** PREPARATION ONLY - NO CONSENT OR PRIVACY APPROVAL

This checklist accounts for every unresolved placeholder in the accepted
[consent/data-handling draft](CORA_HUMAN_VALIDATION_CONSENT_DATA_HANDLING_DRAFT.md),
including its quoted notice and optional quote wording. The draft is not
edited or finalized. The related
[outreach drafts](CORA_HUMAN_VALIDATION_OUTREACH_DRAFTS.md) must be finalized
consistently after decisions, not stripped of unresolved details.

## Status meanings

- `RESOLVED`: actual approved value, responsible approver, date, restricted
  record reference and applicable review evidence exist. A proposal is not resolution.
- `REQUIRES_AUBERT_DECISION`: operating choice/assignment is missing.
  Any associated review must also be completed before RESOLVED.
- `REQUIRES_PRIVACY_LEGAL_REVIEW`: qualified jurisdiction-specific handling
  review is missing; Aubert approval alone cannot resolve the legal conclusion.
- `NOT_APPLICABLE`: approved configuration excludes the item and reviewer
  agrees; record why and version. Proposed no-recording/no-quote choices
  do not yet make those rows NOT_APPLICABLE.

All actual values remain unselected. Where both decisions and review are
needed, the status shows the review blocker and the row identifies Aubert's
choice as well. No participant data or invented authorization goes here.

## Complete placeholder checklist

| ID  | Draft placeholder / decision covered                                                            | Decision linkage       | Current status                  | Evidence needed to close                                                                                                                             |
| --- | ----------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| C01 | Approved owner                                                                                  | D01                    | `REQUIRES_AUBERT_DECISION`      | Named accountable owner, accepted duties, escalation and availability.                                                                               |
| C02 | Contact method and approved contact/method in withdrawal notice                                 | D02, D03               | `REQUIRES_AUBERT_DECISION`      | Approved sender/reply route and usable rights-request route, tested without contacting participants.                                                 |
| C03 | Rights-request contact                                                                          | D03                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Named research/privacy contacts, responsibilities and approved complaint/request wording.                                                            |
| C04 | Privacy/legal determination and jurisdiction/lawful basis                                       | D04                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Actual locations/geography, stage-specific applicability/basis, qualified written review; no inference from consent.                                 |
| C05 | Specific local/organizational storage location                                                  | D05                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Aubert-approved exact stores/devices, ownership, access boundaries and processor/cross-border review.                                                |
| C06 | Encryption/access controls/backups                                                              | D05, D06, D11          | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Verified encryption, permissions, copy/sync/backup inventory and loss/restore procedure.                                                             |
| C07 | Named moderator/observer/analysts/adjudicator/privacy owner; approved access holders            | D06, D14-D16           | `REQUIRES_AUBERT_DECISION`      | Actual named assignments by store, confidentiality/conflict and independence checks; approved participant-facing access categories.                  |
| C08 | Contact-key exact duration and deletion event/date                                              | D07                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Aubert chooses justified exact endpoint and maximum duration, including declined/nonresponding contacts; responsible deletion owner.                 |
| C09 | Pseudonymous response/notes/export/review retention duration/event                              | D08                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Exact bounded durations and destinations by class, aligned withdrawal/audit treatment and reviewer approval.                                         |
| C10 | Recording retention, shortest justified duration and destruction event                          | D09, D08               | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Approved no-recording makes this NOT_APPLICABLE only when recorded; otherwise separately reviewed exact retention/opt-in and processor controls.     |
| C11 | Verified backup schedule and recoverability limits; deletion method and backup limits           | D11, D24               | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Actual copies, expiry windows, deletion method, restore suppression, accountable operator; truthful limits, no instant-purge claim.                  |
| C12 | Withdrawal cutoff: exact date/event before irreversible de-identification/aggregate publication | D10                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Exact approved cutoff and justification, accessible route and end-to-end linked-record handling.                                                     |
| C13 | Quote permission/publication scope; approved quote policy                                       | D12                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Aubert's explicit no-quote/no-public-release choice or separate approved opt-in scope and re-identification review.                                  |
| C14 | None or approved compensation arrangement                                                       | D13                    | `REQUIRES_AUBERT_DECISION`      | Explicit none or exact terms, withdrawal/partial-session treatment and reviewed fairness/payment privacy.                                            |
| C15 | Approved minimal notes/observations                                                             | D22, D23               | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Exact minimal data classes/purposes from data map, accommodation screening limits, approved notice.                                                  |
| C16 | Each optional recording choice separately, or statement that no recording occurs                | D09, D20               | `REQUIRES_AUBERT_DECISION`      | Explicit policy and consistent wording, device/configuration check; audio/video/screenshare distinct opt-ins if separately approved.                 |
| C17 | Data types and exact approved dates/events in participant notice                                | D07, D08, D23          | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Notice enumerates contact data, captures, notes, reviews and outputs with matching approved retention; no hidden additional store.                   |
| C18 | Irreversible de-identification or aggregate-publication event                                   | D10, D12               | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Specific approved event, what stays identifiable and which outputs can/cannot be changed. Internal use is not automatically irreversible.            |
| C19 | Approved details of inability to locate/remove contributions after cutoff                       | D10, D11, D24          | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Exact truthful limitations, residual identifiers/copies, backup expiry and post-cutoff request handling.                                             |
| C20 | Affirmative choice after finalized notice and questions answered                                | D23, D25               | `REQUIRES_AUBERT_DECISION`      | Approved consent-capture mechanics/version first; actual voluntary participant consent only in later authorized collection, never prefilled.         |
| C21 | Specific approved use in separate quote opt-in                                                  | D12                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Conditional approved audience/use and reviewed quotation, or evidenced NOT_APPLICABLE after explicit no-quote decision.                              |
| C22 | Approved remote platform/format and screenshare controls                                        | D20                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Local-only choice plus feasibility or separately approved platform/processor/geography/window-only remote mode; no hidden assistants.                |
| C23 | Employment power imbalance and voluntariness                                                    | D14, D17, D22          | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Approved exclusion/conflict procedure and decline/withdrawal wording; no coercion or employer endorsement.                                           |
| C24 | Accessibility accommodation data                                                                | D22                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Functional needs only, necessary access and retention, no medical details or disability-as-invalidity rule.                                          |
| C25 | Accidental sensitive disclosures                                                                | D24                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Stop/redact/escalate procedure, responsible privacy owner and no sensitive text in audit markers.                                                    |
| C26 | Cross-border services and rights requests                                                       | D02-D05, D20, D21, D24 | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Channel/device/scheduling/copy/processor inventory; applicable obligations and usable request procedure even without recording.                      |
| C27 | Redaction, deletion, withdrawal and physical-deletion evidence                                  | D24                    | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Store-level process tested with synthetic dummy records, review copies/exports/backups covered; limited audit evidence and truthful deletion claims. |
| C28 | Research purpose, notice/consent versions and intended findings use                             | D23, D25               | `REQUIRES_PRIVACY_LEGAL_REVIEW` | Final internally approved synthetic-comprehension purpose and materials, no broader use by assumption; separate scheduling/collection authority.     |

**Current counts:** RESOLVED 0; REQUIRES_AUBERT_DECISION 6;
REQUIRES_PRIVACY_LEGAL_REVIEW 22; NOT_APPLICABLE 0.
These are blocker classifications, not number of people to consult.
The accepted sample/design is resolved in principle, but is not a substitute
for resolving a consent placeholder.

## Outreach-material alignment checklist

| Draft section     | Placeholder coverage needed before approved use                                                                                                                                                            |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Invitation        | Approved personal greeting/recipient only after source approval; broad role and sender/reply route D02/D17/D18; approved information/notes/compensation C14-C16/C28. No greetings or names populated here. |
| Information sheet | Data/choices/access/retention/backups C06-C19; withdrawal/quote C12-C13/C18-C21; research/privacy contacts C02-C03.                                                                                        |
| Scheduling        | Final consent/info, actual approved times only after scheduling authority, accommodations C24, approved logistics/notes/recording C16/C22; D21/D25.                                                        |
| Reminder          | Actual confirmed time only after scheduling authority; contact/format/privacy C02/C16/C22; no reminder cadence selected.                                                                                   |
| Thank-you         | Withdrawal/cutoff/quote C12-C13/C18-C21, compensation C14 and sender C02; no scores or claimed validation outcome.                                                                                         |

No editing final participant language, routing referrals, sending consent
materials or accepting "interested" replies is authorized by this register.
Once decisions are actually made, finalize materials with approved wording,
version/pin those changes and record stage-specific authorization before use.
Keep the accepted draft as historical, not retroactively legally approved.

## Closure procedure

For each row, record ID, approved value or NOT_APPLICABLE reason, Aubert
decision reference, reviewer/reference where needed, date/version, responsible
operator, implementation checks, linked data stores, and unresolved conditions
in the restricted authorization record. Approved exact retention decisions
must be intelligible in the notice; an event alone cannot be an unbounded
"until useful" rule. Specify a maximum endpoint as well.

Outreach stays HOLD until applicable pre-outreach rows are closed.
Session-specific actual consent cannot be completed now: approve the mechanics
before outreach, obtain actual consent only after separate collection authority.
Any legal rejection or unresolved unsafe configuration produces outreach
NO-GO; collection remains NO-GO whenever required evidence is missing.
