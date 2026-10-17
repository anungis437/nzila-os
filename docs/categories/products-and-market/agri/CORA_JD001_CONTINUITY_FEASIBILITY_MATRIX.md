# Cora JD001 Continuity Feasibility Matrix

**Status:** Public-document feasibility review only. No Deere account, API,
token, producer record, or farm data was accessed.  
**Authority boundary:** Technical availability does not authorize Cora use.

## Minimum source graph

| Source node  | Why included                                                                                    | Publicly documented relationship                                                                                       | Cora treatment                                                                                            |
| ------------ | ----------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Organization | Deere access and resource scope.                                                                | Organizations contain organization data and users; organization responses link to resources and connection management. | Resolve as a Deere source identity, never equate it with a Cora tenant or legal entity.                   |
| Client       | Required source relationship context for farm/field ownership and producer identity resolution. | A Client is a grower and/or Operations Center user associated with a Farm; Farms and Fields link to Clients.           | Include in source graph when returned/required; may remain hidden from the Cora canonical surface.        |
| Farm         | Grouping for the land records.                                                                  | A Farm is a set of Fields associated with a Client and Organization.                                                   | Preserve source relationship and identity if separately rights-cleared.                                   |
| Field        | Land unit within set boundaries.                                                                | Organization-scoped; links to Client and Farm; can be created with new or existing Client/Farm.                        | Preserve source ID, relationships, availability/archive status, and observation state only if authorized. |
| Boundary     | Spatial evidence associated with a Field.                                                       | Optional; zero, one, or many per Field. Multipolygon geometry, area/unit and active state are documented.              | Do not assert one permanent boundary; distinguish active/inactive, source state, and captured time.       |

**Source-graph conclusion:** `Organization → Client / Farm → Field →
Boundary` is sufficiently documented to identify the bounded semantic
relationships and public API operations. `Client` is structurally relevant
even if not shown as a Cora-facing canonical object. This does not establish
universal stable-ID semantics, full schema sufficiency, production
availability, or rights to retain the graph.

## Feasibility by gate

| Dimension                         | Current public evidence                                                                                                                                                                                                                                                                            | Feasibility state                | What remains                                                                                                                                                                               |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Technical capability              | Deere docs describe organization/client/farm/field/boundary reads and writes, IDs in paths/links, relationships, status/events, boundary geometry, and required scopes.                                                                                                                            | `TECHNICALLY_DOCUMENTED`         | Exact production URL/entitlement, complete schemas/filters, and object-specific ID lifecycle.                                                                                              |
| Semantic model                    | Organization/Client/Farm/Field/Boundary concepts and relationships are described.                                                                                                                                                                                                                  | `SEMANTICALLY_DOCUMENTED`        | Full mandatory fields, identifier guarantees, timestamp definitions, and complete per-object units are not public in the reviewed material.                                                |
| Authorization mechanics           | OAuth authorization-code flow, callback/app setup, selected organization connection, scope mappings, user permission ceiling, permission adjustment, and token lifetimes are documented.                                                                                                           | `AUTHORIZATION_MODEL_DOCUMENTED` | Eligible account roles, production app entitlement, and complete connection/revocation effects.                                                                                            |
| Incremental continuity            | List eTags/signatures, `304`, changed-list responses, 45-day token retention, pagination, resource events, and DSS subscription/delivery mechanics are documented. DSS permits duplicate/out-of-order delivery and loses unacknowledged events after its seven-day failure/paused-delivery window. | `PARTIALLY_DOCUMENTED`           | Production entitlement and event coverage, end-to-end latency, recovery after loss, object-specific modified-time semantics, source deletion propagation, and reconciliation completeness. |
| Independent historical meaning    | Deere supports source IDs, relationship links, events, and capture-friendly mechanisms.                                                                                                                                                                                                            | `NOT_ESTABLISHED`                | Technical freshness is not a source-currentness guarantee; continuity interpretation also depends on contract rights.                                                                      |
| Contractual permission            | Public development agreement is restrictive and requires a separate Production Agreement for third-party release.                                                                                                                                                                                  | `NOT_AUTHORIZED`                 | Current applicable production agreement and explicit rights per action/data class.                                                                                                         |
| Operator/recipient/Cora authority | Separate governance layers remain necessary.                                                                                                                                                                                                                                                       | `NOT_ESTABLISHED`                | Exact operator consent, Cora approvals, privacy/security review, and recipient acceptance.                                                                                                 |
| Implementation/live proof         | None; no code or live access is authorized.                                                                                                                                                                                                                                                        | `NOT_READY`                      | All applicable gates in the implementation planning record must pass independently.                                                                                                        |

## Freshness and change-risk matrix

| Primitive                              | Supports                                                                                                                                                                                                                                                                                                           | Does not prove                                                                                                                                         | Continuity constraint                                                                                                                                                                                         |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-deere-signature` / eTag-like token  | Efficient list change detection; `304` when unchanged; changed data and a new token when changed.                                                                                                                                                                                                                  | Issuer identity or signature over a particular object, correctness, full history, or currentness after observation.                                    | Deere documents 45-day retention; after expiration/unrecognized token, full list is returned. A longer interruption requires a fresh list/reconciliation.                                                     |
| Pagination                             | List traversal, default 10 and configurable `itemLimit` to 100 with aligned `pageOffset` on supported endpoints.                                                                                                                                                                                                   | Snapshot isolation, comprehensive support across APIs, or a stable cross-page view.                                                                    | Not every response is paginated or accepts the parameters.                                                                                                                                                    |
| Land-resource events                   | Resource pages document selected create/modify/delete and archive/status or merge/unmerge actions/filters. DSS documents event subscriptions, HTTPS consumer validation, `204` acknowledgement within five seconds, possible duplicates and reordering, retries, batching, and seven-day expiration/loss behavior. | Complete event coverage, end-to-end latency, exactly-once/ordered delivery, replay after expiry, durable source tombstones, or downstream propagation. | Treat events as best-effort change signals; events alone cannot recover an expired/lost interval. Reconciliation and its rights/coverage remain unresolved.                                                   |
| Field Operation event `targetResource` | Addition/modification/deletion notification semantics; Deere documents 404 on target lookup as deletion.                                                                                                                                                                                                           | General land-resource deletion behavior or downstream deletion duty.                                                                                   | Field Operations is not in the minimum continuity graph; its behavior cannot be generalized.                                                                                                                  |
| `lastModifiedTime`                     | Operators page explicitly documents the field.                                                                                                                                                                                                                                                                     | A shared timestamp field/meaning on the land graph.                                                                                                    | Need object-specific field and semantic confirmation before using as a cursor or evidence timestamp.                                                                                                          |
| Webhook / Data Subscription Service    | Public DSS docs establish subscription create/list/get/update, status, event-type association, target verification, receiver acknowledgement, retry, batching, pause, and expiry mechanics.                                                                                                                        | Event-type completeness, production entitlement, end-to-end latency, replay/recovery after expiry, and source deletion/currentness guarantees.         | DSS may support incremental capture as a best-effort signal only. Any continuity design needs an independently rights-cleared reconciliation path; technical signaling grants no persistence or reuse rights. |

Record source retrieval time separately from source timestamps if rights
later permit. A captured response can be represented only as historical
observation; it cannot be labeled currently source-confirmed merely because an
eTag, event, Field Sync completion, or successful retrieval exists.

## Architecture reference findings

### Field Sync

Field Sync shows a farmer/user-mediated interoperability workflow: connected
software submits land records; Deere matches geographic shapes; the user
reviews and chooses preferred names and boundaries; completed changes are
reflected in both systems. New land resources may be created; replaced
boundaries become inactive rather than overwritten. The overview reports a
65% overlap threshold for automated matching and states that completed
Operations Center changes cannot currently be undone.

This strengthens the architectural case for explicit user review, matching,
provenance, and careful treatment of replacement/inactive boundaries. It does
not change the minimum read/continuity architecture, prove source rights,
authorize writes, or establish retention, redistribution, rehydration, or
post-disconnect permission. The full document requires portal login.

### Field Operations and shapefile export

Field Operations documents operation/measurement, totals, map images,
shapefile, unit metadata, asynchronous download, polling and event/deletion
mechanisms. This demonstrates substantial technical export and
interoperability capability, but materially increases data volume and scope.
Shapefile availability does not demonstrate durable retention or
redistribution rights. Field Operations, maps, measurements and shapefiles
remain outside the minimum JD001 continuity slice unless separately required
and rights-cleared.

## Rights wall and decision

The technical graph is now documented enough for design-level semantic
assessment, not production implementation. The following remain
`NOT_AUTHORIZED` or unresolved absent authoritative written Deere terms:
durable persistence, retention duration, normalization, derived semantic
representation, producer export, onward sharing, replacement-provider use,
independent rehydration, retention after disconnect, deletion on revocation,
post-termination handling, commercial use, and AI/model use.

The displayed API Development License Agreement is not an evidenced Cora
production agreement. OAuth scope and organization connection do not confer
contractual rights. Keep the implementation gates closed and JD001
reference-only.

See the [official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md),
[capability/rights matrix](CORA_JD001_CAPABILITY_RIGHTS_MATRIX.md), and
[implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md).
