# Cora JD001 Continuity Feasibility (Superseded)

> Superseded by [CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md](CORA_JD001_CONTINUITY_FEASIBILITY_MATRIX.md),
> which reflects the official Deere documentation exhaustion pass. The
> initial review below is retained as historical context only; its
> `NOT_ESTABLISHED` capability findings are not current.

**Status:** Design feasibility review only; no source records or live
operations were accessed.  
**Goal:** Preserve only source-attributed evidence whose representation and
handling are both technically defined and expressly rights-cleared, then
rehydrate it without Deere availability.

## Object-class feasibility

| Candidate class                                       | Public capability / temporal evidence                                                                                              | Rights status                                                                                       | Continuity conclusion                                                                                                   |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Deere organization/account identifiers and membership | Organizations route exists; fields, roles, identifiers, and history are not established.                                           | Read, retain, export, and recipient disclosure not authorized/established.                          | Not currently feasible for real Deere data. A Cora-to-provider identity link is not a portable source fact.             |
| Field identifiers and metadata                        | Fields route exists; schema, identity stability, units, archive behavior, and modification history are not established.            | Copy, retention, transformation, and export not established.                                        | Not currently feasible for real Deere data.                                                                             |
| Boundaries or geometry                                | Boundaries route exists; format, authoritative/current boundary selection, effective time, and change history are not established. | Copy, transform, retain, and disclose not established.                                              | Not currently feasible for real Deere data; geometry sensitivity and meaning require review.                            |
| Field operations and associated media/data            | Field Operations route exists; event types, status, temporal meaning, attribution, attachments, and linkage are not established.   | Copy, storage, rehydration, onward disclosure, and commercial use not established.                  | Not currently feasible for real Deere data. No completeness or replay claim is supportable.                             |
| Deere source references, links, or integrity markers  | No public schema, stable-reference guarantee, source signature, digest, or verification contract was accessible.                   | Even identifiers/links may be subject to terms; rights for export and later resolution are unknown. | Do not claim reference-based continuity or verification.                                                                |
| Cora’s own decision/audit metadata                    | Cora platform contracts define Cora-owned authorization and audit behavior.                                                        | Governed by Cora policy, not Deere source rights.                                                   | May be designed/tested independently, but does not reproduce Deere source authority or grant rights over Deere Content. |
| Synthetic fixture and portable reader                 | The [rehydration test contract](CORA_JD001_REHYDRATION_TEST_CONTRACT.md) specifies fabricated data and offline interpretation.     | Synthetic data only; not a grant for real data.                                                     | Technically testable independently; not evidence of live source capability or permission.                               |

## Temporal and change semantics

The accessible Deere API Development License Agreement §3.2 says Deere may
update, delete, refresh, or otherwise modify Deere Content in the Deere
System. This establishes the possibility of source-side mutation, but not:

- per-object `created`, `modified`, effective, expiry, or observation fields;
- monotonic versions, historical snapshots, event ordering, or tombstones;
- notification, polling, webhook, or delta semantics;
- completeness, replay windows, or gap-recovery behavior; or
- propagation of correction, revocation, or deletion to an authorized copy.

Thus no Cora snapshot can be claimed fresh or complete from the public evidence
reviewed. A future design must distinguish source effective time, source
modification time, Cora observation time, and packaging time if Deere
documentation and rights permit those values to be retained.

## Provider-exit and captivity assessment

The displayed API Development License Agreement §§2.1.4, 14.2, and 14.3
allows key revocation and access limitation, suspension, termination, or
removal of a particular API; termination revokes keys and ends its licenses.
The same displayed license limits use to internal development/testing,
restricts content storage/distribution, and requires destruction of Licensed
Materials after termination. No production transition/export guarantee,
data-retrieval window, backup treatment, source-reference permanence, or
independent verification contract was established.

This supports a **material provider-dependency risk**: a Cora capability that
depends on continued API access cannot be represented as portable or
recoverable. It does not prove that a production agreement lacks transition
terms. The displayed agreement also has no visible version date and contains
a `placeholder 1` marker; verify the applicable agreement before legal
reliance.

### Proposed measurable controls (not yet measurable for JD001)

| Measure                                | Required calculation / pass condition                                                                                                                           | Current result                                                         |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Rights-cleared continuity completeness | Permitted mandatory evidence items preserved / all permitted mandatory items; 100%, with denominator defined by an authoritative schema and institutional need. | `NOT_MEASURABLE`: schema, rights, and mandatory set unknown.           |
| Provenance coverage                    | Required provenance fields present or explicitly unknown / all required provenance fields; 100%.                                                                | `NOT_MEASURABLE`: source fields and permitted attribution are unknown. |
| Semantic fidelity                      | Independently interpreted required concepts match source semantics; 100% for the bounded test fixture.                                                          | Synthetic test contract exists; no source semantics to score.          |
| Offline rehydration                    | Independent reader parses, checks integrity, exposes rights/freshness states with network disabled; all mandatory tests pass.                                   | Not run; no implementation.                                            |
| Provider-exit survivability            | Rights-cleared export remains interpretable after API credentials and network are removed, with zero source calls.                                              | Not established; real-data packaging is not authorized.                |
| Capture risk                           | Count of mandatory consumer decisions that fail because access, format, source authority, rights, or interpretation depends on Deere.                           | `NOT_MEASURABLE`: no verified consumer workflow or supported export.   |

No weighted score may conceal a failed rights, completeness, or integrity
gate. The capsule and test contract are proposals, not evidence of
Deere-independent recovery.

## Minimum viable continuity slice

The only currently permissible slice is a **synthetic, source-independent
contract test**: fabricate namespaced identifiers, evidence objects, source
attribution labels, times, scope, status, integrity digest, and rights states;
package them under the proposed capsule manifest; then parse and fault-inject
with the network, Cora, Deere SDK, credentials, and database absent.

No real Deere identifier, link, payload, boundary, operation, derived value,
or operator export belongs in that slice. A real-data slice can be proposed
only after all relevant rights are evidenced and the exact source contract is
verified.
