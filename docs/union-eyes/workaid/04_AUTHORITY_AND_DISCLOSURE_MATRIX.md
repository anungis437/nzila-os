# 04 — Authority and disclosure matrix

Five independent rights. Holding one never implies another. All are evaluated server-side from a principal resolved from the session; nothing is taken from request bodies, headers or "last selected organization".

| Right | Question it answers | Record | Evaluated by |
|---|---|---|---|
| Technical matter access | May this user see this matter in this system? | `MatterAccessGrant` (live: `ACTIVE`, not revoked, not expired, user + organization + matter match) | `authorizeSpecialistMatterAccess` |
| Professional acceptance | Has WorkAid agreed to act for this member on this matter? | `Matter.acceptance` (`acceptedBy`, `at`) | `authorizeProfessionalAction` |
| WSIB representative authority | May WorkAid act before WSIB for this member? | `RepresentationAuthorization` of type `WSIB_DOA`, live | `authorizeProfessionalAction('WSIB_REPRESENTATIVE_ACTION')` |
| Document disclosure | May this audience see this document, and do what? | `DocumentDisclosureGrant` (+ no `restrictionHold`) | `authorizeDocumentAccess` |
| Member publication | What has WorkAid chosen to tell the member? | `MemberPublication` | `memberStatusView` |

## Evaluation order (document read)

authenticate session → resolve one scoped membership → role surface → organization / member relationship → matter assignment (specialists) → matter grant → document class prohibition for the audience → professional hold → document disclosure grant (live, per action) → redact response → audit. Any missing or contradictory step denies. Every denial that could reveal existence is `NOT_FOUND`.

## Action × role

`✔` = permitted by the contract; `—` = refused. "Policy" = a role list supplied by an explicit policy object because the decision is open (see [11](11_WORKAID_VALIDATION_DECISIONS.md)).

| Action | Union referral rep | Union viewer | Union admin | Member | WorkAid specialist | WorkAid principal | UE platform ops |
|---|---|---|---|---|---|---|---|
| Update packet / offer referral | ✔ (own union) | — | ✔ | — | — | — | — |
| Answer clarification / withdraw | ✔ (withdraw blocked while an urgent review is pending) | — | ✔ | — | — | — | — |
| Grant urgent exception | — | — | — | — | Policy (D-04) | Policy (D-04) | — |
| Clarify / return referral | — | — | — | — | ✔ | ✔ | — |
| Accept representation | — | — | — | — | Policy (D-13) | Policy (D-13) | — |
| Decline referral | — | — | — | — | ✔ (explicit urgent-review disposition required if pending) | ✔ | — |
| Place professional hold | — | — | — | — | ✔ | ✔ | — |
| Lift professional hold | — | — | — | — | Policy (D-03) | Policy (D-03) | — |
| Release a document to an audience | — | — | — | — | Policy (D-03) | Policy (D-03) | — |
| Review / approve submission | — | — | — | — | ✔ approve if in approval policy + live authorization | ✔ | — |
| Dispatch submission (manual record) | — | — | — | — | ✔ (WSIB representative authority required except for the DOA itself) | ✔ | — |
| Acknowledge delivery | — | — | — | — | — | — | provider component only |
| Confirm WSIB receipt | — | — | — | — | ✔ with method + evidence | ✔ | — |
| Confirm a deadline | — | — | — | — | ✔ with source, reasoning, rule source | ✔ | — |
| Validate same-employer claim reference | — | — | — | — | ✔ | ✔ | — |
| Reassign a task | — | — | — | — | — | ✔ | — |
| Publish member status | — | — | — | — | ✔ with matching evidence | ✔ | — |
| Revoke an authorization | — | — | ✔ (own union) | — | ✔ | ✔ | — |

## Disclosure by data class

| Class | Member | Union | Specialist (assigned) | Notes |
|---|---|---|---|---|
| `QUARANTINED` | never | never | via grant | Default for every upload; cleared only by human classification |
| `RESTRICTED_PROFESSIONAL` | only after professional release and no hold | **never** | via matter + document grants | Privileged strategy, professional notes |
| `MEDICAL` | after release, no hold | **never** | via grants | No inference about a member's wellbeing is used as a release rule |
| `IDENTITY` | after release | **never** | via grants | Government photo ID is never copied to an institutional dashboard |
| `WSIB_CORRESPONDENCE` | after release, no hold | with a live union grant, no hold | via grants | Union view requires the referring union |
| `APPROVED_STATUS` | via publication | via grant | via grants | |

A professional `restrictionHold` removes member and union access regardless of grants until a policy-named role lifts it with a reason.

## Notifications and projections

- Notification text is generic by kind; the deep link is opaque and re-authorizes on open. A professional-approved preview is used only for non-sensitive documents and only if it does not contain the document title (`[WA-T053]`, `[WA-ADV-14]`).
- The member view is built by explicit field copy; unknown properties on a publication never reach the member (`[WA-T049]`).
- When nothing is published the member sees "no update" and the lawful records-access channel, never a blanket denial (`[WA-T051]`).

## What is proved and what is not

Proved synthetically: every row above that cites a test in [08](08_SYNTHETIC_TEST_REPORT.md). Not proved: tenant isolation in the deployed system, session invalidation, search/export/preview/thumbnail/cache surfaces, identity-provider behaviour. Those remain with the platform owner and are `NOT_CLOSED` in the matrix.
