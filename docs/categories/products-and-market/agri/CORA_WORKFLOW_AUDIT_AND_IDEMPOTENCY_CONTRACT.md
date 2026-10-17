# Cora Workflow Audit and Idempotency Contract

**Status:** Local synthetic transactional conformance. Production durability,
authenticated transport and platform audit integration remain unproven.

## Lifecycle

```text
REQUESTED -> AUTHORIZED -> EVIDENCE_BOUND -> RESOLVED -> REUSE_EVALUATED
          -> AWAITING_RECIPIENT_DISPOSITION -> DISPOSITION_RECORDED
```

Open states can move to `REVOKED`, `FAILED` or `SUPERSEDED`.
Recorded dispositions can become `REVOKED` or `SUPERSEDED` without losing
the external reference. Revoked/failed/superseded are terminal; impossible
transitions are rejected. New contexts have an explicit `supersedesRunId`
link, not overwritten history.

Originating A reaches reuse-evaluated with `ORIGIN_CONTEXT_NO_REUSE`, not a
counted cross-context event. B uses the accepted Slice 6 qualifier.

## Idempotency and retries

The key binds org/actor, institution/recipient/purpose, exact requirement/
interpretation definitions, evidence/version/assertion/provenance, authorization
context and optional originating run. Unchanged requests return the active
run after revalidation. Concurrent identical requests create one run.
Changed version/authorization creates a new identity. Terminal replay cannot
reset a workflow.

`expectedRevision` binds stage commands: concurrent or repeated commands
for that revision transition once; stale revisions return the current safe
result after revalidation. Invalid/future revisions are rejected.
Unversioned advance deliberately requests the next stage, not network retry.

## Append-only audit and atomicity

Every transition records actor, org, action, evidence/version, requirement/
version, authorization, current recipient/source rights, prior/next state,
server time, reason, previous digest and entry digest. The local per-org
chain uses the existing canonical SHA-256 helper after JSON normalization.
This proves integrity, not legal authority, truth, currentness or issuer
signature.

Each transition stores a detached historical run snapshot. The adapter
rejects edits/truncation to history/audit/reuse/friction prefixes, checks
the audit chain and commits all collections atomically. Operation or audit
failure returns no success. Explicit denials use a server-owned denial audit
port; its failure also surfaces.

Revocation appends the new rights snapshot without rewriting earlier valid
facts. Lawful past reuse and external decisions remain inspectable separately
from current authority. No current-only audit overwrites those facts.

This chain is not integrated with platform `audit_events`. A durable adapter
must provide unique keys, transactional isolation, immutable records, failure
rollback, integrity verification/recovery and approved retention/deletion.
Process memory proves neither crash recovery nor multi-process coordination.

## Reuse ledger

Each consuming run keeps its evaluation. The per-org ledger deduplicates by
governed opportunity; replay/retry adds no entry. Recipient, purpose,
requirement/interpretation/evidence versions and authorization refs remain
distinct. Contradictory qualifications for one opportunity are rejected.
`EvidenceReuseRatio` derives from ledger events using Slice 6 eligibility
and exclusions, not caller totals.

Rejected pseudo-reuse can be retained as diagnostics. Expiry/revocation before
reuse stops execution and produces no qualified entry. Conflicts never select
an issuer winner.

## Event-derived friction

Seven steps are supported: retrieval, manual re-entry, duplicate production,
clarification, permission remediation, institutional re-verification and
reconstruction.

The bounded local runtime records authorization, interpretation and external
reference verification as synthetic permission/clarification/re-verification
actions. A's binding records local catalog retrieval; B's governed reference
does not count new source retrieval. These are **modeled local workflow
operations**, not observed human labor or external-provider retrieval.

Additional events require a trusted server reference scoped to run/org/actor/
time/external audit. Counts derive from events; repeated references count once
and conflicting content/caller totals are rejected. The reuse reconstruction
trace uses B's recorded retrieval/re-entry/duplicate/reconstruction counts.
Any positive count prevents qualification.

The bounded B journey after disposition records **3** local actions, with
zero retrieval/re-entry/duplication/reconstruction. This does not establish an
observed seven-to-three productivity reduction or elapsed-time benefit.
Slice 6's designed baseline remains separate.

See [runtime contract](CORA_INSTITUTIONAL_WORKFLOW_RUNTIME_CONTRACT.md)
and [proof](CORA_GOVERNED_INSTITUTIONAL_WORKFLOW_SLICE_7.md).
