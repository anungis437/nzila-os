# JD001 Official Deere Documentation Exhaustion Record

**Review date:** 2026-10-09  
**Status:** Public official documentation reviewed; no authenticated behavior
tested. No Deere contact, app creation, authentication, API call, Operations
Center access, credentials, or producer records were used.

## Evidence standard and access ceiling

This record treats only Deere Developer Portal pages as technical evidence.
Page descriptions and endpoint contracts are documented capability, not
tested behavior or a production entitlement. Several topic pages expose only
an overview and state `Please login to view complete document`; those
unavailable portions are not treated as public evidence. In particular, the
Field Sync and Work Plans pages are incomplete without login. The current
public API Development License Agreement is also not treated as a production
grant to Cora.

The governing distinction is:

```text
PUBLICLY_DOCUMENTED_API_CAPABILITY != CONTRACTUALLY_PERMITTED_CORA_USE
```

## Official sources reviewed

| Source                                                                                         | Publicly established content                                                                                                                                                                                | Access limitation                                                                                                                                    |
| ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Developer documentation landing page](https://developer.deere.com/dev-doc-landing)            | Starting point for Deere's public developer documentation.                                                                                                                                                  | Client-rendered portal; reviewed topic pages individually.                                                                                           |
| [Organizations](https://developer.deere.com/dev-docs/organizations)                            | Organization membership and links, OAuth 2 authorization-code flow, app setup, organization connection, scope mapping, token behavior, common API errors, pagination, eTags/signatures, and retry guidance. | Public endpoint examples use sandbox hosts; production entitlement and use are not established.                                                      |
| [Data Subscription Service](https://developer.deere.com/dev-docs/webhook)                      | Event subscription management, consumer endpoint requirements, delivery retries, batching, pause, status, and expiry behavior.                                                                              | Public mechanics do not establish production entitlement, complete event coverage, end-to-end latency, replay after loss, or source-data rights.     |
| [Clients](https://developer.deere.com/dev-docs/clients)                                        | Client relationships, endpoints, links, lifecycle/status events, and access scopes.                                                                                                                         | Full parameter/schema detail may require portal login.                                                                                               |
| [Farms](https://developer.deere.com/dev-docs/farms)                                            | Farm relationships, endpoints, links, lifecycle/status events, and access scopes.                                                                                                                           | Full parameter/schema detail may require portal login.                                                                                               |
| [Fields](https://developer.deere.com/dev-docs/fields)                                          | Field endpoints, client/farm relationships, lifecycle and event behavior, and access scopes.                                                                                                                | Full parameter/schema detail may require portal login.                                                                                               |
| [Boundaries](https://developer.deere.com/dev-docs/boundaries)                                  | Multipolygon representation, active state, units, field relationships, endpoints, lifecycle/events, and access scopes.                                                                                      | Full parameter/schema detail may require portal login.                                                                                               |
| [Field Sync](https://developer.deere.com/dev-docs/field-sync)                                  | Public overview of farmer-led matching/review, preferred names and boundaries, synchronization, inactive replacement boundaries, and undo limitations.                                                      | Complete document requires login; overview is not a full operation contract.                                                                         |
| [Field Operations](https://developer.deere.com/dev-docs/field-operations)                      | Operation and measurement types, list/get operations, maps, shapefile export, units, asynchronous export, and event/deletion indications.                                                                   | Public examples do not create retention or redistribution rights.                                                                                    |
| [Work Plans](https://developer.deere.com/dev-docs/work-plans)                                  | Public overview of plan elements and recommendation flow to Operations Center and displays.                                                                                                                 | Complete document requires login; endpoint details and full direction/semantics are not established.                                                 |
| [Products](https://developer.deere.com/dev-docs/products)                                      | Product categories, read/write surfaces, related references and documents, and listed scopes.                                                                                                               | Excluded from the minimum land-continuity slice.                                                                                                     |
| [Operators](https://developer.deere.com/dev-docs/operators)                                    | Organization-bound list/get/write/delete surfaces, archived/available state, events, and listed scopes.                                                                                                     | Excluded from the minimum land-continuity slice.                                                                                                     |
| [AEMP / ISO 15143-3](https://developer.deere.com/dev-docs/aemp)                                | Fleet snapshot and documented machine data classes, one-hour cache, polling guidance, and access setup.                                                                                                     | Requires a separate API profile/setup; excluded from the minimum slice.                                                                              |
| [Partnerships](https://developer.deere.com/dev-docs/partnerships)                              | Organization partnerships, file sharing, partnership permission IDs, partner permissions, and OAuth/common API guidance.                                                                                    | A documented permission is not a Cora permission or contract.                                                                                        |
| [API Development License Agreement](https://developer.deere.com/clickThroughAPIAgreement.html) | Public development/testing license text and its restrictions.                                                                                                                                               | No Cora acceptance or applicable/current production agreement is evidenced; the displayed text contains a placeholder and no visible effective date. |

## Bounded land graph

The public documentation supports the following source-side relationship
model:

```text
Organization → Client / Farm → Field → Boundary
```

`Client` belongs in the minimum source graph. Deere describes a Client as a
grower and/or Operations Center user associated with a farm; a Farm as fields
associated with a Client; and Fields as organization resources linked to
Clients and Farms. A Field may be created with a new or existing Client/Farm.
Boundaries are Field-scoped and optional; a Field can have zero, one, or many
boundaries, commonly with one active boundary. This is a technical source
graph finding only. Cora may choose not to expose Client as a canonical
surface, but must not drop it from source relationship resolution if the
selected Deere operations require it.

| Object       | Publicly documented surface                                                                                                                                             | State and change facts                                                                                                                                                                                                                               | Scope / important limit                                                                                                                                                                                           |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization | `GET /organizations`, `GET /organizations/{orgId}`; organization identity/type/membership and HATEOAS links including connection-management links.                      | A `connections` link indicates organization access has not been connected; a `manage_connections` link indicates a connection exists.                                                                                                                | User may select only some accessible organizations. A returned link is a navigation aid, not a rights grant.                                                                                                      |
| Client       | Organization-scoped list/create/get/update/delete routes and client/farm/field relationships are documented.                                                            | Events describe create/delete/modify and archived/active state.                                                                                                                                                                                      | Writes require the documented higher Locations permission; exact production entitlement remains unresolved.                                                                                                       |
| Farm         | Organization-scoped list/create/get/update/delete routes; linked Clients, Fields, organization, and boundaries are described.                                           | Events describe created/deleted/modified and archived/active state.                                                                                                                                                                                  | Farms group Fields and are associated with Clients. Exact `lastModifiedTime` semantics are not established for every land object.                                                                                 |
| Field        | Organization-scoped list/create/get/update/delete routes; links to Client, Farm, and owning Organization; create may include new or existing Client/Farm.               | New Fields are described as available; update can change name, archive status, Client, or Farm. Events describe create/delete/modify, archive/unarchive, merge/unmerge, and filters including organization, Client, Farm, Field, status, and action. | `ag1` supports listed views; creation/update management is documented under Locations Level 3 / `ag3`.                                                                                                            |
| Boundary     | GET/list/get-by-ID and create/update/delete routes; Field link; multipolygon geometry, exterior/interior rings, area value/unit, active state, extent, and signal type. | Boundaries may be archived/available and active/inactive. Events document create/delete/modify and active/status/action filters. Activating a boundary makes other boundaries on that Field inactive.                                                | Reads are documented with `ag1`; writes with `ag3`. A boundary generated from a Field Operation is a separate documented GET using `ag2`. Updating a boundary with non-`External` source type requires a license. |

### Documented land-resource paths

The following are the documented REST path templates, with method availability
as shown by Deere. Public request examples use the sandbox base
`https://sandboxapi.deere.com/platform`; they do not establish a production
base URL or production entitlement. Deere pages commonly show
`Accept: application/vnd.deere.axiom.v3+json`; that example is not a
production version guarantee.

| Object       | List/create                                                                                                                                                  | Get by ID                                                             | Update/delete                                                                      | Documented relationship routes                                                                                                                                |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Organization | `GET /organizations`                                                                                                                                         | `GET /organizations/{orgId}`                                          | No organization update/delete capability is asserted by this review.               | Organization response links describe membership, organization resources, and connection management.                                                           |
| Client       | `GET /organizations/{orgId}/clients`; `POST /organizations/{orgId}/clients`                                                                                  | `GET /organizations/{orgId}/clients/{clientId}`                       | `PUT` and `DELETE /organizations/{orgId}/clients/{clientId}`                       | `GET /organizations/{orgId}/clients/{id}/farms`; `GET /organizations/{orgId}/clients/{id}/fields`.                                                            |
| Farm         | `GET /organizations/{orgId}/farms`; `POST /organizations/{orgId}/farms`                                                                                      | `GET /organizations/{orgId}/farms/{farmId}`                           | `PUT` and `DELETE /organizations/{orgId}/farms/{farmId}`                           | `GET /organizations/{orgId}/farms/{farmId}/clients`; `GET /organizations/{orgId}/farms/{id}/fields`.                                                          |
| Field        | `GET /organizations/{orgId}/fields`; `POST /organizations/{orgId}/fields`                                                                                    | `GET /organizations/{orgId}/fields/{fieldId}`                         | `PUT` and `DELETE /organizations/{orgId}/fields/{fieldId}`                         | `GET /organizations/{orgId}/fields/{fieldId}/farms`; `GET /organizations/{orgId}/fields/{id}/clients`; boundary routes below.                                 |
| Boundary     | `GET /organizations/{orgId}/boundaries`; `GET /organizations/{orgId}/fields/{fieldId}/boundaries`; `POST /organizations/{orgId}/fields/{fieldId}/boundaries` | `GET /organizations/{orgId}/fields/{fieldId}/boundaries/{boundaryId}` | `PUT` and `DELETE /organizations/{orgId}/fields/{fieldId}/boundaries/{boundaryId}` | `GET https://sandboxapi.deere.com/platform/fieldOperations/{operationId}/boundary` is documented to generate a boundary from an operation and requires `ag2`. |

The visible pages identify `ag1` for location reads and `ag3` for location
management/write capabilities; the Field/Boundary pages explicitly show
`ag1` for reads, `ag3` for writes, and `ag2` for operation-derived
boundaries. The Client/Farm pages also state the relevant higher Locations
permission for creating/managing resources. Do not infer an endpoint's exact
scope where the individual operation page does not state one; confirm exact
operation scopes before any future implementation.

Client, Farm, Field, and Boundary event subscriptions require `orgId`;
optional filters include the object ID and status/action fields, and
Boundary additionally documents `fieldId` and `active` (`ACTIVE` /
`INACTIVE`). Field events also document Client and Farm filters. These are
Data Subscription Service event filters, not proof that list endpoints
accept the same filters. Filter values may be arrays and may identify
multiple organization/resource IDs.

The public pages identify resource IDs in endpoint paths and response links
(for example, `{orgId}`, `{clientId}`, `{farmId}`, `{fieldId}`, and a
boundary ID). They do not establish a universal identifier stability,
uniqueness, non-reuse, or survival guarantee across rename, move, merge,
archive, deletion, permission loss, or account changes. Do not infer those
guarantees from the existence of an ID or link.

Per-object list filters, full field schemas, units for all fields, exact
modification timestamps, media-type/version policy, deletion tombstones, and
production API URLs/entitlements are not completely established by the
publicly accessible material reviewed. Event filters/actions are documented
on the relevant pages, but event delivery completeness and replay are not
thereby guaranteed.

## OAuth and organization connection

The Organizations/Partnerships documentation states that external
applications use OAuth 2 authorization-code flow. App creation requires a
validated Deere user able to sign in to the developer portal. The application
details provide an Application ID and Secret; redirect/callback URIs must be
configured. After authorization, the user must separately connect selected
organizations through the `connections.deere.com` link Deere supplies from
the `/organizations` response. A user can have access to multiple
organizations but decline to connect some or all of them.

Scopes map to user, partner, and Connected Software Company permission
levels. Deere states the application will not receive more permissions than
the connecting user has. A later request for higher/new scopes also requires
the user to adjust connection permissions in Connections, and the user must
first hold or receive those permissions. This describes technical
authorization behavior, not contractual permission for Cora to read,
transform, retain, export, or disclose the data.

| Scope            | Publicly documented permission mapping                                                                       |
| ---------------- | ------------------------------------------------------------------------------------------------------------ |
| `ag1`            | View Locations: Clients, Farms, Fields, and associated data.                                                 |
| `ag2`            | `ag1` plus Analyze Production Data (website access only).                                                    |
| `ag3`            | `ag1` and `ag2` plus Manage Locations and Production Data (website and API access).                          |
| `files`          | Files API access; `ag3` is also required for most file types.                                                |
| `eq1`            | View Equipment; RDA; setup/WDT-related mapping in the scope table.                                           |
| `eq2`            | Equipment view/edit/manage levels, including detailed machine measurements, plus RDA and setup/WDT mappings. |
| `work1`          | View Work and Crop Plans.                                                                                    |
| `work2`          | Work and Crop Plans Access Level 1 and Level 2.                                                              |
| `offline_access` | Request a refresh token.                                                                                     |

The documented access token lifetime is 12 hours. A refresh token is issued
only when `offline_access` is requested; an unused refresh token expires
after 365 days. The documentation says it remains active while refreshed,
unless the customer removes all organization connections for the
application in Connections. This establishes authentication/access behavior
only; it does not establish that any previously received copy may be retained
or used after a connection is removed.

## Common API change, freshness, and request behavior

| Mechanism                             | What Deere documents                                                                                                                                                                                                                                                                                                         | What it does not establish                                                                                                                                                                                            |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `x-deere-signature` / eTag-like token | For most list APIs, send the returned string token on the next request. An unchanged list returns `304 Not Modified`; a changed list returns changed data and a new token. While using the token, pagination is skipped and the complete response of changes since the last API call is returned.                            | Not an issuer signature over a particular evidence object, a cryptographic provenance proof, a full historical log, or proof that the data remains current after the check.                                           |
| Signature retention                   | Deere retains eTags for 45 days; an expired/unrecognized token causes the full list to be returned.                                                                                                                                                                                                                          | No continuity guarantee across a longer gap, no record-retention right, and no source-history guarantee.                                                                                                              |
| Pagination                            | Common list behavior is 10 by default; `itemLimit` may be a multiple of 10 up to 100; `pageOffset` must align to the page size. Deere cautions that not every response is paginated or accepts those parameters.                                                                                                             | No promise that all object surfaces use pagination or that paginated reads are snapshots.                                                                                                                             |
| Retry behavior                        | 429 may provide `Retry-After`, which must be honored; 503 may provide it or require exponential backoff.                                                                                                                                                                                                                     | No production SLA, quota, or availability commitment.                                                                                                                                                                 |
| Object/event change data              | Land-resource pages document create/modify/delete and archive/active or merge/unmerge event actions and selected filters. Field Operations events document additions/modifications/deletions and crop-season, Field, and operation-type filters; a 404 for an event's `targetResource` is documented as indicating deletion. | No guarantee of complete delivery, latency, ordering, replay, durable tombstones, or propagation to a Cora-held copy.                                                                                                 |
| Last-modified fields                  | Operators documents `lastModifiedTime`.                                                                                                                                                                                                                                                                                      | A universal `lastModifiedTime` field or shared temporal semantics for Organization/Client/Farm/Field/Boundary are not established.                                                                                    |
| Webhook / Data Subscription Service   | The public DSS page documents subscription setup/lifecycle, consumer endpoint validation/acknowledgement, delivery retry, batching, pausing, event expiry, and status.                                                                                                                                                       | Does not establish complete event coverage, end-to-end latency SLA, ordering (events may be out of order), exactly-once delivery (duplicates may occur), replay after loss, or source-data deletion/retention rights. |

## Data Subscription Service

Deere's [Data Subscription Service documentation](https://developer.deere.com/dev-docs/webhook)
describes a reusable event-subscription service. A subscription can filter
event data; Deere POSTs notifications to the subscriber's HTTPS target, and
each event includes a link back to data. The page identifies event types for
land resources including Client, Farm, Field, Boundary, and Field Operation,
among other APIs. To create a subscription, the client must have access to
the event's associated API. Public event type/filter documentation does not
grant that access or establish a production entitlement.

| DSS surface                           | Publicly documented behavior                                                                                                                                                                                                                                                               | Boundary / unresolved point                                                                                                                                                                                                                                           |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscription management               | `POST /eventSubscriptions`; paged `GET /eventSubscriptions`; `GET /eventSubscriptions/{id}`; and `PUT /eventSubscriptions/{id}`. The list includes `Active`, `Expired`, and `Terminated` subscriptions.                                                                                    | Examples use `https://sandboxapi.deere.com/platform` and `application/vnd.deere.axiom.v3+json`; production entitlement, complete per-event schemas, and exact event scopes remain unresolved. No separate DELETE route is listed in the public endpoint overview.     |
| Subscription status                   | `Active` delivers; `Expired` is off but can be switched back to `Active`; `Terminated` is off and permanently deleted.                                                                                                                                                                     | Terminating a subscription is not deletion of the underlying source record, nor a downstream deletion instruction.                                                                                                                                                    |
| Event filters                         | Filters are event-type-specific. Documentation requires `orgId` for Field Operation subscriptions and describes resource/status/action filters on land event pages.                                                                                                                        | A filter schema for one event type must not be generalized to other event types or to list API parameters.                                                                                                                                                            |
| Event types and change metadata       | Client, Farm, Field, and Boundary events describe additions, modifications, or deletions; Field Operation events describe operation-data additions, modifications, or deletions. The generic DSS overview says an event contains a link back to data.                                      | The reviewed public material does not establish a complete common event payload schema or guarantee that an event carries a source snapshot/tombstone. Dereference links only under separately authorized access; an event is not itself proof of source currentness. |
| Target validation and acknowledgement | The subscriber must configure a publicly reachable HTTPS consumer endpoint before subscription creation. Deere sends a `subscriptionVerification` event. The target must return `204 No Content` within five seconds; acknowledge/persist before parsing or following event-data links.    | These are receiver implementation requirements, not an end-to-end event delivery SLA. The documentation does not promise complete event coverage or a source snapshot in each notification.                                                                           |
| Ordering and duplication              | Deere states events are not guaranteed to be in order and may be delivered more than once.                                                                                                                                                                                                 | Consumers must not infer causal order or exactly-once delivery from event arrival.                                                                                                                                                                                    |
| Retries and failed delivery           | Deere retries new events until acknowledged. Continuously failing messages eventually expire after seven days; a subscription may be temporarily suspended and appear `Expired`. Deere does not separately notify when delivery fails; the client must reactivate an expired subscription. | The seven-day window applies to undelivered messages, not source-data retention or already received copies. No guarantee of replay after expiry, exact retry schedule, event-loss recovery, or source-state reconstruction is established.                            |
| Batching and concurrency              | Default batches contain up to 10 events; a partial batch may wait up to 10 seconds. Batches can mix event types. Default is one concurrent request per client key for the same destination; batching groups by destination URL and client key.                                             | Batching delay is not a bound on end-to-end event latency.                                                                                                                                                                                                            |
| Paused delivery                       | Client-level delivery can be `Active` or `Paused`; paused events accumulate for seven days, then are lost.                                                                                                                                                                                 | Recovery after the seven-day queue window is not documented.                                                                                                                                                                                                          |
| Delivery configuration                | Client-level delivery settings support status, batch size, authorization header, and concurrency. Deere documents a roughly five-minute overlap when rotating the authorization header.                                                                                                    | The header is a transport setting; its presence does not create source access or use rights.                                                                                                                                                                          |

For the minimum land graph, DSS establishes the basic subscription
management and consumer-delivery mechanics and can notify subscribers of
documented changes instead of requiring continuous polling. It does not
establish production availability, event completeness, end-to-end latency
guarantees, replay after the seven-day loss window, or a recovery guarantee
when an eTag is older than its 45-day retention window. Source-event deletion
semantics remain distinct from subscription termination and are documented
only where the relevant resource page specifies them. DSS therefore supports
incremental capture as a best-effort signal only; it is not, by itself, a
continuity or currentness guarantee.

## Field Sync reference capability

The public Field Sync overview describes a user-requested process. Connected
software submits its land records to Operations Center; Deere matches fields
and boundaries by geography/shape; the user reviews matches and selects which
system supplies preferred field naming and boundary data. Low-overlap matches
(below the documented 65% threshold) are represented as 0% and kept separate
until a user manually merges them. The completed sync updates land resources;
new resources may be created, and replaced boundaries are created as new
records while old boundaries become inactive. The page says records remain
synchronized as either system changes and the connected software updates its
own land data to match.

The page also says completed Operations Center changes cannot currently be
undone. Users can remove the application connection; to stop syncing but
remain connected, the application must stop edits and remove webhook
subscriptions. This is strong evidence of Deere's technical
interoperability/user-review posture and of material write-side consequences.
It is not evidence of Cora retention, redistribution, replacement-provider,
post-disconnect, or rehydration rights. The full Field Sync document is
login-gated.

## Field Operations

The public Field Operations page describes tillage, seeding, application,
harvest and other operation data; operations can span consecutive days and
link to measurements. It documents organization/Field list and get-by-ID
surfaces, target/result measurement concepts, totals, map images/legends, and
point-level data through shapefile export. API surfaces are described with
`ag2`.

Shapefile export is asynchronous: a request can return `202`, subsequent
polls continue until `307` supplies a pre-signed download URL valid for at
least one hour; processing can take up to 30 minutes. The page recommends
polling from five seconds and doubling the interval. `406` means no shapefile
can be generated. Exports may include `.dbf`, `.prj`, `.shp`, `.shx`, and a
Deere JSON metadata file with units; projection is WGS84 (WKID 4326), and
unit selection uses `Accept-UOM-System` when available or organization
preference. Deere lists approximate maximum sizes of Point/EachSection 65 GB,
Point/EachSensor 250 MB, Point/OneHertz 75 MB, Polygon/EachSensor 350 MB,
and Polygon/OneHertz 120 MB. Polygon/EachSection is unsupported. These are
documented approximate ceilings, not an entitlement or retention allowance.

Field Operation events support required organization and optional crop
season, Field, and operation-type filters, and document additions,
modifications, and deletions. A deleted target resource may return 404. A
shapefile export is a technical capability, not evidence that Cora may retain
or redistribute it indefinitely.

## Other documented surfaces and sharing

- **Work Plans:** public overview lists Fields, Guidance Lines, Products,
  Prescriptions, Equipment, and Operators. A Connected Software Company can
  send field-specific recommendations to Operations Center for wireless flow
  to supported displays and Work Planner. Full documentation is login-gated;
  exact endpoint direction/operations/scopes are not established here.
- **Products:** public overview identifies crop types, varieties, chemicals,
  fertilizers, tank mixes, and dry blends, with associated company,
  active-ingredient, and document references. Read/write operations are
  described; listed scopes include `eq1` for reads, `eq2` for writes, and
  `ag2` for tank-mix creation. Product documents may embed PDFs as
  gzip/base64. Not required by the minimum land graph.
- **Operators:** organization-bound list/get are described with `ag1`,
  create/update with `ag2`, and delete with `ag3`; archived/available state,
  `lastModifiedTime`, and create/delete/modify event filters are documented.
  Not required by the minimum land graph.
- **Equipment/AEMP:** ISO 15143-3 documentation describes a fleet snapshot,
  pages of 100, Deere-side one-hour caching and at-least-hourly polling
  guidance, active telematics only, and fields that may be absent. Listed
  data classes include header, last known location, locations, operating
  hours, cumulative hours/idle/fuel, fuel/DEF remaining, load count, payload
  total, and distance. Access requires a separate API profile and Operations
  Center user/password/organization setup. Not required by the minimum graph.
- **Partnerships/sharing:** Deere describes partnerships between
  organizations and individual or automatic file sharing. Partnership
  permission IDs include organization, equipment, jobs, locations,
  `SHARE_ALL_FIELDS`, and `SHARE_FEW_FIELDS` categories. These permission
  IDs describe Deere's platform model; they do not grant Cora a partnership,
  user permission, data-use right, or permission to redistribute data.

## Remaining discovery and rights boundary

### Technical questions not fully answered publicly

1. What production API base URL, application/product entitlement, approval
   sequence, and operation-level version/media-type apply to the proposed
   minimal land graph? Public examples are sandbox-oriented, and Deere says
   some APIs require a license.
2. What are the authoritative ID uniqueness/lifecycle guarantees, complete
   per-object fields/units, list filters, and modification-time semantics for
   Organization, Client, Farm, Field, and Boundary?
3. For each selected land event type, what production entitlement and exact
   event schema/filter/scope apply; what event coverage and end-to-end latency
   commitments exist; and what supported recovery/reconciliation path applies
   after an event expires or a gap exceeds the seven-day DSS queue and
   45-day eTag windows? Public docs already establish receiver validation,
   204 acknowledgement, five-second response, possible duplicates and
   reordering, retry/expiry behavior, batching, and pause limits; do not ask
   Deere to restate those mechanics.
4. What user/account roles are eligible to establish or adjust an
   organization connection, beyond the documented rule that an application
   cannot exceed the connecting user's permissions?
5. Does any selected Field Sync or Work Plans functionality require
   additional operation-level API references for a future architecture
   decision? These are not part of the minimum read-only land slice.

### Deere contractual confirmation remains separate

Authoritative current production terms must address each operation/data
class, including `READ`, `CACHE`, `PERSIST`, `NORMALIZE`, `DERIVE`, `SHARE`,
`EXPORT`, `REHYDRATE`, `RETAIN_AFTER_DISCONNECT`, `DELETE_ON_REVOCATION`,
`COMMERCIAL_USE`, and `USE_FOR_AI_TRAINING`. Explicitly resolve durable
persistence, retention duration, transformation/derived representation,
producer export, onward sharing, replacement-provider use, independent
rehydration, disconnect/revocation/source-deletion/termination handling,
commercial use, and AI/model use.

OAuth, an organization connection, a scope, Field Sync, a partnership
permission, an event, an eTag, or a downloadable shapefile does not answer
any of those rights questions. Deere contact remains
`PREPARED_NOT_AUTHORIZED_TO_SEND`; no application, runtime, integration, or
external communication is authorized.
