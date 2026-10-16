# Cora Provider-Neutral Continuity Kernel — Slice 1

**Status:** Synthetic-only implementation; not approved for production or live
source data.

## Implemented

The pure `apps/cora/lib/source-continuity/` module defines:

- namespaced source and source-authority references, separate from acquisition
  channel and transport;
- four channel classes: native strategic connector, aggregated connector,
  standard/file connector, and operator import;
- explicit source-access, processing, persistence, transformation, disclosure,
  export, rehydration, deletion, retention-after-disconnect, and freshness
  states;
- mandatory purpose/recipient scope, expiration, revocation, and an explicit
  revocation-authority list;
- `SourceCapture` with distinct `sourceObservedAt`, `capturedAt`, and
  `currentlyVerifiedAt`; `CURRENT` requires an explicit verification time;
- provider-namespaced identity-resolution outcomes, immutable semantic mapping
  references, source/canonical values, and explicit mapping losses;
- source-attributed provenance edges and append-only in-memory continuity
  transitions;
- deterministic in-memory capsule assembly, export and offline rehydration;
- synthetic deletion-obligation reconciliation that does not claim physical
  deletion.

Protected actions require every relevant right to be exactly `ALLOWED`.
Unknown, denied, expired, missing, or conditional rights do not authorize an
action. Conditional rights remain blocked until a separately trusted
condition evaluator exists. Revocation blocks subsequent capture, mapping,
persistence, export, disclosure, and rehydration; a separately granted delete
right remains usable for cleanup.

`CORAJCS-1` sorts object keys, preserves array order, rejects non-finite
numbers, and rejects credential-like payload property names. Capture and
capsule SHA-256 digests detect content changes relative to their recorded
digest; they do not authenticate the source, grant rights, or establish
truth/currentness.

## Explicit non-claims

- No provider connector, Deere-specific implementation, credential, external
  request, producer record, database write, or source persistence exists.
- The fixture rights are synthetic test inputs, not legal or contractual
  determinations.
- `trustedOrgId` and `trustedActorId` are explicit pure-function inputs. No
  runtime identity/authorization service is wired to them yet.
- Offline rehydration verifies capsule format, integrity, mapping digests,
  tenant equality, and rights snapshot. It does not query or refresh a source,
  restore a live provider relationship, or prove the snapshot remains current.
- Deletion reconciliation covers only explicitly declared replica IDs and
  returns `physicalDeletion: NOT_VERIFIED`; it does not perform deletion or
  verify backups, provider systems, or legal holds.
- Four synthetic channels preserve the tested status meaning and expose
  missing acreage on the aggregator route. This does not prove provider
  independence, lawful multi-provider routes, source-rights sufficiency, or
  cross-institution acceptance.
- Mapping execution currently supports exact identity and explicit enum
  lookup in the provider-neutral core, with explicit versioned unit conversion
  evidence now exercised by the isolated synthetic ADAPT adapter. Other
  transforms are not inferred. See
  [Cora ADAPT Standard-File Qualification](CORA_ADAPT_STANDARD_FILE_QUALIFICATION.md)
  and [Cora ADAPT Mapping Contract](CORA_ADAPT_MAPPING_CONTRACT.md).

## Validation boundary

Targeted tests assert fail-closed rights, tenant isolation, deterministic
integrity, explicit semantic loss, revocation, lifecycle transitions, and
offline synthetic capsule reading. These results are conformance evidence for
the pure module only. Production use still requires a server-derived identity
context, source- and purpose-specific rights approval, privacy/security
review, independent-reader verification, persistence/deletion design, and a
separately authorized bounded pilot.

Related contracts:

- [Cora Data Sovereignty and Continuity Architecture](CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md)
- [Cora Connector Governance Contract](CORA_CONNECTOR_GOVERNANCE_CONTRACT.md)
- [Cora Continuity Capsule v1 Contract](CORA_CONTINUITY_CAPSULE_V1_CONTRACT.md)
- [Cora First Cross-Institutional Proof Contract](CORA_FIRST_CROSS_INSTITUTIONAL_PROOF_CONTRACT.md)
- [Cora Source Independence Proof — Slice 3](CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md)
- [Cora Multi-Provider Synthetic Proof — Slice 5](CORA_MULTI_PROVIDER_PROOF_SLICE_5.md)
