# CUPE Pilot Support SOP

> Standard Operating Procedures for platform support team.

## Scope

This SOP covers support for the CUPE single-local pilot (1–5 worksites, ~100–200 members).

## Common Issues & Resolutions

### 1. Intake Submission or Case Creation Fails

**Symptom**: User gets a validation error when submitting an intake or creating official casework.

**Resolution**:

- Check required fields: title (5+ chars), description (10+ chars), incident date (not future)
- Verify case type is valid (see CUPE vocabulary: 10 case types)
- Check browser console for JavaScript errors

### 2. Authentication Issues

**Symptom**: User can't log in or gets redirected to error page.

**Resolution**:

- Verify user has an active invitation or provisioned account (Admin → Users)
- Check if invitation expired (7-day default) — re-send if needed
- Verify platform auth configuration is present and correct for the environment
- Clear browser cache and retry

### 3. Attachment Upload Fails

**Symptom**: "File type not allowed" or "File too large" error.

**Resolution**:

- Allowed types: PDF, DOCX, XLSX, JPG, PNG, GIF, TXT
- Max file size: 10 MB per file, 50 MB per case total
- Blocked: executables (.exe, .bat), scripts (.js, .py), archives (.zip)
- If ClamAV scan fails: check CLAMAV_URL env var, restart scanner

### 4. Case Not Visible to User

**Symptom**: User reports case disappeared or can't find it.

**Resolution**:

- Verify user is in the correct organization and has the correct role
- RLS policies filter by org — user can only see their org's cases
- Members can only see their own intake and related records; stewards see assigned and authorized local casework
- Check audit trail for case deletion events

### 5. Work and Dashboard Counts Look Wrong

**Symptom**: Dashboard KPIs don't match expected numbers.

**Resolution**:

- Metrics cache refreshes every 5 minutes — wait or hard refresh
- Verify date range filter is set correctly
- Check timezone: all dates stored as UTC

## Escalation Criteria

Escalate to **development team** when:

- Database errors appear in audit logs
- RLS context failures (security concern)
- Multiple users report same issue simultaneously
- Evidence export produces invalid seal (tamper detection triggered)

## How to Reset

### Reset a Case Status (Admin Only)

Use the transition API to move case back to a previous status. All transitions are audit-logged.

### Re-send User Invitation

Admin → Users → find user → click "Re-invite". Previous invitation is invalidated.

## Contact

- **Platform support email**: Provided by your organization admin
- **Emergency**: Contact platform admin directly
