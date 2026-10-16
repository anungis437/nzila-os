# Cora JD001 Reference Connector Architecture

**Profile:** `JD001` — John Deere Operations Center  
**Status:** Reference architecture only; not implemented, activated, or
approved for source access.

## Evidence ceiling

This profile is deliberately not an API specification. Official Deere
developer documentation routes were identified for **Organizations**,
**Fields**, **Boundaries**, **Field Operations**, and **Connection Management**.
The routes are client-rendered in the reviewed retrieval and did not expose
their substantive API contracts. The public [API Development License
Agreement](https://developer.deere.com/clickThroughAPIAgreement.html) is
accessible. Its displayed text restricts use to internal development/testing,
restricts storage/distribution of Deere Content under that license, and
requires a separate Production Agreement before third-party release. Its
current applicability to Cora is unknown; the page contains a literal
placeholder and no visible version/effective date. No agreement acceptance
or production rights are evidenced.

These observations do not prove that APIs or capabilities do not exist. They
mean that exact operations, schemas, scopes, account-grant semantics,
production availability, and Cora rights were not established. See the
[public evidence ledger](CORA_JD001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md).

Primary documentation discovery links:

- [Deere developer portal](https://developer.deere.com/)
- [Organizations documentation route](https://developer.deere.com/dev-docs/organizations)
- [Fields documentation route](https://developer.deere.com/dev-docs/fields)
- [Boundaries documentation route](https://developer.deere.com/dev-docs/boundaries)
- [Field Operations documentation route](https://developer.deere.com/dev-docs/field-operations)
- [Connection Management documentation route](https://developer.deere.com/dev-docs/connection-management)
- [Public API Development License Agreement](https://developer.deere.com/clickThroughAPIAgreement.html)

The route names establish a research location and topic labels only. They are
not verified endpoint names, supported object types, fields, or permissions.
No Deere account, API, token, operator record, or farm data was accessed for
this architecture.

## Bounded conceptual object graph

The only bounded graph justified at this stage is a list of documentation
topics, not a source data model.

```text
Organizations [documentation topic]
Fields        [documentation topic]
Boundaries    [documentation topic]
Field Operations [documentation topic]
```

No relationship, cardinality, identifier, lifecycle, or shared ownership
between these topics is asserted. In particular, this document does not
assert that a Deere “organization” is a legal entity, customer tenant,
producer, or Cora organization; that a field boundary is current or
authoritative; or that a field operation is complete, machine-recorded, or
reusable evidence.

| Topic surfaced by public documentation route | Possible design concern                                               | Verified source semantics / API capability |
| -------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------ |
| Organizations                                | Provider-account and actor binding; organizational scope.             | `NOT_ESTABLISHED`                          |
| Fields                                       | Source identity and temporal field scope.                             | `NOT_ESTABLISHED`                          |
| Boundaries                                   | Geometry, source authority, effective time, and change history.       | `NOT_ESTABLISHED`                          |
| Field Operations                             | Operation type, status, machine/actor attribution, time, and linkage. | `NOT_ESTABLISHED`                          |

“Possible design concern” is not a claim that Deere provides those fields or
that Cora may process them. Before mapping, review the actual current official
schema and terms and record the exact version, operation, field, and permitted
use. Unlisted objects remain out of scope.

The displayed development agreement additionally states that Deere may
modify/delete content in its system and may limit, suspend, or terminate API
access. This does not establish a change feed, deletion propagation,
production export right, or continuity guarantee. Real-data preservation
remains blocked by the unresolved production agreement and action-specific
rights. See the [rights and authorization model](CORA_JD001_AUTHORIZATION_MODEL.md),
[continuity feasibility matrix](CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md),
and [implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md).

## Hypothetical flow and trust boundaries

If separately approved, a future connection would have this shape:

1. The operator authenticates and selects an organization through canonical
   NzilaOS authority, not a Deere account name alone.
2. A server-side rights decision authorizes only the named source, operation,
   fields, subject, purpose, recipient, and period.
3. A future `JD001` adapter would call only its reviewed allowlist and retain
   the source attribution, request/observation time, schema version, and
   integrity evidence that the provider actually supplies.
4. Cora would validate source identity and scope, quarantine ambiguity, and
   keep the original assertion distinct from any Cora mapping or derivation.
5. A portability capsule would contain only data whose processing,
   persistence, and export rights are documented; all other values would be
   omitted or represented as explicitly unavailable.
6. An independent reader could rehydrate that permitted capsule without a
   Deere connection. Rehydration would not refresh the source or establish
   current Deere status.
7. The operator or authorized recipient would make the consequential
   operational or institutional decision; Cora would not make it.

This sequence is a target constraint, not a current or approved data flow.

## Reference contract

| Concern        | Required future behavior                                                                                                                     | Current state                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------- |
| Authentication | Use only a provider-documented, separately approved method; least privilege and revocation.                                                  | Method and rights `NOT_ESTABLISHED`.           |
| Capabilities   | Versioned, operation/field allowlist; no implicit broad sync.                                                                                | None established.                              |
| Identity       | Provider ID namespaced by provider and bound to the canonical operator/org; ambiguity blocks.                                                | Binding rules are design requirements only.    |
| Freshness      | Preserve source observation time and provider validity semantics; distinguish last-observed from current.                                    | Semantics `NOT_ESTABLISHED`.                   |
| Provenance     | Retain source attribution, schema/version, actor/purpose, and permitted source reference/digest.                                             | Available fields and rights `NOT_ESTABLISHED`. |
| Continuity     | Use the [Continuity Capsule v1 contract](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md); never make source availability a rehydration precondition. | No capsule implementation.                     |
| Decisions      | Cora may present evidence and resolution states; operator, Deere, insurer, buyer, or other authority retains its own decision.               | No decision workflow.                          |
| Rights         | Maintain separate action-level permission for read, process, retain, derive, export, reuse, and rehydrate.                                   | All Deere rights `NOT_ESTABLISHED`.            |

The full [capability and rights matrix](CORA_JD001_CAPABILITY_RIGHTS_MATRIX.md)
is authoritative for current unknowns. The
[connector governance contract](CORA_CONNECTOR_GOVERNANCE_CONTRACT.md)
controls any future lifecycle progression.

## Explicit non-goals

`JD001` does not imply Deere certification, partnership, endorsement, API
availability, supported synchronization, a Cora right to use Deere data, or
an ability to restore Deere source records. It does not turn the shared
platform integration package into a Deere adapter. It does not enable a
farmer-account connection, data ingestion, write-back, remote equipment
control, field-operation scheduling, insurance submission, or institutional
reuse.
