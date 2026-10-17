# NzilaOS External Specialist Contract - Target

Checkpoint 2, 2026-10-12, design only. Inherits scoped commands, human authority,
audit/retention and failures from the
[operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md).
Internal accountability and prohibition of self-acceptance are `[Validated: user]`.
All target storage/state mechanics below are `[Design]`.

## Outcome and boundary

External humans, consultancies and external AI can provide bounded assistance
without acquiring institutional ownership, management decision, risk acceptance,
closure or deployment authority. Engagement metadata does not itself grant access.
No procurement product and no new engagement package.

## Source and contract

New bounded module in institutional-intelligence; durable scoped DB adapter uses
existing identity, policy, evidence and audit ports. Contract steward is the
institutional work steward with governance/identity review. Owners are governed
authenticated-human assignments, not hardcoded names.

```text
SpecialistEngagement {
  id, scope, title, purpose, missionRefs[], estateRefs[],
  specialistPrincipalRefs[], actorClassification: EXTERNAL_HUMAN | EXTERNAL_AI,
  internalSponsorAssignmentRef, technicalCounterpartAssignmentRef, backupRef?,
  approvedScope: { dataRefs[], fields[], actions[], environments[], constraints[] },
  permittedOutputKinds[], deliverableCriteria[], riskRegisterRefs[],
  authorityGrantRefs[], accessGrantRefs[], effectiveAt, expiresAt,
  status, version, approvalRefs[], source, createdBy, createdAt, updatedAt,
  suspensionReason?, revocationReason?, closeoutPlan, evidenceRefs[]
}
EngagementOutput {
  id, scope, engagementRef, producerPrincipalRef, producerClassification,
  kind, immutableContentRef, contentDigest, submittedAt, receivedAt,
  source, version, criteriaRef, uncertaintyStatement,
  disposition: SUBMITTED | QUARANTINED | ACCEPTED | REJECTED | UNPROVEN,
  acceptanceRefs[]
}
OutputAcceptance {
  outputRevisionRef, criteriaVersion, outcome, reason, evidenceRefs[],
  internalAcceptorId, assignmentRef, authorityRef, acceptedAt, auditReceiptRef
}
```

Reference and evidence visibility is source-preserving; accepted output is not
automatically usable in another scope. INTERNAL_HUMAN sponsor and technical
counterpart are mandatory. Backup is optional but effective coverage is explicit.
External AI requires a nonhuman identity, tool/data restrictions and attribution;
it cannot impersonate internal staff through a service principal.

## Lifecycle

| Transition | Authorized internal actor / guard |
| --- | --- |
| none -> DRAFT | Human engagement.create; purpose, sponsor/counterpart and scope required |
| DRAFT -> APPROVED | Independent internal approver, policy/criteria/risk limits/expiry/closeout plan complete |
| APPROVED -> ACTIVE | Internal activation authority; verified narrow grants issued and RECORDED proof, within effective interval |
| ACTIVE -> SUSPENDED | Internal sponsor or security authority; deterministic monitor may apply expired/revoked-grant suspension under narrow policy |
| SUSPENDED -> ACTIVE | Internal reactivation authority; cause resolved with evidence, fresh approvals/grants, still before expiry |
| APPROVED/ACTIVE/SUSPENDED -> EXPIRED | Clock/grant monitor applies half-open expiry; grants deny at expiry even if event delivery lags |
| ACTIVE/SUSPENDED/EXPIRED -> CLOSING | Internal closeout authority; normal execution revoked, preservation/disposition plan assigned |
| CLOSING -> CLOSED | Internal closer verifies deliverables/dispositions, access/credential revocation evidence, knowledge handoff and unresolved-risk ownership |
| DRAFT/APPROVED -> CLOSED | Internal cancellation/closure authority with reason; no fabricated accepted deliverables |
| Any nonterminal state -> REVOKED | Internal security/governance authority; immediate grant invalidation, reason and preserved output/history |

CLOSED and REVOKED are terminal for work/access. Cleanup after REVOKED uses
closeout events/receipts without restoring access or relabeling it as successfully
closed. Extension or broader scope requires internal amendment/independent
approval and new grants; expiresAt cannot be self-modified, and an EXPIRED record
does not reactivate. New engagement may reference predecessor after review.

Existing SAGE external-reviewer expiry/revocation is useful source-domain prior
art, but neither its reviewer role nor permission implies generic engagement
rights. Do not alter SAGE roles or evidence rules.

## State-by-action permissions

All permissions below are further limited by target scope, action-specific policy,
live grants, data visibility and principal identity. "Internal" always means
authorized internal human, independent of output producer/implementer.

| State | Specialist access | Specialist execution | Recommendation | Deliverable submission | Acceptance |
| --- | --- | --- | --- | --- | --- |
| DRAFT | None; internal drafting only | No | Draft invitation information only, no estate access | No | No output acceptance; internal approves contract only |
| APPROVED | None until separate ACTIVE grant | No | No institution-data recommendation | No | No output acceptance |
| ACTIVE | Narrow approved data/actions | Narrow non-authority tasks under fresh CP/run grant; never deploy | Allowed within approved scope with attribution | Allowed types/criteria; submission is not acceptance | Internal only, exact output revision, independent of producer |
| SUSPENDED | No normal access; internal preservation reads only | No; no new step/retry | No new institutional recommendation | No normal submission; signed closeout exception only for already-produced bytes | Internal may disposition retained pre-suspension outputs; cannot cure suspension by accepting |
| EXPIRED | No normal access even with stale lease | No | No new recommendation | No normal submission; retained material via separately approved closeout channel only | Internal may disposition retained outputs; expiry never licenses new work |
| CLOSING | No normal access; minimal explicit time-limited closeout grant if approved | No | No new work recommendation | Only bounded preexisting deliverables/cleanup evidence named by closeout grant | Internal only; accepts/rejects specified retained output, not blanket engagement success |
| CLOSED | None | No | No | No | No new acceptance; later correction is a governed linked review, original receipt immutable |
| REVOKED | None, including closeout external access | No | No | No; internal quarantine/preservation only | No normal acceptance; separate internal security/evidence review may disposition retained bytes, never restore work authority |

An exception channel cannot authorize computation/new work after expiry. It may
receive existing bytes and is independently authenticated, bounded, audited and
not represented as normal ACTIVE submission. Unknown creation time/producer
means quarantine/UNPROVEN, not accepted preexisting work.

## Runtime enforcement design

Every data request and material execution step checks engagement state, scope,
effective/expiry, current grant revocation and actor/tool allowlist. A queued run,
retry or previous authorization is not grandfathered. Revocation must be checked
at each external effect; pause/safe-stop under approved run policy and record
partial effects. Existing automation leases are reuse, not immunity from revocation.

Specialist may not change sponsor/owner, broaden scope, extend expiry, accept its
own output, accept institutional risk, decide rationale, close Mission/Change/
engagement, or deploy. A sponsor who produced a deliverable cannot also accept it;
route to independently authorized internal counterpart/deputy with actual mandate.
Appointed counterpart without acceptance permission cannot act just by title.

Submission records immutable bytes/digest/provenance in existing evidence storage
plus scoped output record and durable audit intent. Incomplete bytes/storage/
malware/identity failure yields QUARANTINED or rejected submission with safe error,
never an ACCEPTED placeholder. Acceptance binds exact criteria and output revision,
authority and independent actor; RECORDED receipt required before downstream
effective decision/benefit acceptance. Agent evaluation of output is a recommendation.

Default retention is RETAIN for contract amendments, grants/expiry/revocation,
deliverable revisions, rejections, acceptance and closeout proof. Use existing
evidence holds/disposition; no automatic delete at expiry. Internal Console,
Mission, rationale and evidence consumers read only permitted refs/fields.

## Failure and binary acceptance

| Test obligation | Expected outcome |
| --- | --- |
| Expiry between queueing and next material step | Denied/safe stop; explicit partial result and no lease bypass |
| External human/AI accepts its own output or changes expiry | Denied by trusted classification/action policy, not only UI |
| Sponsor is producer; counterpart lacks acceptance mandate | No acceptance; independent authorized human required |
| Grant issuance fails during activation | APPROVED remains nonexecuting; error/unknown grants explicit |
| Revoked actor retries or replays old token | No work/access; attributed denied event and retained prior history |
| Output submitted before expiry but accepted later | Internal bounded evidence disposition permitted; no external work resurrection |
| Tenant or specialist reads unrelated Mission/evidence | Scope/visibility deny; no hidden path or aggregate disclosure |

All criteria score 3, `[Design]`. Required future proof includes trusted-identity,
expiry/revocation races, external AI, persistence/outbox and cross-scope tests,
plus existing source-domain regression tests.
