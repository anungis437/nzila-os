# Rollback Procedure Runbook

## Trigger Conditions
- Staging gate failure after deploy.
- Production SLO breach sustained for >5 minutes.
- Policy integrity score drop below accepted threshold.

## Prerequisites
- Approved rollback ticket reference.
- Last known good release tag.
- Confirmed rollback operator with `platform_admin` role.

## Procedure
1. Run release rollback script with target release tag.
2. Validate service health at `/health` and `/health/deep`.
3. Confirm policy enforcement and evidence export integrity.
4. Post rollback confirmation in incident timeline.

## Validation Checklist
- Core APIs return 200.
- Error rate restored to baseline.
- Governance/release dashboards reflect rollback state.
- Customer-facing functionality verified.

## Evidence Requirements
- Rollback command transcript.
- Health/deep-health responses.
- Sealed evidence export hash.
