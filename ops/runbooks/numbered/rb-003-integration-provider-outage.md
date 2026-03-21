# Runbook: Integration Provider Outage

**ID:** RB-003
**Severity:** P2–P1 (depending on provider criticality)
**Category:** Integration
**Owner:** Platform Engineering / Integration Team
**Last Updated:** 2026-03-03

---

## Symptoms

- Console → Integrations shows provider health status `degraded` or `down`
- Integration SLA drops below threshold (see `ops/slo-policy.yml`)
- ChatOps alert: "Integration SLA regression: {provider}"
- DLQ backlog growing for specific provider type
- Org reports: "sync not updating"

## Impact

- Data not flowing to/from external systems (Stripe, QuickBooks, HubSpot, etc.)
- Org operations may be blocked if integration is critical path

## Diagnosis

1. **Console → Integrations**: Check per-provider health cards.
2. **Check provider status page** (e.g., status.stripe.com, status.hubspot.com).
3. **Review recent integration events:**
   ```sql
   SELECT provider, status, COUNT(*), AVG(latency_ms)
   FROM integration_events
   WHERE created_at > NOW() - INTERVAL '1 hour'
   GROUP BY provider, status;
   ```
4. **Check for credential expiry** (OAuth tokens, API keys).

## Remediation

1. **If provider is down (their outage):**
   - No action needed on our side — circuit breaker will queue events.
   - Notify affected orgs via email/in-app banner.
   - Monitor provider status page for recovery.
   - Events will auto-retry on recovery.

2. **If our credentials expired:**
   - Rotate credentials via Console → Integrations → {Provider} → Re-auth.
   - Verify with health check.
   - Replay failed events.

3. **If rate-limited:**
   - Reduce batch size / increase retry backoff.
   - Contact provider for rate limit increase if persistent.

4. **If payload schema changed:**
   - Check adapter mapping in `packages/integrations-runtime`.
   - Deploy adapter fix.
   - Replay DLQ entries.

## Prevention

- Monitor OAuth token expiry — alert 7 days before.
- Weekly integration health review.
- Provider changelog monitoring (automated where possible).

## Audit

- Log all credential rotations as audit events.
- Track provider outage duration for SLA reporting.
