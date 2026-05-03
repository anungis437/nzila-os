# Union Eyes QA Readiness Model

Last updated: 2026-05-01

## Readiness States

- GO_FOR_UX_TESTING
- GO_FOR_PILOT
- GO_FOR_PRODUCTION
- NO_GO

## What Each State Permits

GO_FOR_UX_TESTING:
- Permits controlled external UX/UI testing only.
- Permits isolated tester sandbox access.
- Does not authorize pilot launch.
- Does not authorize production release.

GO_FOR_PILOT:
- Permits controlled pilot execution.
- Requires UX readiness already satisfied.
- Requires human review before pilot promotion.

GO_FOR_PRODUCTION:
- Permits production release consideration only.
- Requires full production-critical QA thresholds.
- Requires explicit human approval evidence.

NO_GO:
- Blocks UX testing, pilot, and production promotion.
- Returned on critical RBAC/auth/audit/containment failures.

## What Each State Prohibits

- UX_READY prohibits pilot and production promotion.
- PILOT_READY prohibits production promotion without production criteria and human approval.
- Automated report status alone never grants production release.

## Gate Commands

- pnpm ue:qa:gate -- --target ux
- pnpm ue:qa:gate -- --target pilot
- pnpm ue:qa:gate -- --target production

Default behavior:
- pnpm ue:qa:gate (no target) evaluates against ux target.

## Artifact Locations

- artifacts/ue-qa/latest-results.json
- artifacts/ue-qa/qa-report.json
- artifacts/ue-qa/qa-report.md
- artifacts/ue-qa/readiness-summary.md

## Human Approval Requirements

Human review is required for:
- pilot promotion
- production promotion
- RBAC changes
- auditor access changes
- NAR/audit behavior changes
- external tester access approvals

Report payload includes:
- humanReview.requiredForPilot=true
- humanReview.requiredForProduction=true
- humanReview.approver
- humanReview.approvalDate
- humanReview.notes
