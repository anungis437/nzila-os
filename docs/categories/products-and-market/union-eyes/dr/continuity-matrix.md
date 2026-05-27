# Union Eyes — Business Continuity Matrix

> **Owner:** CISO / CTO  
> **Controls Covered:** DR-01, DR-02, DR-03, DR-04  
> **Last Updated:** 2026-04-24  
> **Classification:** Internal

---

## Purpose

Define the maximum tolerable downtime and data loss for each Union Eyes
service component, the recovery method, and the responsible owner.

---

## Service Priority Matrix

| Service / Component | Priority | Max Downtime (RTO) | Max Data Loss (RPO) | Recovery Method | Owner |
|--------------------|----------|-------------------|---------------------|-----------------|-------|
| Union Eyes web app (Next.js) | P1 | 4 hours | N/A (stateless) | Container rollback / redeploy | Platform Engineering |
| PostgreSQL primary | P1 | 4 hours | 1 hour | Azure PITR restore | SRE |
| Django backend (Celery workers) | P1 | 4 hours | N/A (stateless) | Container rollback / redeploy | Platform Engineering |
| Azure Blob Storage (evidence packs) | P1 | 0 (RA-GRS failover) | Near-zero | Geo-redundant failover | SRE |
| Redis (rate-limiting, sessions, BullMQ) | P2 | 2 hours | 6 hours (RDB snapshot) | Re-provision + warm-up | Platform Engineering |
| Authentication (`@nzila/platform-auth` / Entra) | P1 | Dependent on Azure AD SLA | N/A | Azure AD HA is Microsoft-managed | Platform Engineering |
| CI/CD pipeline | P3 | 24 hours | N/A | Git-based; re-run from clean checkout | All engineers |

---

## BCP Activation Criteria

| Condition | Priority | Action |
|---------|---------|--------|
| Azure Canada Central unavailable > 30 min | P1 | Activate DR plan; consider geo-failover |
| Database unrecoverable from primary backup | P1 | PITR restore to new server (Scenario 1 in database-restore.md) |
| Container deploy breaks health check | P2 | Rollback via `pnpm exec tsx scripts/release/rollback-prod.ts` |
| Evidence pack storage unavailable | P1 | Blob geo-failover (blob-recovery.md) |
| Key personnel unavailable | P2 | On-call escalation path (ops/runbooks/ue-pilot.md) |
| Secret rotation required post-incident | P1 | Credential rotation runbook (below) |

---

## Credential Rotation After Incident

### Trigger

- Suspected secret compromise
- Gitleaks / TruffleHog scan detects exposure
- Security incident response escalation

### Procedure

1. **Identify exposed secret type** (DB password, JWT secret, Blob SAS, AI key, Stripe key)
2. **Rotate in Azure Key Vault:**

```bash
# Rotate database password
az keyvault secret set \
  --vault-name "nzila-prod-kv" \
  --name "POSTGRES-ADMIN-PASSWORD" \
  --value "$(openssl rand -base64 32)"

# Rotate JWT/session signing secret
az keyvault secret set \
  --vault-name "nzila-prod-kv" \
  --name "AUTH-SECRET" \
  --value "$(openssl rand -base64 64)"
```

3. **Restart affected containers** to pick up new secrets via managed identity reference
4. **Verify health** post-rotation
5. **Record incident** in `ops/incidents/` with rotation evidence

### Key Rotation Schedule

| Secret | Auto-Rotation | Interval | Source |
|--------|--------------|---------|--------|
| Azure Key Vault keys | Enabled (prod) | 90 days | `infrastructure/bicep/modules/keyvault.bicep` |
| Database admin password | Manual | On incident | This runbook |
| JWT / AUTH_SECRET | Manual | On incident | This runbook |
| Evidence HMAC seal key | Manual | On incident | This runbook |

---

## Recovery Time Estimates

> Estimates based on Azure documentation and IaC structure review.  
> **Actual measured timings are NOT yet recorded — pending first live staging execution.**  
> See `reports/dr/` for evidence artifacts as drills are completed.

| Recovery Scenario | Estimated Duration | RTO Target |
|-------------------|-------------------|-----------|
| Container rollback | 5–10 min | ≤ 4 hours |
| PITR restore (staging) | 20–45 min | ≤ 4 hours |
| Full environment rebuild | 50–100 min | ≤ 4 hours |
| Blob geo-failover | Near-zero (RA-GRS) | ≤ 4 hours |

---

## Continuity Controls Status

| Control | Status | Evidence |
|---------|--------|---------|
| Database PITR (continuous WAL) | **Implemented** | `infrastructure/bicep/modules/postgres.bicep` |
| Geo-redundant database backups (prod) | **Implemented** | `postgres.bicep` `geoRedundantBackup: true` |
| Azure Blob RA-GRS | **Implemented** | `ops/disaster-recovery/README.md` |
| Container image retention (90 days) | **Implemented** | `ops/disaster-recovery/README.md` |
| IaC for full environment rebuild | **Implemented** | `infrastructure/bicep/main.bicep` |
| DR runbooks published | **Implemented (this PR)** | `docs/union-eyes/dr/` |
| Restore drill procedure defined | **Implemented (this PR)** | `scripts/db/restore-drill.ts` |
| Live RTO measurement in staging | **Pending** | First execution scheduled 2026-Q2 |
| Reproducible restore-drill report | **Partial → Complete** | `reports/dr/` (procedure live; RTO TBD) |
| Quarterly drill automation | **Implemented (this PR)** | `.github/workflows/dr-drill-reminder.yml` |
| Blob backup manifest (`blob-backup-manifest.json`) | **Pending** | Known gap — follow-on action |
| RTO published as contractual SLA | **Pending** | Requires measured RTO |

---

## Annual Review Schedule

| Review | Frequency | Owner | Next Due |
|--------|-----------|-------|---------|
| Continuity matrix review | Annually | CISO | 2027-04 |
| Contact list update | Annually | Engineering lead | 2027-04 |
| BCP sign-off (CISO + CTO) | Annually | CISO | 2027-04 |

---

## References

- [Restore Drill Runbook](restore-drill-runbook.md)
- [Database Restore Runbook](database-restore.md)
- [Blob Recovery Runbook](blob-recovery.md)
- [Rollback Procedure](rollback-procedure.md)
- [Platform DR Plan](../../../docs/ops/disaster-recovery.md)
- [Ops Business Continuity](../../../ops/business-continuity/README.md)
- [Ops DR README](../../../ops/disaster-recovery/README.md)
