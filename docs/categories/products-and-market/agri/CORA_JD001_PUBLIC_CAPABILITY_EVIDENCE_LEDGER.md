# Cora JD001 Public Capability Evidence Ledger

**Profile:** `JD001` — John Deere Operations Center  
**Review date:** 2026-10-09  
**Status:** Official public documentation exhaustion pass. No Deere account,
API, token, operator record, or farm data was accessed. No authenticated or
live behavior was tested.

> The initial route-only findings retained below are superseded by the
> [official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md).
> Use that record for current technical capability findings; this ledger
> retains the original source review and current rights boundary.

## Evidence standard

This ledger distinguishes (1) a public documentation route, (2) a capability
described by an accessible primary source, and (3) an operation that has been
tested. A route title or search-engine summary is not an API contract. No
authenticated or live behavior was tested. `NOT_PUBLICLY_ESTABLISHED` in the initial review meant the portal rendering
did not expose substantive documentation at that time. The current review
used the rendered official developer documentation and updates those
capability findings below.

## Initial route-only source snapshot (superseded)

| ID  | Source                                                                                                                                                               | What was verified                                                                                                      | Limits                                                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S1  | [Develop with Deere portal](https://developer.deere.com/)                                                                                                            | Public developer portal resolves and identifies itself as “Develop with Deere.”                                        | Retrieved page did not expose substantive API documentation.                                                                                                                                                                                                        |
| S2  | [Organizations documentation route](https://developer.deere.com/dev-docs/organizations)                                                                              | Public route exists and is titled for Organizations.                                                                   | No schema, endpoint, operation, scope, or permission was verified.                                                                                                                                                                                                  |
| S3  | [Fields documentation route](https://developer.deere.com/dev-docs/fields)                                                                                            | Public route exists and is titled for Fields.                                                                          | No schema, endpoint, operation, scope, or permission was verified.                                                                                                                                                                                                  |
| S4  | [Boundaries documentation route](https://developer.deere.com/dev-docs/boundaries)                                                                                    | Public route exists and is titled for Boundaries.                                                                      | No geometry format, lifecycle, endpoint, operation, scope, or permission was verified.                                                                                                                                                                              |
| S5  | [Field Operations documentation route](https://developer.deere.com/dev-docs/field-operations)                                                                        | Public route exists and is titled for Field Operations.                                                                | No operation types, status semantics, schema, endpoint, or permission was verified.                                                                                                                                                                                 |
| S6  | [Connection Management documentation route](https://developer.deere.com/dev-docs/connection-management)                                                              | Public route exists and is titled for Connection Management.                                                           | No OAuth flow, granted-scope behavior, account eligibility, or revocation semantics were verified.                                                                                                                                                                  |
| S7  | [API Development License Agreement](https://developer.deere.com/clickThroughAPIAgreement.html)                                                                       | The accessible public text states its defined internal-development/evaluation scope and restrictions summarized below. | No acceptance by Cora is evidenced. No current production agreement was available. The public text contains a literal `placeholder 1` in §2.1.2 and shows no publication/effective version date. Treat as a review trigger, not as Cora’s contract or legal advice. |
| S8  | [John Deere Data Services](https://www.deere.com/en-us/privacy-data/data-services) and [Your Data](https://www.deere.com/en-us/privacy-data/data-services/your-data) | Public routes and page titles resolve.                                                                                 | Retrieved pages exposed titles only; no data-sharing or application-rights statement was verified.                                                                                                                                                                  |

Review date is the date this public review was performed; no source publication
date/version was visible in the retrieved material. Portal content was
client-rendered in this review. Search-result summaries were not treated as
primary evidence for endpoints, fields, scopes, or operational semantics.

## Initial capability findings (superseded)

| Capability / question                                                                                  | Initial public evidence                         | Initial finding                                                                                                                                                                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Developer portal and topic areas                                                                       | S1–S6                                           | Documentation locations are identified. Topic names do not establish service capability.                                                                                                                                                                                                                                                           |
| Organizations, fields, boundaries, field operations API objects                                        | S2–S5                                           | Their actual object schemas and supported operations are `NOT_PUBLICLY_ESTABLISHED`.                                                                                                                                                                                                                                                               |
| Read, write, delete, bulk export, or synchronization operations                                        | No accessible operation-level contract in S1–S6 | `NOT_PUBLICLY_ESTABLISHED`. No API calls were made.                                                                                                                                                                                                                                                                                                |
| Authentication, OAuth protocol details, scopes, grant UX, token lifetime, refresh, account eligibility | S6 route only                                   | Initial review did not establish details. Superseded by the Organizations and Partnerships documentation findings below.                                                                                                                                                                                                                           |
| Organization membership, role, and subject identity mapping                                            | S2 route only                                   | `NOT_PUBLICLY_ESTABLISHED`. Do not equate a Deere organization with a Cora organization or legal entity.                                                                                                                                                                                                                                           |
| Object fields, identifiers, units, links, pagination, and error semantics                              | S2–S5 routes only                               | `NOT_PUBLICLY_ESTABLISHED`. Examples in search results were not verified against the primary documentation.                                                                                                                                                                                                                                        |
| Timestamps, versioning, history, change feeds, webhooks, and deletion/change notifications             | No accessible operation-level contract          | `NOT_PUBLICLY_ESTABLISHED`.                                                                                                                                                                                                                                                                                                                        |
| Source signatures, stable evidence references, checksums, or issuer verification                       | No accessible contract                          | `NOT_PUBLICLY_ESTABLISHED`.                                                                                                                                                                                                                                                                                                                        |
| Call limits and availability                                                                           | S7 §2.1.5                                       | In the displayed internal-development/evaluation agreement, Deere reserves discretion to limit call frequency. This is not a production quota or SLA.                                                                                                                                                                                              |
| Deere-side content changes                                                                             | S7 §3.2                                         | The text reserves Deere’s ability to update, delete, refresh, or otherwise modify Deere Content in the Deere System. It does not define notifications, history, API semantics, or Cora-copy deletion.                                                                                                                                              |
| API access continuity and termination                                                                  | S7 §§2.1.4, 14.2–14.3                           | Under that displayed agreement, keys may be revoked; access may be limited, suspended, or terminated, including removal of an API; on termination keys are revoked, licenses terminate, and Licensed Materials must be destroyed within ten days. This does not define export, recovery, or handling of any separately authorized production data. |

## Current official-document capability findings

The primary technical evidence for this pass is consolidated in the
[official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md).
The current findings replace the initial route-only table above:

| Finding                                                                | Current status                                                            | Limit                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization, Client, Farm, Field, and Boundary APIs and relationships | `PUBLICLY_DOCUMENTED_API_CAPABILITY`                                      | Public docs describe list/get and, for land resources, create/update/delete operations, IDs/links, relationships, status, and selected event behavior. Exact production entitlement, full schemas, and identifier lifecycle remain unresolved.                                                                                                                                                                                                                        |
| Minimum source graph                                                   | `SEMANTICALLY_DOCUMENTED`                                                 | `Organization → Client / Farm → Field → Boundary`; Client is structurally relevant. Do not collapse source graph relationships into Cora tenant identity.                                                                                                                                                                                                                                                                                                             |
| OAuth and selected-organization connection                             | `AUTHORIZATION_MODEL_DOCUMENTED`                                          | OAuth 2 authorization code, app/callback setup, selected organizations through `connections.deere.com`, scope mapping, user permission ceiling, permission adjustment, 12-hour access token, and refresh-token behavior are documented. This is not contractual permission.                                                                                                                                                                                           |
| Scopes                                                                 | `PUBLICLY_DOCUMENTED_API_CAPABILITY`                                      | Docs map `ag1`, `ag2`, `ag3`, `files`, `eq1`, `eq2`, `work1`, `work2`, and `offline_access` to permission levels; endpoint-specific scopes remain the operation reference.                                                                                                                                                                                                                                                                                            |
| List signatures/eTags and pagination                                   | `PARTIALLY_DOCUMENTED`                                                    | Common list behavior, 304/change response, 45-day signature retention, default/page maximums, and retry guidance are documented. Not every endpoint necessarily supports them; no source-currentness or full-history guarantee.                                                                                                                                                                                                                                       |
| Events and deletion                                                    | `PARTIALLY_DOCUMENTED`                                                    | Land-resource events and selected filters/actions are described; DSS documents subscription/consumer delivery mechanics, including duplicate/out-of-order delivery and a seven-day failure/paused-delivery loss window; Field Operations documents crop-season/Field/type filters and a deleted target lookup behavior. Event coverage, production entitlement, end-to-end latency, replay/recovery after loss, and general tombstone guarantees are not established. |
| Field Sync                                                             | `PUBLIC_OVERVIEW_DOCUMENTED`                                              | User-reviewed matching and synchronization, replacement boundaries, and undo limitations are described. Full documentation requires login; no Cora write or data-use rights follow.                                                                                                                                                                                                                                                                                   |
| Field Operations and shapefile export                                  | `PUBLICLY_DOCUMENTED_API_CAPABILITY`                                      | Operation/measurement/map/export capabilities and asynchronous shapefile delivery are described. Technical availability does not authorize retention or redistribution.                                                                                                                                                                                                                                                                                               |
| Work Plans, Products, Operators, AEMP                                  | `PARTIALLY_DOCUMENTED` or `PUBLICLY_DOCUMENTED_API_CAPABILITY` by surface | Public docs describe significant functionality; Work Plans is login-gated. These are outside the minimum land-continuity graph unless dependency is demonstrated.                                                                                                                                                                                                                                                                                                     |
| Deere production contract and Cora rights                              | `NOT_AUTHORIZED`                                                          | No applicable Cora production agreement, retention, reuse, export, redistribution, post-disconnect, commercial, or AI/model rights have been evidenced.                                                                                                                                                                                                                                                                                                               |

## Public developer-license text: rights-relevant clauses

The displayed agreement is a Deere API Development License Agreement that
becomes effective upon acceptance. Relevant provisions are:

- **§§2.1.1–2.1.2:** the displayed license is limited to internal development,
  testing, and evaluation; use of Deere Content is framed as necessary to
  format and display it in the Licensee Application during internal
  development/testing. Releasing an application to a third party requires a
  separate Production Agreement.
- **§2.1.4:** keys are Deere property/confidential information and may be
  revoked in the stated circumstances.
- **§2.1.5:** Deere reserves the right to limit API call frequency.
- **§3.2:** Deere may modify or delete Deere Content in its system.
- **§4.1(b)–(d):** the displayed agreement restricts disclosure/distribution
  and commercialization, copying, or storage of Deere Content under that
  license.
- **§14.2:** Deere may limit, suspend, or terminate access, including removing
  access to an individual API.
- **§14.3:** termination revokes keys and ends licenses; Licensed Materials
  must be destroyed within ten days. The clause does not establish an export
  right, backup policy, or deletion protocol for a production integration.

These provisions are a material constraint on any use relying on the displayed
development license. They do not establish which production terms would apply
to Cora, whether an operator can authorize Cora, or whether Deere would
approve a particular use. Because the text has a placeholder and no visible
version/effective date, authoritative legal/Deere confirmation is required
before relying on it as the applicable agreement.

## Evidence conclusion

The public review establishes documented technical capabilities for a bounded
land graph and several adjacent surfaces. It does **not** establish a
production-ready or fully specified Cora API contract, an applicable
production agreement, or permission for Cora to authenticate, query, process,
retain, derive, export, rehydrate, redistribute, commercially use, or train
on Deere Content.

No conclusion here changes:

- `CORA_ORGANIC_FIRST_LIVE_SOURCE = BLOCKED_RIGHTS_CONFIRMATION`
- `PHASE_3_PERMISSION = NONE_GRANTED`
- `PUBLIC_SOURCE_RUNTIME_PROOF = NOT_YET_PROVEN`

See the [authorization model](CORA_JD001_AUTHORIZATION_MODEL.md),
[continuity feasibility matrix](CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md),
[implementation planning gates](CORA_JD001_IMPLEMENTATION_PLANNING_GATES.md),
[Deere human-discovery contract](CORA_JD001_DEERE_HUMAN_DISCOVERY_CONTRACT.md),
and
[discovery gaps](CORA_JD001_DISCOVERY_GAPS.md).
