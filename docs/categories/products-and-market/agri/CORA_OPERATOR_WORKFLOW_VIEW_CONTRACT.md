# Cora Operator Workflow View Contract

## Scope

This contract extends the accepted [Slice 7 runtime](CORA_INSTITUTIONAL_WORKFLOW_RUNTIME_CONTRACT.md)
with a local synthetic reference view. It does not authorize a production
route, application grant, provider connection or source access.

**Cora can interpret; authorized institutions determine.**

## Server-owned trust boundary

[The workflow service](../../../../apps/cora/lib/institutional-workflow/service.ts)
implements `inspectOperator(runId)`. It derives organization and actor through
the accepted trusted context port, checks workflow permission and ownership,
and revalidates active workflow boundaries. The browser supplies no authority,
rights, decision, freshness or technical result.

The optional `authorizeOperatorView` port must explicitly establish a view
authorization reference. Missing or denied authorization fails closed.
Terminal records additionally require `historical: true`. Workflow execution
permission alone never implies permission to view evidence.

Current recipient and source disclosure rights are checked separately.
Unknown, denied, conditional, wrong-purpose or wrong-recipient disclosure
cannot be bypassed by a historical grant. Explicit revocation/expiry may
permit historical viewing only through the separately authorized historical
view port; it never authorizes new use. A `NOT_AUTHORIZED` technical check
otherwise yields a detail-free denial.

Expected denials use the runtime denial-audit port and return:

```typescript
{
  access: 'DENIED'
  message: string
}
```

No evidence, requirement, run, issuer, raw rights or metrics accompany this
union member. Unexpected port/storage errors propagate rather than becoming
a success-shaped fallback. The contract is not a claim of production
authentication or resistance to side-channel timing inference.

## Available view

[The projection](../../../../apps/cora/lib/operator-workflow/view.ts)
returns `OperatorInstitutionalWorkflowView`. Its authorized member contains:

| Group            | Contents                                                                                                                                                         |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity/context | Workflow/run identity, lifecycle, current versus historical status, institution, recipient and purpose.                                                          |
| Evidence         | Exact evidence/version, provider, issuer, evidence class, provenance reference/digest, capsule reference, observation time, validity and limitations.            |
| Freshness        | Canonical state, human explanation and explicit verification time when currentness is established.                                                               |
| Permissions      | Current disclosure status, named recipient/purpose, earliest source/recipient expiry and revocation, action-specific decisions and view authorization reference. |
| Requirement      | Recipient-owned requirement/version and interpretation/version.                                                                                                  |
| Technical        | Recorded resolution or independent current check, criteria, missing/conflicting/unresolved semantics, both conflict claims and their issuers/providers.          |
| Reuse            | Qualification, originating/consuming context, reconstruction avoidance, retrieval trace, rejection reasons and historical status.                                |
| Decision         | Separate external reference/status/time and recipient decision owner; no inferred decision outcome.                                                              |
| Lineage          | Run-scoped audit references, transitions, timestamps, exact evidence/requirement versions and authorized successor references.                                   |
| Support          | Bound metrics and raw source/recipient rights, rendered inside closed native disclosures.                                                                        |

Raw details are present in the authorized local document; closed disclosures
are presentation, **not** an access-control boundary. Never distribute the
local HTML as a real-data persistence or disclosure implementation.

## History and currentness

Recorded resolution is immutable. `currentCheckState` is separate: an expired
current check does not erase a historical `MATCHED` or external disposition.
Failed, revoked and superseded runs are non-actionable historical records.
Permission actions are all non-actionable for those records.

`CURRENT` requires a parseable nonfuture trusted verification timestamp.
Without one it becomes `NOT_VERIFIED`; historical records are downgraded even
when such a timestamp exists. `STALE`, `UNKNOWN` and `NOT_VERIFIED` remain
visible. A timestamp is not a guarantee of later source state. This slice
implements no live currentness verification service.

Successor references require same actor/organization and explicit view
authorization, including historical permission for terminal successors.
The collection links only authorized references actually present locally.
Independent synthetic fixtures may have identical deterministic run IDs;
the gallery emits each run anchor only once.

## Presentation boundary

[OperatorWorkflow](../../../../apps/cora/components/workflow/operator-workflow.tsx)
renders supplied facts without resolving authority or computing technical
resolution. It separates Overview, Evidence and authority, Permissions,
Requirement, Reuse, Decision and Lineage.

No connector configuration, upload, credential, OAuth, source retrieval,
recipient configuration or decision-making control is included.

See [the truth guide](CORA_WORKFLOW_UX_TRUTH_AND_AUTHORITY_GUIDE.md)
and [Slice 8 proof](CORA_OPERATOR_WORKFLOW_UX_SLICE_8.md).
