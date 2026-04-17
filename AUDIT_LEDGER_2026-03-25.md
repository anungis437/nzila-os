# Audit Ledger (2026-03-25)

Canonical historical anchor for governance audit events dated 2026-03-25.

## Scope

This ledger identifier is preserved for documentation continuity and audit traceability.
Detailed event payloads are maintained in governed evidence stores and platform audit tables.

## Ledger fields

- event_id
- event_time
- actor_type
- actor_id
- organization_id
- control_id
- action
- evidence_hash
- previous_hash
- current_hash

## Integrity requirements

- Hash-chain continuity must verify without gaps.
- Ledger exports must be immutable once certified.
- Any correction requires a compensating append-only event.

## References

- docs/hardening/AUDIT_TRAIL_SCHEMA.md
- docs/platform/proof/README.md
- tooling/contract-tests/evidence-chain-integrity.test.ts
