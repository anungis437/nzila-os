# Service Operations Layer — Internal Adoption Guide

## Status

The Service Operations Layer is **live in NzilaOS Console** and **actively used by the Nzila team**.  
This is not a product for market release. This is the machine we run on.

---

## Why this exists

1. **Run lean, not reactive** — every ticket gets tracked, every incident has an owner, every client has a health score.
2. **Build trust** — clients see a professional ops team behind the product, not a startup on Slack.
3. **Sales enablement** — "we eat our own dog food" is the strongest demo. Prospects see how we run and want it for themselves.
4. **Operational maturity** — MTTR, SLA attainment, and client health metrics become inputs to product roadmap decisions.

---

## Module Adoption Sequence

### Step 1 — Support Desk (Immediate)
Start logging all client support requests as tickets. Assign an owner. Track resolution time.  
Route: Console → Support Desk

### Step 2 — Client Accounts (Week 1)

Navigate to Platform Admin → ITSM Config → Queue Manager.  
Create at least one queue with:
- Name (e.g., "General IT Support")
- Responsible team
- Working hours and timezone
- Mark as **Default**

### Step 3 — Set SLA Profile (Optional)

Platform Admin → ITSM Config → SLA Profiles.  
The platform default applies if no custom profile is created.  
Create a custom profile to override P1/P2 targets for higher-tier clients.

### Step 4 — Create KB Stubs

Seeding 5–10 published KB articles dramatically improves the out-of-box experience.  
Suggested starter categories: `Network`, `Hardware`, `Software`, `Access & Accounts`, `General`.

### Step 5 — Enable Automation Rules (Optional)

Platform Admin → ITSM Config → Automation Rules.  
Activate the **VIP P1 Escalation** template immediately — requires no additional configuration.

### Step 6 — Open the Queue Board

Console → ITSM → Queue Board.  
Agents start creating tickets via the **+ New Ticket** button.

---

## Messaging by Persona

### IT Manager
> "Get full visibility into your team's workload, SLA attainment, and MTTR — all in one place, without leaving NzilaOS."

### Service Desk Agent
> "One inbox for every ticket type — incidents, service requests, access, and changes — with AI that triages for you."

### Platform Admin
> "Configure queues, SLA profiles, and automation rules in minutes from Platform Admin. No IT-ITSM tool subscription required."

### MSP / Managed Services
> "Bundle service tiers with custom SLA contracts and give clients a read-only view of their tickets and contract health."

---

## Competitive Differentiation

| Feature | NzilaOS ITSM | Standalone ITSM Tools |
|---|---|---|
| Integrated with HR, Finance, Governance | Yes | No — requires integrations |
| NIL AI (triage, drafts, KB suggest) | Built-in | Add-on / extra cost |
| Role-based access via platform RBAC | Yes | Separate user management |
| Same DB as all other NzilaOS data | Yes | Separate product / data silo |
| MSP multi-tenant contracts | Yes (org-scoped) | Complex setup required |
| Deployment | Zero — runs on existing NzilaOS | New tool + infra |

---

## Success Metrics (Pilot KPIs)

| Metric | Target |
|---|---|
| Time to first ticket created | < 10 min after onboarding |
| SLA attainment at 30 days | ≥ 85% |
| MTTR vs. baseline (if measurable) | ≥ 20% reduction |
| Agent adoption (tickets/week via ITSM) | ≥ 80% of service requests tracked |
| KB article usage (tickets with KB suggestion viewed) | ≥ 30% |

---

## Support & Feedback

File issues in the `nzila-os` repository with label `module:itsm`.  
For architecture questions, see `docs/itsm/ARCHITECTURE.md`.  
For schema queries, see `docs/itsm/SCHEMA.md`.
