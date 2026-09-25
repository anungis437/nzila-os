# PHASE_H_PILOT_ROLLBACK_SUPPORT_SIGNOFF

Applied: 2026-09-23, ~6:03 p.m. ET / `2026-09-23T22:03:50Z` UTC

Ops sign-off for the Phase H controlled **staging-only** pilot.

## Support owner / escalation

| Field | Value |
|---|---|
| Named support / escalation | `support@onelabtech.com` (**APPROVED**) |
| Basis | CANONICAL_SNAPSHOT_LIFECYCLE RBAC grants reference this mailbox |
| Alternate | TBD engineering-on-call if mailbox is not the pilot channel |
| approved | **true** |

## Kill criteria

- Cross-org data leak detected
- Audit log NAR chain breaks or gaps found
- Authentication bypass or session fixation confirmed
- More than 3 unhandled 500 errors per hour sustained for 30+ minutes
- Pilot sponsor / platform lead requests halt
- Authority regression on PRIMARY auth, RLS, tenant isolation, or external-specialist boundary

## Revisions & snapshot

| Field | Value |
|---|---|
| Current traffic revision | `nzila-os-union-eyes-staging--0000259` |
| Prior ACA revision | `nzila-os-union-eyes-staging--0000257` |
| Snapshot ID | `staging-canonical-20260923T184938Z-92611387` |
| Schema digest | `92611387...` |

## Recovery procedure

1. Shift staging ACA traffic from `--0000259` to `--0000257` (or deactivate the tip revision).
2. If DB state is suspect, restore the canonical snapshot into a disposable PG15 target.
3. Halt pilot organization access and notify the approved support owner.
4. **No production touch.**

## Who may terminate pilot

**APPROVED:** platform lead; pilot sponsor; named support owner (`support@onelabtech.com`). `approved=true`.

## ACA rollback dry-run

**OPTIONAL_NOT_RUN** — optional only; not executed and not a gate.

## ROLLBACK_SUPPORT_CONTROLS

| Field | Value |
|---|---|
| status | **PASS** |
| approver | `Aubert / Nzila designated pilot authority` |
| approverDecision | **PASS** |
| signedAt | `2026-09-23T22:03:50Z` |
| pilot_end | **2026-10-07** |
| awaiting_human_approval | **false** |
