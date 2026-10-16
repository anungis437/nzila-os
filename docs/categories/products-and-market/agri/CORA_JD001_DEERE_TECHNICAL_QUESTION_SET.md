# JD001 Deere Technical Question Set

**Status:** Internal documentation-exhaustion record; no question has been
sent.  
**Contact state:** `PREPARED_NOT_AUTHORIZED_TO_SEND`  
**Scope:** Public technical capability only. No app creation, authentication,
API call, Operations Center access, or producer data.

## Classification vocabulary

- `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`
- `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`
- `REQUIRES_DEERE_TECHNICAL_CONFIRMATION`
- `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`
- `REQUIRES_DEERE_PRIVACY_GOVERNANCE_CONFIRMATION`

Public documentation can establish a technical capability without proving
production entitlement, tested behavior, or contractual permission. The
[official documentation exhaustion record](CORA_JD001_OFFICIAL_DOCS_EXHAUSTION_RECORD.md)
contains the source-by-source evidence and limits.

## Only active technical discovery questions

The following three questions are the complete technical agenda for a future
authorized discussion. They concern only Organization, Client, Farm, Field,
Boundary, and selected land-resource events.

1. **Production entitlement:** What production API base URL, product/license,
   version/media type, approval/entitlement, and eligible connecting-user
   roles apply to read surfaces for Organization, Client, Farm, Field, and
   Boundary?
2. **Complete schema and identifier semantics:** What are the authoritative
   complete schemas and list filters for those five objects, including ID
   uniqueness/lifecycle across rename, move, merge, archive, deletion,
   permission loss, and reconnection; relevant units; and source
   modification-time semantics?
3. **Event completeness and recovery:** For selected land-resource events,
   what production entitlement and exact event schema/filter/scope apply;
   what event coverage and latency commitments exist; and what supported
   reconciliation is available after a gap exceeds the documented seven-day
   DSS failed/paused-delivery window or 45-day eTag retention?

Do not re-ask public documentation questions about OAuth, app/callback
setup, scopes and permission mapping, organization selection, pagination,
retry mechanics, eTag/signature behavior, DSS receiver acknowledgements,
duplicates/out-of-order delivery, batching, or the Field Sync and Field
Operations overviews. Do not use technical confirmation to infer contract
rights.

## Reclassification of the prior question set

The following inventories preserve the classification history and evidence
limits; they are not a second or expanded external agenda. If an inventory
entry appears broader than the three questions above, treat it as background
only and do not send it as an additional question.

### Developer and production access

| Former question                                                                         | Classification                               | Public answer / remaining gap                                                                                                                                                                                                            |
| --------------------------------------------------------------------------------------- | -------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1. Current agreement governing production use                                          | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`    | Public development agreement is not a production grant; current production terms must be identified by an authorized contracting owner.                                                                                                  |
| A2. Prior production approval, developer tier, partner status, review, or certification | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Public docs require a validated Deere user to create an application and say some APIs require a license; production approval, entitlement, and review sequence remain unclear.                                                           |
| A3. Developer-to-production onboarding sequence                                         | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | App creation, Application ID/Secret, callback URI, OAuth authorization code, and organization connection are documented. A supported production pathway and approval sequence are not fully established.                                 |
| A4. Sandbox availability and limits                                                     | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Public endpoint examples use sandbox URLs. Class-specific data, account eligibility, environment restrictions, and parity are not established.                                                                                           |
| A5. API product/entitlement for each selected object                                    | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Operations and scopes are described for the bounded land graph; some API access requires a license. Production availability and exact product entitlements remain open.                                                                  |
| A6. Authentication and organization grants                                              | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | OAuth 2 authorization-code flow, callback setup, organization selection through `connections.deere.com`, scope mapping, permission ceiling, and scope adjustment are documented. Eligible user roles and all revocation effects are not. |
| A7. Production limits, quotas, concurrency, burst, pagination, throttling               | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Common pagination and 429/503 retry guidance are documented. Production quotas, rate limits, burst/concurrency and per-operation limits are not.                                                                                         |
| A8. Commercial terms and contracting authority                                          | `REQUIRES_DEERE_CONTRACTUAL_CONFIRMATION`    | Not a technical question; retained in the rights set only.                                                                                                                                                                               |

### Data-class capability inventory

| Data class                     | Classification                               | Publicly documented capability and remaining scope                                                                                                                                                                        |
| ------------------------------ | -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization                   | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | List/get, membership/type, response links, and connection links are documented. Stable ID lifecycle, full schema, and production entitlement remain open.                                                                 |
| Client                         | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Organization-scoped operations, Client/Farm/Field links, archived/active and events are described. Exact filters, full schema, stable-ID lifecycle, and timestamp semantics remain open.                                  |
| Farm                           | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Organization-scoped operations, Client/Field relationships, status and events are described. Full schema, exact filters, stable-ID lifecycle, and timestamp semantics remain open.                                        |
| Field                          | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Organization-scoped list/get/write/delete, Client/Farm links, archive/merge status/events and selected filters are described. Full schema, stable-ID lifecycle, and timestamp semantics remain open.                      |
| Boundary                       | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Multipolygon, area/unit, active state, Field link, list/get/write/delete and event concepts are described. Full schema, ID lifecycle, and complete units/filter semantics remain open.                                    |
| Machine / AEMP                 | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | ISO 15143-3 snapshot and listed machine data classes, caching and polling guidance are public. Separate API profile/setup and class-specific entitlement apply; outside minimum slice.                                    |
| FieldOperation                 | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Types, list/get, measurements, totals, maps, shapefile export, crop-season filters and deletion indication are described. Full delivery/history guarantees and production entitlement remain open; outside minimum slice. |
| Operator                       | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Organization binding, list/get/write/delete, scopes, archived/available, `lastModifiedTime`, and events are described. Outside minimum slice.                                                                             |
| Product / Input                | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Categories, references/documents, operations and scopes are described. Outside minimum slice unless a dependency is demonstrated.                                                                                         |
| Measurement                    | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Field Operation documentation describes target/result measurement types, totals, map image and shapefile outputs. Outside minimum slice.                                                                                  |
| WorkPlan                       | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Overview describes constituent elements and recommendation-to-Operations-Center/display flow. Full document is login-gated; outside minimum slice.                                                                        |
| Prescription / PlannedActivity | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS` | Work Plans overview lists prescriptions; detailed operations and semantics are behind login and outside minimum slice.                                                                                                    |

### Prior minimum-slice questions

| Former question                                                                     | Classification                                            | Public answer / remaining gap                                                                                                                                                              |
| ----------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| C1. Required source fields, timestamps, identifiers, relationship keys              | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | Relationship concepts, resource IDs in endpoint paths/links, and boundary geometry/area units are documented. Exact complete schemas, required fields and identifier lifecycle are not.    |
| C2. Meaning and completeness of source timestamps                                   | `REQUIRES_DEERE_TECHNICAL_CONFIRMATION`                   | `lastModifiedTime` is documented for Operators, not established with common meaning across the land graph. No universal timestamp semantics should be inferred.                            |
| C3. Current versus historical/corrected/archived/deleted source state               | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | Archive/active and selected event actions are described. Historical snapshots, correction semantics, tombstones and queryability after deletion are not established.                       |
| C4. Incremental change capture and re-read requirements                             | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | eTag/signature behavior and 45-day retention, pagination, and selected events are documented. Completeness, replay, ordering, delivery timing and gap recovery remain open.                |
| C5. Representing Cora-captured history without claiming current source confirmation | Internal Cora evidence-state policy, not a Deere question | Do not send to Deere. Cora must distinguish capture/observation time from source-currentness and apply the governed evidence-state vocabulary internally.                                  |
| C6. Source-side currentness check and what it proves                                | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | eTags detect list changes; events report selected changes. Neither proves source currentness after the check or complete history. Object-specific verification remains unclear.            |
| C7. Semantics after a Deere connection ends                                         | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | The token may expire or remain active subject to refresh and organization-connection removal; future source access can end. Rights/handling of prior copies is contractual, not technical. |

### Prior supported-access distinctions

| Former distinction                                        | Classification                                            | Finding                                                                                                                                                                                                                                                                             |
| --------------------------------------------------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supported operations versus documentation topic routes    | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | Operation methods are documented for the bounded land objects, but the complete production contract and entitlement are not.                                                                                                                                                        |
| Snapshot versus history/change interfaces                 | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | eTags and events provide selected incremental/change signals; complete history/replay is not documented.                                                                                                                                                                            |
| IDs versus labels                                         | `ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`                        | Deere uses IDs in resource paths and links; names are resource attributes. No stable-ID lifecycle guarantee follows.                                                                                                                                                                |
| Source timestamps versus Cora observation time            | Internal Cora evidence-state policy, not a Deere question | Maintain these as distinct timestamps; ask Deere only for source-field semantics where documented fields are used.                                                                                                                                                                  |
| Source deletion versus archive/access loss/query omission | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | Selected archive/delete event states are described; per-object tombstones, propagation, and downstream duties remain open.                                                                                                                                                          |
| Event completeness versus best-effort/delayed updates     | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | DSS says events may be duplicated and out of order; documents endpoint acknowledgement, retries, batching, and seven-day failed/paused-delivery loss. It does not establish event coverage/completeness, end-to-end latency, production entitlement, or recovery/replay after loss. |
| Current-source verification versus a captured snapshot    | `PARTIALLY_ANSWERED_BY_OFFICIAL_PUBLIC_DOCS`              | A `304` or event cursor is change detection, not proof of currentness or historical completeness.                                                                                                                                                                                   |

## Remaining minimum technical questions

Ask only if technical discovery is separately authorized:

1. For the documented Organization/Client/Farm/Field/Boundary read surfaces,
   what production API base URL, API product/license, version/media type,
   approval and entitlement apply? Which connecting-user roles may establish
   and adjust the organization connection?
2. For those five objects, what are the authoritative complete schemas and
   list filters, ID uniqueness/lifecycle rules, units, and source
   modification-time semantics? In particular, are identifiers stable across
   rename, move, merge, archive, delete, permission loss, or reconnection?
3. For each selected land event type, what production entitlement and exact
   event schema/filter/scope apply; what event coverage and end-to-end latency
   commitments exist; and what supported recovery/reconciliation path applies
   after an event expires or a gap exceeds the seven-day DSS queue and
   45-day eTag windows? Public docs already establish target verification,
   `204` acknowledgement within five seconds, duplicate/out-of-order delivery,
   retry/expiry behavior, batching, and pause limits.

Do not ask for Work Plans, Field Sync implementation detail, Field Operations,
products, operators, or AEMP unless a later scoped design demonstrates that
one is required. The full Field Sync and Work Plans documents are login-gated;
their overview evidence is recorded without assuming their unavailable
operation contracts.

No question above is permission to create an app, obtain credentials,
authenticate, call an API, access Operations Center, or inspect producer
records. Deere technical answers do not establish source rights; consult the
[rights question set](CORA_JD001_DEERE_RIGHTS_QUESTION_SET.md).
