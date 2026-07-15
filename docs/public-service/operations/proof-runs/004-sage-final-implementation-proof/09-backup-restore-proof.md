# 09 — Backup and Restoration Proof

## Status: NOT_PROVEN (no backup/restore environment provisioned)

A real backup capture and restoration to an isolated environment requires a
production-equivalent managed PostgreSQL with backup tooling and an isolated restore
target. Neither was provisioned in this local proof environment.

## What a valid proof must demonstrate (carried forward)

Restoration must recover, with row-count and hash reconciliation:

```
workspaces, evidence metadata, review notes, decisions,
export requests, export approvals, package metadata,
delivery grants, receipts, retention assignments,
legal holds, destruction requests, destruction evidence,
package tombstones, audit outbox/history
```

And must prove two **negative** invariants:

- Destroyed package **bytes must not reappear** through restoration (the
  `sage_export_package_object` row is deleted at destruction; a point-in-time restore
  from before destruction would reintroduce bytes and must therefore be governed by the
  retention/backup window policy — this policy must be proven, not assumed).
- Terminally destroyed notification **ciphertext must not be restored into an accessible
  state** (migration 0042 clears `encrypted_payload` and sets `payload_destroyed_at`).

## Honest signal from code

The schema, append-only guards and tombstone/ciphertext-destruction semantics are
proven (docs 05/07). These make a *correct* restore possible, but the **restore itself,
the backup window policy, and the two negative invariants above are NOT_PROVEN** here.

## Verdict

Gate G13 = **NOT_PROVEN**. Critical gate → mandates NO_GO until a real restoration is
performed and the byte-non-resurrection and ciphertext-non-resurrection invariants are
demonstrated with reconciliation evidence.
