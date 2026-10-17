# Cora Workflow UX Truth and Authority Guide

## Non-negotiable wording

**Cora can interpret; authorized institutions determine.**

A source provider, issuer, Cora processor, requirement owner and recipient
decision authority are separate actors. No generic "verified by Cora"
treatment substitutes for those identities.

| Canonical technical state | Operator meaning                                                       | Must not imply                                                              |
| ------------------------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `MATCHED`                 | Evidence meets the technical requirements checked by Cora.             | Certification, eligibility, funding, procurement or institutional approval. |
| `PARTIAL`                 | Some required evidence is available; additional information is needed. | Full sufficiency or acceptance.                                             |
| `UNKNOWN`                 | Cora cannot establish whether the requirement is met.                  | A guessed result or hidden success.                                         |
| `CONFLICT`                | Source assertions disagree; no winner selected.                        | Cora deciding which issuer is correct.                                      |
| `EXPIRED`                 | Evidence or authorization is outside its stated validity period.       | An earlier lawful result being erased or newly actionable.                  |
| `NOT_AUTHORIZED`          | Cora lacks permission for this use.                                    | Evidence disclosure through a historical-view loophole.                     |
| `NOT_SATISFIED`           | Evidence does not meet this recipient's technical requirement.         | A disposition owned by the recipient.                                       |

Historical technical matches use past tense and an explicit non-current,
non-approval warning. Canonical states and audit references remain available
in support details; they do not replace the main explanation.

## Currentness and permissions

- `NOT_VERIFIED` is visible uncertainty, not implicit currentness.
- `CURRENT` is timestamp-backed and bounded to that verification time.
- Stale evidence remains stale; offline/history does not refresh it.
- Source and recipient rights intersect for each displayed action.
- Disclosure does not imply persistence, transformation, export or restore.
- The earlier applicable source/recipient expiry is shown; raw vectors are
  available only in a closed technical disclosure.
- Revoked/superseded records remain historical where separately view-authorized.
  They carry no permission for new use or reuse.
- Bounded denial exposes no evidence, issuer, requirement or workflow detail.

## Conflict, decisions and reuse

Conflict shows both evidence/version references, providers, issuers and claim
values. Named issuers must correct or clarify their assertions; the
recipient's authorized review process determines how to proceed. Cora has
not selected a winner.

The Decision section separates the technical check from the recipient-owned
external reference. Recording a reference is not interpreting its outcome.
One recipient's disposition never determines another recipient's decision.

Qualified reuse is stated as governed use from an earlier context, with the
origin, consuming context and reconstruction/retrieval evidence. It is not
automatic institutional acceptance. Reconstruction and other pseudo-reuse
attempts are explicitly not qualified reuse; rejection reasons remain visible.
Raw reuse/friction metrics are support details, not marketing KPIs or
measured productivity.

## Accessibility and comprehension

The reference uses semantic headings, labeled states, definition lists and
native `details`/`summary` controls. Text carries state meaning independently
of color. Links and disclosures have visible focus outlines. Long reference
identifiers wrap rather than forcing horizontal scrolling.

Browser keyboard/layout checks are bounded reference checks, not a
screen-reader audit or accessibility certification. No human comprehension
results have been collected.

### Next milestone: bounded synthetic comprehension validation

Pause architectural expansion. Use the local synthetic reference with an
operator, adviser, certifier/program participant and institutional recipient.
No real files, source accounts, invitations, grants or provider access are
authorized by this document. Planning the exercise does not authorize
outreach or select a live second consumer.

Ask each participant to identify, without coaching:

1. What evidence is present and who issued it?
2. What Cora knows versus cannot establish.
3. Which institution owns the requirement and which criteria are missing.
4. Why a technical match is not institutional approval.
5. Who makes the decision and what an external reference does not prove.
6. Where qualified reuse occurred and why reconstruction does not qualify.
7. What revocation/supersession changed, and what remains historical.
8. Whether currentness and permission for keep/export/restore are established.

Record correct, incorrect and uncertain answers per scenario and role, plus
confusions and facilitator prompts. Any confusion between technical match and
approval, historical and current permission, or disclosure and retention
should block broader rollout until wording is corrected and rechecked.
Do not report readiness or productivity from synthetic action counts.

See [the view contract](CORA_OPERATOR_WORKFLOW_VIEW_CONTRACT.md)
and [Slice 8 proof](CORA_OPERATOR_WORKFLOW_UX_SLICE_8.md).
