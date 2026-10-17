# Cora Institutional Workflow Runtime Contract

**Status:** Slice 7 server-owned service conformance, synthetic/local data only.
No HTTP route, database adapter, live identity provisioning, source access,
application grant, provider connector or institutional consumer is activated.

## Contracts and trust boundary

[Runtime contracts](../../../../apps/cora/lib/institutional-workflow/contracts.ts)
define `InstitutionalWorkflow`, `InstitutionalWorkflowRun`,
`WorkflowEvidenceBinding`, `WorkflowRequirementBinding`,
`WorkflowResolutionRecord`, `WorkflowReuseRecord`, and
`WorkflowDispositionReference`.

The [service](../../../../apps/cora/lib/institutional-workflow/service.ts)
accepts strict requests containing requirement ID/version, evidence ID/version,
and optionally an originating run ID. No organization, actor, source/recipient
authority, result, classification, rights vector or disposition value can be
supplied. Unknown keys are rejected.

Server-owned ports supply canonical `CoraAuthorizationContext`, scoped immutable
definitions, separately current recipient and source rights, current issuer
authority, authenticated external recipient references/action events, clock
and transactional storage. The server composition root owns all ports.

`cora:institutional-workflow:execute` and
`cora:institutional-workflow:disposition` are distinct contract permissions,
**not provisioned grants**. Session claims, membership roles and source API
scopes grant neither. A future approved application integration must compose
[Cora canonical authorization](CORA_AUTHORIZATION_COMPOSITION.md).
The fixture supplies synthetic canonical-shaped context only. The current
resolver is unchanged; no route bypasses it or uses this service.

## Execution and immutable bindings

| Operation              | Behavior                                                                                                                                                               |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `request`              | Derive actor/org; load exact definitions; verify current source/recipient disclosure; snapshot bindings and append `REQUESTED`. Replay revalidates current boundaries. |
| `advance`              | Recheck ownership, authority, rights, exact catalog digests and time; advance one stage. Expected revision makes retries safe.                                         |
| `recordDisposition`    | Require separate permission and authenticated external recipient/authority/reference/time/provenance/audit; append a reference only after revalidation.                |
| `recordFrictionAction` | Fetch a server action reference scoped to run/org/actor/time/external audit; reject caller totals and conflicting event IDs.                                           |
| `inspect`              | Recheck current boundaries; expose the reference-only operator preparation model and event-derived metrics.                                                            |

Runs bind org/actor, institution/recipient/purpose, requirement/version,
interpretation/version/definition digest, evidence/version/assertion digest,
source-provenance digest, capsule reference, authorization reference/context
digest, rights snapshot, server timestamp and audit lineage.

Exact definitions are loaded, never silently remapped. Edits under an existing
version, explicit requirement supersession or changed allowed rights context
supersede the run. Unknown/denied/conditional, revoked, expired, wrong-purpose
or wrong-recipient disclosure stops execution. Evidence validity and issuer
authority are checked at each stage. Old snapshots remain unchanged.

## External disposition and source boundary

The disposition path accepts an external reference, not a decision value.
Recipient identity, decision authority and lineage come from its authenticated
server port. An operator execute grant cannot manufacture a decision. Wrong
recipient/authority is rejected; conflicting subsequent references require
explicit supersession.

Technical resolution retains the seven accepted states, separate from external
decision ownership. Runtime failure/revocation does not imply institutional
rejection. Prior lawful resolution/reuse and external decisions remain history.

The runtime references capsule/assertion/provenance without mutating source
truth, rights, freshness or continuity state. Disclosure does not grant
persistence, export, transformation, rehydration or post-disconnect retention.

## Operator preparation model

Inspection exposes source provider, issuer, requirement owner, technical result
and gaps, reuse status, recipient decision owner/reference, freshness, rights,
lifecycle and lineage. It explicitly labels synthetic runtime and non-approval.
A terminal lifecycle must not be shown as a currently authorized `MATCHED`.

No polished UX is built. This contract supports a bounded synthetic workflow
UX after its server composition, identity, permission and error handling are
separately reviewed. It does not select a real consumer.

## Storage ceiling

The port requires serialized per-org atomic state/history/audit/reuse/friction
commits. The shipped adapter is **synthetic process-memory storage**, with
append-only prefix checks, detached snapshots and rollback; not a durable
production ledger.

Full assertion snapshots exist solely in that synthetic adapter. A durable
adapter must independently establish metadata/payload persistence, retention,
deletion and audit rights and minimize claim content. Unknown recipient
persistence rights remain unknown. No database migration or live persistence
is authorized.

See [audit/idempotency](CORA_WORKFLOW_AUDIT_AND_IDEMPOTENCY_CONTRACT.md)
and [Slice 7 proof](CORA_GOVERNED_INSTITUTIONAL_WORKFLOW_SLICE_7.md).
