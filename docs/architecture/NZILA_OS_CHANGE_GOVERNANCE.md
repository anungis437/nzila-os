# NzilaOS Change Governance - Target Contract

Checkpoint 2, 2026-10-12, design only. Inherits explicit scopes, authority, audit,
retention and command errors from the
[operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md).
The two independent authorities are `[Validated: user]`; guards/bridge/extensions
below are `[Design]`, not existing runtime enforcement.

## Sources and boundaries

| Meaning | Writable authority | Scope / owner | Consumers and retention |
| --- | --- | --- | --- |
| Operational/service Change | [itsmChanges and itsmApprovals](../../packages/db/src/schema/itsm.ts), existing DB adapter with strengthened material-write composition | ORGANIZATION; internal service owner; platform operational work uses explicitly bound governance org | ITSM, Mission, operations, Console; retained approvals/result/PIR/history |
| Deployment/release Change | [ChangeRecord](../../packages/platform-change-management/src/types.ts), Git JSON at approved repository revision | Explicit PLATFORM_INSTITUTION scope binding, named release owner and independently approved actors | CI, Control Plane, operations, Console; retained Git revisions/attestations/PIR |
| Bridge | Future scoped durable link adapter in existing DB/institutional reference boundary | Both endpoint scopes retained; internal linker with read/link permission for both | Mission/incident/COMMAND correlation only; link history retained |

Operational approval is not deployment authorization. Deployment approval is not
operational risk acceptance. Neither run status nor Mission approval collapses
these authorities. Existing platformChangeId is a compatibility pointer, not
proof that both sources agree. Existing file save/approval helpers are insufficient:
role strings in approved_by are not authenticated human identity or durable proof.

## Durable linkage

```text
ChangeBridge {
  id, scope, operationalRef: { orgId, itsmChangeId, revision },
  deploymentRef: { scope, repository, changeId, path, gitRef, blobHash, revision },
  relationship: REQUIRES_DEPLOYMENT | SUPPORTS_DEPLOYMENT | REMEDIATES | ROLLBACK_OF,
  linkedBy, actorClassification, linkedAt, reason, authorityRef,
  evidenceRefs[], endpointGrantRefs[], version,
  supersedesLinkRef?, withdrawnAt?, withdrawalReason?
}
```

REQUIRES_DEPLOYMENT blocks the dependent operational implementation step until its
particular Deployment Change authorization/execution conditions are satisfied.
SUPPORTS_DEPLOYMENT is correlation without mandatory gating. REMEDIATES/ROLLBACK_OF
do not automatically authorize remediation/rollback. A many-to-many bridge is
allowed; each operational implementation step names its required deployment refs.
Status is read from each source; no dual writable lifecycle or approval columns.

Creating/withdrawing/revising a link requires scoped access to both endpoints,
relationship permission, reason, CAS and durable audit intent. For different
scopes, endpoint grants specify purpose and disclose only permitted fields.
Link replacement retains predecessor and original actor/time/evidence. Revoked/
withdrawn required links leave dependent work blocked until a human resolves the
dependency explicitly; they do not make the requirement vanish.
The existing single platformChangeId can be populated by compatibility adapter
only for one unambiguous link, otherwise explicit multiple-link disposition.

DB commit is atomic with link audit intent. Git is independently verified before
link commit and at deploy. Changed Git approval/commit/blob invalidates its prior
evaluation, requiring new proof. CI mismatch is a blocker, not a warning-only
institutional gate. Missing Git/bridge/source means UNKNOWN/unavailable, not none.

## Independent state dimensions

| Dimension | Target contract / source | What it does NOT imply |
| --- | --- | --- |
| Lifecycle | Existing proposed/under_review/approved/scheduled/implementing/completed/failed/rolled_back/closed and uppercase Git equivalents; source-native spelling retained | APPROVED is not current execution permission; COMPLETED is not success/acceptance |
| Approval | Existing ITSM pending/approved/rejected/escalated; Git PENDING/APPROVED/REJECTED plus verified approval refs | Role names or past approval cannot authorize a changed request |
| Authorization | Current CP decision + actor/action/revision/environment/request binding, validity/expiry/revocation | An authorization is not human risk or deliverable acceptance |
| Blocking conditions | Source-scoped POLICY/HUMAN_GATE/DEPENDENCY/CAPACITY/ENVIRONMENT/EVIDENCE records/evaluations | Blocker array is not another Change lifecycle |
| Execution | Existing run pending/queued/running/succeeded/failed/cancelled/timed_out/dead_lettered plus lease and attempts | Run success cannot close Change or realize benefit |
| Result | Independent outcome SUCCESS/PARTIAL_SUCCESS/FAILED/ROLLED_BACK/UNKNOWN with evidence refs | Lifecycle "completed" alone cannot prove SUCCESS |
| Rollback | NOT_REQUIRED/PLANNED/REQUESTED/RUNNING/SUCCEEDED/FAILED/UNKNOWN, plan and execution proof | ROLLED_BACK cannot mean restoration verified if proof is absent |
| PIR | NOT_DUE/DUE/IN_REVIEW/ACCEPTED/REJECTED, review owner/outcome/evidence | A text PIR field is not accepted review |
| Evidence | REQUIRED/PRESENT/VERIFIED/ACCEPTED/REJECTED/MISSING, each purpose/source revision | Hash verification alone cannot imply adequacy or acceptance |
| Disposition | ACTIVE/REJECTED/CANCELLED/WITHDRAWN and reason, separate append-only event when source lacks terminal enum | Rejected/cancelled work is not mislabeled COMPLETED/CLOSED success |

Preserve both source-native enums through explicit adapters, not mass renaming.
PIR outcome reuses existing SUCCESS/PARTIAL_SUCCESS/FAILED/ROLLED_BACK.
Future state metadata belongs to the source boundary or its versioned immutable
events; COMMAND copies none of it as writable truth. Do not add enum values before
source schema compatibility tests. Disposition returns no-current-execution
authorization and retains lifecycle history.

## Approval and Change type contract

| Type | Operational authority | Deployment authority | Required proof / exceptions |
| --- | --- | --- | --- |
| STANDARD | Known operational pattern preauthorized by authorized internal human under explicit criteria | Approved deployment pattern ID/version + narrow revision/environment/service/impact limits; CP/CI still independently verify | Pattern owner/approval/expiry, permissible variation, tests, rollback, evidence; out-of-pattern becomes NORMAL, never silent standard |
| NORMAL | Scoped service-owner/change-manager approvals with impact/risk evaluation, security authority as policy requires | Existing NORMAL roles plus verified approver identities, registered gate policy and protected environment human approval | Named independent humans, current request digest, impact/dependencies, test/rollback plan and retained authorization |
| EMERGENCY | Named time-bound internal emergency authority for affected service and explicit risk acceptance | Named fast-path release authority, scoped break-glass proof, independent protected-environment gates unless explicit preexisting emergency policy defines an exception | Reason, incident/risk ref, minimized scope/window, named actor/time, tests/rollback disposition, mandatory retrospective/PIR deadline and overdue blocker |

STANDARD does not mean an agent invented its own preauthorization. Pattern registry
is a versioned extension of existing change-management, not another approval engine.
Preauthorization may remove per-occurrence human approval only where the approved
policy explicitly says so; human pattern authorization is still attributable.

EMERGENCY cannot bypass branch protection or an unrelated required environment gate.
Emergency policy explicitly enumerates any permitted fast-path exception, who may
invoke it, reason/evidence and expiry. Missing policy blocks, never "allow urgent".
Retrospective deadline is specified by the approved emergency policy before start;
missing deadline is EVIDENCE/HUMAN_GATE blocked. Overdue PIR blocks closure and
further emergency reuse as policy requires, not retroactive rewrite of the run.

## Lifecycle guards

| Transition | Mutator and required guard |
| --- | --- |
| none -> proposed | Internal requester with change.create; explicit owner, scope, type, affected estate, reason |
| proposed -> under_review | Internal change coordinator; current impact, known dependencies, tests/rollback and approval request |
| under_review -> approved | Source-specific approval policy satisfied by verified humans or approved STANDARD pattern; audit proof recorded |
| approved -> scheduled | Authorized scheduler; validated window, no conflict/freeze, capacity and environment constraints checked |
| scheduled -> implementing | Authorized executor only; fresh actor/request-bound CP grant, exact approved artifact/revision, required operational/deployment gates, lease and active window |
| implementing -> completed | Narrow executor/monitor records work ended with measured result and evidence, not acceptance |
| implementing -> failed | Narrow executor/monitor records failure class and partial effect, holds/recovery work |
| failed/implementing -> rolled_back | Authorized rollback path and verified restoration evidence; rollback failure stays failed + explicit rollback.failed |
| completed/failed/rolled_back -> closed | Authorized independent internal human; result, evidence disposition and required PIR accepted, residual risks assigned |

Rejection/cancellation is an append-only disposition with safe-stop/partial effect
evidence where work began. Changing approved scope/risk/artifact/window invalidates
affected approvals/authorization and returns to review/scheduling as policy requires.
No closed record is edited into a new execution; new Change references predecessor.

Closure guard is target institutional strengthening, not a claim that existing
ITSM/Git save paths already implement it. Source services enforce it; UI is not
the control. Lifecycle changes also emit atomic audit intent, or verified Git
approval/proof plus durable link receipt when crossing storage boundaries.

## Blockers and capacity

```text
Blocker { id, targetRef, category, sourceRef, sourceRevision, reason,
          evaluatedAt, ruleVersion, status: ACTIVE | CLEARED | UNKNOWN,
          authorityRef?, ownerAssignmentRef?, resolutionEvidenceRefs[] }
```

POLICY is a current denied/unknown registered policy; HUMAN_GATE is missing/
revoked human approval or owner coverage; DEPENDENCY is required work/provider;
CAPACITY is the policy-required validated commitment/reserve; ENVIRONMENT is
window/freeze/health/protected-environment issue; EVIDENCE is missing/unaccepted
proof. Unknown required inputs block. Capacity metadata grants no authority.

Canonical wire spelling uses HUMAN_GATE and EVIDENCE. Source adapters map
source-native spellings (including a future human-gate hyphen label) only when
semantically exact, retaining source value. Unknown categories become explicit
UNKNOWN_INPUT with source metadata and block required work, not guessed POLICY.
RAID risk blocks only through a named policy/management decision condition.

Blockers are evaluated against source records; a projection does not clear them.
Lease/reservation + gate recheck occurs at start and before material steps. Required
capacity is reserved transactionally with a start receipt, released by recorded
completion/cancellation/expiry; unknown capacity is not zero/free. Mid-run denial
prevents further steps and follows approved safe-stop/recovery plan.

## Failure and binary acceptance

| Test obligation | Required result |
| --- | --- |
| O approved, P absent/denied/outside window | Required deployment step blocked, O approval preserved, no deploy |
| P approved, O risk rejected | Deployment consent does not override O; blocked operational work |
| STANDARD with mismatching pattern revision | Reject preauthorization; NORMAL review needed |
| EMERGENCY without named authority/deadline | Deny execution; no permissive shortcut |
| Same bridge ID/request retried or Git changed | Deduplicated scoped receipt / explicit revision conflict and re-evaluation |
| Run says succeeded but rollback/PIR/evidence unresolved | Closure denied, result/unknowns shown separately |
| Tenant attempts institutional bridge read/edit | No source IDs/counts leaked; safe denied result |

AC scores are 3 (binary), `[Design]`. Future tests must exercise existing operational,
Git, CI and CP surfaces together; helper/schema tests alone are not adoption proof.
