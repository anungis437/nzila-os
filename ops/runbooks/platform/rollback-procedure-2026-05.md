# Platform Rollback Procedure — May 2026

Generated: 2026-05-01
Period: 2026-05
Scope: Controlled rollback for nzila-os production workloads without weakening runtime gate

## Rollback Preconditions

All conditions must be met before rollback execution:
- Incident severity is P1 or P2 with confirmed production impact
- Current release identified from release ledger and signed manifest
- Last known good release artifact available and integrity verified
- Change owner + platform-ops approver assigned
- Communication channel active (incident bridge and status updates)

## Rollback Inputs

- Target app name (for example: nzila-os-web, nzila-os-partners, nzila-os-union-eyes)
- Current deployed image digest/tag
- Previous signed image digest/tag
- Deployment inventory routing entry
- Health endpoints for validation

## Standard Rollback Procedure

1. Declare rollback intent in incident channel with app scope and target revision.
2. Freeze non-incident deployments until rollback validation completes.
3. Pin app to previous signed image digest.
4. Apply configuration parity checks (env vars, secrets, ingress mode unchanged).
5. Trigger deployment and wait until revision is healthy.
6. Validate endpoint reachability:
   - root endpoint returns expected status
   - health endpoint returns 200 for app-specific probe
7. Re-run proof health checks for affected environment.
8. Re-run production runtime gate.
9. Record rollback result in release ledger and incident timeline.

## Verification Commands

Use these command patterns during rollback validation:

- pnpm proof:health
- pnpm proof:runtime --period 2026-05
- pnpm proof:runtime:gate -- --env production

## Rollback Safety Rules

- No destructive data operations during rollback.
- Do not rotate credentials as part of rollback unless the incident root cause is credential compromise.
- Keep rollback focused on service restoration; defer non-critical fixes.
- If rollback fails once, stop and escalate to platform-ops lead before second attempt.

## Exit Criteria

Rollback is complete only when:
- Service health probes pass for impacted app
- Runtime gate remains PASSED at 100/100 Grade A
- Incident owner confirms customer impact resolved
- Release ledger and runbook evidence updated

## Known Exceptions

Internal apps with documented rollback exceptions (console, control-plane) may require transactional redeploy instead of revision switch. In those cases:
- Use pinned previous image redeploy pattern
- Execute smoke validation immediately after rollout
- Capture exception use in post-incident report
