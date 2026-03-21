# Runbook: Tenant Isolation Breach / Cross-Org Data Leak

**ID:** RB-006
**Severity:** P1
**Category:** Security
**Owner:** CISO / Platform Engineering
**Last Updated:** 2026-03-03

---

## Symptoms

- Contract test `org-isolation.test.ts` or `cross-org-auth.test.ts` fails
- Audit log shows queries without `org_id` filter on org-scoped tables
- Org reports seeing data from another organization
- Security scan flags RLS policy bypass

## Impact

- **Critical**: Data confidentiality breach between orgs
- Regulatory exposure (POPIA, GDPR)
- Immediate customer trust damage

## Diagnosis

1. **Confirm the breach:**
   - Check audit trail for cross-org data access events.
   - Verify which org(s) and data types are affected.

2. **Identify the vector:**
   ```sql
   SELECT action, actor_id, org_id, target_org_id, created_at
   FROM audit_events
   WHERE org_id != target_org_id
     AND created_at > NOW() - INTERVAL '24 hours'
   ORDER BY created_at DESC;
   ```

3. **Check RLS policies:**
   ```sql
   SELECT schemaname, tablename, policyname, permissive, qual
   FROM pg_policies
   WHERE tablename = '{affected_table}';
   ```

4. **Check application code** for missing `orgId` scoping in queries.

## Remediation

1. **Immediate containment:**
   - Isolate affected org(s) via `@nzila/platform-isolation`.
   - Disable the affected endpoint/feature via feature flag.
   - **Do NOT** attempt to "fix forward" without isolation first.

2. **Assess data exposure:**
   - Enumerate exactly which records were exposed.
   - Document in incident ticket with evidence.

3. **Fix the root cause:**
   - Add missing `orgId` filter / RLS policy.
   - Verify with contract tests (`pnpm contract:test`).
   - Code review by security-qualified engineer.

4. **Notify affected parties:**
   - Internal: CISO, Legal, CTO within 1 hour.
   - External (if confirmed breach): Per data breach notification requirements.

5. **Deploy fix & re-enable:**
   - Deploy to staging, run full contract test suite.
   - Deploy to production.
   - Remove org isolation after verification.

## Prevention

- `org-isolation.test.ts` runs on every PR.
- RLS policies enforced at database level.
- `@nzila/db` scoped DAL prevents raw queries without org context.
- Quarterly isolation certification (Console → Isolation).

## Audit

- All steps must create audit events.
- Evidence pack required: audit trail export, containment log, remediation tracker.
- Retain for 7 years per data lifecycle policy.
