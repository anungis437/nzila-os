# UE Pilot — CUPE Local 123 Provisioning & Runbook

**Severity:** P2  
**Owner:** Platform Engineering / Union-Eyes  
**Last Reviewed:** 2026-05-03  
**Alert:** `ue-pilot-health-degraded`  
**Pilot Org ID:** `cupe-local-123`  
**Pilot Org Slug:** `cupe-local-123`  
**Environment:** `ue-pilot-cupe` (Canada Central — PIPEDA / Québec Law 25)

---

## Overview

Controlled-access pilot of Union-Eyes for CUPE Local 123. Participant capacity:
1–3 internal Nzila users, 1 optional external UX tester. No mass onboarding.
All new cases must enter the system through Union-Eyes from day 1 of the pilot.

Org isolation is enforced at the application layer via PostgreSQL row-level security.
Every DB operation runs inside `withRLSContext(orgId, ...)` which executes
`SET LOCAL app.org_id = 'cupe-local-123'` before any query. There is no separate
database schema for this pilot.

---

## Pre-requisites

| Requirement | Notes |
|-------------|-------|
| KeyVault access | `nzila-staging-kv` (nzila-staging-rg, Canada Central) |
| Azure Container Apps access | `nzila-canada-staging-rg` |
| PostgreSQL access | `nzila-staging-db` (nzila-staging-rg) |
| Azure Blob Storage access | `nzilacanadastore` — `evidence` container |
| `admin` OrgRole | Required for provisioning, DB verification, and rollback |

---

## Support SLA

| Priority | Response Time | Resolution Target |
|----------|---------------|-------------------|
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

## Step 1 — Seed Demo Data

Demo data (7 members, 5 cases, 3 worksites) is seeded using the existing script.
Skip this step if the pilot will use live data only.

```bash
# Seed CUPE Local 123 demo data
cd apps/union-eyes
node scripts/seed-cupe-pilot.mjs

# Verify row counts
PGPASSWORD=$PGPASSWORD psql -U nzila -d nzila_automation -h $PGHOST -p $PGPORT \
  -c "SELECT COUNT(*) FROM union_eyes.members WHERE org_id = 'cupe-local-123';"

# To reset demo data (removes all seeded rows and re-inserts)
node scripts/seed-cupe-pilot.mjs --reset
```

Fixture source: `fixtures/cupe/pilot-org/cupe-pilot-setup.json`

---

## Step 2 — Provision Real Pilot Users

Pilot users authenticate via email/password (Argon2id) or Entra SSO.
Do NOT enable self-registration for this pilot.

### 2a. Create user accounts

Use the `platform-auth` admin UI or the `auth.users` + `auth.org_members` tables directly.
Approved participants:

| User | Role | Auth method |
|------|------|-------------|
| Internal admin (Nzila) | `admin` | Entra SSO |
| CUPE steward #1 | `steward` | Email/password |
| CUPE member #1 | `member` | Email/password |
| External UX tester (optional) | `member` | Email/password |

### 2b. Assign org membership

```sql
-- Insert org membership for a real user (replace UUIDs as appropriate)
INSERT INTO auth.org_members (user_id, org_id, role, created_at)
VALUES (
  '<user-uuid>',
  'cupe-local-123',  -- NOT a UUID — this is the org slug-ID used in union_eyes tables
  'steward',
  now()
)
ON CONFLICT (user_id, org_id) DO UPDATE SET role = EXCLUDED.role;
```

> **Important:** `auth().orgId` returns the Entra AD security-group GUID, not the
> app-level org ID. Always use `getOrganizationIdForUser(userId)` from
> `organization-utils.ts` to resolve the correct org ID for role lookups.

### 2c. Verify user can log in

```bash
# Health check (auth-exempt — no session required)
curl -s https://<UE_HOST>/api/auth_core/health/ | jq .

# Confirm session cookie is set after login
curl -c cookies.txt -b cookies.txt -s https://<UE_HOST>/api/health | jq .
```

---

## Step 3 — Verify Org Isolation

Run immediately after provisioning and again after the first real case is created.

```sql
-- All members in the pilot org
SELECT COUNT(*) FROM union_eyes.members WHERE org_id = 'cupe-local-123';

-- Confirm no members from other orgs are visible under this RLS context
-- (Run inside withRLSContext in a local Node REPL)
-- Expected: only cupe-local-123 rows
SELECT org_id, COUNT(*) FROM union_eyes.members GROUP BY org_id;
```

```kql
-- Cross-org query detection (should return 0 rows)
customEvents
| where name == "rls_context_set"
| where customDimensions.orgId != customDimensions.requestOrgId
| where customDimensions.orgId == "cupe-local-123" or customDimensions.requestOrgId == "cupe-local-123"
| project timestamp, customDimensions.orgId, customDimensions.requestOrgId,
          customDimensions.userId, customDimensions.route
| order by timestamp desc
```

---

## Step 4 — Deploy Pilot Revision

The pilot uses the existing `nzila-os-union-eyes` container app with a dedicated
revision label. The GitOps manifest is at
`infrastructure/gitops/environments/ue-pilot-cupe.yml`.

```bash
# Apply pilot-specific env vars to the container app
az containerapp update \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  --revision-suffix ue-pilot-cupe \
  --set-env-vars \
    NEXT_PUBLIC_APP_ENV=ue-pilot-cupe \
    PILOT_ORG_ID=cupe-local-123 \
    PILOT_ORG_SLUG=cupe-local-123 \
    ALLOW_MASS_ONBOARDING=false \
    DJANGO_API_URL=http://nzila-os-union-eyes-django-pilot \
    NEXT_PUBLIC_DJANGO_API_URL=http://nzila-os-union-eyes-django-pilot \
    READY_REQUIRE_QUEUE=true \
    OTEL_TRACES_SAMPLER_ARG=1.0 \
    DATABASE_POOL_SIZE=10

# Verify the revision is active and healthy
az containerapp revision show \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  --revision nzila-os-union-eyes--ue-pilot-cupe

# Verify pilot Django sidecar revision health
az containerapp revision list \
  --name nzila-os-union-eyes-django-pilot \
  --resource-group nzila-canada-pilot-rg \
  --query "[].{name:name,active:properties.active,health:properties.healthState,replicas:properties.replicas}" \
  -o table
```

---

## Step 5 — Health Checks

```bash
# UE ingress liveness
curl -s https://<UE_HOST>/api/health | jq .

# UE ingress readiness
curl -s https://<UE_HOST>/api/ready | jq .

# Django backend sidecar health (auth-exempt)
curl -s https://<UE_HOST>/api/auth_core/health/ | jq .
```

```kql
-- UE metrics for the pilot org (last 30 min)
customMetrics
| where name startswith "ue_"
| summarize count() by name, bin(timestamp, 5m)
| order by timestamp desc
| take 50
```

---

## Step 6 — Access Control

- Participant list is maintained in the Nzila internal pilot tracker.
- No self-registration or invite links are to be shared publicly.
- `ALLOW_MASS_ONBOARDING=false` is enforced in the env config.
- Role assignments must be approved by the Union-Eyes tech lead.
- External UX testers receive `member` role only; no `admin` or `steward` access.

---

## Monitoring & Alerts

| Metric / Alert | Threshold | Dashboard |
|----------------|-----------|-----------|
| `ue-pilot-health-degraded` | Readiness probe fails 3× in 5 min | UE Operations |
| `ue_rls_context_mismatch` | Any occurrence | Security |
| `ue_auth_failure_rate` | > 10% of requests in 5 min window | UE Operations |
| `ue_django_proxy_latency_p99` | > 3 s | UE Performance |
| `ue_export_unauthenticated` | Any occurrence (must be 0) | Security |

PagerDuty rotation: `ue-pilot`

```kql
-- Auth failures for the CUPE pilot org
customEvents
| where name == "auth_failure" or name == "role_check_failed"
| where customDimensions.orgId == "cupe-local-123"
| project timestamp, customDimensions.userId, customDimensions.route,
          customDimensions.requiredRole, customDimensions.actualRole
| order by timestamp desc
```

---

## Rollback Procedure

### Step R1 — Notify participants

Inform the CUPE pilot contact and the Union-Eyes tech lead that rollback is proceeding.

### Step R2 — Export org data

```bash
curl -H "Authorization: Bearer $SESSION_TOKEN" \
  "https://<UE_HOST>/api/v2/rewards/export?orgId=cupe-local-123&format=csv" \
  -o cupe-pilot-rewards-export.csv
```

### Step R3 — Deactivate the pilot revision

```bash
az containerapp revision deactivate \
  --name nzila-os-union-eyes \
  --resource-group nzila-canada-staging-rg \
  --revision nzila-os-union-eyes--ue-pilot-cupe
```

### Step R4 — Disable org (preserve audit trail)

Use the `platform-auth` admin UI to set the org status to `inactive`.
Do NOT delete the org — the audit trail must be retained.

### Step R5 — Verify no active sessions remain

```kql
customEvents
| where name == "auth_success"
| where customDimensions.orgId == "cupe-local-123"
| where timestamp > ago(1h)
```

### Step R6 — Reset demo data (if applicable)

```bash
cd apps/union-eyes
node scripts/seed-cupe-pilot.mjs --reset
```

### Step R7 — Archive blob storage

```bash
az storage blob copy start-batch \
  --source-container evidence \
  --destination-container evidence \
  --source-path "cupe-local-123/" \
  --destination-path "archived/cupe-local-123/" \
  --account-name nzilacanadastore
```

---

## Key References

| Resource | Location |
|----------|----------|
| GitOps manifest | `infrastructure/gitops/environments/ue-pilot-cupe.yml` |
| Env flags | `ops/environments/ue-pilot-cupe.env` |
| Generic UE pilot runbook | `ops/runbooks/ue-pilot.md` |
| Demo seed script | `apps/union-eyes/scripts/seed-cupe-pilot.mjs` |
| Fixture data | `fixtures/cupe/pilot-org/cupe-pilot-setup.json` |
| Pilot demo seeds schema | `apps/union-eyes/db/schema/domains/pilot/pilot-demo-seeds.ts` |
| KeyVault | `nzila-staging-kv` (nzila-staging-rg) |
| ACR | `nzilacanadaacr.azurecr.io` |
| ACA Environment | `nzila-canada-staging-env` (nzila-canada-staging-rg, Canada Central) |
