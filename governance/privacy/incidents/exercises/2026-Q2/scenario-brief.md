# Scenario Brief — 2026-Q2 Security IR Tabletop

Exercise date: 2026-06-07
Exercise type: formal tabletop (simulated response)
Scope: Console authentication + billing path anomaly with potential data exposure risk.

## Scenario Summary

At 14:02 UTC, monitoring reports a sudden spike in denied authz requests and elevated 5xx responses on billing-adjacent API routes. A concurrent internal report flags potential cross-org metadata mismatch in a payment workflow. No confirmed exfiltration at initial detection.

## Objectives

1. Validate severity classification and IC activation speed.
2. Validate containment sequence (session control, route gating, rollback decision).
3. Validate breach-assessment handoff timing and required notifications decision path.
4. Validate evidence capture quality for post-incident legal and compliance review.

## Assumptions

- Production systems remain available to responders.
- Observability stack is operational.
- Break-glass credentials are available through approved path.

## Success Criteria

1. Severity declared within SLA for SEV2 or higher.
2. Initial containment decision made within 30 minutes.
3. Breach-assessment branch initiated within 60 minutes.
4. All decisions logged with owner and timestamp.
