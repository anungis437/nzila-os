# Cora JD001 Capability and Rights Matrix

**Status:** Public-evidence qualification for a design-only profile. No
Deere runtime capability or Cora right is authorized by this matrix.

## State vocabulary

- `PUBLICLY_DOCUMENTED_API_CAPABILITY`: an official Deere page describes the
  operation or behavior; not tested, production-entitled, or contractually
  permitted for Cora.
- `PARTIALLY_DOCUMENTED`: public evidence answers only part of the operation,
  schema, lifecycle, or temporal question.
- `TECHNICALLY_DOCUMENTED`: public docs describe the bounded technical
  surface sufficiently for design-level analysis; not an implementation
  approval.
- `SEMANTICALLY_DOCUMENTED`: public docs describe the source object
  relationships, without guaranteeing complete schema or stable-ID behavior.
- `AUTHORIZATION_MODEL_DOCUMENTED`: public docs describe OAuth and
  organization-connection mechanics, not source rights.
- `NOT_ESTABLISHED`: evidence is insufficient; do not implement or invoke.
- `DOC_ROUTE_IDENTIFIED`: an official documentation route/topic is known,
  but its substantive contract has not been verified.
- `REQUIRES_WRITTEN_APPROVAL`: a capability might be technically possible,
  but the named authority must approve the exact use.
- `NOT_AUTHORIZED`: current Cora design grants no permission for the action.
- `FUTURE_OPTION_REQUIRES_SOURCE_RIGHTS`: concept retained for future review;
  no availability or rights assumed.

## Initial capability boundary (superseded)

The route-only snapshot below is retained for history. Current capability
statuses are in the official-docs exhaustion table that follows.

| Capability / topic                                                           | Public evidence reviewed                                                                          | Capability status      | Design treatment                                                                                                                                             |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Deere developer portal                                                       | Portal resolves as “Develop with Deere”; public API Development License Agreement is retrievable. | `DOC_ROUTE_IDENTIFIED` | Public discovery only. Agreement text does not authorize Cora.                                                                                               |
| Organizations                                                                | Official route exists; no substantive schema or operation verified.                               | `DOC_ROUTE_IDENTIFIED` | Do not map or equate to NzilaOS/Cora organization.                                                                                                           |
| Fields                                                                       | Official route exists; no substantive schema or operation verified.                               | `DOC_ROUTE_IDENTIFIED` | Do not assert ownership, boundaries, or field lifecycle.                                                                                                     |
| Boundaries                                                                   | Official route exists; no substantive schema or operation verified.                               | `DOC_ROUTE_IDENTIFIED` | Do not assert geometry format, authority, time, or change behavior.                                                                                          |
| Field Operations                                                             | Official route exists; no substantive schema or operation verified.                               | `DOC_ROUTE_IDENTIFIED` | Do not assert operation types, completion, provenance, or evidence status.                                                                                   |
| Connection Management, authentication, OAuth scopes, grants, and eligibility | Official route exists; grant details and scopes not verified.                                     | `NOT_ESTABLISHED`      | No registration, auth flow, scopes, account connection, or live calls.                                                                                       |
| Read, write, webhook, export, or bulk synchronization operations             | No operation-level contract verified.                                                             | `NOT_ESTABLISHED`      | No adapter or data flow.                                                                                                                                     |
| Source signing, stable references, versioning, timestamps, change history    | Not established by reviewed material.                                                             | `NOT_ESTABLISHED`      | Do not assume source verification, freshness, delta, or replay support.                                                                                      |
| Call limits and content changes                                              | Displayed API Development License Agreement §§2.1.5, 3.2.                                         | `CONTRACT_TEXT_ONLY`   | Agreement reserves Deere’s right to limit calls and modify/delete server content; no production limits or change-feed contract established.                  |
| API license scope and production rights                                      | Displayed agreement §§2.1.1–2.1.2.                                                                | `CONTRACT_TEXT_ONLY`   | Text is for internal development/testing; third-party release requires a separate Production Agreement. Not accepted by or applicable to Cora by assumption. |

## Current capability boundary

| Capability / topic                                                             | Official documentation finding                                                                                                                                                                                                          | Current status                                                | Design treatment                                                                                                                                          |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization → Client/Farm → Field → Boundary                                  | Deere documents the relationship concepts, object endpoints, IDs/links, field-boundary structure, lifecycle, and selected event behavior. Client is structurally relevant to the land hierarchy.                                        | `TECHNICALLY_DOCUMENTED`; `SEMANTICALLY_DOCUMENTED`           | Use for design-level evaluation only. Confirm production entitlement, complete schemas, exact fields/filters, and ID lifecycle before any implementation. |
| OAuth and organization connection                                              | OAuth 2 authorization-code flow, app/callback setup, user-selected organizations via `connections.deere.com`, scope mappings, user permission ceiling, scope adjustment, token lifetime, and refresh behavior are public.               | `AUTHORIZATION_MODEL_DOCUMENTED`                              | No app creation, credential issuance, authentication, or producer connection. Connection permission is not contractual use permission.                    |
| `ag1`, `ag2`, `ag3`, `files`, `eq1`, `eq2`, `work1`, `work2`, `offline_access` | Official scope table maps scopes to Deere permission levels; endpoint docs identify required scopes.                                                                                                                                    | `PUBLICLY_DOCUMENTED_API_CAPABILITY`                          | Request least privilege only in a future authorized design; no scope is currently granted to Cora.                                                        |
| eTags, `x-deere-signature`, pagination, retry behavior                         | Common behavior and 45-day signature retention are documented for most list APIs; 429/503 guidance is documented.                                                                                                                       | `PARTIALLY_DOCUMENTED`                                        | Treat as bounded change detection, not a history, currentness, integrity, or continuity guarantee.                                                        |
| Land-resource events and deletion                                              | Create/modify/delete and selected archive/status/merge filters are documented.                                                                                                                                                          | `PARTIALLY_DOCUMENTED`                                        | Delivery, replay, ordering, completeness, deletion propagation, and tombstone semantics remain unresolved.                                                |
| Field Sync                                                                     | Public overview documents user-reviewed matching, preferred naming/boundaries, two-way synchronization, new records, inactive replaced boundaries, webhook references, and no undo for completed changes. Full document requires login. | `PUBLIC_OVERVIEW_DOCUMENTED`                                  | Reference capability only; no write path or retention/redistribution rights inferred.                                                                     |
| Field Operations and shapefiles                                                | Operation/measurement/list/get/map/shapefile export and asynchronous download behavior are documented.                                                                                                                                  | `PUBLICLY_DOCUMENTED_API_CAPABILITY`                          | Excluded from minimum continuity slice. Export availability does not confer retention or redistribution rights.                                           |
| Work Plans                                                                     | Overview documents Fields, Guidance Lines, Products, Prescriptions, Equipment and Operators, plus Connected Software Company recommendations into Operations Center and wireless display flow. Full document requires login.            | `PARTIALLY_DOCUMENTED`                                        | Excluded unless a dependency is shown; exact operations and scopes remain unresolved.                                                                     |
| Products, Operators, AEMP                                                      | Public docs identify categories, operations, scopes and machine data classes.                                                                                                                                                           | `PARTIALLY_DOCUMENTED` / `PUBLICLY_DOCUMENTED_API_CAPABILITY` | Outside the minimum land slice. AEMP needs a separate profile/setup.                                                                                      |
| Partnerships and sharing                                                       | Public docs define organization partnerships, file-sharing permissions and IDs such as `SHARE_ALL_FIELDS` / `SHARE_FEW_FIELDS`.                                                                                                         | `PUBLICLY_DOCUMENTED_API_CAPABILITY`                          | Deere platform semantics only; no Cora permission, contract, or redistribution right.                                                                     |
| Production endpoint, entitlement, complete schemas, exact temporal guarantees  | Public pages use sandbox examples and state some APIs require a license; full pages/schema details are not uniformly public.                                                                                                            | `PARTIALLY_DOCUMENTED`                                        | Keep implementation gate closed; ask only unresolved product/technical-owner questions.                                                                   |

## Rights matrix

The matrix is intentionally stricter than the technical capability table.
Permission is assessed separately for each action and data class.

| Action                    | Minimum Deere contractual permission to establish, separately from producer consent, Cora governance, and recipient authority                 | Current JD001 disposition                                                                                      | Gate                                                               |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `READ`                    | Production agreement and product/API terms must identify permitted objects, fields, purpose, subjects, and access method.                     | `NOT_AUTHORIZED`; technical capabilities are partly documented, but Cora has no production agreement or grant. | No source calls or payload handling.                               |
| `CACHE`                   | Explicit permission for temporary copies, cache purpose, location, duration, expiry, and treatment of replicas/logs/backups.                  | `NOT_AUTHORIZED`; development-license storage restriction is not a production grant.                           | No cache or transient persistence.                                 |
| `PERSIST`                 | Explicit permission for bounded durable copies, permitted data classes, duration, location/residency, backup, and legal-hold treatment.       | `NOT_AUTHORIZED`; production rights unestablished.                                                             | No durable storage.                                                |
| `NORMALIZE`               | Permission for transformations and mappings, preservation of source attribution, and restrictions on changed representations.                 | `NOT_AUTHORIZED`; semantics and transformation rights unestablished.                                           | No normalization.                                                  |
| `DERIVE`                  | Permission for each derived-value class, method/purpose limits, source attribution, and rights in outputs.                                    | `NOT_AUTHORIZED`; derived-use rights unestablished.                                                            | No derived Deere values.                                           |
| `SHARE`                   | Permission for the named recipient, purpose, fields, onward disclosure, recipient retention, and access method.                               | `NOT_AUTHORIZED`; no receiving-institution authority established.                                              | No disclosure or receiver access.                                  |
| `EXPORT`                  | Permission for the producer to export the specified source content or bounded representation, including format and downstream-use conditions. | `NOT_AUTHORIZED`; producer-portability rights unestablished.                                                   | No export or package.                                              |
| `REHYDRATE`               | Permission for an independent reader or another system to interpret/use the representation, including source identifiers and semantics.       | `NOT_AUTHORIZED`; no interpretation or rehydration right established.                                          | Capsule remains a design contract only.                            |
| `RETAIN_AFTER_DISCONNECT` | Explicit event-specific permission, allowed data classes, retention duration, historical-use scope, and deletion/backup rules.                | `NOT_AUTHORIZED`; post-disconnect rights unestablished.                                                        | No post-disconnect retention claim or use.                         |
| `DELETE_ON_REVOCATION`    | Exact trigger, scope, deadline, treatment of derived data/backups/downstream copies, audit evidence, and exceptions.                          | `NOT_ESTABLISHED`; no propagation or deletion semantics established.                                           | No assumption that revocation means deletion or permits retention. |
| `COMMERCIAL_USE`          | Explicit commercial-use permission, applicable fees/limits, service model, recipients, and any separate production approval.                  | `NOT_AUTHORIZED`; no commercial-use right established.                                                         | No commercial use.                                                 |
| `USE_FOR_AI_TRAINING`     | Explicit permission naming data classes, training/improvement purpose, models, retention, withdrawal/deletion behavior, and outputs.          | `NOT_AUTHORIZED`.                                                                                              | No Deere data in training, fine-tuning, or model improvement.      |

No authorization, provider terms, public listing, general API grant, or
operator consent alone is presumed to satisfy the whole row. A missing,
ambiguous, expired, or conflicting rights record blocks the affected action.
For each row, record whether it is allowed, prohibited, or conditional, the
exact governing agreement and data classes, purpose and retention limits,
recipient and commercial limits, deletion duties, and post-termination duties.
A general affirmative answer never grants an unasked-for operation.
If Deere identifies a right as conditional on a Production Agreement, record
that operation as `REQUIRES_PRODUCTION_AGREEMENT` until the exact agreement
is executed and reviewed; the conditional answer is not an active permission.

The displayed public API Development License Agreement is a material
restriction, not a production grant: it limits use to internal
development/testing, prohibits storing/distributing Deere Content under that
license, and requires a separate Production Agreement before third-party
release. The public text contains a literal placeholder and no visible
version/effective date; current applicability must be confirmed. See the
[public evidence ledger](CORA_JD001_PUBLIC_CAPABILITY_EVIDENCE_LEDGER.md) and
[authorization model](CORA_JD001_AUTHORIZATION_MODEL.md).

## Required re-review evidence

To change any `NOT_ESTABLISHED` or `NOT_AUTHORIZED` state, the accountable
reviewer must add:

1. an accessible, current official source document with publication/version
   date and the exact relevant section;
2. exact provider capability semantics: object, operation, fields, identity
   and scope, authentication, errors, rate limits, and freshness;
3. the signed or otherwise authoritative rights basis for each action,
   including retention, derived use, export, rehydration, reuse, recipients,
   commercial use, correction, and deletion;
4. privacy/security/legal decisions and named accountable approvers; and
5. a passing synthetic contract and Deere-independent rehydration test before
   any separately authorized real-data pilot.

For the current evidence basis, see the
[continuity feasibility matrix](CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md),
[implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md),
[Deere rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md), and
[public discovery gaps](CORA_JD001_DISCOVERY_GAPS.md).

No item in this matrix changes
`CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`,
`PHASE_3_PERMISSION = NONE_GRANTED`, or
`PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`.

See [JD001 Reference Connector Architecture](CORA_JD001_REFERENCE_CONNECTOR_ARCHITECTURE.md)
and [Cora Data Sovereignty and Continuity Architecture](CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md).
