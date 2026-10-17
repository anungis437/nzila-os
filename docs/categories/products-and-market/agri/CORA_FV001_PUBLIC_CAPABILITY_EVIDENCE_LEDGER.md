# Cora FV001 Public Capability Evidence Ledger

**Profile:** `FV001` — Climate FieldView Platform APIs
**Review scope:** Official publicly available developer and legal materials
only. No account, credentials, API calls, producer records, or farm files were
used.
**Evidence snapshot:** 2026-10-09
**Disposition:** Public technical capability is documented at a useful level;
partner production access and Cora-specific rights remain unresolved.

## Evidence rules

This ledger distinguishes:

```text
PUBLIC_API_CAPABILITY
!= CORA_IMPLEMENTED_CAPABILITY
!= CONTRACTUALLY_PERMITTED_CORA_USE
```

The fixed v4 OpenAPI document is the principal evidence for current API
surface area. The separate “Next Versions” v5 OpenAPI document is recorded
as preview evidence only. Neither document is evidence that Cora has partner
status, an API key, production access, or permission to persist or reuse
source data.

## Official sources reviewed

| Official source                                                                                                                                                    | Evidence used                                                                                                                                                                                    | Important limit                                                                                                                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [FieldView Technical Documentation](https://dev.fieldview.com/technical-documentation/)                                                                            | Entry point to the published v4 API documentation and OpenAPI.                                                                                                                                   | The exact OpenAPI snapshot is separately identified below.                                                                                               |
| [FieldView v4 OpenAPI](https://dev.fieldview.com/openapi/platform.yaml)                                                                                            | OpenAPI 3.0.0; title “Climate FieldView Platform APIs”; document says last modified 2025-12-08; server `https://platform.climate.com`; token endpoint `https://api.climate.com/api/oauth/token`. | Schema is partner-facing API documentation, not evidence of Cora onboarding or production entitlement.                                                   |
| [FieldView API Security](https://dev.fieldview.com/api-details/)                                                                                                   | OAuth2 authorization-code and refresh-token behavior, user consent, client credentials, callback URI, and token handling.                                                                        | Developer instructions do not grant Cora source-data retention rights.                                                                                   |
| [FieldView FAQ](https://dev.fieldview.com/faq/)                                                                                                                    | Partner onboarding summary and explicit limitation on accessing shared-user data through the APIs.                                                                                               | Does not establish the terms applicable to a future Cora partnership.                                                                                    |
| [FieldView Next Versions](https://dev.fieldview.com/technical-documentation/next-versions/) and [v5 OpenAPI](https://dev.fieldview.com/openapi/next-versions.yaml) | Future API shapes, including growing seasons, reports, and prescription exports.                                                                                                                 | `info.version` is `0.0.0`; reviewed operations are tagged implementation `ALPHA` / specification `BETA`. Do not treat as released production capability. |
| [FieldView Terms of Use](https://climate.com/en-us/legal/terms-of-use.html)                                                                                        | Customer Farm Data, FieldView Generated Works, Climate’s license, and account closure/deletion provisions.                                                                                       | Consumer terms do not supply the separate platform-partner agreement or a Cora data-use grant.                                                           |
| [FieldView Privacy Statement](https://climate.com/en-us/legal/privacy-statement.html)                                                                              | Climate’s personal-data purposes, retention, and account-rights statements.                                                                                                                      | It describes Climate’s own handling; it does not define Cora’s downstream controller/processor role or authorize Cora processing.                        |

## Bounded v4 API surface

The API requires HTTPS, an OAuth access token, and a partner `X-Api-Key`.
The API key is assigned a partner-specific usage plan with burst/rate limits
and a monthly quota; excess requests can receive `429`, optionally with
`Retry-After`.

| Object or capability           | Publicly documented operation                                                                         | IDs, relationships, filters, and semantics                                                                                                                                                                                                                                                                                                                                                           | Scope / evidence limit                                                                                                                                                                                                              |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Farm organization              | `GET /v4/farmOrganizations/{farmOrganizationType}/{farmOrganizationId}`                               | Retrieves a particular farm organization. The documented type enum is `farm`; the response identifies it by UUID, name, and type. No v4 list route was identified.                                                                                                                                                                                                                                   | `farmOrganizations:read`. Does not document a Deere-like organization/client hierarchy.                                                                                                                                             |
| Resource owner                 | `GET /v4/resourceOwners/{resourceOwnerId}`                                                            | Get by UUID. No v4 list route was identified. The schema includes name and email; do not assume this is a verified legal entity or Cora organization.                                                                                                                                                                                                                                                | `resourceOwners:read` (the operation also lists legacy `platform`).                                                                                                                                                                 |
| Field                          | `GET /v4/fields`, `GET /v4/fields/{fieldId}`                                                          | List and get by UUID. Field model has name, boundary UUID, resource-owner UUID, and a parent UUID/type (`farm`). Optional field-name-prefix filter; documented prefix minimum is three characters.                                                                                                                                                                                                   | `fields:read` (some operations also list deprecated `platform`). No field `updatedAt`, archived-state, or delete signal is present in the Field schema.                                                                             |
| Boundary                       | `GET /v4/boundaries/{boundaryId}`, `POST /v4/boundaries/query`                                        | Get by UUID or retrieve up to ten known boundary IDs per request. A field carries the current boundary UUID. Boundary is a GeoJSON Feature with Point/Polygon/MultiPolygon geometry, area, and centroid; area units are documented as hectares. No boundary-list endpoint or active/archive property was identified.                                                                                 | `fields:read`. Query-by-ID is not a full enumeration mechanism.                                                                                                                                                                     |
| Farm/field relationships       | Field and farm-organization schemas                                                                   | A Field points to a parent of type `farm`, its `boundaryId`, and `resourceOwnerId`. The FarmOrganization schema identifies a farm.                                                                                                                                                                                                                                                                   | These are API model relationships, not a legal-ownership or source-authority determination.                                                                                                                                         |
| Operations                     | `GET /v4/operations/all`                                                                              | Lists operations accessible to the authenticated user; optional `resourceOwnerId` filter. Basic Operation schema contains UUID, name, and resource-owner UUID. No `/operations/{id}` route was identified in v4.                                                                                                                                                                                     | `operations:read`. This listing is not the same as the operation/activity layer surfaces below.                                                                                                                                     |
| Planting, application, harvest | `GET /v4/layers/asPlanted`, `/asApplied`, `/asHarvested`; per-activity summary and `/contents` routes | Lists activity summaries and retrieves a summary or zipped raw activity by activity UUID. Summaries include field IDs, start/end, `createdAt`, `updatedAt`, source-file modification timestamps, machine/crop information, checksums, and (where defined) area, season code, yield/population/measurement attributes. List filters include resource owner, occurred-after/before, and updated-after. | Read scopes are `asPlanted:read`, `asApplied:read`, `asHarvested:read`; the documented `updatedAfter` applies to these activity lists, not to fields or boundaries. Units and payload meaning remain data-product-specific.         |
| Scouting observations          | `/v4/layers/scoutingObservations` and individual/attachment/content routes                            | Lists observations by authenticated user, supports occurrence-time filters and pagination, and provides attachments. The FAQ/API docs specify a 20 MB ceiling for photos stored in a scouting note.                                                                                                                                                                                                  | `scouting:read` (some endpoints also list deprecated `platform`).                                                                                                                                                                   |
| Export                         | `POST /v4/exports`, `GET /v4/exports/{exportId}/status`, `GET /v4/exports/{exportId}/contents`        | Asynchronous request/status/content flow. v4 lists planting-activity GeoJSON (Beta), harvest GeoJSON, and yield-analysis PDF/JSON. Status can be processing, invalid, expired, completed, or no-data. Export content can expire; no exact retention duration is stated.                                                                                                                              | `exports:read`; the description lists additional data scopes for some products, while the OpenAPI security declaration lists only `exports:read` on the request. Treat this as a scope-documentation inconsistency, not permission. |
| Prescription / file upload     | `/v4/uploads` and upload status routes                                                                | Uploads include multiple agronomic products. Shapefile ZIPs are documented for planting and prescription-zone uploads; upload ceiling is 500 MiB and uploads over 5 MiB use contiguous 5 MiB chunks.                                                                                                                                                                                                 | Write scopes vary by product. A shapefile upload is not shapefile export and does not establish rights to import, retain, or redistribute a producer file.                                                                          |

Downloads larger than 5 MiB must be chunked into 1–5 MiB ranges (the final
chunk may be smaller). Per-activity as-planted/as-applied/as-harvested raw
contents are documented as zipped data. No dedicated field-operation map
image export route or shapefile export product was identified in the reviewed
v4 OpenAPI.

## Pagination, freshness, deletion, and version semantics

The API-wide documentation describes `X-Limit` (1–100, default 100),
`X-Next-Token`, `206` for paginated responses, and `409` for an expired token
on some endpoints. Documentation describes `304` inconsistently: the API
overview says no results; the FAQ describes it as “no more data” while
fetching paginated agronomic data. Neither describes conditional HTTP
validation with an ETag or proves that a source object is unchanged.

The v4 field schema has no modification timestamp, archive flag, or deletion
indicator. Activity summaries expose `updatedAt`; source payload summaries
also include timestamps such as `srcLastModified`, `originalSrcModified`,
`indexedAt`, and `lastProcessedAt`. Their definitions are activity/file
specific and do not establish a field/boundary change log or a global
source-currentness guarantee. Activity list endpoints support inclusive
`updatedAfter` and occurrence-time filters. No v4 webhook, Data Subscription
Service, general event feed, or land-record deletion notification was
identified.

An export `xNextToken` may be reused with an otherwise identical request to
obtain additional matching export data (the example describes new fields).
This is a bounded incremental-export aid; it does not document updates to
previously exported objects, deletion detection, token retention, or
complete reconciliation.

The separate v5 “Next Versions” schema lists field, growing-season, report,
prescription-export, resource-owner, and connection-related routes. It is
marked `0.0.0`, last modified 2026-10-07, and the reviewed routes carry
`ALPHA` implementation / `BETA` specification release stages. Its presence
on a production-looking service URL does not override those maturity labels
or prove release availability. Its `updatedAt` and `cropYear` examples do not
retroactively add those fields or semantics to v4.

## Scope inventory and inconsistencies

The v4 security-scheme scope catalog includes `fields:read`,
`farmOrganizations:read`, `operations:read`, `resourceOwners:read`,
`scouting:read`, `exports:read`, `fields:write`, `imagery:write`,
`rx:write`, `soil:write`, `asApplied:read/write`, `asPlanted:read/write`,
`asHarvested:read/write`, `diagnostics:read`, `plantingActivitySummary:read`,
`customerInsights:read`, and `avroAgronomicData:read`. The legacy `platform`
scope is explicitly marked deprecated but remains listed on some v4
operations. `boundaries:write` and `rxZones:write` occur in endpoint/product
descriptions but not in the top-level v4 scope catalog. Export request prose
also describes additional scope requirements that the corresponding
OpenAPI security declaration does not list. These must be resolved through
official partner onboarding before any implementation; no scope should be
guessed.

## Public-evidence conclusion

FieldView publicly documents a technically useful user-scoped API for field,
boundary, activity, scouting, and export data. It does not publicly establish
Cora’s production eligibility or contractual permissions for durable
persistence, transformation, derived semantics, producer export, onward
sharing, replacement-provider use, independent rehydration, retention after
disconnect, post-termination handling, commercial use, or AI/model use.
Details and human questions are tracked in the
[rights matrix](CORA_FV001_CAPABILITY_RIGHTS_MATRIX.md),
[authorization model](CORA_FV001_AUTHORIZATION_MODEL.md), and
[discovery gaps](CORA_FV001_DISCOVERY_GAPS.md).
