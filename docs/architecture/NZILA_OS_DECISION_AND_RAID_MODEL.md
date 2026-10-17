# NzilaOS Decision and RAID Model - Target Contract

Checkpoint 2, 2026-10-12, design only. Inherits scope bindings, material mutation/
audit, retention, authority and error contracts from the
[operating model](./NZILA_OS_INSTITUTIONAL_OPERATING_MODEL.md).
Management authority is `[Validated: user]`; persistence/guards below are `[Design]`.

## Distinct decision meanings

| Object | Source / target persistence | Authority and consumers |
| --- | --- | --- |
| Decision question / analysis | Existing [DecisionAnalysis](../../packages/decision-intelligence-engine/src/schema/decision.ts); future scoped DB adapter for current ports | Internal analysis owner; analyst/agent may prepare permitted drafts. Options/criteria/uncertainty, not institutional authority |
| Recommendation | Versioned analysis/agent/engagement output reference; existing evidence store retains bytes | Producer identity + scope; human reviews; no recommendation implies acceptance |
| Material management choice | Extended [GovernanceRationale](../../packages/governance-rationale/src/schema.ts); immutable decided payload in scoped durable DB adapter | Internal human owner + action-specific policy/required approvals; Mission/Change/RAID/value consume references |
| Permission/policy decision | Existing decision-core and durable decision_events | CP/policy authorization evidence, expires/revokes independently; not management rationale |
| executiveDecisions | Existing [executive schema](../../packages/db/src/schema/executive.ts), compatibility reference to rationale | Legacy consumer/projection; not co-authoritative institutional choice |
| SAGE decisions | Existing SAGE services/repository in source domain | Domain-governed named-human choices and visibility stay unchanged; reference only |
| DecisionGraph / institutional lineage | Existing graph/store ports with scoped index adapters | Read-only links/snapshots, never source update or authority |

Scopes are explicit I/O with org binding as applicable. SYSTEM never creates a
management decision on behalf of an inferred institution. Decided rationale source
and supporting evidence retain original visibility. Decision title/graph can be
more sensitive than a public product and is not automatically exposable.

## Lifecycle without collapsing models

| Conceptual step | Source meaning / state | Mutator and guard |
| --- | --- | --- |
| Question | Analysis drafting with question, owner, scope, deadline and estate refs | Authorized internal initiator; agent drafts only attributed input |
| Analysis | Existing drafting -> under-review | Permitted analyst; options/criteria/evidence/uncertainty/source gaps recorded |
| Recommendation | Versioned recommended option, basis and producer | Permitted analyst/agent/specialist; no human acceptance or execution grant |
| Decision | Analysis decided is a frozen analysis revision; GovernanceRationale records human outcome/rationale | Internal decision owner under decision.record; required approvals/accepted risks separate |
| Effective | Rationale draft -> active plus effectiveAt and satisfied explicit conditions | Activation uses validated human decision and RECORDED proof; monitor only applies condition event under narrow policy |
| Review | reviewAt/reviewDue markers/events, not a new authorization status | Internal decision owner/reviewer examines evidence/conditions; overdue creates issue/blocker only by policy |
| Supersession | active -> superseded as derived lifecycle, X->X2 immutable event | Internal authorized human; atomic payload/head/supersession transaction |
| Archive | active/superseded -> archived display disposition | Internal records steward; source retained, no replay rewrite/destruction |

Existing rationale draft/active/superseded/archived and analysis drafting/under-
review/decided/implemented/superseded vocabulary is preserved in adapters. Analysis
"implemented" is an analytical assessment, not Mission closure or deployment.
Decided rationale payload is frozen even before its effectiveAt; activation,
review, archive and supersession are append-only events, not payload edits.
Expiry/conditions may make a decision inapplicable without deleting it.

## Durable rationale contract

```text
RationalePayload {
  id, scope, schemaVersion, question, decisionTitle, decisionType, trigger,
  context, outcome, rationale, ownerAssignmentSnapshot,
  optionsConsidered[], rejectionReasons[], criteria[], uncertaintyStatement,
  assumptions: scopedRefs[], supportingEvidence: revisionedRefs[],
  evidenceDispositions: [{ ref, status, purpose, acceptedBy?, authorityRef?,
                            reason, digest, acceptanceReceiptRef? }],
  acceptedRiskRefs[], conditions[], mitigationCommitments[],
  effectiveAt, reviewAt?, decisionAnalysisRef?, missionRefs[], changeRefs[],
  source, decidedBy, decidedAt, approvalRefs[], authorityDecisionRef,
  payloadHashVersion, payloadHash
}
RationaleHead { scope, rationaleId, version, latestLifecycleEventRef }
Supersession { scope, predecessorId, successorId, reason,
               actorId, authorityRef, at, auditReceiptRef }
```

Owner snapshot at decision time is immutable; current steward assignment is a
separate ref/event and cannot overwrite the historical human. Evidence disposition
distinguishes referenced, integrity-verified, accepted, rejected, unavailable and
unknown. Evidence gaps require explicit policy-permitted disposition/uncertainty;
a blanket "all evidence accepted" is prohibited. Risk acceptance binds a named
internal human mandate, severity/condition/expiry and evidence.

Future store ports require `(scope, id, expectedVersion, mutationContext)`, not
the existing getById/update-by-ID signatures for material commands. Scoped PK/
FK/unique constraints protect against host mistakes. Draft edits CAS and retain
revision history; after decision, only append lifecycle/link events.

### Immutable replay and atomic supersession

The current [replay implementation](../../packages/governance-rationale/src/replay.ts)
hashes a subset including mutable status, and the
[engine](../../packages/governance-rationale/src/engine.ts) appends successor before
updating predecessor. These are existing behaviors, not target guarantees.

`[Design]` Preserve legacy hash version for legacy replay only. New payloads hash a
versioned canonical encoding of *all* decided material content, including nested
assumptions, risks, rejection reasons, evidence dispositions, human approvals,
scope, owner and authority refs. Sort object keys recursively; sort set-semantic
refs by stable key; preserve ordered option/criteria arrays. Store canonical bytes
and algorithm/version; transport field order never changes hash.

Do not include later status/supersededBy/review/archive events in decided payload
hash. Those are separately immutable, audited linked events. Hash mismatch
quarantines integrity-dependent use; replay never repairs content silently.

In one transaction:

1. Lock/CAS predecessor scoped head; ensure no successor, immutable payload digest
   verifies, current authorized human/conditions and independent approvals valid.
2. Append successor decided payload and head, retaining predecessor owner, content,
   evidence and original timestamps untouched.
3. Append same-scope X->X2 event; unique predecessor-successor constraint prevents
   forks, and validate no cycle/self-reference. Only same-scope supersession allowed.
4. Append audit intent with both refs/hashes. On commit, head/lifecycle projection
   reads X as superseded and X2 as decided/effective when conditions and proof allow.
5. Graph/lineage consumes committed receipt idempotently. It may lag and disclose
   lag; cannot mutate either source. Any failure before commit rolls back all rows.

PENDING audit delivery does not make X2 effective. It also does not resurrect the
old choice as a new authorization: effective view reports pending replacement/
review condition explicitly. Original X retains immutable readable history.
Concurrent CAS loser returns conflict, not a second successor.

### Executive / other compatibility

New institutional decisions require a rationale ref: no fallback to an executive
row. Add a versioned compatibility adapter with executive ID/scope/revision,
canonicalRationaleRef, mapping authority, migration evidence and mappedAt.
Fields displayed from rationale are read-only; legacy notes/action tracking remain
legacy source fields and cannot change decided choice. Existing unlinked executive
rows display LEGACY_UNRECONCILED, not canonical management authority. An authorized
human may reconcile individual rows after checking source evidence, not wholesale
backfill or fabrication of prior approvals.

SAGE decisions and authorization ledger records never receive a synthetic rationale
replacement. Refer with exact kind/namespace/visibility. Their domain authority/
permissions remain source-owned. Graph pending/executed/overridden/revoked/expired
remain graph-specific semantics, not rationale statuses.

## RAID source contract

Institutional RAID is a bounded extension of institutional-intelligence with a
scoped DB adapter. Existing domain risk/ITSM problem records remain references.
Not a duplicate ticket system and not a graph-as-authority register.

```text
RaidRecord {
  id, scope, kind: RISK | ASSUMPTION | ISSUE | DEPENDENCY,
  title, description, ownerAssignmentRef, origin: { namespace, ref?, actor, at },
  severityOrImportance, sourceScale, normalizedBand?, evidenceBasis,
  linkedMissionRefs[], changeRefs[], decisionRefs[], estateRefs[],
  engagementRefs[], supplierRefs[], evidenceRefs[],
  status, resolution, blockingRuleRef?, reviewAt?, version,
  closureAuthorityRef?, closureEvidenceRefs[], historyRefs[]
}
```

Severity preserves source scale (e.g. rationale 1..5 vs ITSM priority vs
LOW/MEDIUM/HIGH/CRITICAL). Explicit rule/version can normalize to LOW/MEDIUM/HIGH/
CRITICAL/UNKNOWN for reads; no guessed numeric equivalence. Likelihood/importance
may be qualitative or UNKNOWN with evidence basis. Origin is mandatory; agents
may recommend a record, internal human assigns accountability. Source/history
is retained by default, including rejected assumptions and resolved risks.

| Kind | Meaning / lifecycle | Blocking | Resolution / closure authority and evidence |
| --- | --- | --- | --- |
| Risk | Possible future harm: identified, assessed, mitigating, accepted, resolved, closed | Not automatic. Only current policy/decision condition creates a blocker; accepted risk cannot clear unrelated policy | Internal risk-mandated human accepts with rationale/expiry/mitigation, or owner submits reduction evidence; independent permitted closer verifies residual disposition |
| Assumption | Unproven proposition: unvalidated, validated, invalidated, retired | Blocks only if required proposition is prerequisite in policy/work dependency; "confidence" is not truth | Authorized internal validator records test/evidence; invalidation creates linked issue/decision review, not history rewrite; internal owner retires with reason |
| Issue | Present deviation: open, investigating, resolving, resolved, closed | Blocks only required impacted action under policy/decision; incident priority alone is not permission | Internal issue owner submits remedy/evidence; permitted independent closer accepts verification |
| Dependency | Required prerequisite: proposed, confirmed, unmet, satisfied, waived, closed | Confirmed required dependency may block; unresolved/unknown required state blocks. Optional link does not | Owner validates prerequisite revision/condition; authorized internal waiver must have policy mandate/rationale/expiry. Independent close verifies satisfaction/valid waiver and evidence |

Blocking Dependency stores dependent work ref, prerequisite ref, requiredCondition,
neededBy, evaluator version and satisfaction evidence. Reject self/cyclic required
work dependency with a stable cycle explanation; service dependency cycles are
handled by estate traversal. A "waived" record cannot overrule a hard policy.
Dependency satisfaction is rechecked against source revision at start; graph
refresh or a deleted link cannot clear it.

Ownership, severity, blocking-rule change, validation/resolution/waiver/closure all
use CAS + actor/authority/reason + before/after audit intent. Closed history is
immutable; reopened issue uses new linked record/revision with original closure
preserved. A decision acceptance links RAID risk but cannot rewrite its past owner.

## Failure and binary acceptance

| Test | Required result |
| --- | --- |
| Edit decided owner/evidence/conditions via legacy update | Rejected by scoped guarded adapter; hash/history unchanged |
| Two simultaneous X supersessions; failure after successor append | Exactly one successor or total rollback, never partial source state |
| Graph refresh marks executed / executive note changed | Canonical rationale unchanged; compatibility divergence exposed |
| Unauthorized risk waiver / dependency cleared by graph | Denied; required work stays blocked |
| Missing analysis/evidence or source denied | Uncertainty/availability explicit, no success-shaped empty trail |
| Cross-scope ID lookup or supersession | No leakage or mutation; explicit scoped denial |
| Review/archive/supersession | Original decided bytes/hash replay identically |

All ACs score 3, `[Design]`. Persistence/transaction failure injection and legacy
regressions are mandatory later; memory-store tests cannot certify these guarantees.
