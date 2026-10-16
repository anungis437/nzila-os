# Cora FV001 Reference Connector Architecture

**Profile:** `FV001` — Climate FieldView Platform APIs
**Status:** Reference profile only. Not implemented, activated, or authorized.

## Architectural role

If separately qualified, FieldView would be a **Native Strategic Connector**.
The provider identity is Climate FieldView; the acquisition channel is a
provider-native API connector; OAuth and HTTPS are transport/authentication
mechanisms, not authority.

```text
SOURCE_PROVIDER = CLIMATE_FIELDVIEW
ACQUISITION_CHANNEL = NATIVE_STRATEGIC_CONNECTOR
TRANSPORT = HTTPS_REST + OAUTH2 + PARTNER_API_KEY
SOURCE_AUTHORITY = RECORD_SPECIFIC; UNKNOWN UNTIL EVIDENCED
```

The authenticated-user context, a `resourceOwnerId`, or a customer’s
ownership statement must not automatically be treated as the source authority
for every underlying record. Preserve actual upstream authorship where
documented; otherwise use `UNKNOWN`.

## Trust and mapping boundaries

```text
FieldView OAuth/API responses or authorized export files
  -> immutable source capture + exact raw representation (only if rights allow)
  -> FieldView-versioned mapping at the connector boundary
  -> Cora-owned canonical objects and provenance
  -> rights-gated capsule, export, or rehydration
```

Provider-specific names, UUIDs, scopes, payloads, timestamps, and units
remain in the adapter/mapping evidence. Cora canonical contracts do not adopt
FieldView identifiers or schemas as universal truth. The connector must
preserve provider, acquisition channel, transport, authority, resource-owner
reference, capture time, source timestamps, API/spec version, mapping version,
and every field-level loss or ambiguity.

| Source shape                                                     | Candidate Cora interpretation                 | Required qualification                                                                                         |
| ---------------------------------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| FarmOrganization with type `farm`                                | Source-local farm identity                    | Keep provider UUID and type; do not map to a legal organization without binding evidence.                      |
| Field UUID, name, parent, boundary UUID, resource-owner UUID     | Source-local field identity and relationships | Resolve field/farm/resource-owner identities separately; field schema lacks status and modified time.          |
| Boundary GeoJSON Feature, hectare area, centroid                 | Spatial assertion with source geometry        | Preserve original geometry and its source metadata; do not claim active/current without documented status.     |
| Operation list record                                            | Source operation reference                    | Basic model has id/name/resource owner only; do not infer operation type or full event detail from it.         |
| As-planted/as-applied/as-harvested activity summary and raw file | Agronomic event assertions and observations   | Keep source time roles distinct; retain original unit/value alongside any mapping and transformation evidence. |
| Scouting observation/attachment                                  | Field observation and media reference         | Treat personal data, image rights, file limits, and recipient disclosure separately.                           |

## Rights-aware execution contract

No future adapter method should execute by default merely because an OAuth
token and API key are present. Before each operation, the provider-neutral
governance resolver must establish capability state and the complete rights
vector for source read, persistence, transformation, disclosure, and
rehydration, plus freshness and revocation state. Unknown/denied/expired
rights must fail closed and surface a non-success state. Token refresh
storage is authentication-secret handling, not permission to store source
records.

Activity-list `updatedAfter` may inform a bounded rescan strategy for those
activity classes only. It is not a general field/boundary freshness feed.
Without a deletion signal and documented reconciliation method, Cora must
not represent a captured set as complete or current.

## Provider neutrality and route independence

Equivalent source state may arrive through a native API, an ADAPT or other
standard file, an aggregated connector, or operator import. Each route
retains its own channel and source provenance and uses separate mappings and
rights. A matching canonical value does not prove that the routes carry
equivalent authority, temporal semantics, spatial fidelity, rights, or
completeness.

## Architecture decision

FieldView reinforces the value of a provider-neutral kernel because its
public field graph, user visibility, operation vocabulary, and time/freshness
surface are not identical to Deere’s. It does not change the canonical
architecture, create a second runtime connector, or justify broad ETL,
farm-management, data-lake, or aggregator behavior. No live implementation
is in scope until the contractual and privacy gates are affirmatively
resolved.

Related contracts:
[connector governance](CORA_CONNECTOR_GOVERNANCE_CONTRACT.md),
[continuity capsule v1](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md),
[Slice 3 source-independence proof](CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md),
and the [JD001 reference profile](CORA_JD001_REFERENCE_CONNECTOR_ARCHITECTURE.md).
