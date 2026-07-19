# Console — Production Canary Checklist

## Scope
This checklist validates high-risk Console behavior immediately after production deployment, with explicit focus on authz boundaries and billing flows.

## Preconditions
- Deployment completed and healthy at infrastructure level.
- At least two test identities are available:
  - `platform-admin` (has platform role)
  - `org-operator` (member of one org, not platform role)
- One canary org exists with active billing data.
- Rollback owner and incident channel are on standby.

## Timebox
- Run all checks within 15 minutes after deploy.
- If any hard-fail check fails, stop rollout and execute rollback.

## Hard-Fail Checks
1. Auth session integrity
- Action: sign in as `org-operator`, then access an org-scoped page and API route.
- Expectation: `200` only for in-scope org resources; no cross-org data exposure.

2. Cross-org denial
- Action: call at least one org-scoped API with a different `orgId` as `org-operator`.
- Expectation: `403` or `404`; never `200` with foreign org payload.

3. Platform-only route enforcement
- Action: access platform-only endpoints (for example assurance/evidence global views) as `org-operator`.
- Expectation: denied (`403`/`404`).
- Action: repeat as `platform-admin`.
- Expectation: allowed (`200`).

4. Stripe portal org binding
- Action: from billing settings for canary org, open customer portal.
- Expectation: session is created for the same org only; no mismatch between selected org and returned portal context.

5. Stripe refund/report org consistency
- Action: trigger one read-only report and one safe refund-path validation flow for canary org.
- Expectation: only canary org records are queried or mutated; audit entries include correct org identifier.

## Telemetry/SLO Canary Signals
Track these for 15 minutes post-deploy.

1. Authorization denial rate
- Signal: count of denied authz responses for Console protected routes.
- Guardrail: no abrupt spike above normal release baseline.

2. Unexpected 5xx on authz/billing APIs
- Signal: `5xx` rate on Console authz and Stripe-related routes.
- Guardrail: zero sustained `5xx` burst; investigate any repeated errors.

3. Trusted-context failures
- Signal: middleware/security-context validation failures.
- Guardrail: no new sustained failure pattern after deploy.

4. Billing workflow health
- Signal: checkout/portal/refund/report request success rate and latency.
- Guardrail: success rate stable, latency within normal p95 window.

5. Audit trail completeness
- Signal: presence of audit records for canary billing actions.
- Guardrail: every canary action has a corresponding auditable event with actor and org.

## Rollback Triggers
Trigger rollback immediately if any occurs:
- Cross-org access is granted to non-platform user.
- Platform-only endpoint accessible by non-platform user.
- Billing action executes against wrong org.
- Sustained 5xx affecting authz or billing critical routes.

## Evidence Capture
Record in release notes:
- Timestamp and deploy revision.
- Canary operator identity.
- Pass/fail result for each hard-fail check.
- Links to logs/metrics/audit events.
- Final go/no-go decision and approver.
