# Governed Rollback System

**Status:** Active
**Effective:** 2026-05-09
**Authority:** [master-rollout-governance-index.md](./master-rollout-governance-index.md)

---

## 1. Position

Rollback is a **legitimacy-preserving** governed event, not a
panic-triggered escape hatch. A rollback executed without governance
is itself a governance incident.

## 2. Rollback Legitimacy

A rollback is legitimate when:

1. The rolled-back release identifier exists in the promotion ledger.
2. The target release identifier is itself a previously legitimate
   release (had its own promotion attestation).
3. The rollback is reviewed at the same authority level as the
   original promotion (e.g., pilot rollback requires sponsor).
4. The rollback attestation has been recorded before resources are
   modified.

## 3. Rollback Attestation

Schema (extends common envelope):

```json
{
  "attestation_type": "rollback",
  "subject": { "tier": "pilot", "from_release_id": "R-...", "to_release_id": "R-..." },
  "payload": {
    "reason": "non-trivial text",
    "reviewer": "named",
    "incident_ref": "INC-...",
    "schema_implications": "none|reverse-migration|snapshot-restore",
    "continuity_window_action": "open|extend|reset"
  },
  "lineage": { "parent_attestation_id": "<original promotion attestation id>" }
}
```

## 4. Rollback Review

Each rollback runs the standard rollout legitimacy review with these
emphases:

- Schema implications (does the rollback require a reverse migration
  or a snapshot restore?).
- Data implications (data created at the higher release).
- Continuity implications (does rollback open or extend a window?).

## 5. Rollback Stabilization

Every rollback opens a continuity window equal to the tier default.
No promotion to that tier is permitted during the window. Operator
surfaces present a calm "Recently rolled back — stabilizing" indicator.

## 6. Rollback Lineage

Rollback attestations form an explicit chain back to the promotion
they reverse. Repeated rollbacks of the same release are visible in
the lineage view and trigger a readiness review per
[continuity-safe-rollout-system.md §7](./continuity-safe-rollout-system.md).

## 7. Required UX Surfaces

- rollback review flow
- rollback legitimacy summary
- rollback attestation lineage view
- rollback continuity posture indicator

## 8. Anti-Patterns

- "Quick rollback" buttons that skip review.
- Rollbacks recorded after-the-fact.
- Rollbacks that quietly truncate data without recording schema
  implications.
- Rollbacks treated as routine operations rather than governed events.
