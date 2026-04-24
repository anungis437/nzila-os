# Union Eyes — Pilot Proposal

> **Document type:** Pilot Proposal  
> **Generated from:** `apps/union-eyes/maturity.json`  
> **Version:** 1.0  
> **Generated:** 2026-04-24 13:12:22 UTC  
> **Status:** pilot

---

## Why This Proposal

Labour unions carry extraordinary evidential responsibility. Every grievance
that reaches arbitration — or fails to — lives or dies on the quality of its
documentation, timeline integrity, and role-separation. Today most unions run
this work on spreadsheets, email threads, and institutional memory.

UnionEyes is built for exactly this problem.

---

## What We Are Proposing

A **90-day time-limited pilot** of UnionEyes with [Prospective Organisation]
covering the core representation lifecycle:

| Phase | Scope |
|-------|-------|
| **Week 1–2** | Org provisioned; roles assigned; first real grievances logged |
| **Week 3–6** | Steward and LRO workflows validated; officer dashboard live |
| **Week 7–13** | Pilot review vs. readiness checklist; go/no-go for expansion |

---

## What Is Included

| Module | Description | Pilot Scope |
|--------|-------------|------------|
| Grievance Intake | Structured submission, timestamped, categorized | ✅ Included |
| Case Management | Full lifecycle: review → assignment → escalation → resolution | ✅ Included |
| Steward Workspace | Task surface, assigned cases, evidence, notes | ✅ Included |
| LRO Workspace | Senior rep oversight, arbitration prep, outcome recording | ✅ Included |
| Officer Dashboard | Real-time case load, risk patterns, outcome analytics | ✅ Included |
| Member Inbox | Outcome visibility for members | ✅ Included |
| Evidence Pack | Hash-sealed, tamper-evident case records | ✅ Included |
| AI Case Intelligence | Pattern extraction, precedent signals, risk scoring | Optional add-on |
| Multi-org Federation | National + locals in one system | Post-pilot |

---

## Platform Readiness

| Gate | Status |
|------|--------|
| Product tier | TIER 1 |
| Deployment status | pilot |
| DR runbooks published | ✅ `docs/union-eyes/dr/` |
| Restore drill evidence | ✅ `reports/dr/` (evidence-mode) |
| Quarterly drill cadence | ✅ Automated |
| Observability | Partial — per-route dashboards in progress |
| Access reviews | Partial — quarterly attestation framework active |
| Contracts complete | partial |

---

## Security Summary

- **Authentication:** Microsoft Entra ID (SSO/SCIM compatible)
- **Data isolation:** Row-level security enforced at database layer; org-scoped
  every query
- **Audit trail:** Hash-chained `audit_events` table — append-only, tamper-evident
- **Evidence sealing:** AES-256 HMAC-sealed evidence packs on every case export
- **Infrastructure:** Azure Container Apps (Canada Central), Key Vault,
  geo-redundant storage
- **Secrets:** Azure Key Vault with 90-day auto-rotation
- **Backup:** Continuous PostgreSQL PITR; RTO target ≤ 4 hours; RPO ≤ 1 hour

Full security and continuity documentation available under NDA.

---

## Pilot Contract Terms

| Term | Detail |
|------|--------|
| Duration | 90 days |
| Fixed fee | $5k–25k (negotiated) |
| User limit | Agreed cohort size |
| Data ownership | Client retains all data |
| Export on exit | Full JSON export + evidence packs available on request |
| Conversion path | Month-to-month SaaS on pilot conclusion |

> *Pricing is a working hypothesis. Final terms are negotiated per engagement.*

---

## Success Criteria

The pilot is complete when:

1. Real users have moved work through the core path
2. Platform shows healthy operational signals (SLA compliance, case throughput)
3. Readiness checklist reviewed at day 30 and day 90
4. Go/no-go decision documented

---

## References

- [Platform DR Summary](../../docs/public/restore-readiness-summary.md)
- [Trust Center](../../docs/public/trust-center.md)
- [Procurement Pack](../../artifacts/commercial/procurement-pack.md)
- [Revenue Profile](../../docs/union-eyes/revenue-profile.md)
- [Pilot Admin Runbook](../../docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md)
