# Rollout Attestation Fabric

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Purpose

The rollout attestation fabric records, in append-only form, every
governed rollout event. It is the institutional ledger of rollout
legitimacy.

## 2. Attestation Types

| Type                                | Emitted by                                     |
|-------------------------------------|------------------------------------------------|
| Promotion attestation               | `node tooling/scripts/record-promotion-attestation.mjs`                  |
| Pilot legitimacy attestation        | Pilot governance workflow                      |
| Rollout readiness attestation       | `node tooling/scripts/run-rollout-readiness-review.mjs`                       |
| Onboarding readiness attestation    | Institutional onboarding workflow              |
| Deployment governance attestation   | Release pipeline + operator review             |
| Continuity-safe rollout attestation | Continuity workflow on stabilization close     |
| Rollback attestation                | `node tooling/scripts/record-rollback-attestation.mjs`                 |
| Demo session attestation            | Demo operator workflow                         |

## 3. Storage

Attestations are written as JSONL under
`proof-artifacts/rollout-attestations/`:

- `promotions-YYYY-MM.jsonl`
- `reviews-YYYY-MM.jsonl`
- `readiness-YYYY-MM.jsonl`
- `rollbacks-YYYY-MM.jsonl`
- `sessions-YYYY-MM.jsonl`

Files are append-only and rotated monthly. Out-of-band edits to these
files are governance incidents.

## 4. Schema (common envelope)

```json
{
  "attestation_id": "uuid",
  "attestation_type": "promotion|review|readiness|rollback|session|...",
  "timestamp": "ISO-8601",
  "actor": "named-operator-or-system",
  "subject": { "tier": "...", "release_id": "...", "git_sha": "..." },
  "outcome": "PASS|PASS-WITH-CONDITIONS|HOLD|REFUSE|RECORDED",
  "payload": { /* type-specific */ },
  "lineage": { "parent_attestation_id": null }
}
```

## 5. Lineage

Attestations form a lineage. A rollback attestation references the
promotion attestation it reverses. A readiness attestation references
the most recent promotion + bootstrap attestations for the subject
environment.

## 6. Visibility

Attestation viewers expose:

- a per-environment timeline,
- a per-release lineage,
- a search by `release_id` or `git_sha`,
- a calm summary on the operator rollout panel.

## 7. Anti-Patterns

- Silent attestation creation (every attestation has a named actor).
- Backdated attestations (timestamp is wall-clock at recording).
- Attestations created from CI without operator gating for `pilot` and
  `prod` subjects.
