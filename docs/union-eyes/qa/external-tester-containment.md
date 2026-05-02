# External Tester Containment (Union Eyes)

Last updated: 2026-05-01

## Objective
Allow external UX/UI testers only inside isolated QA tenant boundaries with full traceability.

## Controls
- Restricted tester users are seeded with deterministic IDs in isolated org: `ue-qa-ux-sandbox`.
- Tester role is `member` (no elevated role path).
- Testers are not inserted into primary or secondary QA organizations.
- Test-user metadata marks external accounts with:
  - `externalTester: true`
  - `monitored: true`
  - `sandboxOnly: true`

## Mandatory constraints
- No production org membership for tester accounts.
- No platform-admin, admin, steward, or officer role grants for tester accounts.
- All tester mutations must be logged/audited.
- QA gate must be `GO` before issuing tester credentials.

## Operational checklist
1. Run `pnpm ue:seed:test-env`.
2. Verify tester account exists only in sandbox org.
3. Run `pnpm ue:qa:gate` and confirm `GO`.
4. Issue temporary credentials and rotate on test window close.
5. Export audit pack for tester session review.
