# Cora ADAPT Standard-File Qualification — Slice 2

**Status:** `CORA_ADAPT_SLICE_2_PASS_WITH_LIMITATIONS` after synthetic-only
implementation and validation. ADAPT is qualified as a public standard and
reference framework for bounded file-interoperability experiments; this is not
a production connector approval.

## Decision

ADAPT is modeled only as
`ACQUISITION_CHANNEL = STANDARD_FILE_CONNECTOR`. An ADAPT-shaped file may carry
data originating from an OEM, FMIS, agronomic system, operator export, or
another compatible system. ADAPT is not the source provider, source authority,
institutional authority, or Cora's canonical ontology.

The adapter preserves an upstream provider and authority only when the
synthetic input explicitly supplies them. Otherwise it records `UNKNOWN`.
Neither `ADAPT` nor the file adapter is substituted as source authority.

The governing distinctions remain:

- `SOURCE_PROVIDER != ACQUISITION_CHANNEL`
- `TRANSPORT != AUTHORITY`
- `STANDARD_FILE != CANONICAL_TRUTH`

Public standard capability, Cora's bounded implementation, and source rights
are independent claims. The public availability of ADAPT or its code license
does not authorize Cora to ingest, persist, transform, export, disclose, or
rehydrate any producer's data.

## Public-source qualification

The official AgGateway ADAPT site describes the ADAPT Framework as an
Agricultural Application Data Model, common API, and set of conversion
plug-ins. It states participating FMIS implementations map the shared ADM to
their own models. The plugin interface supports identifying and validating
data cards and importing/exporting application data models. These are
framework capabilities, not guarantees that every product implements a
plugin, that all concepts round-trip losslessly, or that a given file can be
opened without an appropriate plugin.

The public project is
[AgGateway-ADAPT/ADAPT](https://github.com/AgGateway-ADAPT/ADAPT). The
repository includes a .NET Application Data Model and separate model
directories for field boundaries, logged data, equipment, products,
prescriptions, guidance, shapes, and documents. At the qualification snapshot,
the repository's visible release was `v3.1.0`; the inspected source tree was
commit
[`92615dd80d6eeb74ccdff878249f1ee09b5e799f`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f).
The framework site describes controlled versioning and release candidates.
This snapshot does not establish that every `develop`-branch source file is
part of the released v3.1.0 API.

The repository's `LICENSE` identifies Eclipse Public License 1.0 (EPL-1.0).
That license applies to covered repository materials under its terms; it does
not grant rights in files produced by an ADAPT plugin, data supplied by a
grower, proprietary plugin behavior, or underlying provider content.

### Public model concepts observed

| Concept area                    | Public model evidence                                                                                                                                                                                                                                                                            | Qualification                                                                                                                                                                                                                                                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ADM and plugin architecture     | [`ApplicationDataModel.cs`](https://github.com/AgGateway-ADAPT/ADAPT/blob/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/ADM/ApplicationDataModel.cs), [`IPlugin.cs`](https://github.com/AgGateway-ADAPT/ADAPT/blob/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/ADM/IPlugin.cs) | Shared in-memory model and plugin import/export interface. A plugin is required for concrete file-format support.                                                                                                                                                                                                     |
| Farms, fields, and identifiers  | [ADAPT model source](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT)                                                                                                                                                                        | Objects use model-local integer references and may also carry `UniqueIds`; neither is inherently a Cora-wide identity.                                                                                                                                                                                                |
| Boundaries and spatial data     | [`FieldBoundary.cs`](https://github.com/AgGateway-ADAPT/ADAPT/blob/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/FieldBoundaries/FieldBoundary.cs)                                                                                                                                       | Includes `FieldId`, `MultiPolygon` spatial data, original EPSG code, time scopes, headlands, and contextual attributes. This does not itself define Cora's coordinate validation or normalization.                                                                                                                    |
| Operations and measurements     | [`OperationData.cs`](https://github.com/AgGateway-ADAPT/ADAPT/blob/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/LoggedData/OperationData.cs), [`LoggedData`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/LoggedData)            | Operation data can reference products, equipment configurations, prescriptions, loads, and spatial records. Logged data includes numeric/enumerated working data and spatial records. A single operation's effective time, crop-season meaning, and rate semantics require model- and source-specific interpretation. |
| Products and inputs             | [`Products`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/Products)                                                                                                                                                                       | Product and category types cover crop, crop-protection, crop-nutrition, variety, and other product concepts. Identity and category semantics remain product-specific.                                                                                                                                                 |
| Equipment and machines          | [`Equipment`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/Equipment)                                                                                                                                                                     | Model contains equipment configurations, machines, implements, and device elements; this is not proof of live telemetry access or equivalence to AEMP/ISO 15143-3 feeds.                                                                                                                                              |
| Units and time                  | [`Representations`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/Representations), [`Common`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/Common)                                 | The model includes numeric representations/unit objects and time-scope constructs. Source unit codes, time zones, timestamp roles, and crop-season semantics need explicit interpretation; no universal conversion is inferred.                                                                                       |
| Extensibility and serialization | [`ADM`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/ADAPT/ADM), [`PluginManager`](https://github.com/AgGateway-ADAPT/ADAPT/tree/92615dd80d6eeb74ccdff878249f1ee09b5e799f/source/PluginManager)                                                 | Model properties include extension/proprietary values and plugin APIs provide file import/export. The framework model is not one universal serialization format.                                                                                                                                                      |

Public sources reviewed:

- [ADAPT Framework overview](https://adaptframework.org/)
- [ADAPT Framework versioning](https://adaptframework.org/farmework-versioning/)
- [ADAPT repository](https://github.com/AgGateway-ADAPT/ADAPT)
- [ADAPT v3.1.0 release](https://github.com/AgGateway-ADAPT/ADAPT/releases/tag/v3.1.0)
- [ADAPT EPL-1.0 license](https://raw.githubusercontent.com/AgGateway-ADAPT/ADAPT/develop/LICENSE)
- The pinned model-source links in the table above.

The official source tree is a model/reference implementation, not a provider
contract. This qualification does not assert availability of a producer's
ADAPT export, completeness of a plugin, or permission to use any such export.

## Cora implementation boundary

The implementation lives under
`apps/cora/lib/source-continuity/adapters/adapt/` and remains outside the
provider-neutral package barrel. It accepts a strict, bounded synthetic Cora
fixture envelope labeled `adapt-adm-3.1.0-cora-fixture-v1`. That label is a
Cora fixture/schema marker, **not** an official ADAPT file serialization and
not an ADAPT parser.

For the supported fixture only, the adapter:

1. validates the synthetic envelope;
2. creates a source capture with `STANDARD_FILE_CONNECTOR` and `FILE`;
3. preserves the entire source envelope and any explicitly provided upstream
   provider/authority identity;
4. applies immutable mapping version `1.0.0`;
5. records mapping results, transformation evidence, provenance, and known
   semantic losses;
6. assembles an integrity-checked continuity capsule; and
7. supports offline rehydration using only the synthetic rights snapshot.

No live provider, real farm file, copied proprietary data, network request,
credential, runtime connector, or official-format file parser is included.
The synthetic rights vector is test input, not a legal or contractual
determination.

## Slice result and limits

The tests demonstrate bounded canonical-meaning equivalence for selected
synthetic land and operation fields over a native route and the standard-file
route. The route comparison intentionally excludes source payload identity,
acquisition provenance, unnormalized geometry, and unresolved time semantics.
`providerIndependenceProven` remains false.

The test suite also proves that:

- hectare-to-acre conversion retains source value/unit, transformed value/unit,
  transformation version, and evidence reference;
- unrecognized measurement units are preserved as-is, while absent area units
  are not fabricated;
- missing or conflicting land identifiers/relationships remain unresolved;
- timestamps are preserved without assigning observation/effective/modified
  roles;
- geometry remains in the source capture and is marked as semantic loss;
- unknown upstream provider remains `UNKNOWN`, never `ADAPT`;
- persistence, transformation, export, and rehydration fail closed when their
  respective rights are unknown or denied; and
- the existing core route test uses the provider-neutral mapper without an
  ADAPT import.

Not established: actual ADAPT serialization parsing; exhaustive conversion of
ADM objects; general identity resolution; canonical spatial normalization;
operation/crop-season semantics; producer source rights; persistent storage;
production authorization; independent reader; source currentness; provider
independence; or production readiness.

Slice 3 completed a bounded synthetic comparison of native and standard-file
routes. The result remains scoped to explicit fixture claims and does not
establish live-provider independence. See
[CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md](./CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md)
and [CORA_CONTINUITY_FIDELITY_CONTRACT.md](./CORA_CONTINUITY_FIDELITY_CONTRACT.md).
It must not introduce a live connector absent separate source-right and
product approval.
