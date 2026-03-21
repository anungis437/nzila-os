# Runbook: SLO Breach

**Trigger**: Error budget burn rate exceeds threshold  
**Severity**: P2 (unless customer-facing, then P1)  
**Audience**: On-call engineer, SRE

## Definitions

| Term | Meaning |
|------|---------|
| SLO | Service Level Objective (e.g., 99.9% availability) |
| Error budget | Allowed failures before SLO is breached |
| Burn rate | Rate at which error budget is being consumed |
| Fast burn | 14.4× burn rate over 6h → **page immediately** |
| Slow burn | 1× burn rate over 3d → **create ticket** |

## Immediate Actions (< 5 min)

1. **Acknowledge the alert** in your alerting system
2. **Identify the service** from the alert metadata:
   - `nzila.service.name` — Which app/service
   - `nzila.slo.name` — Which SLO
   - `nzila.slo.burn_rate` — Current burn rate
3. **Check the SLO dashboard** in Grafana (or `packages/otel-core/dashboards/nzila-slo-dashboard.json`)

## Diagnosis (< 15 min)

### Check Error Rate
- Look at the error rate panel for the affected service
- If availability SLO: check HTTP 5xx rates
- If latency SLO: check P99 latency spikes

### Check Dependencies
- Database: `nzila.db.query_duration_ms` metrics
- AI Gateway: `nzila.ai.request_duration_ms` metrics
- External APIs: Stripe, Clerk health status

### Check Recent Changes
- Review recent deployments (`git log --oneline -10`)
- Review recent config changes
- Check if the burn started after a specific deployment

## Remediation

### If Fast Burn (14.4×)

1. **Rollback** the last deployment if it correlates with the burn start
2. **Scale up** if load-related (increase replica count)
3. **Circuit break** the failing dependency if upstream issue
4. **Communicate** via #incidents Slack channel

### If Slow Burn (1×)

1. **Create a ticket** for investigation
2. **Analyze patterns** — is it periodic? timezone-related? org-specific?
3. **Implement fix** in next sprint if not urgent
4. **Monitor** error budget recovery over 7 days

## Recovery Verification

- [ ] Error rate returns to baseline
- [ ] Error budget is no longer being burned
- [ ] SLO dashboard shows green
- [ ] No customer complaints in support queue

## Post-Incident

1. Run the SLO monitor to verify recovery:
   ```typescript
   import { SLOMonitor, NZILA_SLOS } from '@nzila/otel-core/slo';
   const monitor = new SLOMonitor();
   NZILA_SLOS.forEach(slo => monitor.registerSLO(slo));
   const alerts = monitor.evaluate({ /* current metrics */ });
   // Should return empty array when recovered
   ```

2. Update the `packages/otel-core/src/slo.ts` thresholds if the SLO was too aggressive
3. Write a brief post-mortem
