# Flow Pilot Outcome Memo (ShopMoiCa)

Date: 2026-04-26
Owner: Pilot Captain (Flow)
Status: Pilot-ready in codebase; production go-live pending external operational approvals.

## Executive Decision

Decision: Proceed to controlled production readiness phase for ShopMoiCa with explicit operational gates.

Rationale:
- Technical readiness gates now pass in-repo.
- Flow app quality gates pass (typecheck, lint, tests, lockdown check).
- Remaining blockers are operational/external (domain, environment approvals, org provisioning sign-off).

## Verified Technical Evidence

1. Root pilot gate passes:
- Command: `pnpm exec tsx scripts/pilot-check.ts`
- Result: PASS
- Artifact: `.pilot-check/attestation.json`

2. Flow app quality gates pass:
- `pnpm --filter @nzila/flow typecheck`
- `pnpm --filter @nzila/flow lint`
- `pnpm --filter @nzila/flow test`
- `pnpm --filter @nzila/flow lockdown:check`

3. Lockdown integrity:
- `lockdown:check` reports 0 violations.

4. Automated cutover gate:
- Checklist source: `docs/ops/pilots/flow-pilot/shopmoica-cutover-checklist.json`
- Local/CI gate: `pnpm exec tsx scripts/flow-shopmoica-cutover-check.ts`
- Enforced mode: `pnpm exec tsx scripts/flow-shopmoica-cutover-check.ts --enforce`
- CI workflow: `.github/workflows/flow-shopmoica-cutover-gate.yml`

## Remaining Non-Code Blockers (Required Before Production Cutover)

1. Domain and DNS cutover
- Confirm canonical production domain mapping for `shopmoica.ca`.
- Validate TLS, redirect, and DNS health checks.

2. Production environment approvals
- Final secret/config review and sign-off.
- Runtime environment parity verification with staging.

3. Tenant provisioning and access controls
- Provision production org and role assignments.
- Validate org isolation and admin/operator access policies.

4. Business and compliance sign-off
- Buyer acknowledgement package delivery.
- Security/privacy packet acknowledgment on file.

## Risks and Mitigations

- Risk: Domain misconfiguration during cutover.
  Mitigation: Run DNS verification and staged traffic checks before full switch.

- Risk: Runtime drift between staging and production.
  Mitigation: Execute parity checks and smoke runbook before go-live.

- Risk: Operational readiness not aligned with technical readiness.
  Mitigation: Require explicit approvals from Platform Owner, CISO, and Pilot Captain.

## Go-Live Recommendation

Recommendation: GO for a controlled production launch window after non-code blockers are closed and sign-offs are recorded.

## Sign-Off

- Platform Owner: Pending
- CISO: Pending
- Pilot Captain (Flow): Pending
- Business Owner: Pending
