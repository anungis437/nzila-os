# 14 — Persona journey contracts

Status: v0.3 candidate. Synthetic only. Every journey is a deterministic test over one pure in-memory `World` (`tooling/workaid-prep/src/journey.ts`) that composes the v0.2 contracts. Nothing here is a built screen, route or database. All people, organizations, claim numbers and documents are fabricated.

**How to read a step id.** `A-nn` Domenic, `B-nn` Angelo, `C-nn` union representative, `D-nn` member, `X-nn` cross-persona. Each step is one asserted outcome recorded in `evidence/journey-trace.json` and listed row by row in [18](18_SLICE_C_TEST_REPORT.md). A step is credited only to the requirements, findings and matrix cases it lists.

## 0. The shared matter and the four views

| Persona | Projection | Source of the view | Denied by returning |
|---|---|---|---|
| Union representative | `unionView` | The union's own referral, its evaluation and approved union-visible milestones | `null` (indistinguishable from nothing) |
| Domenic (specialist) | `specialistView` | Only matters where he is assigned **and** holds a live matter grant | `null` |
| Angelo (principal) | `supervisorView` | The specialist organization's own matters; principal role only | `null` |
| Member | `memberView` | The member's own matter, in the member's own organization, published statuses only | `null` |

Every view is built by explicit field copy. None returns a raw record, a claim list, a decision list, a submission or a task for the member and union views (D-02, D-23 assert the key set).

**Authority separation used throughout:** a view grant, a professional acceptance of representation, a signed DOA/retainer authorization and a WSIB authorization are four different records. No journey step lets one stand in for another (A-05, X-25).

**Task-of-record stays unresolved.** Journeys run with `taskOfRecord = UNRESOLVED` unless a step states otherwise. Under it no reminder is scheduled and none is delivered (A-14). Steps that set `UNION_EYES` or `CLIO` do so as a *fixture* to show the behaviour under each value (A-29–A-31, X-30–X-32); they are not a proposal.

## 1. Journey A — Domenic / WorkAid specialist

Goal: take a referral from union submission to an ARO wait without retyping the member or claim.

| Stage | What the journey proves | Steps |
|---|---|---|
| Referral | An incomplete packet is refused unless an urgent exception is granted; the specialist asks for clarification about claim history | A-01, A-02, A-03 |
| Representation | A specialist cannot accept representation (policy reserves it); a WRF cannot be created from a view grant alone | A-04, A-05 |
| Multiple claims | An objection on the wrong claim is refused; the right claim/decision/issue combination is accepted; replay is idempotent; an outbound ITO may reference only its own claim; grouping within a claim is a recorded professional choice | A-06 – A-10 |
| Dispatch | Attempt, then confirmation with a transmission reference; neither is receipt | A-11, A-12 |
| Contextual task | The task carries member label, claim number, document kind and version; nothing is re-entered | A-13 |
| Reminders | With task-of-record unresolved: nothing delivered even after years. Under `UNION_EYES`: none before 09:00 local on the due date and exactly one after, however many workers run. Under `CLIO`: Union Eyes sends nothing | A-14, A-29 – A-31 |
| Receipt | A provider-style method is refused; a phone call with a named contact is accepted; the filing view stays `UNDETERMINED` | A-15 – A-17 |
| Filing determination | One unattested element refuses; every element attested with evidence passes; the status is "professionally determined valid", never "filed" | A-18, A-19 |
| Evidence gathering | A medical report is requested from the member as an information request | A-20 |
| Waiting | A partner-reported "4–6 weeks" is recorded as an expectation, `legalDeadline: false`; the queue changes after the window passes but nothing is claimed overdue by law | A-21, A-22, A-27, A-28 |
| ARF | Approval is refused until readiness is attested; "appeal sent" cannot be published from an attempt, only from confirmed dispatch | A-23 – A-26 |
| Isolation | An unassigned specialist sees nothing, cannot open or classify documents | A-32 – A-34 |

Not demonstrated: any WSIB form content, any actual transmission, Clio behaviour, accessibility, load.

## 2. Journey B — Angelo / professional supervisor

| Stage | What the journey proves | Steps |
|---|---|---|
| Supervision | Only a principal gets the supervision view; a specialist gets `NULL_VIEW` | B-01, B-02 |
| Acceptance | A specialist cannot accept representation (`FORBIDDEN_ACTOR`); the principal can | B-03, B-04 |
| Holds | A specialist can place a restriction hold but cannot lift it; the principal sees it and lifts it with a reason | B-05 – B-08 |
| Access boundary | The principal cannot release a document without being assigned and granted access; once granted, release to the member works, and the member can open it | B-09 – B-11 |
| Medical to the union | Releasing a medical document to the union is refused even for the principal | B-12 |
| Reassignment | A specialist cannot reassign a receipt task; the principal cannot assign to someone with no matter access; with access, reassignment succeeds | B-13, B-14, B-14b |
| Uncertain deadlines | A mixed-issue deadline needs manual affirmation, a source document, a reviewed rule source and reasoning; an unknown rule source is refused; the supervisor sees the uncertain list change as it is resolved | B-15 – B-20 |
| Adverse ARO | An adverse outcome opens a prompt for professional assessment; a tribunal notice cannot be prepared before an assessment of "proceeding"; a specialist cannot assess; a forged assessor identity is refused; the principal's recorded assessment unlocks *preparation only*; approval still needs the attested readiness gate | B-21 – B-28 |
| Overrides | An approval request that asserts a different approver is refused; a union representative cannot approve or reassign | B-29 – B-31 |
| Closure | A specialist cannot close the matter; the principal can; professional action after closure is denied | B-32 – B-34 |

**Tribunal boundary.** The contract records a professional's assessment and nothing else. It states no time limit (`timeLimit: null`), computes no deadline, does not say whether a notice is in time, and never files. The deadline question for WSIAT is an open professional decision (D-06, D-23).

## 3. Journey C — Union representative

| Stage | What the journey proves | Steps |
|---|---|---|
| Duplicates | Re-registering the same name and birth year in the same union flags a possible duplicate; referring it is refused; a referral representative cannot resolve it; the administrator can; a superseded record cannot be referred; another union is unaffected | C-01 – C-06 |
| Create and correct | An incomplete packet is held; the union view lists *every* missing item and who supplies it; a returned referral shows why | C-07 – C-10 |
| Outstanding obligations | The union sees the information requests addressed to it and nothing about requests addressed to the member | C-08 |
| Milestones | Before anything is marked union-visible the list is empty; an approved milestone appears with only stage, text and version; withdrawal removes it | C-15 – C-17 |
| Denials | A union representative cannot open a medical document, release one, classify a document, or publish a status; a read-only role cannot withdraw a referral | C-11 – C-14, C-22 |
| Uploads | An instruction-like filename and spoofed class are neutralized and the upload is quarantined | C-18 |
| Other unions | Another union cannot read, update or upload to this union's referral | C-19 – C-21 |

## 4. Journey D — Member

| Stage | What the journey proves | Steps |
|---|---|---|
| Nothing published | The member sees a neutral view with no claims, decisions, submissions or tasks | D-01, D-02 |
| Supplying information | Sees a request; another member cannot supply it; uploads; marks supplied; cannot open their own upload before any release | D-03 – D-08 |
| Three states kept apart | **Submitted document** ("sent") · **pending WSIB action** ("receipt confirmed") · **actual decision** ("a decision arrived; your specialist will explain"). Wording that claims WSIB received what was only sent, that the objection was filed, or that states the outcome is refused; stages that the evidence does not support are refused | D-09 – D-19 |
| Restricted records | A guessed id of a restricted medical document returns not found; another member gets the same; the member can request full-record access through a separate channel | D-20 – D-25 |
| Released correspondence | Appears in the member's document list only after release | D-26, D-27 |
| French and English | Where policy requires French an English-only publication is refused; French that overstates progress is refused; with both, the member sees the requested language; the English fallback is labelled | D-28 – D-32 |

**French/English.** The contract defines *text pairs and refusal rules*. French text is recorded `UNREVIEWED` (the system claims nothing about translation quality). No translation, readability, screen-reader or small-screen testing has been run (matrix cases WA-T063–T065 remain blocked). Approved plain-language content is decision D-20.

## 5. Requirements each journey leans on

Computed from the `req` fields of the steps in `evidence/journey-trace.json` (journey = step-id prefix):

| Journey | Steps | Requirements listed by at least one step |
|---|---:|---|
| A (Domenic) | 34 | WA-REQ-002, 006, 007, 008, 010, 013, 020, 022, 023, 024, 031, 032, 033, 040, 041, 043, 044, 053, 063, 100 |
| B (Angelo) | 35 | WA-REQ-008, 010, 012, 033, 045, 050, 052, 061, 062, 090, 091 |
| C (Union) | 22 | WA-REQ-002, 004, 006, 007, 013, 060, 061, 063, 110 |
| D (Member) | 32 | WA-REQ-013, 032, 053, 060, 061, 063, 090, 111, 112 |
| X (Cross-persona) | 60 | WA-REQ-006, 007, 008, 010, 011, 012, 013, 015, 024, 032, 040, 044, 045, 050, 053, 061, 062, 063, 064, 065, 071, 090, 100 |

The generated mapping with counts is [02](02_REQUIREMENTS_TRACEABILITY.md). This table is derived and can drift; the trace file is authoritative.

## 6. What the journeys do not show

- No persistence, API, UI, notification channel or Clio connector exists. Reminders are rows in an outbox that is read by the test.
- Revocation and session handling are modelled as authorization epochs; the real session and signed-link behaviour is the platform's and is unproven (routed to Codex in [13](13_INTEGRATION_HANDOFF_CONTRACT.md)).
- Journeys use one claim graph per scenario. Cross-employer disclosure is tested through work-context validation (X-08 – X-10), not through real employer data.
- No journey passes if a professional decision is wrong; the decisions are in [11](11_WORKAID_VALIDATION_DECISIONS.md).
