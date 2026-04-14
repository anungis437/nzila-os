# CUPE Pilot Rollback Runbook

> Steps to pause or roll back the CUPE pilot if needed.

## When to Use This Runbook

- Critical security issue discovered
- Data integrity concern (e.g., evidence seal verification fails)
- Stakeholder decision to pause pilot
- Infrastructure failure requiring extended downtime

## Step 1: Freeze New Intake and Case Creation

1. Set environment variable: `PILOT_FREEZE=true`
2. The intake API will return `503 Service Unavailable` with message "Pilot temporarily paused"
3. Existing records remain accessible in read-only mode for members

## Step 2: Notify Users

Send email to all pilot participants:

> Subject: Union-Eyes Pilot — Temporarily Paused
>
> The Union-Eyes pilot is temporarily paused while we address [brief reason].
> Your existing records are preserved and accessible in read-only mode.
> We will notify you when operations resume.

## Step 3: Export Case Data

1. For each active case, use the evidence export API:

   ```
   GET /api/cases/{caseId}/export
   ```

2. Verify each export's seal:
   - The `seal` field is a SHA-256 hash of the pack contents
   - Use `verifySeal()` to confirm no tampering
3. Store exports in a secure location (Azure Blob: `backups/pilot-freeze-{date}/`)

## Step 4: Export Audit Trail

1. Query all audit logs for the pilot period:

   ```sql
   SELECT * FROM audit_security.audit_logs
   WHERE created_at >= '{pilot_start_date}'
   ORDER BY created_at ASC;
   ```

2. Export as CSV for legal hold if required

## Step 5: Assess and Resolve

1. Investigate root cause
2. Apply fix
3. Run validation script: `scripts/validate-cupe-pilot-readiness.sh`
4. Get stakeholder sign-off to resume

## Step 6: Resume Operations

1. Remove `PILOT_FREEZE=true` environment variable
2. Verify intake API returns 200
3. Notify users that operations have resumed
4. Monitor for 24 hours post-resume
