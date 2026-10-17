# Cora JD001 Implementation Planning Gates

**Status:** No implementation is authorized by this document.  
**Applies to:** Any future request to implement, activate, or pilot `JD001`.

This is the canonical planning-gates record for JD001. Human-discovery
preparation, an outreach draft, or any discovery answer by itself does not
authorize implementation and does not turn a gate GREEN.

## Rights-first disposition rules

For each Deere operation, accept only an authoritative written disposition
that identifies the governing agreement and exact section, applicable data
classes/fields and purpose, conditions, retention/location/backups, recipient
classes, and lifecycle duties. A decision for one operation does not imply
permission for another.

The continuity-critical rights are persistence, normalization, producer
export, recipient sharing, independent rehydration, and retention after
disconnect. Apply the outcome in the
[rights outcome matrix](CORA_JD001_RIGHTS_OUTCOME_MATRIX.md). If Deere terms
prohibit all lawful means of preserving enough historical state for
meaningful independent continuity, record
`JD001_CONTINUITY_PROOF_NOT_VIABLE`. If the direct Deere source route is
blocked but the wider thesis has not been tested, record
`JD001_SOURCE_ROUTE_NOT_VIABLE`; this does not by itself mean
`CORA_CONTINUITY_THESIS_INVALID`.

## Gate sequence

| Gate                                 | Evidence required to pass                                                                                                                                                                                                                              | Current state                                                                                                                                                                                                                                 | Failure behavior                                                   |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 0. Scope and authority               | Named source, legal entity, operator cohort, purpose, recipient, fields, environment, and accountable approvers.                                                                                                                                       | Not supplied.                                                                                                                                                                                                                                 | Stop; no implementation plan for real-source access.               |
| 1. Current Deere contract            | Authoritative current production agreement, accepted by properly authorized entity; terms cover app release, use, and commercial model. Resolve the public API Development License Agreement’s scope, currentness, and placeholder discrepancy.        | Open; no Production Agreement established.                                                                                                                                                                                                    | No app registration or API access.                                 |
| 2. Operator authorization            | Official account-grant procedure, eligible role, exact organization/scope semantics, consent evidence, expiry, and revocation behavior.                                                                                                                | OAuth authorization-code flow, selected-organization connection, scope mapping, user permission ceiling, and token behavior are publicly documented; eligible roles and complete revocation effects remain unresolved.                        | No OAuth or account connection.                                    |
| 3. Capability contract               | Current operation-level API references for each selected object, schema, identifier, allowed fields/directions, pagination, limits, errors, historical depth, change semantics, and version policy.                                                    | Land graph and several adjacent capabilities are publicly documented; production URL/entitlement, complete schema/ID semantics, and event guarantees remain unresolved.                                                                       | No adapter, sync, or data mapping.                                 |
| 4. Data and purpose rights           | Separate binding written disposition for each operation/data class/field/purpose, including READ, CACHE, PERSIST, NORMALIZE, DERIVE, SHARE, EXPORT, REHYDRATE, RETAIN_AFTER_DISCONNECT, DELETE_ON_REVOCATION, COMMERCIAL_USE, and USE_FOR_AI_TRAINING. | Not established; displayed development license is restrictive and is not a production grant.                                                                                                                                                  | Block each unsupported action; no payload handling.                |
| 5. Semantics and temporal fidelity   | Defined source identity, provenance, measurement units, timestamps, corrections, deletion/archive behavior, history, change events, and freshness semantics sufficient to distinguish captured history from current source state.                      | Land-graph relationships, boundary geometry/area units, selected lifecycle events, eTags and pagination are documented; stable-ID lifecycle, common timestamps, complete history, event guarantees, and source-currentness remain unresolved. | Do not present Cora values as current, complete, or authoritative. |
| 6. Continuity and exit rights        | Contracted permitted bounded persistence, normalization, producer export, recipient sharing, independent rehydration, post-disconnect historical use, revocation/deletion, termination, and backup handling.                                           | Not established; no independent continuity right.                                                                                                                                                                                             | No real-data capsule or recovery claim.                            |
| 7. Platform privacy/security         | Data classification, jurisdiction/residency, minimization, threat model, tenant isolation, secret handling, audit, incident response, and authorized retention/deletion design.                                                                        | Existing platform controls are design/implementation context only; Deere-specific approval absent.                                                                                                                                            | No credentials, persistence, or runtime configuration.             |
| 8. Synthetic contract validation     | Contract tests for schemas, identity binding, idempotency, drift, errors, revocation, limits, provenance, source changes, export integrity, and failure states.                                                                                        | No Deere adapter or schema tests.                                                                                                                                                                                                             | No live-data test.                                                 |
| 9. Offline rehydration               | Independent reader passes every applicable test in the [JD001 rehydration contract](CORA_JD001_REHYDRATION_TEST_CONTRACT.md), with source network and Cora service absent.                                                                             | Contract only; not implemented or run.                                                                                                                                                                                                        | No continuity acceptance.                                          |
| 10. Bounded live pilot authorization | Separate explicit approvals from source, Cora, operator, and recipient authorities; named cohort, purpose, fields, dates, limits, support, rollback, and stop conditions.                                                                              | `NONE_GRANTED`.                                                                                                                                                                                                                               | No pilot or source activation.                                     |
| 11. Production acceptance            | Gates 0–10 pass, lawful production rights exist, operational/recovery evidence is measured, and accountable owners approve.                                                                                                                            | `NOT_READY`.                                                                                                                                                                                                                                  | Keep `JD001` reference-only.                                       |

## Non-negotiable stop conditions

- No inference of Deere rights from operator access, an API scope, or a
  successful technical request.
- A producer authorization is not a Deere contractual/API permission, Cora
  governance decision, or receiving-institution authorization.
- No implementation using the displayed development agreement as a
  production license.
- No use of search-result examples as a substitute for current Deere API
  documentation.
- No silent fallback to stale, partial, cached, or Cora-derived data.
- No sharing or receiver access without exact source/operator/Cora/recipient
  authority.
- No scraping, reverse engineering, operator credential capture, unofficial
  exports, hidden retention, aggregator laundering, or indirect acquisition
  intended to circumvent Deere terms.
- No access, source activation, producer-record review, credentials, runtime
  configuration, ingestion, or live test under the current task.

The existing [connector governance contract](CORA_CONNECTOR_GOVERNANCE_CONTRACT.md)
remains the lifecycle authority; this document adds no gate waiver.

The [JD001 Deere human-discovery contract](CORA_JD001_DEERE_HUMAN_DISCOVERY_CONTRACT.md)
and its question sets are preparation artifacts only. All gates remain open
or not established until the evidence listed above is obtained, assessed,
and approved by the proper authorities.

For the updated design-level capability assessment, see the
[official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md)
and [continuity feasibility matrix](CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md).
