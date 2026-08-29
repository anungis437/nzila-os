# Union Eyes Rollback Runbook

## Objective

Safely roll back Union Eyes deployments to the previous stable revision across all environments (staging, demo, pilot, production) when critical failures occur that cannot be mitigated in-place.

## Prerequisites

- Azure CLI (`az`) installed and authenticated with subscription access
- Container Apps permissions (Contributor or higher on the resource group)
- Access to the environment's Container Registry credentials
- Knowledge of the current deployment revision SHA/tag

## Rollback Procedure

### Step 1: Identify the Current and Previous Revisions

```bash
# List all revisions for a Container App (sorted by creation time, newest first)
az containerapp revision list \
  --resource-group <resource-group> \
  --name <app-name> \
  --query "[0:3].{revision: name, image: properties.template.containers[0].image, replicas: properties.template.scale.minReplicas, createdAt: properties.createdTime}" \
  --output table
```

**Example output:**
```
Revision                      Image                                        Replicas  CreatedAt
──────────────────────────────────────────────────────────────────────────────────
nzila-web--xyz123             acr.azurecr.io/nzila-web:v2.5.0              3         2026-08-29T12:00:00Z
nzila-web--xyz122             acr.azurecr.io/nzila-web:v2.4.9              0         2026-08-29T09:00:00Z
nzila-web--xyz121             acr.azurecr.io/nzila-web:v2.4.8              0         2026-08-29T06:00:00Z
```

The current active revision is listed first. The second revision is the immediate predecessor.

### Step 2: Determine Backward Compatibility

**Before executing rollback, verify that the previous revision's code can run against the current database schema.**

Database schema compatibility is guaranteed only for N-1 code:

- **Current prod code**: v2.5.0
- **Previous revision**: v2.4.9 (N-1) ✅ Tested during Phase 2
- **Older revisions**: v2.4.8, v2.4.7 ⚠️ May have schema compatibility gaps

**Actions:**

1. Check the git tag or release notes for the previous revision to identify its version.
2. Search the CHANGELOG for any `breaking database changes` entries between versions.
3. If the CHANGELOG indicates a schema-incompatible change between current and previous, **do not roll back via revision**. Instead, contact the platform team for a staged rollback via a hotfix deployment.

### Step 3: Revert to Previous Revision

```bash
# Activate the previous revision (roll back nzila-web to v2.4.9)
az containerapp revision activate \
  --resource-group <resource-group> \
  --name <app-name> \
  --revision <previous-revision-name>
```

**Example:**
```bash
az containerapp revision activate \
  --resource-group ue-prod-east-rg \
  --name nzila-web \
  --revision nzila-web--xyz122
```

**Expected output:**
```
Revision activated: nzila-web--xyz122
Active replicas: 3
```

### Step 4: Verify Rollback Health

Immediately after activation, monitor the revised deployment:

```bash
# Check replica status and error logs
az containerapp show \
  --resource-group <resource-group> \
  --name <app-name> \
  --query "properties.latestRevisionFqdn" \
  --output tsv

# Test the health endpoint (adjust URL per service)
curl https://<app-fqdn>/health
```

**Expected outcome:**
- HTTP 200 response from health endpoint
- All replicas in READY state (check Azure Portal → Container Apps → Revisions)
- No error logs in the last 5 minutes (check Application Insights or OTEL traces)

### Step 5: Notify and Document

1. **Incident log:** Record the rollback in the incident tracker with:
   - Timestamp of rollback start
   - Reason for rollback
   - Revisions involved (from/to)
   - Health verification result
   - Team notified

2. **Slack/Teams notification:**
   ```
   :warning: Rollback executed for <app-name>
   Environment: <environment>
   Rolled back from: v2.5.0 (revision xyz123)
   Rolled back to:   v2.4.9 (revision xyz122)
   Status: Healthy
   Next: Begin root-cause analysis
   ```

3. **Post-incident:** After the system stabilizes, schedule a blameless post-mortem within 24 hours.

## Rollback SLOs by Environment

| Environment | RTO Goal | RPO Implication | Revisions Kept | Test Frequency |
|-------------|----------|-----------------|-----------------|-----------------|
| **Staging** | ≤ 15 min | Data loss unlikely (frequent backups) | Last 5 | Weekly |
| **Demo** | ≤ 15 min | Demo data—no production impact | Last 5 | Weekly |
| **Pilot** | ≤ 10 min | Production-like test environment; same RTO as production | Last 10 | Daily |
| **Production** | ≤ 5 min | Production SLO; immediate activation | Last 20 | Real-time monitoring |

## Scenario: Full Revert (Non-Containerized)

If Container Apps revision history is exhausted or corrupted, fall back to a managed hotfix deployment:

1. **Check revision count:**
   ```bash
   az containerapp revision list --resource-group <rg> --name <app> --query "length(@)"
   ```
   
   If result is < 2, you are below the retention threshold.

2. **Deploy a known-good tag from the registry:**
   ```bash
   az containerapp update \
     --resource-group <resource-group> \
     --name <app-name> \
     --image <registry>/<image>:v2.4.9
   ```

3. **Monitor the new deployment** (same as Step 4 above).

## Known Limitations

### Provider-Side Effects Union Eyes Cannot Control

- **External email/SMS after handoff:** Once a notification is sent via SendGrid or Twilio, cancellation is best-effort. Rollback does not recall sent messages.
- **IdP token invalidation latency:** Entra ID token revocation may take 30-60 seconds to propagate. Existing sessions may remain valid until token expiry.
- **Browser/local cache:** Users' cached data and session tokens persist on client devices. Instruct users to clear cache/local storage if needed.
- **Already-issued provider artifacts:** Signed evidence exports, forensic exports, or audit bundles already downloaded by users cannot be invalidated. Rollback does not affect already-issued artifacts.

### Database Rollback Constraints

- **Database snapshots:** Rollback procedure does not restore the database. If a migration corrupted data, manual reconciliation or restore from backup is required.
- **Backup frequency:** Production backups are retained for 35 days; staging/demo for 14 days. Rollback older than that window may require Disaster Recovery Team involvement.

## Testing Rollback Readiness

### Monthly Rollback Drill

Execute this playbook monthly in staging/demo (not production unless scheduled):

```bash
#!/bin/bash
# Monthly rollback drill: test N-1 revision activation

ENV="staging"
APP="nzila-web"
RG="ue-${ENV}-east-rg"

# Get the current and previous revisions
CURRENT=$(az containerapp revision list --resource-group $RG --name $APP --query "[0].name" -o tsv)
PREVIOUS=$(az containerapp revision list --resource-group $RG --name $APP --query "[1].name" -o tsv)

echo "Testing rollback: $CURRENT → $PREVIOUS"

# Activate previous revision
az containerapp revision activate --resource-group $RG --name $APP --revision $PREVIOUS

# Wait for stabilization
sleep 30

# Health check
HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://$(az containerapp show --resource-group $RG --name $APP --query "properties.latestRevisionFqdn" -o tsv)/health)

if [ "$HEALTH" = "200" ]; then
  echo "✅ Rollback drill passed"
  # Rollback to current (restore)
  az containerapp revision activate --resource-group $RG --name $APP --revision $CURRENT
  exit 0
else
  echo "❌ Rollback drill failed: health check returned $HEALTH"
  exit 1
fi
```

### Approval Gate: Revision Backward Compatibility

Every production deployment must include a `BACKWARD_COMPATIBLE_TO_REVISION` annotation in the commit message:

```
BACKWARD_COMPATIBLE_TO_REVISION: nzila-web--xyz121
This deployment does not require schema migrations beyond N-1 compatibility.
```

Deployment pipeline validation must verify this annotation before progression to production.

## Escalation Path

| Scenario | Action | Escalate To |
|----------|--------|-------------|
| Rollback succeeds, app healthy | Monitor for 1 hour | None; begin root cause analysis |
| Rollback fails (revision won't start) | Contact ops team; prepare hotfix | Platform Team, Reliability Engineer |
| Database corrupted; rollback insufficient | Execute database restore | DBA, Disaster Recovery Team |
| Production offline > 15 min; cannot rollback | Declare SEV-1 incident | Engineering Manager, CTO |

## Post-Rollback Actions

1. **Stabilization (first 30 min):**
   - Monitor error rates, latency, and replica health
   - Verify all dependencies are reachable (database, cache, IdP, APIs)
   - Spot-check user workflows (login, create case, upload evidence)

2. **Investigation (first 2 hours):**
   - Identify the failure root cause
   - Check deployment logs for startup errors, secrets issues, dependency failures
   - Review application logs (OTEL traces, Application Insights) for the failure window

3. **Decision (within 4 hours):**
   - **If root cause identified and fixed:** prepare hotfix deployment
   - **If root cause unclear:** keep system on previous revision and escalate to engineering team for investigation
   - **If pattern repeats:** move to manual code review + staged rollout strategy

4. **Remediation (within 24 hours):**
   - Merge root-cause fix to `main`
   - Run full test suite + staging smoke test
   - Deploy hotfix to production with enhanced monitoring

## References

- [Azure Container Apps Revisions Documentation](https://learn.microsoft.com/en-us/azure/container-apps/revisions)
- [Incident Response Playbooks](./incident-response-playbooks.md)
