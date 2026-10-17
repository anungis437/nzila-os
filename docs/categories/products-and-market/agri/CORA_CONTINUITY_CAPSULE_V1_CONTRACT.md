# Cora Continuity Capsule v1 Contract

**Status:** Proposed design contract with a synthetic-only conformance
implementation; no production schema, live-source use, persistence, or data
collection is authorized.  
**Purpose:** Define a portable, rights-bounded evidence package that can be
preserved and interpreted without requiring Cora or a live source connection.

## Contract goals

A capsule must preserve enough authorized information to identify what was
captured, from which authority, for which purpose and scope, under what
version, with what integrity evidence, and with what limitations. It must
distinguish a portable copy from a pointer back to a provider.

“Open rehydration” means that the documented capsule manifest and any
permitted payload can be parsed and interpreted by an independent reader. It
does not mean that restricted source data may be copied, that Deere must
expose an API, or that a provider reference can be resolved without provider
access. A source reference without an authorized payload is a traceable
reference, not an independently restored source assertion.

## Envelope field inventory

The following remains the governing field inventory. A strict in-memory
conformance model and deterministic JSON serialization are implemented in
`apps/cora/lib/source-continuity/`; they are not an approved production wire
schema. Any production adoption, new payload class, or changed field
requiredness requires separate review.

| Section                | Conceptual contents                                                                                                                                                        | Constraint                                                                                                                                                     |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capsule identity       | Capsule format name/version, unique capsule ID, creation time, creator authority, intended export recipient/purpose.                                                       | No provider credential, refresh token, personal secret, or hidden Cora-only decryption dependency.                                                             |
| Manifest               | Ordered item list, stable item IDs, item type, payload/reference mode, content length, digest algorithm/value when permitted, schema/media type, required/optional status. | Manifest is integrity-checked; unavailable items are explicit, not silently dropped.                                                                           |
| Source attribution     | Source institution/provider, source record/reference, source event/version, source signature/attestation if verifiably supplied, capture method, observation time.         | Do not invent source signatures. A Cora signature attests only to Cora packaging unless otherwise proven.                                                      |
| Subject and scope      | Provider-namespaced subject/organization references and explicit farm/field/product/temporal scope if present and permitted.                                               | Identifiers are not globally meaningful without their namespace. Minimize identifying data.                                                                    |
| Evidence payload       | Exact authorized source object or permitted normalized representation; original and derived values are distinguished.                                                      | Include only payload whose retention and export rights are established. Otherwise carry permitted reference and `PAYLOAD_NOT_INCLUDED_RIGHTS_OR_AVAILABILITY`. |
| Interpretation         | Data dictionary/version, units, enums, timezone, locale, coordinate reference system, transformation steps, and mapping provenance where applicable.                       | Unknowns remain unknown. No undocumented Cora runtime is required to decode mandatory content.                                                                 |
| Authority and handling | Operator authorization reference, purpose, recipients, permitted actions, effective/expiry times, retention/deletion rule, revocation state, rights decision reference.    | Authorization is scoped; it is not a transfer of source rights. Do not put sensitive consent contents in an unprotected package.                               |
| Integrity and custody  | Digests, packaging signature/identity, event chronology, verification algorithm and version.                                                                               | Integrity proves byte consistency, not truth, currentness, completeness, legal rights, or provider authorship.                                                 |
| Limitations and status | `currentness`, `source_access`, `rights`, `identity_binding`, `integrity`, `completeness`, `conflict`, and `availability` states.                                          | Distinguish `UNKNOWN`, `NOT_VERIFIED`, `WITHHELD`, `EXPIRED`, and `CONFLICT`; no success-shaped fallback.                                                      |

## Portability requirements

- The manifest must be independently documented and versioned. A reader
  implementation must be possible from the documentation, not a private Cora
  service or an undocumented database table.
- Use established, documented encodings and integrity algorithms. The capsule
  must declare the exact algorithms and versions used; do not create a
  proprietary opaque binary format.
- Store source identifiers with their provider namespace and any permitted
  source version. Do not treat a live pointer as a recoverable payload.
- Preserve source values and qualifiers separately from normalized fields.
  Every transformation records its input reference, rule/version, output,
  and loss/uncertainty.
- Bind the manifest, items, and rights metadata into the integrity check.
  Tampering or a missing item must be detectable.
- The package must be exportable and verifiable without Cora-specific keys or
  service calls, except where encryption at rest/in transit is required.
  Where a recipient needs a decryption key, the key delivery mechanism is
  separate, authorized, and not embedded in the capsule.
- The capsule must not include access tokens, client secrets, private keys,
  raw session cookies, or credentials in any form.
- Portable storage does not lengthen a retention right. Enforce and record
  expiry/deletion, including derived payloads and applicable replicas.

## Rights states

Each item and operation carries a state such as `AUTHORIZED`, `NOT_AUTHORIZED`,
`UNKNOWN`, `EXPIRED`, `WITHHELD`, or `NOT_APPLICABLE`. A recipient may not
reinterpret `UNKNOWN` as permission. If source data cannot lawfully be
included, the manifest may record only the minimum authorized metadata
necessary to explain omission; metadata itself may still be personal or
protected and must be rights-reviewed.

The capsule must distinguish:

- **operator-carried file:** an operator-provided object; source authorship,
  validity, and Cora's rights to process/retain/export still require
  verification;
- **source-reference:** a provider identifier and attribution; no copy or
  current source state is implied;
- **source verification result:** a dated result from a documented,
  authorized verification path; it is not the underlying source record; and
- **normalized evidence:** a derived representation; it does not replace the
  issuer's original assertion.

## Rehydration states and failure behavior

An independent reader can produce only explicit results:

| State                          | Meaning                                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| `REHYDRATED_VERIFIED`          | Required permitted capsule items, integrity, schema, and provenance checks pass. This does not establish current source status.   |
| `REHYDRATED_PARTIAL`           | Some optional or explicitly non-mandatory items are unavailable; all mandatory requirements still pass and omissions are visible. |
| `BLOCKED_RIGHTS`               | Required action or item has no sufficient, current rights record.                                                                 |
| `BLOCKED_INTEGRITY`            | Digest, signature, or manifest verification fails.                                                                                |
| `BLOCKED_SCHEMA`               | Required content cannot be interpreted from declared public/documented schema.                                                    |
| `BLOCKED_SCOPE`                | Subject, recipient, organization, purpose, or data scope cannot be bound.                                                         |
| `SOURCE_UNAVAILABLE`           | Capsule contains a source reference but not a portable payload, and no permitted source access is available.                      |
| `STALE_OR_CURRENTNESS_UNKNOWN` | Capsule integrity is valid but current status cannot be established from the source's documented validity rules.                  |

### Retention manifest

Capsule v1's implementation includes a per-capture retention manifest with
the rights decision reference, retention-after-disconnect state, and deletion
state. Retention duration and expiry are deliberately represented as
`UNKNOWN`/`null`; authorization does not establish a retention period. The
manifest is covered by capsule integrity. Its presence is not a grant to
retain data, and packaging does not extend any source or operator right.

Rehydration must not query Deere to repair a failed capsule unless separate,
current source access and processing permission has been granted for that
specific action. It must never promote stale or unknown evidence to current.

## Acceptance invariants

### Synthetic implementation boundary

The current module exercises provider-neutral contracts, SHA-256 integrity,
rights-gated in-memory capsule assembly/export/rehydration, append-only
synthetic ledger transitions, and deletion-obligation reporting. It has no
database adapter, network client, credential path, API route, production
authorization resolver, or live-source integration. The harness uses only
invented values and labels all results synthetic.

The `CORAJCS-1` encoding sorts object keys and preserves array order.
Credential-like field names are rejected from source payloads. SHA-256
establishes only deterministic byte-level consistency: it is not a digital
signature, source attestation, authorization, truth, completeness, or
currentness proof.

`ALLOWED_WITH_CONDITIONS` is denied because no trusted condition evaluator is
implemented. The explicit organization argument is a seam for a future
server-derived tenant context, not permission to trust client-supplied tenant
identity. Rehydration verifies the serialized object offline and returns
`sourceCurrentness: NOT_VERIFIED`; it does not contact or represent a source.
Deletion reports cover only caller-declared replica targets and always return
`physicalDeletion: NOT_VERIFIED`.

This synthetic implementation does not meet the independent-reader,
production-rights, live-source, or provider-independence acceptance gates
below. In particular, route conformance across four synthetic acquisition
channels is not proof of multiple lawful providers or runtime replaceability.

Before any pilot is separately considered, a synthetic capsule must:

1. round-trip through a clean independent reader with no Cora runtime;
2. preserve every mandatory permitted item, source attribution, scope,
   version, units, temporal context, and rights state;
3. detect modified bytes, dropped manifest entries, duplicate IDs, and
   invalid signatures;
4. reject unknown mandatory schema versions and unknown rights states;
5. keep source-signed and Cora-packaging signatures distinct;
6. work offline when payload is included, and explicitly report
   `SOURCE_UNAVAILABLE` when it is not;
7. demonstrate that no credential or secret is serialized; and
8. meet the [JD001 rehydration test contract](CORA_JD001_REHYDRATION_TEST_CONTRACT.md).

This contract is subordinate to the
[Cora data sovereignty and continuity architecture](CORA_DATA_SOVEREIGNTY_AND_CONTINUITY_ARCHITECTURE.md)
and the [connector governance contract](CORA_CONNECTOR_GOVERNANCE_CONTRACT.md).
