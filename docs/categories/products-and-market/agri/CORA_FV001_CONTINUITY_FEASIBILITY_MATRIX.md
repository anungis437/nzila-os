# Cora FV001 Continuity Feasibility Matrix

**Profile:** `FV001` — Climate FieldView Platform APIs
**Status:** Public-document feasibility review only. No live access or data.

## Bounded land and activity graph

```text
FarmOrganization(type=farm)
       |
       +-- Field(parent.id/type=farm)
               |-- boundaryId -> Boundary(UUID)
               |-- resourceOwnerId -> ResourceOwner(UUID)

Authenticated-user operations
       |-- resourceOwnerId -> ResourceOwner
       +-- planting / application / harvest activity lists and activity IDs
```

This is the public v4 API shape, not a claim of legal ownership, universal
identity, or a complete FieldView account hierarchy. It differs from Deere’s
public `Organization → Client/Farm → Field → Boundary` graph: FieldView v4
has a farm-organization get-by-ID route and a Field parent reference, but no
Client object or farm-organization list route was identified. The `resource
owner` model includes a name and email; it must not be treated as a verified
legal entity or Cora organization.

| Gate                       | Public evidence                                                                                                                                                            | State                                           | What remains                                                                                                                                                                        |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Technical land capability  | UUID-based get/list for Fields; farm organization get by type/id; boundary get and batch query; field-to-parent, boundary, and resource-owner links.                       | `TECHNICALLY_DOCUMENTED`                        | No full tenant/org enumeration, field archive status, boundary active state, or complete lifecycle semantics in v4.                                                                 |
| Land semantics             | Field is a logical named unit whose spatial attributes are supplied by a Boundary; parent type is `farm`; boundary is GeoJSON with area and centroid, area in hectares.    | `PARTIALLY_DOCUMENTED`                          | The farm/resource-owner hierarchy, legal identity, boundary history, temporal validity, and geometry coordinate/reference rules need precise confirmation before canonical mapping. |
| Operations and activities  | Generic user-accessible Operations list; separate planting/application/harvest layer lists, summaries, IDs, and zipped raw contents.                                       | `TECHNICALLY_DOCUMENTED`                        | Generic Operation schema is sparse; operation ID is not shown as a route to full detail. Crop/activity mapping must use the activity layers and their exact payload definitions.    |
| Temporal data              | Activity summaries have `createdAt`, `updatedAt`, start/end times, and source/index/process timestamps. Lists can filter occurrence interval and inclusive `updatedAfter`. | `PARTIALLY_DOCUMENTED`                          | These are activity/file timestamps, not field/boundary timestamps or a source-currentness guarantee.                                                                                |
| Units and measurements     | Some activity schemas identify measurement fields, season codes, and source data metadata; area is explicitly hectares for the Boundary schema.                            | `PARTIALLY_DOCUMENTED`                          | Not a global unit system; individual product schemas/raw payloads require field-by-field interpretation.                                                                            |
| Incremental capture        | Paginated lists; `updatedAfter` for operation/activity lists; export `xNextToken` can retrieve additional matching content for an otherwise identical export request.      | `PARTIALLY_DOCUMENTED`                          | No general field/boundary update cursor, event feed, deletion signal, documented token retention, or complete reconciliation guarantee.                                             |
| Freshness/source status    | Activity update/source timestamps and modified-after filter.                                                                                                               | `NOT_ESTABLISHED` for authoritative currentness | A successful API response or `304` does not prove all records are current or unchanged.                                                                                             |
| Contractual permission     | Consumer Terms distinguish Customer Farm Data from Climate-owned Generated Works; partner terms are separately required by onboarding FAQ.                                 | `NOT_AUTHORIZED`                                | Cora-specific rights for capture, persistence, transformation, export, sharing, rehydration, deletion, and post-termination use.                                                    |
| Rehydration/replaceability | A provider-neutral capsule can technically contain authorized captured state.                                                                                              | `TECHNICAL DESIGN POSSIBLE; RIGHTS UNKNOWN`     | Explicit rights for offline/independent rehydration and replacement-provider use.                                                                                                   |

## Freshness and change primitives

| Primitive                                                               | Detects / supports                                                                                                | Does not establish                                                                                                          |
| ----------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `updatedAfter` on v4 planting/application/harvest lists                 | Activity records whose documented modification time is at or after the supplied UTC timestamp.                    | Field/boundary changes; deletion; completeness across all user/resource-owner scopes; exact event latency.                  |
| `occurredAfter` / `occurredBefore`                                      | Activity occurrence intervals matching the documented inclusive interval rules.                                   | Record modification time, currentness, or deletion.                                                                         |
| `updatedAt`, source modified timestamps, `indexedAt`, `lastProcessedAt` | Distinct activity-summary metadata such as last API-record update, source-file change, index, or processing time. | That an underlying producer record is the latest/authoritative state; universal semantics beyond the named activity schema. |
| `X-Next-Token` pagination                                               | Continue a paginated result sequence. Expired tokens can yield `409` on some endpoints.                           | Durable change cursor or recovery guarantee.                                                                                |
| `304` responses                                                         | The docs describe no-results/no-more-page cases depending on context.                                             | ETag/conditional validation, unchanged object, or source-currentness.                                                       |
| Export `xNextToken`                                                     | For identical export parameters, request additional matching export content (example: newly matching fields).     | Changes to prior objects, deletion events, guaranteed window/retention, or full source reconciliation.                      |
| No documented FieldView v4 webhook/event feed                           | None found in reviewed v4 OpenAPI or developer pages.                                                             | Do not presume push events, replay, delivery, or deletion notification.                                                     |
| Account closure/deactivation                                            | Climate’s consumer privacy statement describes customer account requests.                                         | Cora token revocation, API disconnect event, rights to retain/delete Cora copies, or provider-data deletion propagation.    |

## Export and file constraints

The v4 async export request/status/content routes document planting and
harvest GeoJSON and yield-analysis PDF/JSON. Export statuses include
`PROCESSING`, `COMPLETED`, `NO_DATA`, `INVALID`, and `EXPIRED`; no exact
content-retention period is specified. A separate upload flow accepts
shapefile ZIP prescriptions, but the reviewed v4 OpenAPI does not describe a
shapefile export. Raw activity contents are ZIP payloads and large downloads
use ranged 1–5 MiB chunks. These are technical transfer features only; they
do not establish a right for Cora to retain or redistribute the material.

## Minimum continuity conclusion

FieldView publicly documents enough UUID and relationship structure to
identify a bounded **farm–field–boundary** acquisition model, but not a
complete Deere-like organization/client graph. It documents richer
operation/activity time metadata and activity-level incremental filtering
than the land-record surface. A provider-neutral Cora canonical model can
represent these as one source route while preserving provider, acquisition
channel, authority, raw source evidence, mapping version, and rights
separately. Cora must not model the route as complete, continuously current,
or rights-cleared.

See [JD001 comparison](CORA_FV001_JD001_COMPARISON.md) and
[reference architecture](CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md).
