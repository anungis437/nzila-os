# Union-Eyes (UE) Pilot Deployment

**Severity:** P2  
**Owner:** Platform Engineering / Union-Eyes  
**Last Reviewed:** 2026-02-26  
**Alert:** `ue-pilot-health-degraded`

---

## Trigger

- New union onboarding to Union-Eyes pilot
- Pilot health check failures (readiness probe, Django backend)
- Org isolation concern raised during pilot
- Data export request from pilot participant
- Rollback request from pilot org

---

## Pre-requisites

- Access to Union-Eyes production environment
- Access to Django admin panel (admin role)
- Access to Clerk dashboard (org management)
- Access to Azure Blob Storage (evidence / exports)
- Access to Redis and PostgreSQL dashboards
- `admin` or `owner` OrgRole for the affected org

---

## Support SLA

| Priority | Response Time | Resolution Target |
|----------|--------------|-------------------|
| P1 — Data breach / org isolation failure | 15 min | 2 hours |
| P2 — Feature broken, blocking pilot | 1 hour | 8 hours |
| P3 — Non-blocking bug or question | 4 hours | 48 hours |
| P4 — Enhancement request | Next sprint | Best effort |

**Escalation path:**
1. On-call engineer (PagerDuty `ue-pilot` rotation)
2. Union-Eyes tech lead
3. Platform Engineering lead
4. CTO (P1 only)

---

## Diagnosis Steps

### Step 1: Verify Service Health

```bash
# Check Kubernetes readiness
curl -s https://<UE_HOST>/api/ready | jq .

# Check Django backend health
curl -s https://<UE_HOST>/api/health | jq .
```

```kql
customMetrics
| where name startswith "ue_"
| summarize count() by name, bin(timestamp, 5m)
| order by timestamp desc
| take 50
```

### Step 2: Verify Org Isolation

```kql
# Check for cross-org query attempts
customEvents
| where name == "rls_context_set"
| where customDimensions.orgId != customDimensions.requestOrgId
| project timestamp, customDimensions.orgId, customDimensions.requestOrgId, 
          customDimensions.userId, customDimensions.route
| order by timestamp desc
```

```typescript
// Verify RLS is active for the pilot org
import { withRLSContext } from '@/lib/db/with-rls-context';

const result = await withRLSContext(pilotOrgId, async (db) => {
  return db.execute(sql`SELECT current_setting('app.org_id')`);
});
// Should return the pilot org ID, not empty
```

### Step 3: Check Auth & Permissions

```kql
customEvents
| where name == "auth_failure" or name == "role_check_failed"
| where customDimensions.orgId == "<PILOT_ORG_ID>"
| project timestamp, customDimensions.userId, customDimensions.route,
          customDimensions.requiredRole, customDimensions.actualRole
| order by timestamp desc
```

### Step 4: Check Data Integrity

```kql
# Verify no data leakage across orgs
customMetrics
| where name == "ue_query_total"
| extend orgId = tostring(customDimensions.orgId)
| summarize queryCount = sum(valueSum) by orgId, bin(timestamp, 1h)
| where orgId == "<PILOT_ORG_ID>"
| order by timestamp desc
```

---

## Resolution Steps

### Pilot Onboarding (New Org)

1. **Create Clerk organization** for the pilot entity
2. **Configure RLS context**: Verify `withRLSContext` is applied to all queries for this org
3. **Seed required data**: Run any org-specific migration scripts
4. **Verify isolation**: Run the org isolation verification query (Step 2 above)
5. **Confirm export routes require auth**: Ensure `/api/v2/rewards/export` and `/api/v2/tax/cra/export` return 401 without valid session
6. **Verify cross-org routes**: Confirm `/api/analytics/cross-org` and `/api/analytics/cross-tenant` require admin role
7. **Enable monitoring**: Verify alert rules fire correctly

### If Org Isolation Concern

1. **Immediately** check the cross-org query log (Step 2)
2. If cross-org queries found → **escalate to P1**, follow [org-isolation-breach runbook](../commerce/org-isolation-breach.md)
3. If no cross-org queries → check Django-side RLS via admin panel
4. Verify `withRLSContext` is wrapping all DB calls in affected route
5. Check that `djangoProxy()` passes through the Clerk session correctly

### If Feature Broken

1. Check error logs for the specific route/action
2. Verify Django backend is responding (health check)
3. Check Redis connectivity (session / rate-limit stores)
4. If Django timeout → check DB connection pool saturation
5. If auth error → verify Clerk webhook is syncing org membership

---

## Rollback / Export-All

### Full Data Export

```bash
# Export all data for a pilot org via authenticated API
curl -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  "https://<UE_HOST>/api/v2/rewards/export?orgId=<ORG_ID>&format=csv" \
  -o rewards-export.csv

curl -H "Authorization: Bearer $CLERK_SESSION_TOKEN" \
  "https://<UE_HOST>/api/v2/tax/cra/export?orgId=<ORG_ID>&format=csv" \
  -o tax-cra-export.csv
```

### Rollback (Remove Pilot Org)

1. **Notify** the pilot org contact that rollback is proceeding
2. **Export** all org data (see above)
3. **Disable** the org in Clerk (do NOT delete — preserve audit trail)
4. **Verify** no active sessions remain:
   ```kql
   customEvents
   | where name == "auth_success"
   | where customDimensions.orgId == "<PILOT_ORG_ID>"
   | where timestamp > ago(1h)
   ```
5. **Archive** blob storage artifacts:
   ```bash
   az storage blob directory move \
     --container evidence \
     --source-path "<ORG_ID>/" \
     --destination-path "archived/<ORG_ID>/" \
     --account-name $STORAGE_ACCOUNT
   ```
6. **Update** pilot status document

---

## Monitoring

| Metric / Alert | Threshold | Dashboard |
|---------------|-----------|-----------|
| `ue-pilot-health-degraded` | Readiness probe fails 3x in 5 min | UE Operations |
| `ue_rls_context_mismatch` | Any occurrence | Security |
| `ue_auth_failure_rate` | > 10% of requests in 5 min window | UE Operations |
| `ue_django_proxy_latency_p99` | > 3s | UE Performance |
| `ue_export_unauthenticated` | Any occurrence (should be 0) | Security |

---

## Verification

- [ ] Pilot org can log in and access their data only
- [ ] Cross-org analytics requires admin role
- [ ] Export routes return 401 without auth
- [ ] RLS context is set correctly for all queries
- [ ] No cross-org data leakage in query logs
- [ ] Monitoring alerts fire on test trigger
- [ ] Rollback procedure tested in staging

---

## Evidence to Capture

| Artifact | Description |
|----------|-------------|
| Isolation verification | Output of cross-org query check (Step 2) |
| Auth verification | Proof that export routes reject unauthenticated requests |
| Admin gate test | Proof that cross-org analytics rejects non-admin users |
| Health check logs | Readiness and health probe results |
| Rollback test | Evidence of successful rollback in staging |
