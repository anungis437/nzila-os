# Audit hash compatibility

New `AuditEngine.record` entries use `hashVersion: 2`. Their SHA-256 input is a
v2-specific domain, the previous hash and recursively ordered JSON. Nested object
keys are retained and deterministically ordered; array order, JSON primitive
types and null are preserved. Serialization does not mutate the input. Existing
JSON semantics for optional fields and `toJSON` remain; the writer captures the
JSON value once before awaiting the store, so caller mutation or stateful
`toJSON` cannot change the value between hashing and persistence. Cyclic values
and BigInt are rejected before append. The two-argument `computeAuditHash` API now computes
v2. Its optional third argument `1` is for historical evidence verification only.

## Historical evidence

**HASH_VERSIONING_REQUIRED.** The old replacer-list encoding covered top-level
fields but omitted nested keys not in that list. Recomputing an old entry with
v2 would invalidate its recorded hash even when no evidence had changed.

An absent `hashVersion` means v1. `verifyChain` and `verifyOrgChain` dispatch by
entry version; they never try v1 after a failed v2 verification. The v2 domain
binds its marker, and a chain cannot return to v1 after its first v2 entry.
Legacy records and root snapshots are not rewritten or re-signed. A v2 writer
can append to the existing last hash without invalidating the legacy prefix.
JSON and CSV exports retain the version needed to verify new records. JSON
preserves absent legacy markers; CSV explicitly emits `1` for them and `2` for
new entries. All CSV fields are quoted and embedded quotes are escaped.

Verification reports `hashCoverage: FULL` or `LEGACY_PARTIAL` and an explicit
`legacyEntriesChecked` count. `valid: true` on a legacy/mixed chain establishes
only the original limited contract, **not integrity of legacy nested payloads**.
Callers requiring full nested integrity must pass `{ requireFullCoverage: true }`;
legacy entries then fail closed. No cryptographic change can retroactively
authenticate fields omitted from a historical hash. Such evidence requires its
existing independent anchors/custody review; never relabel it as fully covered.

## Consumers and scope

The repository supplies an in-memory `AuditStore`; no deployed store or historical
production dataset was accessed. The compatibility decision follows the persisted
entry/export/snapshot contract and reproduced legacy hashes, not an assumption
that no external stores exist. Host stores must preserve `hashVersion` verbatim;
dropping it from v2 entries correctly makes verification fail.

`FULL` describes the hashed entry fields (id, timestamp, actor, organization,
action, resource, resourceId and payload), not transport-only traceId/spanId.
`verifyOrgChain` rejects incomplete or cross-organization store responses instead
of certifying a prefix. Its existing 100,000-entry read bound is fail-closed:
larger chains require host pagination/consistent snapshot support before rollout.
Exports and root snapshot creation retain their existing 100,000-entry bound;
hosts must not use those helpers as complete-chain exports/anchors above it.

Direct declared consumers are enforcement, platform-integrations and tool-fabric. The
platform-integrations package delegates through an audit-engine port; its contract
test covers v2 export round-trips, nested tampering and propagated serialization
errors. The tool-fabric trust ledger computes `hashVersion: 2` entries with
`computeAuditHash`, validates them with `auditEntrySchema`, and verifies them with
`verifyChain(entries, { requireFullCoverage: true })`, so any change to the hash
contract also affects the trust ledger.

## Durable rollout prerequisites

This package supplies only an in-memory store. It copies/freezes persisted JSON
values, but neither it nor `AuditEngine.record` provides an atomic head
compare-and-append. Concurrent writers can race; a durable host must atomically
compare `entry.prevHash` with the organization head, persist the entry and its
version, and reject conflicts (with retries/recovery owned by the host). A
process-local lock is not a multi-process guarantee. Tool Fabric's atomic ledger
contract is separate; these tests do not certify that ledger or any deployed host.

Before a durable transition, inventory existing evidence and independent anchors,
preserve absent/explicit v1 markers without rewriting old hashes or snapshots,
persist v2 markers losslessly, and prove restart/import/export plus conflicting
writer behavior on the actual host. Downstream readers must examine
`hashCoverage` or require full coverage, not treat legacy `valid: true` as full
nested integrity. Unknown versions fail closed; a writer refuses an unknown
head version and a verifier never attempts a legacy fallback. No database
migration, deployment or historical evidence certification is supplied here.
