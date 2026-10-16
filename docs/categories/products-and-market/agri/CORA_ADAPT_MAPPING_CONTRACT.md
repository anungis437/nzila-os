# Cora ADAPT Mapping Contract — Slice 2

**Status:** Bounded, versioned, synthetic-only mapping contract.

## Invariants

- `SOURCE_PROVIDER != ACQUISITION_CHANNEL`
- `TRANSPORT != AUTHORITY`
- `STANDARD_FILE != CANONICAL_TRUTH`
- ADAPT identifiers are source-local references, never Cora-wide IDs.
- An unknown source or authority stays `UNKNOWN`.
- The full synthetic source representation is retained in the capture; a
  mapped canonical field does not replace it.
- A mapping proves neither source truth nor source freshness nor source rights.
- A public/open standard does not grant source-data ingestion, persistence,
  transformation, export, disclosure, retention, or rehydration rights.

## Adapter and mapping identity

| Attribute                      | Value                                                           |
| ------------------------------ | --------------------------------------------------------------- |
| Adapter boundary               | `apps/cora/lib/source-continuity/adapters/adapt/`               |
| Acquisition channel            | `STANDARD_FILE_CONNECTOR`                                       |
| Transport                      | `FILE`                                                          |
| Fixture marker                 | `adapt-adm-3.1.0-cora-fixture-v1`                               |
| Mapping ID / version           | `cora-adapt-land-operation` / `1.0.0`                           |
| Scope                          | One synthetic farm, field, boundary, operation, and measurement |
| Official serialization support | None; input is a Cora-defined synthetic projection              |

The mapping is not exported from the core `source-continuity/index.ts`.
Removing or disabling this adapter does not alter the provider-neutral kernel
or its native synthetic route.

## Bounded mapping table

| Source path/concept               | Cora mapping-result field                   | Confidence                             | Result                                                                                       | Unit handling                                                                                                                     | Time handling                                                                                                           | Identity/provenance                                                  |
| --------------------------------- | ------------------------------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| `farm.id.referenceId`             | `land.farm.sourceLocalReferenceId`          | High for fixture path                  | Lossless value copy when present; otherwise unresolved                                       | None                                                                                                                              | None                                                                                                                    | Remains a source-local reference scoped by provider and capture.     |
| `field.id.referenceId`            | `land.field.sourceLocalReferenceId`         | High for fixture path                  | Lossless value copy when present; otherwise unresolved                                       | None                                                                                                                              | None                                                                                                                    | Not promoted to a universal identity.                                |
| `field.farmId`                    | `land.field.farmSourceLocalReferenceId`     | High for fixture relationship          | Mapped only when it equals the farm `referenceId`; absent/conflicting values are unresolved  | None                                                                                                                              | None                                                                                                                    | Relationship remains source-local and capture-scoped.                |
| `boundary.fieldId`                | `land.boundary.fieldSourceLocalReferenceId` | High for fixture relationship          | Mapped only when it equals the field `referenceId`; absent/conflicting values are unresolved | None                                                                                                                              | None                                                                                                                    | Does not create cross-provider identity.                             |
| `field.area.value` plus unit code | `land.field.area`                           | High for represented numeric/unit pair | Lossless for `acre`; explicit unit conversion for `ha`; absent unit/value is not invented    | `ha` → `acre` using `hectare-to-acre@1.0.0`, scale `2.471053814671653`, offset `0`; retain source/transformed values and evidence | No time role                                                                                                            | Value remains attributable to captured source document.              |
| `operation.operationType`         | `agriculture.operation.type`                | Medium; bounded label copy only        | Value copied; no taxonomy reconciliation is claimed                                          | None                                                                                                                              | None                                                                                                                    | Raw source payload retained.                                         |
| `operation.measurement.value`     | `agriculture.operation.measurement.value`   | High for numeric copy only             | Lossless numeric copy                                                                        | Source unit is copied as the mapped unit; no unrequested unit conversion or semantic equivalence is claimed                       | None                                                                                                                    | Unit field is separately mapped and source remains retained.         |
| `operation.measurement.unit`      | `agriculture.operation.measurement.unit`    | High for literal code                  | Lossless string copy                                                                         | Unit code is not normalized                                                                                                       | None                                                                                                                    | Unknown units remain explicit strings; no unit catalogue validation. |
| `operation.timeScope.timeStamp1`  | `agriculture.operation.timeValue`           | Low without a role contract            | Deliberately `UNMAPPED`; `TEMPORAL_ROLE_UNSPECIFIED`                                         | None                                                                                                                              | Timestamp is retained, but observation/effective/modified role, timezone interpretation, and crop season are unresolved | No date-based identity or freshness claim.                           |
| `boundary.spatialData`            | `land.boundary.geometry`                    | Low without a geometry contract        | Deliberately `UNMAPPED`; `SEMANTIC_LOSS_SPATIAL_NORMALIZATION_NOT_IMPLEMENTED`               | Coordinates/EPSG are retained in source payload; no reprojection, topology, or boundary normalization                             | None                                                                                                                    | Raw source geometry is preserved with provenance.                    |

Confidence describes only the mapping of this bounded fixture representation.
It is not confidence in upstream source correctness.

## Rights and execution

Each capture must include the complete provider-neutral rights snapshot. The
adapter invokes the generic source-capture, mapping, capsule, export, and
rehydration gates; it does not treat an ADAPT license or file format as a
rights grant.

The verified synthetic cases include:

| Action                 | Required right   | Fail-closed evidence                            |
| ---------------------- | ---------------- | ----------------------------------------------- |
| Capture into capsule   | `persistence`    | `UNKNOWN` persistence rejects capsule assembly. |
| Apply semantic mapping | `transformation` | `DENIED` transformation rejects mapping.        |
| Export capsule         | `export`         | `DENIED` export rejects serialization.          |
| Offline rehydrate      | `rehydration`    | `DENIED` rehydration rejects the import.        |

The transformation right gates this implementation's mapping action. It does
not imply a distinct legal right to normalize or derive producer data outside
the synthetic test context. A runtime adapter must receive an independently
approved, purpose- and source-scoped rights decision before execution.

## Mapping-result integrity and loss

Mapping results identify the source provider and acquisition channel
separately; they refer to the capture and immutable mapping version. The
continuity capsule binds mapping results to their source capture and mapping.
Values not mapped to a canonical field remain in the original capture.

The mapping intentionally does not:

- infer a provider from ADAPT or from a plugin;
- resolve a `UniqueId` or numeric reference across captures;
- reconcile operation vocabularies, products, crop seasons, or measurement
  semantics;
- interpret timestamps as source-currentness;
- normalize geometry or claim that source and Cora boundaries are equivalent;
- treat a matching route test as provider independence or legal permission.

## Validation references

- Adapter contract: `apps/cora/lib/source-continuity/adapters/adapt/contracts.ts`
- Synthetic fixture: `apps/cora/lib/source-continuity/adapters/adapt/fixture.ts`
- Mapping: `apps/cora/lib/source-continuity/adapters/adapt/mapping.ts`
- Ingestion: `apps/cora/lib/source-continuity/adapters/adapt/ingest.ts`
- Adapter tests: `apps/cora/lib/source-continuity/adapters/adapt/ingest.test.ts`
- Provider-neutral boundary test:
  `apps/cora/lib/source-continuity/core-adapter-boundary.test.ts`
- Public ADAPT evidence: [Cora ADAPT Standard-File Qualification](CORA_ADAPT_STANDARD_FILE_QUALIFICATION.md)
