# Cora FV001 / JD001 Public-Documentation Comparison

**Purpose:** Compare publicly documented native-provider surfaces without
equating API capability, user visibility, or OAuth authorization with Cora
rights.
**Status:** Documentary comparison only. No live provider access or
producer data was used.

## Side-by-side evidence

| Dimension                    | JD001 — Deere Operations Center                                                                                                                                                                   | FV001 — Climate FieldView                                                                                                                                                                                                           |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Public land graph            | Deere docs establish Organization, Client, Farm, Field, and Boundary concepts/links; Client is structurally relevant.                                                                             | v4 documents a farm-organization get-by-ID, Field with farm parent, boundary UUID, and resource-owner UUID. No Client type or farm-organization list route was identified.                                                          |
| Field/boundary access        | Deere documentation describes list/get and broader lifecycle/status mechanisms.                                                                                                                   | v4 fields list/get; boundary get and batch query of up to ten known IDs. No boundary list route.                                                                                                                                    |
| Field Sync / sharing posture | Deere public Field Sync describes farmer-reviewed field matching, preferred naming/boundary choice, synchronization, and undo limitations; public partnership docs describe permissioned sharing. | FAQ explicitly says APIs do not currently return other users’ shared operations to the authenticated user and recommends explicit partner-account connection. No Field Sync-equivalent field matching/sync workflow was identified. |
| Operation access             | Deere Field Operations docs describe list/get operation data and event/deletion indications; detailed capability depends on object/scope.                                                         | v4 has a basic user-accessible Operations list, plus distinct planting/application/harvest layer lists, summaries, raw content, and scouting routes. No generic operation-by-ID route was identified.                               |
| Time/freshness               | Deere docs describe list signatures/eTags and event/Data Subscription Service mechanics, with documented windows and delivery limitations.                                                        | v4 activity summaries include timestamps and activity lists support `updatedAfter`; no equivalent general field/boundary cursor, event feed, or deletion signal was found.                                                          |
| Export                       | Deere Field Operations documentation describes asynchronous field-operation shapefile export and associated metadata; technical export is not an indefinite retention/distribution right.         | v4 async exports include planting/harvest GeoJSON and yield reports as PDF/JSON. Shapefile is documented as prescription upload, not export. Export content can expire, but no exact period is stated.                              |
| OAuth and identity           | Deere documents application registration, org connection via `connections.deere.com`, scopes mapped to permission levels, and user permission ceiling.                                            | FieldView documents OAuth authorization-code login and scope consent, partner API key, and authenticated-user visibility. It does not document the same Deere organization-selection model.                                         |
| Maturity evidence            | Public Deere docs include sandbox examples; production agreement remains separate and unresolved.                                                                                                 | Fixed v4 OpenAPI is dated 2025-12-08. Separate v5 “Next Versions” is `0.0.0`, implementation `ALPHA`, specification `BETA`.                                                                                                         |
| Rights                       | Deere development agreement is restrictive and requires separate production terms for third-party release; Cora rights remain unresolved.                                                         | Consumer Terms distinguish customer farm data and FieldView Generated Works; partner terms are separate and Cora-specific downstream use rights remain unresolved.                                                                  |

## What the comparison changes

1. **No canonical-model redesign.** The two sources expose different land
   hierarchies, relationship keys, sharing visibility, operation layers, and
   freshness tools. This supports retaining Cora-owned canonical objects and
   per-provider mapping boundaries rather than making Cora Deere-shaped or
   FieldView-shaped.
2. **No substitution of one access route for another.** Deere Field Sync and
   FieldView partner connection are not the same product behavior. FieldView
   access to shared operations is explicitly limited in the FAQ; a second
   provider therefore does not automatically replace Deere access or
   establish equivalent source coverage.
3. **No source-independence claim.** Public capability comparison is not
   proof of producer reach, cross-provider identity equivalence, rights
   compatibility, continuity after intermediary loss, or provider
   replaceability.
4. **No rights upgrade.** Deere shapefile export and FieldView GeoJSON/JSON
   exports strengthen the technical portability evidence only. Neither
   proves Cora may retain, normalize, share, rehydrate, or keep data after
   disconnect.

## Continuity and sovereignty implication

FieldView’s activity `updatedAfter` and export token are useful technical
primitives for an eventual authorized capture process; neither is a
source-currentness guarantee. Deere’s documented event/signature mechanisms
are richer for change observation but also have scope and retention windows.
In both cases, absence of deletions, incomplete event delivery, or permission
loss can invalidate claims of completeness. Cora needs its own recorded
capture time, freshness state, rights state, event/reconciliation evidence,
and explicit data-withheld/deletion state.

An export format can help an operator regain usable representations, but
does not alone establish a future provider’s acceptance, durable retention,
or independent rehydration rights.

## Decision

Keep `JD001` as a reference profile and `FV001` as a separate documentary
native-provider profile. Both live connector implementations remain blocked
by their respective rights gates. The next useful work is provider-neutral
and synthetic or rights-cleared: test the same canonical claim dimensions
across route-local mappings and preserve differences in authority,
visibility, temporal meaning, units, spatial fidelity, and action rights.
