# Runbook: Integration Provider Failure

**Scope:** Outbound integration failures (email, SMS, CRM sync, Slack, Teams, WhatsApp)
**Severity:** P2 (single provider) / P1 (multi-provider or data loss risk)
**On-call:** Platform Engineering

## Detection

Integration failures surface through:

1. **SLO breach alerts** — availability drops below target in `platform-observability` SLO definitions
2. **Circuit breaker open** — `CircuitBreaker` transitions to OPEN state, logged as audit event
3. **DLQ depth** — dead letter queue depth exceeds `maxDlqDepth` threshold
4. **Health check degraded** — `checkAllIntegrations()` returns `degraded` or `down`

## Triage

### Step 1: Identify affected provider

Check the ops-readiness dashboard at `/integration-ops` in platform-admin, or query:

```bash
# Check circuit breaker states (if using console dashboard)
# Navigate to: Console → System Health → Integration Health
```

### Step 2: Classify the failure

The platform classifies failures automatically via `classifyFailure()`:

| Class | Action | Examples |
|-------|--------|----------|
| **transient** | Auto-retry with backoff | Rate limits (429), timeouts, network errors |
| **permanent** | Route to DLQ | Auth failures (401/403), validation errors (400), not found (404) |
| **unknown** | Retry up to limit, then DLQ | Unrecognised errors |

Check `reports/ops-readiness-audit.json` for current error classification coverage.

### Step 3: Check provider status

| Provider | Status page |
|----------|-------------|
| Resend | <https://resend.com/status> |
| Twilio | <https://status.twilio.com> |
| Slack | <https://status.slack.com> |
| HubSpot | <https://status.hubspot.com> |
| Microsoft 365/Teams | <https://status.office365.com> |
| WhatsApp (Meta) | <https://developers.facebook.com/status> |
| Postmark | <https://status.postmarkapp.com> |
| SendGrid | <https://status.sendgrid.com> |

## Response

### Transient failures (rate limits, timeouts)

1. Verify the retry state machine is operating (check logs for `retry` decisions)
2. If retry budget exhausted, messages land in DLQ — they will be reprocessed
3. If rate-limited, the `rateLimitParser` automatically detects `Retry-After` headers
4. **No manual action needed** unless sustained for >30 minutes

### Permanent failures (auth, config)

1. **Credential rotation:** Check if API keys expired → rotate in vault
2. **Config mismatch:** Verify integration config via `resolveConfig()` in dispatcher
3. **Webhook URL changed:** Update webhook subscriptions in integration-db
4. After fix, manually replay DLQ entries

### Circuit breaker tripped

1. Check circuit breaker state: should show OPEN with failure count
2. Wait for cooldown timer → circuit moves to HALF_OPEN
3. Half-open probes test connectivity; if probe succeeds → CLOSED
4. **Admin override** (emergency): use `forceReset(orgId, provider)` — documented in `resilientAdapter.ts`

**Never force-close a breaker during a confirmed provider outage.** Let the backpressure protect downstream systems.

### DLQ processing

1. DLQ entries are persisted in `integrations-db`
2. Each entry contains: original request, failure reason, retry count, timestamps
3. Replay: re-enqueue through the dispatcher after root cause is resolved
4. Expiration: DLQ entries older than 7 days should be reviewed and archived

## Escalation

| Condition | Action |
|-----------|--------|
| Provider down >1 hour | Notify affected orgs via status page |
| Multi-provider failure | Escalate to P1, involve infrastructure team |
| Data loss confirmed | Invoke `secret-compromise.md` if credentials involved |
| DLQ depth >1000 | Alert product team, consider feature flag to disable integration |

## Prevention

- Monitor SLO compliance in platform-admin → Platform Health dashboard
- Review ops-readiness audit weekly — target >50% maturity score
- Ensure all integration adapters have health checks registered
- Run chaos simulations monthly (non-production only) via `ChaosSimulator`

## Related

- [SLO Breach Runbook](slo-breach.md)
- [Secret Compromise Runbook](secret-compromise.md)
- Integration Ops Dashboard: `apps/platform-admin/app/integration-ops/page.tsx`
- Ops Readiness Audit: `reports/ops-readiness-audit.md`
