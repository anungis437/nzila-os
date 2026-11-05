# 15 — Cross-persona consistency

Status: v0.3 candidate. Synthetic only. The challenge tests are in `test/cross-persona.test.ts` (steps `X-nn`) and the persona journey files (`A-`, `B-`, `C-`, `D-`). Every statement below is backed by a step id; a statement without one is design intent and is labelled so.

## 1. Rule

One synthetic matter, four views. An event changes only the views it is permitted to change. A refusal changes nothing except one entry on the **actor's** organization trail. Nothing is derived from a status string; every projection is built from the same records and re-authorized.

## 2. Event → effect matrix (X-01 … X-05, executed)

The test snapshots all four views before and after each event and asserts exactly which ones changed.

| Event | Domenic | Angelo | Union | Member | Why |
|---|:-:|:-:|:-:|:-:|---|
| Dispatch confirmed (X-01) | changes | changes | — | — | Unconfirmed receipt becomes a professional work item; the other two are told nothing |
| Member-only status published (X-02) | — | — | — | changes | Publication is deny-by-default; union visibility is a separate flag |
| Union-visible status published (X-03) | — | — | changes | changes | Only an explicitly union-visible, non-withdrawn milestone appears |
| Receipt documented (X-04) | changes | changes | — | — | Nobody outside the professionals is told until a professional publishes it |
| Information request addressed to the union (X-05) | changes | — | changes | — | The member never sees a request addressed to the union |

## 3. Source of truth and ownership

| Fact | Owner | Everything else is |
|---|---|---|
| Referral packet, referral state, union-visible milestones | Union Eyes referral record (the union's) | A projection |
| Representation acceptance | A WorkAid professional named by policy (a fixture here) | Unavailable until recorded; a view grant, a WSIB authorization and an acceptance are different records |
| Documents, classification, holds, release | Union Eyes document store; classification and release by a professional | Denied by default |
| Submission state, receipt | Union Eyes submission record; receipt is recorded only by a human professional | A Clio "done" or "receipt confirmed" is a report, not a fact (X-30, X-31) |
| Filing validity | A professional's determination against a reviewed source | `UNDETERMINED` until then ([17](17_RECEIPT_VS_FILING_AUTHORITY.md)) |
| Task of record | **Unresolved** until Domenic rules (D-02) | Under `UNRESOLVED` tasks are non-authoritative and schedule no reminder |
| Deadline obligations | A human-confirmed record with source, rule version and reasoning | Never derived from grievance deadlines |
| Waiting expectations | Partner-reported, `legalDeadline: false` | Never a deadline |

**Option B stays provisional.** No journey assumes Clio is the task system of record, writes back to Clio, or reads from it except through `clioReport`, which only records a discrepancy.

## 4. Required challenges and where each is executed

| Challenge (mission §4) | Result | Steps |
|---|---|---|
| Multiple claims for one worker | Union and member views carry no claim number, employer or decision; professionals see the target claim only when preparing an outbound | X-06, X-07, X-08, D-23 |
| Historical claims, different employers | A work-context validation never overrides an employer mismatch; the historical claim is excluded from the outbound | X-08, X-09, X-10 |
| Duplicate worker identities and union relationships | Possible duplicates block referral; resolution needs the administrator; a superseded record cannot be referred; another union's identical name is unaffected | C-01 … C-06 |
| Revoked specialist authority | Access ends; document read becomes not found; queue empties; an approved-but-unsent submission cannot be dispatched; session invalidation is scoped to one user and one matter; the member's view is unchanged; revoking only the WSIB DOA is a different record and stops dispatch as representative | X-11 … X-19 |
| Incomplete urgent referrals | An urgent exception lets the referral through; the specialist and union see the same pending review; neither can withdraw or decline until it is dispositioned | X-20 … X-24, A-01 |
| Missing professional acceptance | A "representation accepted" status cannot be published with only a grant and a DOA; union and member views show no acceptance | X-25 … X-27, A-05, B-03, B-04 |
| Unconfirmed WSIB receipt | The supervisor lists it; "receipt confirmed" cannot be published; "appeal sent" cannot be published from an attempt | X-28, X-29, A-25, D-12 |
| Conflicting Clio and Union Eyes task information | Recorded as a reconciliation exception visible to the professionals; no writeback; an external "receipt confirmed" does not create a receipt | X-30 … X-32, A-31 |
| Withheld medical evidence | A restriction hold keeps the document from union and member, even by guessed id; only the principal lifts it; the notification does not reveal it; a professional cannot release it to the member while held | X-41 … X-46, B-05 … B-08, B-12, D-20 |
| Reassigned case responsibility | The old owner loses the task and access; the new owner needs an assigned matter and a live grant; the reminder moves with the task; nothing is delivered to the wrong person; member and union views do not change | X-35 … X-40, B-13, B-14, B-14b |
| Delayed ARO decisions | Seven months into the wait the specialist sees "waiting, no expectation configured" with `legalDeadline: false`; the supervisor sees no tribunal prompt and no obligation until a decision is recorded; the member sees no update and no invented decision date | X-47 … X-49, A-21, A-22, A-27, A-28 |
| Unknown or disputed filing deadlines | A disputed deadline is listed for the supervisor as uncertain; no persona shows any date or timer; it cannot be confirmed without a source, reviewed rule, reasoning and manual affirmation | X-33, B-15 … B-20 |
| Cross-tenant access attempts | Another union's attempts to publish a status, request information, grant matter access (administrator), revoke an authorization (administrator), upload, withdraw the referral and set a work context all return not found; its read of a document and views of this union's matter return nothing; a member of another union gets the same | X-50 … X-58, C-19 … C-21, D-21, D-22, D-25 |
| Member updates that would misrepresent progress | Wording claiming WSIB received what was only sent, that an objection was filed, or that states a decision's outcome is refused; stages the evidence does not support are refused; French is held to the same rule | D-09, D-13, D-16, D-17, D-29, X-25, X-29 |

## 5. Audit expectations

Asserted for every step, not sampled (X-59 for the whole matter):

1. Each **successful** operation appends exactly one audit event whose action the step names (for example `DOCUMENT_RELEASED`, `AUTHORIZATION_REVOKED`, `TRIBUNAL_ASSESSMENT_RECORDED`).
2. Each **refused** operation appends **nothing** to any matter or organization audit trail and the state is unchanged (`deepEqual` on the world's audit list).
3. A refusal is recorded once, on the **actor's** organization (`world.denied`), never on the target's: a cross-tenant probe must not write into the victim's trail or reveal that the object exists.
4. Details in an audit event are references and codes (document id, reason code), never filenames, claim numbers or medical text.
5. The audit trail of one matter worked by union, specialist, principal and system keeps each actor and organization distinct (X-59).

Not asserted: durability, tamper evidence, retention, export, or that a real audit sink receives these events.

## 6. Findings this challenges but does not close

WA-R1-02, R1-03, R1-04, R1-05, R1-06, R1-13, R1-14, R2-01, R2-03, R2-04, R3-004, R3-007, R3-008, R4-01, R4-06, R4-09, R5-02, R5-09, WA-C-001, WA-C-003. They remain `PARTIALLY_MITIGATED` at best, with `proofLevel: SYNTHETIC_CONTRACT`. Runtime isolation (RLS), search, export, previews and real sessions are untested.

## 7. Weaknesses I found in my own tests while building this

Recorded so Grok does not have to rediscover them:

- X-11 asserted `ALLOW` through a hard-coded value rather than a real read, and the document had never been granted to the specialist, so the later "not found after revocation" (X-14) would have passed even with no revocation. Both are fixed: the specialist now holds a live per-document grant tied to the matter grant, X-11 performs the real read, and X-14 therefore shows the revocation effect. A matching control step (A-33a) was added to the unassigned-specialist denial.
- X-37 originally contained a tautology and was replaced with a real assertion about a successor without a grant.
- Three expectations used the wrong refusal code (the more specific code was the correct one); the refusal itself was kept (E-31).
- The supervisor's `matterWithoutLiveSpecialist` list counts a principal holding a grant as a "live" holder. That is a design question (does a supervisor count as someone who can act?), not asserted either way.
