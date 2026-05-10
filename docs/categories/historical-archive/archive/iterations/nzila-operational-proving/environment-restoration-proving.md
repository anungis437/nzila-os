# Environment Restoration Proving

**Status:** Active · Proven 2026-05-09
**Authority:** [master-operational-proving-index.md](./master-operational-proving-index.md)

This document records the restoration rehearsal performed against
the pilot tier following the rollback rehearsal.

---

## 1. Restoration performed

| Field            | Value                                                 |
| ---------------- | ----------------------------------------------------- |
| Tier             | pilot                                                 |
| Release          | `R-2026-05-09-PROVE`                                  |
| Reviewer         | aubert                                                |
| Attestation type | `restoration`                                         |
| Attestation ID   | `8a63bb7b-75eb-480c-934c-6e7c589d5393`                |
| Log              | `proof-artifacts/operational-proving/restore-pilot.log` |

Recorded via `pnpm rollout:rollback:attest -- --restore`.

---

## 2. Validations

| Validation                                  | Result |
| ------------------------------------------- | ------ |
| Restoration integrity (separate ledger file)| PASS   |
| Promotion lineage continuity                | PASS   |
| Environment legitimacy restoration          | PASS   |
| Governance readability after restoration    | PASS   |
| Topology restoration (registry intact)      | PASS   |
| Continuity restoration (no window override) | PASS   |

---

## 3. Ledger isolation

Restorations are written to a dedicated
`restorations-YYYY-MM.jsonl` ledger so they do not pollute the
promotion or rollback timelines. Surfaces may merge them for
display but the ledgers remain isolated for audit.

---

## 4. Posture

Restoration is governed identically to a major change attestation.
The CLI requires a non-trivial reason (>= 16 chars) and records
the git SHA automatically.
