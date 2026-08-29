# Union Eyes Incident Response Playbooks

## Overview

This document contains step-by-step incident response procedures for five critical Union Eyes failure scenarios. Each playbook is designed for immediate execution during production incidents, with clear decision trees, escalation paths, and recovery procedures.

**Key principles:**
- **Speed over perfection:** Execute rapid diagnostics first; detailed investigation follows.
- **Fail-closed:** Union Eyes defaults to denying access rather than exposing data.
- **Transparency:** Communicate incident status to stakeholders every 15 minutes.
- **Evidence preservation:** Capture logs, metrics, and state before remediation for post-incident analysis.

---

## Scenario 1: Crash Loop / Out of Memory (OOM)

### Detection

- **Symptom:** Container Apps shows replica count cycling (READY → CRASHING → READY)
- **Observable signal:** Application Insights shows HTTP 503 Service Unavailable, or connection timeouts
- **OTEL metric:** `process.runtime.go.goroutines` or `container.memory.percent_used` > 90% immediately before crash

### Immediate Diagnosis (2–3 min)

```bash
# Check replica status
az containerapp show \
  --resource-group <rg> \
  --name <app> \
  --query "properties.template.scale.{currentReplicas: status.replicas, minReplicas: minReplicas, maxReplicas: maxReplicas}" \
  -o json

# Fetch last 50 lines of stderr (crash logs)
az containerapp logs show \
  --resource-group <rg> \
  --name <app> \
  --tail 50 \
  --follow

# Check if OOM: look for "signal: killed" or "out of memory" in logs
# Check if panic: look for "panic:" or "fatal error:"
```

### Root Cause Classification

| Pattern in Logs | Likely Cause | Action |
|---|---|---|
| `fatal error: runtime: out of memory` | Memory leak or heap explosion | Proceed to **Memory Leak Mitigation** |
| `panic: database connection pool exhausted` | DB connection leak | Proceed to **Connection Pool Exhaustion** (Scenario 2) |
| `fatal error: all goroutines are asleep - deadlock detected` | Goroutine deadlock | Escalate; prepare rollback |
| `signal: killed` (no prior error) | OS killed process (timeout, node eviction) | Check node pressure; may indicate cluster capacity issue |

### Memory Leak Mitigation

1. **Lower memory limit temporarily (if safe):**
   ```bash
   # This may trigger faster crashes but preserves logs
   # Only if you have a known hotfix ready to deploy
   az containerapp update \
     --resource-group <rg> \
     --name <app> \
     --memory 2.0Gi  # Reduce from 4Gi to 2Gi
   ```

2. **Enable heap profiling for the next run (for post-incident analysis):**
   Add to the deployment YAML:
   ```yaml
   env:
     - name: GODEBUG
       value: "gctrace=1"  # Enable GC tracing to diagnose
   ```

3. **Prepare rollback:** If the memory leak was introduced in the current deployment, execute the rollback procedure (see Rollback Runbook).

### Decision Tree

- **Memory leak confirmed** → Rollback to N-1 revision immediately
- **Crash loop continues after rollback** → Escalate to Platform Team; check node/cluster health
- **Crash loop stops after rollback** → Root cause is in current deployment; fix and redeploy

### Escalation

| Outcome | Action | Escalate To |
|---|---|---|
| Rollback restores health | Monitor for 1 hour; begin root cause analysis | Engineering Lead |
| Rollback fails; multiple services crashing | Declare SEV-1 incident | CTO, Ops Lead |
| Isolated to one service; not production-wide | Execute rollback; open incident ticket | Engineering Lead |

---

## Scenario 2: Connection Pool Exhaustion

### Detection

- **Symptom:** Requests hang for 30+ seconds, then timeout with 503 or connection reset
- **Observable signal:** Application Insights shows `dependency` duration > 30s for database calls
- **OTEL metric:** `db.client.connections.usage` = 100% for 5+ min
- **Error pattern:** `too many connections` or `connection pool timeout`

### Immediate Diagnosis (2–3 min)

```bash
# Check current connection count on the database
az postgres flexible-server connect \
  --resource-group <rg> \
  --server-name <db-server> \
  --admin-user <admin> \
  --admin-password <password> \
  -d postgres
# Once connected:
SELECT count(*) FROM pg_stat_activity;
SELECT usename, count(*) FROM pg_stat_activity GROUP BY usename;
```

### Root Cause Classification

| Metric | Likely Cause | Action |
|---|---|---|
| `pg_stat_activity.count = 150+` (at capacity) | Connection leak in app | Proceed to **Connection Leak Remediation** |
| `pg_stat_activity.count = 50-80` (normal) + high wait time | Query performance degradation | Proceed to **Query Performance Degradation** |
| `pg_stat_activity.state = 'idle in transaction'` | Long-running transaction not committing | Kill idle transaction; escalate |

### Connection Leak Remediation

1. **Check for idle connections:**
   ```sql
   SELECT pid, usename, query_start, query
   FROM pg_stat_activity
   WHERE state = 'idle' AND query_start < now() - interval '10 minutes'
   ORDER BY query_start;
   ```

2. **Identify the app causing the leak:**
   ```sql
   SELECT application_name, count(*)
   FROM pg_stat_activity
   WHERE state = 'idle'
   GROUP BY application_name
   ORDER BY count DESC;
   ```

3. **Graceful connection drain:**
   ```bash
   # Scale down the replica count to allow existing connections to idle out
   az containerapp update \
     --resource-group <rg> \
     --name <app> \
     --min-replicas 1
   
   # Wait 5 minutes for idle connections to close
   sleep 300
   
   # Check connection count again
   ```

4. **If connections still exhausted after drain:**
   - Restart the Container App (kills all connections):
     ```bash
     az containerapp restart \
       --resource-group <rg> \
       --name <app>
     ```
   - Monitor for reconnection burst over 2–3 minutes
   - Once stable, restore replica scale:
     ```bash
     az containerapp update \
       --resource-group <rg> \
       --name <app> \
       --min-replicas 3
     ```

### Decision Tree

- **Connections drain after scale-down** → Likely connection leak; escalate to engineering for code fix
- **Connections still exhausted** → Possible database issue; check for query locks or deadlocks
- **Restart helps** → Temporary fix; prepare for rollback if issue repeats

### Escalation

| Outcome | Action | Escalate To |
|---|---|---|
| Connections drain; app recovers | Monitor; open engineering ticket for leak | Engineering Lead |
| Connections persist; database is healthy | Escalate; may indicate misconfigured connection limits | DBA, Engineering Lead |
| Restart helps but issue repeats within 1 hour | Rollback to N-1 revision | CTO, Ops Lead |

---

## Scenario 3: Disk Space Exhaustion

### Detection

- **Symptom:** File uploads fail; disk-dependent operations (logging, caching, temporary files) fail
- **Observable signal:** Application Insights shows file I/O errors (EIO, ENOSPC)
- **OTEL metric:** `host.disk.percent_used` > 90%; `/tmp` or application data directory full
- **Pod restart:** Container killed with exit code 137 (OOM) or 124 (timeout) after I/O errors

### Immediate Diagnosis (2–3 min)

```bash
# Connect to the running container and check disk space
# Use Azure Container Apps remote debugging or kubectl exec on AKS

# Inside the container:
df -h
du -sh /app/*
du -sh /tmp/*
ls -lh /app/logs/ | tail -20

# Check what's consuming space
find /app -type f -size +100M -exec ls -lh {} \;
```

### Root Cause Classification

| Location | Likely Cause | Action |
|---|---|---|
| `/tmp` full | Unbounded temp file creation (upload processing, cache, sessions) | Proceed to **Temp File Cleanup** |
| `/app/logs` full | Log files not rotated; no cleanup policy | Proceed to **Log Cleanup** |
| `/app/data` full | Database dumps, backups, or export files in container filesystem | Escalate; likely misconfigured backup path |
| OS root `/` full | Multiple containers or system processes hoarding space | Escalate to infrastructure team |

### Temp File Cleanup

1. **Identify large temp files:**
   ```bash
   find /tmp -type f -size +10M -mtime +1 -exec ls -lh {} \;
   ```

2. **Safe cleanup (delete old temp files only):**
   ```bash
   # Delete files older than 24 hours
   find /tmp -type f -mtime +1 -delete
   
   # Verify space reclaimed
   df -h
   ```

3. **Implement cleanup policy (for post-incident fix):**
   - Add a scheduled cron job or systemd timer to clean `/tmp` every 6 hours
   - OR configure application to clean up temp files immediately after use
   - OR mount `/tmp` on a separate volume with quota enforcement

### Log Cleanup

1. **Check log rotation configuration:**
   ```bash
   # If using logrotate:
   cat /etc/logrotate.d/<app-name>
   
   # If using application-level logging:
   grep -r "log.*rotation\|max-file-size" /app/config
   ```

2. **Manual cleanup (safe approach):**
   ```bash
   # Archive old logs
   tar -czf /tmp/logs-archive-$(date +%Y%m%d).tar.gz /app/logs/*.log.{1,2,3}
   
   # Delete archived logs
   rm /app/logs/*.log.{1,2,3}
   
   # Verify space
   df -h
   ```

3. **Implement log rotation (for post-incident fix):**
   ```yaml
   # Add to deployment YAML:
   env:
     - name: LOG_MAX_FILE_SIZE
       value: "100M"
     - name: LOG_MAX_FILES
       value: "5"  # Keep only 5 rotated files
   ```

### Decision Tree

- **Cleanup successful; disk space restored** → Monitor application for the next 30 min; implement cleanup policy
- **Cleanup unsuccessful; space still exhausted** → Escalate; likely a database dump or external file consuming space
- **Space restored but immediately fills again** → Application has a file leak; prepare for rollback

### Escalation

| Outcome | Action | Escalate To |
|---|---|---|
| Cleanup restores disk space | Monitor; open ticket to implement cleanup policy | Engineering Lead |
| Issue repeats within 1 hour | Prepare for rollback | CTO, Ops Lead |
| Space exhaustion impacts database | Declare SEV-1; activate disaster recovery | DBA, CTO, Ops Lead |

---

## Scenario 4: High Latency / Slow Requests

### Detection

- **Symptom:** Requests that normally complete in < 500 ms now take 5–30 seconds
- **Observable signal:** Application Insights shows P95 latency > 5s or P99 > 30s
- **OTEL metric:** `http.server.request.duration` percentile spike; database query latency increases
- **User reports:** "The app is slow; operations are timing out"

### Immediate Diagnosis (2–3 min)

```bash
# Identify slow endpoints
az monitor metrics list \
  --resource <container-app-id> \
  --namespace Microsoft.App/containerApps \
  --metric ResponseTime \
  --aggregation Average \
  --interval PT1M \
  --start-time $(date -u -d '30 minutes ago' +%Y-%m-%dT%H:%M:%S) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%S)

# Check database query performance
az postgres flexible-server connect <credentials>
SELECT mean_time, max_time, calls, query
FROM pg_stat_statements
ORDER BY mean_time DESC
LIMIT 10;
```

### Root Cause Classification

| Signal | Likely Cause | Action |
|---|---|---|
| `http.server.request.duration` spikes for all endpoints | CPU saturation or memory pressure | Check node resources; may need to scale |
| Specific endpoint slow (e.g., `/api/cases`) | Query performance regression in that endpoint | Proceed to **Query Optimization** |
| Database query latency increases across all queries | Database resource exhaustion (CPU, I/O) | Check DBA; may indicate backup/maintenance job |
| External API calls timing out (e.g., to IdP or file store) | Downstream dependency degradation | Check dependency status; may need timeout adjustment |

### Query Optimization

1. **Identify the slow query:**
   ```sql
   -- Find the slowest queries
   SELECT query, mean_time, calls, total_time
   FROM pg_stat_statements
   WHERE mean_time > 100  -- Queries taking > 100ms
   ORDER BY mean_time DESC
   LIMIT 5;
   
   -- Explain the query plan
   EXPLAIN ANALYZE <slow-query>;
   ```

2. **Check for missing indexes:**
   ```sql
   -- Identify queries using seq scan on large tables
   SELECT indexrelname, idx_scan, idx_tup_read, idx_tup_fetch
   FROM pg_stat_user_indexes
   WHERE idx_scan = 0  -- Never used index
   ORDER BY idx_tup_read DESC;
   ```

3. **Temporary workaround (while fix is prepared):**
   - Add a query timeout to prevent cascading hangs:
     ```bash
     az postgres flexible-server parameter set \
       --resource-group <rg> \
       --server-name <db> \
       --name statement_timeout \
       --value 10000  # 10 seconds
     ```
   - Restart the database for the parameter to take effect
   - This may cause timeouts, but prevents connection pool exhaustion

### CPU Saturation

1. **Check node CPU:**
   ```bash
   az containerapp show \
     --resource-group <rg> \
     --name <app> \
     --query "properties.template.containers[0].cpu" \
     -o tsv
   ```

2. **If CPU limit is reached:**
   - Option A: Temporarily increase CPU (if budget allows):
     ```bash
     az containerapp update \
       --resource-group <rg> \
       --name <app> \
       --cpu 4.0  # Increase from 2.0 to 4.0
     ```
   - Option B: Scale up replicas to distribute load:
     ```bash
     az containerapp update \
       --resource-group <rg> \
       --name <app> \
       --max-replicas 10  # Allow more replicas
     ```

### Decision Tree

- **Query slow; index is missing** → Add index (post-incident); monitor
- **CPU saturated** → Scale up replicas or increase CPU allocation
- **External dependency slow** → Check dependency status page; add retry logic
- **No clear cause** → Prepare for rollback; latency may indicate regression

### Escalation

| Outcome | Action | Escalate To |
|---|---|---|
| Root cause identified and fixed | Monitor P95/P99 for 1 hour | Engineering Lead |
| Latency persists after optimization | Escalate; may indicate query plan regression | DBA, Engineering Lead |
| High latency in N-1 revision too | Infrastructure-level issue; check node health | Ops Lead, CTO |

---

## Scenario 5: Authentication Service Unavailability (IdP Failure)

### Detection

- **Symptom:** Users cannot log in; token validation fails
- **Observable signal:** Application Insights shows errors like `AADSTS50058: Silent sign-in request failed` or `connection timeout to /.well-known/openid-configuration`
- **OTEL error:** `auth.idp_request_failed` or `auth.token_validation_failed`
- **User reports:** "Login is broken; I can't access the app"

### Immediate Diagnosis (2–3 min)

```bash
# Check IdP connectivity from the app container
curl -v https://login.microsoftonline.com/.well-known/openid-configuration 2>&1 | head -30

# Verify IdP tenant is accessible
curl -v https://login.microsoftonline.com/<tenant-id>/.well-known/openid-configuration

# Check if the app's registered IdP application still exists and is enabled
# (This requires Azure CLI access to the tenant)
az ad app show --id <app-client-id>

# Check for recent Entra ID incidents
# (Visit https://status.azure.com or check Azure Portal → Service Health)
```

### Root Cause Classification

| Observable Signal | Likely Cause | Action |
|---|---|---|
| Curl to `.well-known` succeeds; app fails | OTEL config issue or certificate validation error | Proceed to **App Configuration Check** |
| Curl fails with connection timeout or DNS error | Network connectivity issue (firewall, DNS, proxy) | Check outbound network rules; escalate to ops |
| Curl succeeds; app shows `4xx error` (auth error, not timeout) | User account issue or IdP tenant misconfiguration | Proceed to **IdP Configuration Audit** |
| Azure Service Health shows IdP incident | Upstream Entra ID issue | Monitor status page; prepare customer communication |

### App Configuration Check

1. **Verify OTEL/auth environment variables:**
   ```bash
   az containerapp show \
     --resource-group <rg> \
     --name <app> \
     --query "properties.template.containers[0].env" \
     -o table
   
   # Expected variables:
   # - OIDC_AUTHORITY = https://login.microsoftonline.com/<tenant-id>
   # - OIDC_CLIENT_ID = <registered-app-id>
   # - OIDC_REDIRECT_URI = https://<app-fqdn>/auth/callback
   ```

2. **Verify certificate trust (TLS validation):**
   ```bash
   # Check if the app's environment has certificate validation disabled (antipattern)
   echo "Check for NODE_TLS_REJECT_UNAUTHORIZED or INSECURE env vars"
   
   # If disabled, this should NOT be the default; re-enable it:
   az containerapp update \
     --resource-group <rg> \
     --name <app> \
     --remove-env NODE_TLS_REJECT_UNAUTHORIZED
   ```

3. **Restart the app to reload configuration:**
   ```bash
   az containerapp restart \
     --resource-group <rg> \
     --name <app>
   
   # Wait for replicas to stabilize
   sleep 30
   
   # Test login
   curl -s https://<app-fqdn>/health | jq .
   ```

### IdP Configuration Audit

1. **Verify the app's IdP registration:**
   ```bash
   # Check if the app is still registered in the tenant
   az ad app show --id <app-client-id>
   
   # Expected output: registration should be ENABLED
   ```

2. **Verify redirect URI is correct:**
   ```bash
   az ad app show \
     --id <app-client-id> \
     --query "web.redirectUris"
   
   # Expected: ["https://<app-fqdn>/auth/callback", ...]
   ```

3. **Verify credentials (client secret) have not expired:**
   ```bash
   az ad app credential list --id <app-client-id>
   
   # Check if `endDateTime` has passed; if so, the secret expired
   ```

4. **If credentials expired:**
   - Generate a new client secret:
     ```bash
     az ad app credential reset --id <app-client-id>
     ```
   - Update the app's secret in Key Vault:
     ```bash
     az keyvault secret set \
       --vault-name <key-vault> \
       --name "oidc-client-secret" \
       --value <new-secret>
     ```
   - Restart the app to reload the secret

### Network Connectivity Check

1. **Verify outbound DNS and firewall rules:**
   ```bash
   # From inside the app container, test DNS resolution
   nslookup login.microsoftonline.com
   
   # Test HTTPS connectivity
   curl -v https://login.microsoftonline.com:443/
   ```

2. **If DNS fails:**
   - Check Azure DNS configuration; may need to update nameservers
   - Escalate to Network/Ops team

3. **If HTTPS connectivity fails:**
   - Check Azure Network Security Group (NSG) rules for outbound HTTPS (port 443)
   - Check proxy configuration (if app goes through corporate proxy)

### Decision Tree

- **Configuration is correct; connectivity works** → Issue may be transient; restart app and monitor
- **IdP credentials expired** → Update credentials; restart app
- **Network connectivity fails** → Escalate to Ops/Network team
- **Multiple services failing to auth** → IdP is likely down; monitor status page

### Escalation

| Outcome | Action | Escalate To |
|---|---|---|
| App-side config issue fixed; auth restored | Monitor login success rate for 30 min | Engineering Lead |
| IdP credentials expired; updated | Monitor token validation errors | Identity/Security Team |
| IdP is experiencing an incident | Activate communication plan; provide login alternatives if available | CTO, Communications, Compliance |
| Network connectivity issue | Escalate to Ops/Network team | Network Ops, Ops Lead |

---

## General Escalation Matrix

| Incident Severity | Definition | Escalate To | Notification |
|---|---|---|---|
| **SEV-1** | Production offline > 15 min; users cannot access; data at risk | CTO, VP Ops, Compliance | Immediate; update every 15 min |
| **SEV-2** | Degraded performance; specific feature unavailable; workaround exists | Ops Lead, Engineering Lead | Within 30 min |
| **SEV-3** | Intermittent issue; no immediate impact; non-critical feature affected | Engineering Lead | Within 2 hours |
| **SEV-4** | Documentation issue; cosmetic bug; no user impact | Engineering team | Next business day |

---

## Post-Incident Actions

1. **Stabilization (first 30 min):** Follow the scenario playbook to restore service.
2. **Monitoring (next 2 hours):** Establish 24/7 monitoring with alerts for similar patterns.
3. **Communication (every 15 min during incident):** Update stakeholders on status, ETA, and actions taken.
4. **Post-mortem (within 24 hours):** Schedule a blameless review; document root cause and remediation.
5. **Follow-up (within 1 week):** Implement permanent fix, tests, and monitoring to prevent recurrence.

---

## References

- [Rollback Runbook](./rollback-runbook.md)
- [PostgreSQL Troubleshooting](https://learn.microsoft.com/en-us/azure/postgresql/flexible-server/concepts-troubleshoot)
- [Entra ID Authentication Errors](https://docs.microsoft.com/en-us/azure/active-directory/develop/reference-aadsts-error-codes)
- [Azure Service Health Status](https://status.azure.com)
