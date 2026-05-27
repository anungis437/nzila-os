# Nzila OS — Incident Response Plan

> **Version:** 1.0  
> **Last Updated:** 2026-03-04  
> **Owner:** Platform Engineering  
> **Classification:** Internal

---

## 1. Severity Levels

| Level | Name | Description | Examples |
|-------|------|-------------|----------|
| **SEV-1** | Critical | Complete service outage or data breach | Production down, PII exposure, compliance violation |
| **SEV-2** | High | Major feature degraded, affects >25% of users | Payment processing failure, auth service down |
| **SEV-3** | Medium | Non-critical feature impacted, workaround exists | Dashboard slow, report generation delayed |
| **SEV-4** | Low | Minor issue, cosmetic, no workflow impact | UI alignment, non-critical log noise |

---

## 2. Escalation Paths

### SEV-1 — Critical

1. **T+0 min** — On-call engineer acknowledges alert
2. **T+5 min** — Incident commander assigned, war-room channel created
3. **T+15 min** — Engineering lead + security lead notified
4. **T+30 min** — CTO / VP Engineering briefed
5. **T+60 min** — External comms drafted (if customer-facing)

### SEV-2 — High

1. **T+0 min** — On-call engineer acknowledges
2. **T+15 min** — Team lead notified
3. **T+60 min** — Engineering lead notified if unresolved
4. **T+4 hr** — Escalate to SEV-1 if unresolved

### SEV-3 — Medium

1. **T+0 min** — On-call engineer triages
2. **T+1 hr** — Assigned to relevant team
3. **T+24 hr** — Team lead review if unresolved

### SEV-4 — Low

1. Logged and prioritised in next sprint planning

---

## 3. Response Time Targets

| Severity | Acknowledgement | First Response | Resolution Target |
|----------|----------------|----------------|-------------------|
| SEV-1 | 5 minutes | 15 minutes | 1 hour |
| SEV-2 | 15 minutes | 30 minutes | 4 hours |
| SEV-3 | 1 hour | 4 hours | 24 hours |
| SEV-4 | Next business day | Next sprint | Best effort |

---

## 4. Containment Procedures

### 4.1 Immediate Containment

1. **Isolate affected systems** — Disable affected routes, enable maintenance mode
2. **Revoke compromised credentials** — Rotate API keys, tokens, secrets immediately
3. **Preserve evidence** — Snapshot logs, database state, network captures before remediation
4. **Block attack vectors** — Update WAF rules, IP blocklists, rate limits

### 4.2 Short-Term Containment

1. Deploy hotfix or rollback to last known good state
2. Enable enhanced monitoring on affected systems
3. Restrict access to affected data stores
4. Notify affected organisations (if applicable)

### 4.3 Long-Term Remediation

1. Root cause analysis (RCA) document within 48 hours of resolution
2. Implement permanent fix with full test coverage
3. Update runbooks and monitoring based on learnings
4. Schedule post-incident review (PIR) within 5 business days

---

## 5. Forensic Artifact Preservation

### Evidence Chain Requirements

All incident evidence must be preserved with full chain-of-custody:

| Artifact Type | Retention Period | Storage Location |
|---------------|-----------------|------------------|
| Application logs | 90 days | Log aggregator (immutable) |
| Database snapshots | 30 days post-resolution | Encrypted blob storage |
| Network captures | 30 days post-resolution | Encrypted blob storage |
| Evidence packs | Indefinite | `ops/security/` + signed ZIP |
| Procurement evidence | 7 years | Sealed evidence pack |
| Incident timeline | Indefinite | `ops/incident-response/` |

### Evidence Pack Integration

Nzila OS evidence packs (`@nzila/platform-evidence-pack`) serve as forensic artifacts:

- **Compliance snapshots** — System state at the time of incident
- **Audit chain entries** — Hash-chain verification of evidence integrity
- **Procurement pack sections** — Signed, tamper-evident operational evidence
- **Build attestations** — Verify deployed code provenance via `ops/security/build-attestation.json`
- **SBOM** — Supply chain state at time of incident via `ops/security/sbom.json`

### Preservation Procedure

1. Generate evidence pack: `pnpm exec tsx scripts/demo-golden-path.ts`
2. Export signed procurement pack: `pnpm exec tsx scripts/validate-procurement-pack.ts`
3. Store cryptographic hash of all artifacts
4. Record incident timeline with UTC timestamps (ISO 8601, no milliseconds)
5. Maintain immutable log export for affected time window

---

## 6. Communication Templates

### Internal Notification (SEV-1/SEV-2)

```
INCIDENT: [Brief description]
SEVERITY: SEV-[N]
STATUS: [Investigating | Identified | Monitoring | Resolved]
IMPACT: [What is affected]
COMMANDER: [Name]
WAR ROOM: [Channel link]
NEXT UPDATE: [Time]
```

### External Notification (if required)

```
We are aware of an issue affecting [service/feature].
Our engineering team is actively investigating.
Current status: [status]
We will provide updates every [interval].
```

---

## 7. Post-Incident Review (PIR)

Every SEV-1 and SEV-2 incident requires a blameless PIR within 5 business days:

1. **Timeline** — Minute-by-minute reconstruction
2. **Root cause** — Technical and process factors
3. **Impact** — Users, revenue, data, compliance
4. **What went well** — Effective responses
5. **What could improve** — Process gaps identified
6. **Action items** — With owners and deadlines

PIR documents stored in `ops/incident-response/pir/`.

---

## 8. Related Documents

- [Disaster Recovery Plan](disaster-recovery.md)
- [Enterprise Readiness Index](../governance/enterprise-readiness.md)
- [On-Call Runbooks](../../ops/runbooks/)
- [Security Operations](../../ops/security-operations/)
- [SLO Policy](../../ops/slo-policy.yml)
