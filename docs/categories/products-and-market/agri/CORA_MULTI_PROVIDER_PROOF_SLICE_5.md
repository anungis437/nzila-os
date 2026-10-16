# Cora Multi-Provider Synthetic Proof — Slice 5

**Status:** `CORA_MULTI_PROVIDER_SLICE_5_PASS_WITH_LIMITATIONS`

## Decision

Slice 5 proves that the current provider-neutral continuity kernel can compare
and bundle one bounded agricultural scenario across three synthetic routes
without making any single route the canonical truth:

- Deere-shaped native strategic route;
- Climate FieldView-shaped native strategic route;
- ADAPT-shaped standard-file route.

This proof remains synthetic-only. It does not authorize live provider
connectors, real producer data, rights assumptions, retention, disclosure,
export, or source-currentness claims.

The governing distinctions remain:

- `SOURCE_PROVIDER != ACQUISITION_CHANNEL`
- `TRANSPORT != AUTHORITY`
- `STANDARD_FILE != CANONICAL_TRUTH`
- `PROVIDER_SCHEMA != CORA_CANONICAL_MODEL`
- `CANONICAL_EQUIVALENCE != PAYLOAD_EQUIVALENCE`
- `RIGHTS_DO_NOT_TRANSFER_ACROSS_ROUTES`

## What Slice 5 adds

Slice 3 proved bounded two-route equivalence between a native synthetic route
and an ADAPT-shaped standard-file route. Slice 5 adds a third, FieldView-shaped
native route and a dedicated orchestration layer that:

- runs pairwise route comparisons across all three routes;
- summarizes lossless, lossy, and unresolved semantics per route;
- classifies canonical pressure introduced by each route;
- aggregates rights fail-closed outcomes without transferring rights across
  routes;
- packages a bounded synthetic combined capsule for offline proof exchange.

The implementation lives in:

- `apps/cora/lib/source-continuity/adapters/fieldview/`
- `apps/cora/lib/source-continuity/fixtures/multi-provider-routes.ts`
- `apps/cora/lib/source-continuity/multi-provider-proof.ts`
- `apps/cora/lib/source-continuity/multi-provider-proof.test.ts`

## Bounded proof scope

The proof compares one bounded scenario containing:

- source identity;
- farm/field/boundary relationship identity;
- one agronomic/operational event;
- one measurement with unit semantics;
- route provenance;
- bounded rights state.

The required proof dimensions remain:

- `IDENTITY`
- `RELATIONSHIP`
- `UNIT`
- `MEASUREMENT`
- `OPERATIONAL`

Spatial and temporal meaning remain visible in the reports, but they are not
upgraded to universal equivalence claims when a route cannot justify them.

## Route semantics outcome

### Canonical equivalence

For the bounded required dimensions, the three synthetic routes converge on the
same canonical meaning. The proof module reports this through pairwise
evaluation rather than assuming three-route equality by construction.

### Route-specific fidelity

| Route                     | Bounded canonical meaning | Route-specific evidence preserved                                                                                | Known limitation                                                                                                            |
| ------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Deere-shaped native       | Supported                 | Provider identity, native route provenance, bounded spatial/temporal claims                                      | Synthetic only; no live Deere rights or currentness proof                                                                   |
| FieldView-shaped native   | Supported                 | Provider-scoped FieldView GUIDs, route provenance, `activity.lastModifiedTime` as source-extension evidence      | `lastModifiedTime` is not upgraded to canonical truth or currentness                                                        |
| ADAPT standard-file route | Supported                 | Standard-file acquisition channel, mapping evidence, semantic-loss markers, unresolved upstream-provider support | ADAPT time and geometry semantics remain partial when the file format does not prove observation/effective/modified meaning |

### Canonical pressure outcome

The Slice 5 proof adds route-pressure classification:

- `ALREADY_SUPPORTED_CANONICALLY`
- `SOURCE_EXTENSION_ONLY`
- `DOMAIN_JUSTIFIED_CANONICAL_EXTENSION`
- `PROVIDER_SPECIFIC_AND_REJECTED`
- `UNRESOLVED`

In the current bounded scenario:

- the required land/operation/measurement slice is
  `ALREADY_SUPPORTED_CANONICALLY`;
- FieldView `activity.lastModifiedTime` is retained as
  `SOURCE_EXTENSION_ONLY`;
- no provider-specific field forced a canonical model extension.

That means Slice 5 did **not** contaminate the canonical model with ADAPT or
FieldView-specific schema.

## Rights behavior

Slice 5 intentionally preserves rights asymmetry. A route can match canonical
meaning while still failing protected actions. The proof records each route's
protected-action decisions separately and never treats a right on one route as
available on another.

The tests cover:

- allowed persistence/export/rehydration on the bounded synthetic proof path;
- a degraded route where export and rehydration are denied while canonical
  comparison still proceeds;
- fail-closed reporting of blocked protected actions.

### Synthetic bundle purpose clarification

The combined multi-route capsule uses a dedicated synthetic proof purpose and a
dedicated synthetic proof recipient. Each route's synthetic rights are extended
for that exact bounded proof context only so the shared capsule can be
assembled lawfully inside the synthetic model.

This does **not** mean:

- route rights transfer to another route;
- a real provider granted Cora a general multi-source bundling right;
- Cora may ignore route-specific purpose or recipient limits.

It means only that the bounded synthetic proof can be packaged under an
explicit shared purpose instead of accidentally inheriting one route's purpose.

## Failure behavior

Slice 5 does not silently merge conflicting routes.

If pairwise comparison finds a direct canonical conflict:

- the proof state degrades to `PROVIDER_NEUTRALITY_FAILED`;
- the conflict remains visible;
- the evaluator does not select a winner based on transport, provider, or
  confidence.

Unknown provider identity also remains explicit. A standard-file route does not
become authoritative merely because it is ingestible.

## Provider-neutrality outcome

The proof layer classifies provider-neutrality using:

- `PROVIDER_NEUTRALITY_NOT_PROVEN`
- `PROVIDER_NEUTRALITY_SYNTHETICALLY_SUPPORTED`
- `PROVIDER_NEUTRALITY_SYNTHETICALLY_PROVEN_FOR_BOUNDED_SLICE`
- `PROVIDER_NEUTRALITY_FAILED`

Current Slice 5 outcome:

- canonical meaning is equivalent across the bounded required dimensions;
- route-specific provenance is retained;
- canonical contamination is avoided;
- rights asymmetry is still surfaced as a live limitation.

That supports a bounded synthetic provider-neutrality proof while still
requiring a `PASS_WITH_LIMITATIONS` disposition because:

- the proof is synthetic only;
- rights remain route- and purpose-scoped;
- spatial/temporal fidelity is not universally lossless across all routes;
- no live source-currentness or post-disconnect proof exists.

## Validation evidence

The dedicated Slice 5 proof tests validate that:

1. the bounded three-route scenario evaluates successfully;
2. route-specific limitations remain visible in the summary;
3. degraded rights are reported fail-closed without inventing permissions;
4. conflicting canonical claims fail the neutrality proof;
5. the proof summary is serializable for documentation/exchange.

These tests do not prove:

- legal authority to ingest real provider data;
- runtime source availability;
- production readiness;
- physical deletion verification;
- post-disconnect rehydration rights.

## Non-claims

- No Deere, FieldView, ADAPT, or other provider credential, token, API call,
  export file, or real producer record was used.
- No real FieldView or Deere semantics are asserted beyond their documented
  public shapes and the synthetic bounded scenario.
- The combined capsule is not evidence of lawful multi-provider persistence for
  any real customer dataset.
- Removing the FieldView or ADAPT adapter does not change the kernel contract;
  it only removes one route from the proof harness.

## What remains after Slice 5

Next work should focus on evidence that is still missing without weakening the
rights wall:

- broader continuity-fidelity comparisons for spatial and temporal semantics;
- additional standard/intermediary routes only when they add independence value;
- rights-cleared or pilot-authorized validation only after provider-specific
  rights gates are resolved;
- persistent ledger/storage, independent-reader verification, and physical
  deletion verification for production readiness.

Related records:

- [Cora Provider-Neutral Continuity Kernel — Slice 1](CORA_PROVIDER_NEUTRAL_CONTINUITY_KERNEL_SLICE_1.md)
- [Cora ADAPT Standard-File Qualification — Slice 2](CORA_ADAPT_STANDARD_FILE_QUALIFICATION.md)
- [Cora Source Independence Proof — Slice 3](CORA_SOURCE_INDEPENDENCE_PROOF_SLICE_3.md)
- [Cora FV001 Reference Connector Architecture](CORA_FV001_REFERENCE_CONNECTOR_ARCHITECTURE.md)
