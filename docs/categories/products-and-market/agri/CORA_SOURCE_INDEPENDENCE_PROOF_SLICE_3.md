# Cora Source-Independence Proof — Slice 3

**Status:** Synthetic-only, bounded comparison. This is not live-provider
independence, production readiness, legal clearance, or proof of provider
replaceability in operation.

## Result

The evaluator compares a synthetic native strategic route with a synthetic
ADAPT-shaped standard-file route. It compares explicit claims only; it does
not assume identical payloads or treat an acquisition channel as an authority.
The required bounded dimensions are identity, relationship, unit,
measurement, and operation type. Those claims are backed by an explicitly
test-only crosswalk, not a universal Cora identifier.

The baseline fixture returns
`PROVEN_FOR_BOUNDED_SYNTHETIC_SLICE`. This means only that the selected claims
compare equivalent, both routes preserve their own provenance, and each
capture permits the evaluated proof actions. It does not mean the providers,
rights, source authorities, payloads, freshness, or semantic coverage are
independent or production-qualified.

## Evidence and limits

| Dimension             | Slice 3 evidence                                                                                                           | Baseline result                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Identity              | Synthetic crosswalk joins route-local farm/field references for this fixture only.                                         | Equivalent within the fixture; not a Cora-wide identity.                |
| Relationships         | Synthetic crosswalk asserts farm-to-field linkage.                                                                         | Equivalent within the fixture.                                          |
| Units and measurement | Both routes assert the same value/unit; ADAPT area conversion also records original and converted units and rule evidence. | Equivalent for required measurement; area conversion evidence retained. |
| Operation             | Both routes assert the same synthetic operation type.                                                                      | Equivalent for required operation type.                                 |
| Spatial               | Native route has explicitly normalized fixture geometry; ADAPT geometry remains unnormalized and records semantic loss.    | Partial.                                                                |
| Temporal              | Native route distinguishes effective and observed time; ADAPT timestamp role remains unspecified.                          | Partial.                                                                |
| Provenance            | Each route separately preserves provider, authority, acquisition channel, transport, and mapping version.                  | Route attribution intact; sources differ and are not collapsed.         |
| Source authority      | Explicit attribution can be carried; an unknown upstream source stays `UNKNOWN`.                                           | Partial when unknown.                                                   |
| Rights                | Evaluated separately for each capture and each protected action. No route lends rights to another.                         | Equivalent only when all tested actions are independently allowed.      |

Conflicting present claims produce `FAILED` and retain both claims with route,
provider, channel, capture, mapping, time, confidence, and evidence references.
The evaluator does not pick a route by transport or confidence. Resolution
requires a source authority or operator with a documented binding.

The continuity-fidelity evaluator reports eight internal dimensions:
semantic, provenance, identity, relationship, temporal, permission, source
freshness, and rehydration completeness. Missing evidence remains unresolved.
The result is explicitly not a public score, ranking, source-currentness
claim, or legal assessment.

Capsule export and offline rehydration are tested for each route after source
availability is absent. The reader can recover the captured package and
mapping evidence without resolving a live provider. Rehydration marks source
availability false and currentness `NOT_VERIFIED`. This does not show that
any real provider's content may be retained or exported.

## Implementation boundary

Added provider-neutral comparison and completeness evaluators, synthetic
paired route fixtures, conflict/rights/unknown-source tests, and a generic
capsule retention manifest. The manifest makes retention duration and expiry
explicitly unknown; it does not infer a retention term from authorization.
ADAPT concepts remain behind the ADAPT adapter and mapping boundary. Canonical
contracts do not include ADAPT types or identifiers.

No live provider connection, producer data, real farm file, credential,
external API call, outreach, or provider runtime claim was used. Deere's
rights gate and Organic Alpha's separate rights gate are unchanged.

## Next slice

Slice 4 should add independent review of the fixture-to-claim evidence binding,
exercise deletion and revocation end to end with persistence adapters still
synthetic, and test capsule reading in a separate minimal consumer that imports
only the documented capsule contract. A later public-evidence qualification
may compare another provider, but this proof alone does not select or authorize
one.
