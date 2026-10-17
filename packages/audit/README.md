# Audit hash compatibility

New `AuditEngine.record` entries use `hashVersion: 2`. Their SHA-256 input is a
v2-specific domain, the previous hash and recursively ordered JSON. Nested object
keys are retained and deterministically ordered; array order, JSON primitive
types and null are preserved. Serialization does not mutate the input. Existing
JSON semantics for optional fields and `toJSON` remain; cyclic values and BigInt
are rejected before append. The two-argument `computeAuditHash` API now computes
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
JSON and CSV exports retain the version needed to verify new records.

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

Direct declared consumers are enforcement and platform-integrations. The latter
delegates through an audit-engine port. Tool Fabric is an unmerged consumer and
is outside this PR; its separate ledger chain is not removed or certified here.
No audit API is replaced, no database or migration is introduced, and no UE or
Restricted Data product source changes are included.
