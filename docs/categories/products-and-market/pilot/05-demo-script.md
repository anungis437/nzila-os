# Demo Script — 20-Minute Pilot Walkthrough

**Purpose:** Structured demo script for pilot stakeholders, mapping Console features to proof artifacts.
**Audience:** CTO, VP Ops, Procurement, Compliance Officer
**Duration:** 20 minutes
**Owner:** Solutions Engineering
**Last Updated:** 2026-03-03

---

## Before the Demo

- [ ] Console is accessible (staging or pilot environment)
- [ ] Pilot org is provisioned with sample data
- [ ] Integrations configured (at least one active)
- [ ] Proof pack generated for the pilot org
- [ ] SLO gate passing (`pnpm pilot:check`)

---

## Demo Flow

### Minute 0–2: Opening (2 min)

**Script:**
> "Thank you for joining. Today I'll walk you through Nzila OS — our operational platform
> that gives you real-time visibility, compliance evidence, and confidence in your operations.
> Everything I show maps to auditable proof artifacts."

**Action:** Open Console → Dashboard.

---

### Minute 2–5: Org Overview (3 min)

**Console page:** `/console`

**Key points:**

- Multi-tenant architecture — your data is isolated.
- Your org has its own scoped view of everything.
- Quick navigation to all operational areas.

**Proof artifact:** Isolation Certification Report.

---

### Minute 5–8: System Health (3 min)

**Console page:** `/system-health`

**Key points:**

- Real-time DB health, outbox backlogs, worker saturation.
- All metrics are live — not static dashboards.
- Automated daily health digests with anomaly detection.
- On-call team is alerted immediately on threshold breach.

**Proof artifact:** Health Digest Snapshots, SLO Compliance Report.

---

### Minute 8–11: Performance & Regressions (3 min)

**Console page:** `/performance` → `/performance/regressions`

**Key points:**

- P50/P95/P99 latency, error rate, throughput — org-scoped.
- Regressions dashboard: top regressions, slowest routes, error spikes.
- SLO gate prevents regressions from reaching your environment.
- Optional perf budgets for additional protection.

**Proof artifact:** Performance Envelope Report, Release Attestation.

---

### Minute 11–14: Governance & Audit Trail (3 min)

**Console page:** `/governance` → `/audit-insights` → `/audit-graph`

**Key points:**

- Every mutation is audit-logged with hash-chain integrity.
- Tamper-evident — you can verify the chain hasn't been broken.
- Full audit graph showing relationships between events.
- Governance profiles enforce rules automatically.

**Proof artifact:** Audit Trail Export, Hash Chain Verification.

---

### Minute 14–16: Integrations (2 min)

**Console page:** `/integrations`

**Key points:**

- Pre-built adapters for Stripe, QuickBooks, HubSpot, etc.
- Per-provider health monitoring and SLA tracking.
- DLQ management with automatic retry.
- Credential management — no secrets exposed in UI.

**Proof artifact:** Integration SLA Report.

---

### Minute 16–18: Proof Pack (2 min)

**Console page:** `/proof-pack`

**Key points:**

- All evidence from this demo is bundled here.
- SHA-256 hashed, tamper-evident, 7-year retention.
- Exportable for your compliance team.
- Maps to SOC 2 Trust Service Criteria, POPIA, GDPR.

**Proof artifact:** This IS the proof pack.

---

### Minute 18–20: Deployment & Next Steps (2 min)

**Console page:** `/deployment-profile`

**Key points:**

- Three deployment profiles: Managed, Sovereign, Hybrid.
- Choose based on your data residency and control requirements.
- Pilot can convert to production with the same org and data.

**Close:**
> "Everything you've seen today is backed by automated proof artifacts.
> The pilot org we've created is ready for your team to begin using.
> What questions do you have?"

---

## Objection Handling Quick Reference

| Objection | Response |
|-----------|----------|
| "How do we know our data is isolated?" | Console → Isolation shows automated certification with evidence. |
| "What happens if there's an outage?" | Documented incident response + on-call + runbooks. Show SLAs. |
| "Can we get SOC 2 evidence?" | Proof Pack bundles all controls. SOC 2 Type II in progress. |
| "What about performance under load?" | Console → Scale Sim + Performance show real metrics. SLO gate enforces. |
| "Can we self-host?" | Yes — Sovereign profile. See deploy/profiles.md. |
| "How do we export our data?" | Console → Platform Export. Full data export, any time. |

---

## Related Documents

- [Scope Checklist](01-scope-checklist.md)
- [Security & Privacy Packet](03-security-privacy-packet.md)
- [Deploy Profiles](../deploy/profiles.md)
