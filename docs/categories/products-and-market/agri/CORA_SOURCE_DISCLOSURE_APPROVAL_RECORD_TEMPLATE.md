# Cora Source-Disclosure Conditional Decision Record

**Decision status:** `APPROVE_WITH_CONDITIONS`  
**Recorded:** 2026-10-07  
**Candidate status:** `PROPOSED_NOT_ACTIVE`  
**Activation authorization:** `NOT_GRANTED`  
**Signature/attestation:** unset

This record captures the explicit human direction supplied in the current
conversation. The instruction did not establish the requester's legal name,
institutional role, delegation or quorum; this record does not claim those
facts or fabricate source-owner, privacy or legal concurrence. It is a
conditional product/institutional direction, not runtime authorization, a
signature or an instruction to activate anything. Blank fields are unresolved,
not waived.

Canonical proposal:
[authorization packet](CORA_SOURCE_DISCLOSURE_AUTHORIZATION_PACKET.md),
sections 3-7; see the
[condition ledger](CORA_SOURCE_DISCLOSURE_CONDITION_LEDGER.md). The runtime
policy registry remains empty.

## 1. Decision identity and binding

| Field                                                  | Human-entered record                                                                                                       |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| Decision ID                                            | UNSET -- assign a unique institutional decision reference                                                                  |
| Record version and date                                | UNSET                                                                                                                      |
| Recorded decision status                               | `APPROVE_WITH_CONDITIONS` -- explicit human direction; authority mandate not verified                                      |
| Policy candidate ID                                    | `cora-farmer360-agrimo-producer-status-same-org-viewer`                                                                    |
| Policy candidate version                               | `1.0.0`                                                                                                                    |
| Candidate artifact reference and content hash/revision | UNSET -- bind the exact reviewed scope, matrix and draft, including its worktree revision                                  |
| Decision                                               | `APPROVE_WITH_CONDITIONS` -- narrow direction only; C1-C9 must close before activation                                     |
| Decision rationale                                     | Narrow same-organization, purpose-bound, read-only status disclosure direction; no blanket Agrimo-to-Cora grant            |
| Approval evidence reference                            | Current conversation's explicit human instruction dated 2026-10-07; durable institutional evidence/signature remains UNSET |
| Governing authority reference                          | Current conversation instruction; legal identity, institutional role and delegated mandate remain UNSET                    |
| Decision recorded date                                 | `2026-10-07` -- record date only, not an effective date                                                                    |
| Effective date (ISO-8601 UTC)                          | UNSET -- no runtime policy effective date authorized                                                                       |
| Expiry date (ISO-8601 UTC)                             | UNSET -- finite expiry required before any later policy activation                                                         |
| Review date and cadence                                | UNSET -- no later than expiry; include material-change triggers                                                            |
| Accountable policy owner and deputy                    | UNSET -- role, identity, appointment evidence and contact                                                                  |

## 2. Authority and required concurrence

Team aliases route review; they are not proof of authority to bind an
institution. See packet section 7. Record any required quorum/decision-body
rules and their source; do not borrow IP/equity thresholds.

| Responsibility                                     | Institution and accountable human/role | Authority basis / delegation evidence | Concurrence or rejection | Evidence reference / date |
| -------------------------------------------------- | -------------------------------------- | ------------------------------------- | ------------------------ | ------------------------- |
| Source institution/controller and data owner       | UNSET                                  | UNSET                                 | UNSET                    | UNSET                     |
| Agrimo source/product representative               | UNSET                                  | UNSET                                 | UNSET                    | UNSET                     |
| Cora product/Surface Owner                         | UNSET                                  | UNSET                                 | UNSET                    | UNSET                     |
| Privacy Lead/DPO and legal authority               | UNSET                                  | UNSET                                 | UNSET                    | UNSET                     |
| Security Lead (applicable control/risk assessment) | UNSET                                  | UNSET                                 | UNSET                    | UNSET                     |
| Institutional delegated disclosure approver / body | UNSET                                  | UNSET                                 | UNSET                    | UNSET                     |

If a concurrence is not applicable, the accountable authority must record the
reason and basis. Technical ownership alone cannot approve disclosure.

## 3. Approved scope and conditions

Record an explicit disposition for every unresolved question and matrix row
in the packet. No unresolved field is implicitly approved.

| Field                                                                     | Human-entered decision / evidence                                                                                                       |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Source system/domain/entity/field/authority and schema coverage           | UNSET -- proposed exact tuple in packet section 3                                                                                       |
| Allowed status values and privacy classification of linked IDs/status     | UNSET -- approve all submitted enum values or specify enforceable narrower scope                                                        |
| Destination, surface, action and section                                  | UNSET -- proposed Cora Farmer 360 read/evidence-confidence only                                                                         |
| Recipient organizations, same-org relationship, role allowlist            | UNSET -- proposed canonical-viewer-only; verify exact canonical role eligibility, not Cora fallback mapping; no cross-org authorization |
| Required permission, active identity binding and membership               | UNSET -- canonical `cora:farmer360:read`; no implied write grant                                                                        |
| Approved purpose token and human purpose statement                        | UNSET -- proposed `farmer360.operational-read`                                                                                          |
| Source-subject linkage and provenance requirements                        | UNSET -- exact source IDs/org/class/time; no inferred identity                                                                          |
| Controller(s), jurisdiction, lawful/privacy basis and assessment evidence | UNSET                                                                                                                                   |
| Consent required/exempt determination and evidence                        | UNSET -- if required, specify refusal, withdrawal, expiry and evaluation mechanism                                                      |
| Freshness/age cutoff and stale/unknown/suspended eligibility              | UNSET -- current 90-day label is not a cutoff                                                                                           |
| Historical-data boundary                                                  | UNSET -- proposed exclusion of status history                                                                                           |
| API/UI exposure and identifier minimization                               | UNSET -- include internal full-row read and response metadata review                                                                    |
| Cache rules, no-store/invalidation controls and verification              | UNSET                                                                                                                                   |
| Status and audit retention, deletion, legal holds and rights              | UNSET -- reconcile actor-bearing audit/log retention doctrine                                                                           |
| Source correction and propagation requirements/SLA                        | UNSET                                                                                                                                   |
| Export and onward disclosure                                              | UNSET -- proposed prohibited; no approval by omission                                                                                   |
| Audit requirements, access controls, retention and review owner           | UNSET                                                                                                                                   |
| Conditions / prohibited uses                                              | UNSET -- explicit exhaustive conditions; retain section 3 exclusions                                                                    |
| Policy review cadence, schema/use/legal-change triggers                   | UNSET                                                                                                                                   |

For each condition:

| Condition ID | Required control / prohibited use | Accountable owner | Due date | Acceptance evidence | Human verification / disposition |
| ------------ | --------------------------------- | ----------------- | -------- | ------------------- | -------------------------------- |
| UNSET        | UNSET                             | UNSET             | UNSET    | UNSET               | UNSET                            |

The runtime schema does not enforce all proposed conditions. An
`APPROVE_WITH_CONDITIONS` decision must list separate implementation and
verification prerequisites; it is not authorization to bypass them.

## 4. Revocation and audit

| Field                                                                    | Human-entered record                                                                                                                                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authority allowed to suspend/revoke, and mandate                         | UNSET                                                                                                                                                                         |
| Suspension/revocation triggers and emergency contact                     | UNSET                                                                                                                                                                         |
| Mechanism / execution custodian                                          | UNSET -- later governed registry removal or inactive/revoked state, with next-read withholding proof                                                                          |
| Maximum enforcement delay and treatment of in-flight/cached responses    | UNSET -- no propagation SLA is implied by the existing evaluator                                                                                                              |
| Source correction, consent withdrawal and membership suspension handling | UNSET                                                                                                                                                                         |
| Revocation evidence and notification record                              | UNSET                                                                                                                                                                         |
| Required decision audit                                                  | Org, actor, binding/membership, purpose, source class, policy ID/version, result/reason, timestamp and correlation; durable hash chain; no status values or source record IDs |
| Audit failure behavior                                                   | Read must fail; no successful unaudited disclosure                                                                                                                            |
| Audit reader roles, review cadence, retention/disposal and legal holds   | UNSET -- approval required                                                                                                                                                    |
| Approval/rejection/conditional-decision evidence retention               | UNSET                                                                                                                                                                         |

## 5. Human signature / attestation metadata

| Field                                                        | Human-entered record            |
| ------------------------------------------------------------ | ------------------------------- |
| Approving authority's legal name, institution and role       | UNSET                           |
| Identity and delegated-authority verification reference      | UNSET                           |
| Signature/attestation method                                 | UNSET                           |
| Signature/attestation reference and verification evidence    | UNSET -- no simulated signature |
| Signed/attested timestamp and timezone                       | UNSET                           |
| Signed artifact content hash and immutable evidence location | UNSET                           |
| Decision-body minutes/quorum reference if applicable         | UNSET                           |
| Record custodian and change-history location                 | UNSET                           |

## 6. Activation boundary

- `REJECT`: retain withholding; no policy installation.
- Recorded `APPROVE_WITH_CONDITIONS`: retain withholding until every C1-C9
  condition is evidenced and a separate final authorization explicitly
  authorizes a later activation mission.
- `APPROVE`: record does not install a policy. A separate explicit
  authorization must name the approved exact candidate/version and completed
  prerequisites before a later implementation mission.
- Any scope expansion or material change returns to governance review.
- Do not change capability truth, resume authenticated HTTP acceptance, or
  deploy as part of recording the human decision.

Current condition closure is tracked in the
[condition ledger](CORA_SOURCE_DISCLOSURE_CONDITION_LEDGER.md). No executable
positive policy is created by this record.
