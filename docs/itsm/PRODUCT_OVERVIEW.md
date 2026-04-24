# Nzila Service Operations Layer — Overview

## What is it?

The **Service Operations Layer** is how Nzila runs itself professionally.  
It is **not** an ITSM product we sell — it is the internal operational backbone that lets us deliver
Union Eyes, FairCase, Flow, Zonga, and Agrimo with credibility, reliability, and speed.

Every feature maps to a real Nzila operational need.  
Build the internal machine first. The business follows.

---

## Who uses it?

| Role | What they do | Surface |
|---|---|---|
| Ops Agent | Handle support tickets, onboard clients | Console → Support Desk |
| Ops Lead | Monitor health, MTTR, delivery | Console → Ops Dashboard |
| Account Owner | Track client health + renewals | Console → Client Accounts |
| Incident Owner | Manage production incidents, comms, RCA | Console → Incidents |
| Change Owner | Log deployments and changes | Console → Change Log |
| Platform Admin | Configure SLAs, queues, automation | Platform-Admin → Service Ops Config |

---

## Core Capabilities

### 1. Ticket Management

- Full lifecycle: `new → triaged → assigned → in_progress → resolved → closed`
- 10 ticket types: Incident, Service Request, Change, Problem, Question, Maintenance, Access, Security, Procurement, Other
- 4 priority tiers: P1 Critical → P4 Low
- Immutable event log for full auditability

### 2. SLA Engine

- Per-priority response and resolution targets
- Real-time breach detection and countdown
- SLA attainment percentage reporting
- MTTR (Mean Time To Resolution) analytics
- Custom SLA profiles per queue or MSP contract

### 3. CMDB (Configuration Management Database)

- Track servers, workstations, laptops, network devices, software, licenses, databases, and services
- Asset risk scoring (0–100) based on criticality, age, patch status
- Link assets to tickets for impact analysis

### 4. Change Management

- Request for Change (RFC) workflow
- Approval chains (multi-step, multi-approver)
- Change calendar view
- Bridges to `@nzila/platform-change-management` for cross-platform change tracking

### 5. Problem Management

- Relate multiple incidents to a root-cause problem
- Track through investigation stages to resolution
- Known Error Database (KEDB) entries

### 6. Knowledge Base

- Structured articles per category
- Published/draft/archived lifecycle
- Search and filter by category
- AI-powered article suggestions at ticket intake

### 7. MSP Client Contracts

- Define service tiers per client organisation
- Bind custom SLA profiles to contracts
- Track contract expiry and renewal

### 8. No-Code Automation

- Condition → Action rules evaluate on every ticket mutation
- Built-in templates: P1 escalation, no-response escalation, recurring-to-problem
- Rules stored in DB; editable via Platform Admin

### 9. AI Intelligence (NIL-powered)

- **Auto-triage**: suggest priority, queue, category from ticket text
- **SLA breach prediction**: score breach risk for in-flight tickets
- **Duplicate detection**: find related open tickets before starting work
- **KB suggest**: surface relevant articles at intake
- **Response draft**: generate professional agent reply drafts

---

## Key Metrics (ITSM Dashboard)

- SLA attainment by priority tier
- Open ticket volume by status
- MTTR trend
- P1/P2 critical ticket count
- Tickets by type and category

---

## Licensing Considerations

The ITSM Command Center is available to all NzilaOS organisations.  
Advanced AI features (triage, breach prediction, response drafts) require an active `@nzila/intelligence` configuration with a connected Azure OpenAI deployment.

---

## Roadmap

| Phase | Features |
|---|---|
| v1 (current) | Tickets, SLA, CMDB, Changes, Problems, KB, Contracts, Automation, NIL prompts |
| v2 | Customer-facing self-service portal, email-to-ticket, SLA notification webhooks |
| v3 | Full CMDB discovery integration, automated asset scanning, ML-based priority prediction |
