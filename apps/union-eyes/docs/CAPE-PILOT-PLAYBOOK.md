# CAPE Pilot Playbook

> Historical CAPE-specific playbook.
> Current UnionEyes pilot implementation is metrics-first and route-driven.
> Use these as canonical references for current behavior:
> - [apps/union-eyes/docs/PILOT_SCOPE.md](apps/union-eyes/docs/PILOT_SCOPE.md)
> - [apps/union-eyes/docs/PILOT_VALIDATION.md](apps/union-eyes/docs/PILOT_VALIDATION.md)
> - [docs/union-eyes/pilot-kpis.md](docs/union-eyes/pilot-kpis.md)

**Version:** 1.0
**Audience:** CAPE-ACEP pilot administrators, LROs, and leadership
**Platform:** UnionEyes by NzilaOS

---

## 1 — Pilot Objective

Deploy UnionEyes as CAPE's grievance case management platform for a **4-week controlled pilot** with a single CAPE bargaining unit. The pilot validates that the platform meets CAPE's representation model — specifically the **LRO-led** (Labour Relations Officer) workflow — before broader rollout.

### Success Criteria

- [ ] LROs can file, assign, and resolve grievances end-to-end
- [ ] Leadership dashboard provides real-time KPIs to authorized officers
- [ ] Evidence packs are generated and sealed for resolved cases
- [ ] Pilot health score reaches **≥ 70** (Good) by Week 4
- [ ] All onboarding checklist items completed by end of Week 0

---

## 2 — Scope

### In Scope

| Workflow | Description |
|----------|-------------|
| Grievance intake | File new grievances via web form (draft → submitted) |
| Case assignment | Protocol-aware assignment to LROs (CAPE preset) |
| Case progression | Triage → investigation → mediation → arbitration/settlement |
| Employer communication | Log and send communications to employer contacts |
| Leadership reporting | Dashboard with KPI cards, trends, capacity, compliance |
| Evidence export | Generate sealed evidence packs for resolved cases |
| Onboarding | 7-item checklist with demo data seeding |

### Out of Scope (This Pilot)

- Dues management and Stripe payment processing
- Elections module
- Strike fund management
- Calendar/scheduling
- Bulk member import from external HR systems
- Mobile app

---

## 3 — Roles & Responsibilities

| Role | Platform Role | Responsibilities |
|------|---------------|------------------|
| **Pilot Lead** | `admin` or `local_president` | Overall pilot coordination, go/no-go decisions |
| **IT Contact** | `admin` | Platform configuration, user provisioning, integration setup |
| **LRO (Labour Relations Officer)** | `steward` + LRO protocol | File grievances, manage cases, communicate with employers |
| **Senior LRO** | `chief_steward` | Review escalated cases, workload balancing |
| **Director of Labour Relations** | `business_agent` | Final escalation point, leadership dashboard access |
| **CAPE Officer** | `local_president` / `local_vp` | Leadership dashboard, export reports, pilot oversight |
| **Nzila Support** | Platform support | Technical support, troubleshooting, pilot health monitoring |

---

## 4 — Environment Setup

### 4.1 Prerequisites

- [ ] CAPE organization created in platform auth (SSO or PG accounts)
- [ ] Pilot users provisioned with platform accounts
- [ ] UnionEyes deployment accessible (production or staging URL)
- [ ] PostgreSQL database provisioned and migrated
- [ ] Redis instance available (rate limiting, caching)

### 4.2 Organization Configuration

1. **Navigate to** `/dashboard/pilot/onboarding`
2. **Representation Protocol:** Verify CAPE LRO-led preset is active
   - Admin UI: `/admin/representation-protocol`
   - API: `GET /api/admin/representation-protocol`
   - Expected preset: `lro-led` with primary role = `Labour Relations Officer`
3. **Feature Flags:** Ensure CAPE pilot flags are enabled for the organization

### 4.3 Representation Protocol Verification

Confirm the LRO-led protocol is configured:

| Setting | Expected Value |
|---------|---------------|
| Primary Representative | Labour Relations Officer (LRO) |
| Escalation Chain | Senior LRO → Director of Labour Relations |
| Assignment Terminology | "Assign LRO" (not "Assign Steward") |
| Workload Cards | "LRO Workload" titles |

---

## 5 — Seed Data

### 5.1 Demo Data Seeding

1. Navigate to `/dashboard/pilot/onboarding`
2. Locate the **Demo Data Badge** panel
3. Click **Seed Demo Data**
4. Verify the summary shows:
   - 4 employers (Treasury Board, CRA, PSPC, Statistics Canada)
   - 8 sample grievances (across contract, discipline, harassment, safety types)
   - 24 timeline entries
   - 1 sample resolution

### 5.2 Demo Data Contents

The demo dataset includes realistic CAPE-style grievances:

| Grievance | Type | Status | Employer |
|-----------|------|--------|----------|
| EC-06 Classification Dispute | Contract | Investigating | Treasury Board |
| Unjust 5-Day Suspension | Discipline | Filed | CRA |
| Remote Work Accommodation Denial | Contract | Mediation | PSPC |
| Workplace Harassment Complaint | Harassment | Draft | Treasury Board |
| Overtime Pay Calculation Error | Contract | Settled | Statistics Canada |
| Denial of Language Training | Contract | Arbitration | CRA |
| Acting Pay Dispute | Contract | Investigating | PSPC |
| Ergonomic Assessment Refusal | Safety | Filed | Treasury Board |

### 5.3 Purging Demo Data

Before going live with real data, purge demo data:
1. Navigate to `/dashboard/pilot/onboarding`
2. Click **Purge Demo Data** on the Demo Data Badge
3. Confirm purge (this emits a `PILOT_DEMO_DATA_PURGED` audit event)

---

## 6 — Weekly Timeline

### Week 0 — Setup & Onboarding (Pre-Pilot)

| Day | Activity | Owner |
|-----|----------|-------|
| Mon | Provision platform accounts for all pilot users | IT Contact |
| Mon | Configure LRO-led representation protocol | IT Contact |
| Tue | Seed demo data; walk through onboarding checklist | Pilot Lead |
| Tue | Role assignment: LROs, Senior LRO, Director, Officers | IT Contact |
| Wed | Import employer contacts (Treasury Board, CRA, PSPC, StatCan) | Pilot Lead |
| Wed | Verify integration configs (email notifications) | IT Contact |
| Thu | **LRO Training Session** (see Section 7) | Pilot Lead |
| Thu | Test evidence export pipeline | IT Contact |
| Fri | Complete all 7 onboarding checklist items | Pilot Lead |
| Fri | **Go/No-Go Decision** — all checklist items green? | Pilot Lead |

### Week 1 — Controlled Use

| Activity | Details |
|----------|---------|
| **File 3–5 real grievances** | LROs file initial cases using the intake form |
| **Test draft/resume** | Save a draft, close browser, verify resume modal appears |
| **Assign cases** | Use "Assign LRO" to distribute workload |
| **Check dashboard** | Officers review leadership dashboard daily |
| **Daily standup** | 10-min check-in: blockers, feedback, issues |
| **Health check** | Nzila support reviews pilot health score |

### Week 2 — Expanded Use

| Activity | Details |
|----------|---------|
| **File 5–10 additional grievances** | Cover all 4 types (contract, discipline, harassment, safety) |
| **Progress cases** | Advance cases through triage → investigation → mediation |
| **Log employer communications** | Use employer contact system for formal correspondence |
| **Export first report** | Officers export PDF board summary |
| **Review workload** | Senior LRO reviews LRO workload cards |
| **Mid-pilot review** | Pilot Lead + Nzila review health score, address concerns |

### Week 3 — Full Operations

| Activity | Details |
|----------|---------|
| **All new grievances filed in UnionEyes** | No parallel paper/email system |
| **Resolve first case** | Complete a case through to settlement/resolution |
| **Generate evidence pack** | Seal evidence for a resolved case |
| **Compliance review** | Check compliance summary card for alerts |
| **Leadership export** | Generate monthly PDF + CSV for board |

### Week 4 — Evaluation & Decision

| Activity | Details |
|----------|---------|
| **Freeze new features** | Focus on evaluation, not new requests |
| **Collect feedback** | Survey all pilot users (LROs, officers, admin) |
| **Review metrics** | Pilot Lead reviews all KPIs, health score, adoption |
| **End-of-pilot report** | Generate final leadership export |
| **Go/No-Go for rollout** | Decision meeting with CAPE leadership |

---

## 7 — Training Plan

### 7.1 LRO Training Session (2 hours)

| Duration | Topic | Materials |
|----------|-------|-----------|
| 15 min | Platform overview & login | Training links panel |
| 20 min | Filing a grievance (intake form) | Demo with GRV-DEMO-001 |
| 15 min | Draft save & resume | Live demo of resume modal |
| 20 min | Case assignment & workload | LRO workload cards |
| 15 min | Employer communication | Contacts + communication log |
| 15 min | Case progression (triage→investigation→mediation) | Workflow walkthrough |
| 10 min | Evidence export | Evidence pack generation |
| 10 min | Q&A | — |

### 7.2 Officer Training Session (1 hour)

| Duration | Topic |
|----------|-------|
| 15 min | Leadership dashboard walkthrough (6 KPIs) |
| 15 min | Employer hotspots & compliance alerts |
| 15 min | Exporting reports (PDF board summary, CSV) |
| 15 min | Pilot health monitoring & escalation |

### 7.3 Self-Service Resources

Available via the **Training Links Panel** on the onboarding page:
- LRO onboarding guide
- CBA reference guides
- Filing best practices
- Escalation procedures

---

## 8 — Support & Escalation

### 8.1 Support Tiers

| Tier | Channel | Response Time | Scope |
|------|---------|---------------|-------|
| **Tier 1** | In-app support card | Same day | How-to questions, navigation help |
| **Tier 2** | Email to Nzila support | 4 hours | Bug reports, data issues, access problems |
| **Tier 3** | Direct Nzila engineering | 2 hours | System outages, data integrity, security |

### 8.2 Escalation Path

```
LRO → Senior LRO → Director of Labour Relations → Pilot Lead → Nzila Support
```

### 8.3 Known Limitations

- Webhook integrations (Stripe, CLC) are not active — not needed for this pilot
- Mobile-optimized UI is available but not a dedicated mobile app
- Bulk member import requires admin assistance

---

## 9 — Success Metrics

### 9.1 Quantitative Targets

| Metric | Week 1 Target | Week 4 Target |
|--------|:-------------:|:-------------:|
| Grievances filed in platform | ≥ 3 | ≥ 15 |
| Cases assigned to LROs | ≥ 2 | ≥ 12 |
| Cases resolved | — | ≥ 2 |
| Leadership dashboard views | ≥ 5 | ≥ 20 |
| Evidence packs generated | — | ≥ 1 |
| Pilot health score | ≥ 50 | ≥ 70 |
| LRO adoption rate | ≥ 60% | ≥ 90% |

### 9.2 Qualitative Targets

- [ ] LROs report the platform is easier than current process
- [ ] Officers find the leadership dashboard useful for decision-making
- [ ] No data integrity or security incidents during pilot
- [ ] Employer communication log is more organized than email threads

---

## 10 — Go/No-Go Criteria

### Go (Proceed to Rollout)

All of the following must be true:

- [ ] Pilot health score ≥ 70 (Good)
- [ ] ≥ 2 cases resolved end-to-end in the platform
- [ ] ≥ 1 evidence pack successfully generated and sealed
- [ ] No critical bugs or data integrity issues
- [ ] ≥ 80% LRO adoption rate
- [ ] Positive feedback from majority of pilot users

### No-Go (Extend or Reassess)

Any of the following triggers a no-go:

- Pilot health score < 50 (Critical) at Week 4
- Data loss or cross-org data leakage incident
- LRO adoption rate < 50%
- Majority negative feedback from pilot users
- Unresolved blocker bugs

---

## 11 — End-of-Pilot Deliverables

| Deliverable | Format | Owner |
|-------------|--------|-------|
| Pilot Health Report | Auto-generated (in-app) | System |
| Leadership KPI Summary | PDF export from dashboard | Pilot Lead |
| Detailed Case Data | CSV export from dashboard | Pilot Lead |
| User Feedback Survey | Google Form / internal survey | Pilot Lead |
| Technical Incident Log | Audit event export | IT Contact |
| Go/No-Go Recommendation | Written memo | Pilot Lead |
| Rollout Plan (if Go) | Document | Pilot Lead + Nzila |

---

## Appendix: Onboarding Checklist Reference

The 7-item pilot checklist (tracked at `/dashboard/pilot/onboarding`):

| # | Item | Description |
|---|------|-------------|
| 1 | Organization seeded | CAPE org configured in system |
| 2 | Users invited | All pilot users have platform accounts |
| 3 | Roles assigned | LRO, Senior LRO, Director, Officer roles set |
| 4 | Contracts uploaded | Relevant CBA(s) uploaded to system |
| 5 | Employers imported | Treasury Board, CRA, PSPC, StatCan contacts added |
| 6 | Integrations configured | Email notifications verified working |
| 7 | Export verified | Evidence export pipeline tested successfully |

Completion of all 7 items emits a `PILOT_CHECKLIST_COMPLETED` audit event.

---

*End of playbook. For technical details, see the [CAPE Pilot Audit Report](./CAPE-PILOT-AUDIT-REPORT.md).*
