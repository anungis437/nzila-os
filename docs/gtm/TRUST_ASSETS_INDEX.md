# Trust Assets Index

> **Authority:** `docs/gtm/GTM_MASTER_OPERATING_SYSTEM.md`  
> **Owner:** Platform Owner  
> **Updated:** 2026-04-20  
> **Purpose:** Map every credibility-building asset in the repo to the buyer persona that needs it and the moment in the sales cycle when it should be used.

---

## Why This Exists

Nzila has more trust assets than most early-stage platforms. The problem is discoverability. This index ensures no asset sits unused because no one remembered it was there.

**Rule:** Before any buyer meeting, check the relevant persona section and attach or reference the assets appropriate to their role and stage.

---

## Persona Key

| Code | Persona | When They Appear |
|------|---------|----------------|
| **EXEC** | Executive Sponsor — Executive Director, General Secretary, Regional VP | Every stage; decision authority |
| **IT** | IT / Technical Contact — internal systems lead, IT manager | Due diligence, post-proposal |
| **SEC** | Security / Compliance | Due diligence, procurement gate |
| **PROC** | Procurement / Finance | After pilot, before SaaS contract |
| **OPS** | Operations / Admin — office manager, case administrator | Pilot kickoff and onboarding |
| **BOARD** | Board or Governance Body | Sometimes in approval path for national orgs |

**Stage Key:** Stage numbers match `docs/gtm/PIPELINE_ENGINE.md` (0-Research → 9-Expansion)

---

## Executive Sponsor (EXEC)

*Needs: confidence in the platform, peer validation, clear ROI, credibility of vendor*

### Send at First Meeting (Stage 3–4)

| Asset | File | What It Does |
|-------|------|-------------|
| Union Eyes Executive One-Pager | [docs/gtm/ue-executive-one-pager.md](../gtm/ue-executive-one-pager.md) | 1-page summary — reads in 90 seconds. Send before or after first meeting. |
| Portfolio Overview | [docs/buyers/PORTFOLIO_OVERVIEW.md](../buyers/PORTFOLIO_OVERVIEW.md) | Shows breadth of platform without overwhelming; demonstrates this isn't a one-trick vendor |
| Pilot Tier Menu | [docs/gtm/ue-pilot-tiers.md](../gtm/ue-pilot-tiers.md) | Translates "what does working with you look like?" into a structured, low-risk on-ramp |

### Send with Proposal (Stage 5–6)

| Asset | File | What It Does |
|-------|------|-------------|
| Operating Model | [docs/buyers/OPERATING_MODEL.md](../buyers/OPERATING_MODEL.md) | Shows how the platform runs in production — executive-level governance framing |
| SLA and Support Model | [docs/buyers/sla-support-model.md](../buyers/sla-support-model.md) | Answers "what happens when something goes wrong?" before they ask |
| Reliability Summary | [docs/buyers/RELIABILITY_SUMMARY.md](../buyers/RELIABILITY_SUMMARY.md) | Infrastructure reliability framing — non-technical language |
| Enterprise Readiness | [docs/governance/enterprise-readiness.md](../governance/enterprise-readiness.md) | Demonstrates the platform meets enterprise org requirements |

### For Board / Leadership Approval Path

| Asset | File | What It Does |
|-------|------|-------------|
| Platform Readiness | [docs/governance/platform-readiness.md](../governance/platform-readiness.md) | Structured evidence of production-readiness — useful for board memos |
| Governance Architecture | [docs/governance/GOVERNANCE_ARCHITECTURE.md](../governance/GOVERNANCE_ARCHITECTURE.md) | Shows the evidence model is governed by design, not luck |

---

## IT / Technical Contact (IT)

*Needs: integration clarity, deployment model options, architecture credibility, data ownership answers*

### At Technical Due Diligence Stage (Stage 4–5)

| Asset | File | What It Does |
|-------|------|-------------|
| Integration Readiness Matrix | [docs/buyers/integration-readiness-matrix.md](../buyers/integration-readiness-matrix.md) | Shows what systems Union Eyes connects to, how, and what isn't supported yet |
| Deployment Models | [docs/buyers/deployment-models.md](../buyers/deployment-models.md) | Cloud vs. on-prem vs. hybrid — answer their first 5 questions before they ask |
| Product Capability Matrix | [docs/buyers/product-capability-matrix.md](../buyers/product-capability-matrix.md) | Structured feature/capability list — useful for IT evaluation rubrics |
| Audit Logging Model | [docs/governance/audit-logging-model.md](../governance/audit-logging-model.md) | Every significant action is logged — critical for orgs with audit requirements |
| Data Retention Policy | [docs/governance/data-retention-policy.md](../governance/data-retention-policy.md) | Where does data live, how long, what gets deleted |

### Architecture Depth (if they want it)

| Asset | File | What It Does |
|-------|------|-------------|
| Change Enablement Architecture | [docs/governance/CHANGE_ENABLEMENT_ARCHITECTURE.md](../governance/CHANGE_ENABLEMENT_ARCHITECTURE.md) | How platform changes are managed and deployed safely |
| Platform Surface Responsibilities | [docs/governance/PLATFORM_SURFACE_RESPONSIBILITIES.md](../governance/PLATFORM_SURFACE_RESPONSIBILITIES.md) | Ownership model for each layer of the platform |

---

## Security / Compliance (SEC)

*Needs: vulnerability posture, access controls, incident response, vendor security practices*

### At Security Review Stage (Stage 5–6)

| Asset | File | What It Does |
|-------|------|-------------|
| Security Summary | [docs/buyers/SECURITY_SUMMARY.md](../buyers/SECURITY_SUMMARY.md) | Buyer-facing security posture summary — non-technical language |
| Security Overview (detailed) | [docs/governance/security-overview.md](../governance/security-overview.md) | Full security architecture reference |
| Vulnerability Disclosure Policy | [docs/governance/vulnerability-disclosure-policy.md](../governance/vulnerability-disclosure-policy.md) | Responsible disclosure — shows maturity of security posture |
| Incident Response Summary | [docs/governance/incident-response-summary.md](../governance/incident-response-summary.md) | Answers "what happens if there's a breach?" |
| Pentest Plan | [docs/governance/pentest-plan.md](../governance/pentest-plan.md) | Evidence that active security testing is in practice |
| BCP/DR Overview | [docs/governance/bcp-dr-overview.md](../governance/bcp-dr-overview.md) | Business continuity and disaster recovery — answers "what if the vendor goes down?" |

### For Heavily Regulated Orgs (healthcare unions, public sector)

| Asset | File | What It Does |
|-------|------|-------------|
| Vendor Questionnaire Starter Pack | [docs/governance/vendor-questionnaire-starter-pack.md](../governance/vendor-questionnaire-starter-pack.md) | Pre-filled answers to the 80% of questions every security team asks |
| Secure Coding Training | [docs/governance/secure-coding-training.md](../governance/secure-coding-training.md) | Shows engineering team has documented security practices |

---

## Procurement / Finance (PROC)

*Needs: commercial terms, pricing logic, contract structure, SLA commitments*

### Before Contract Signature (Stage 6–7)

| Asset | File | What It Does |
|-------|------|-------------|
| Procurement Pack | [docs/governance/procurement-pack.md](../governance/procurement-pack.md) | Full buyer-side procurement package — designed to accelerate internal approvals |
| Procurement FAQ | [docs/governance/procurement-faq.md](../governance/procurement-faq.md) | Pre-answered procurement questions — give this to the finance/procurement team to unblock them |
| Procurement Evidence System | [docs/governance/PROCUREMENT_EVIDENCE_SYSTEM.md](../governance/PROCUREMENT_EVIDENCE_SYSTEM.md) | How evidence of performance and compliance is maintained |
| SLA and Support Model | [docs/buyers/sla-support-model.md](../buyers/sla-support-model.md) | Commercial SLA commitments in clear terms |
| Pricing Strategy V2 | [docs/gtm/PRICING_STRATEGY_V2.md](../gtm/PRICING_STRATEGY_V2.md) | Internal pricing reference; do not send in full — use to generate a scoped proposal |

---

## Operations / Admin (OPS)

*Needs: onboarding ease, training plan, day-to-day workflow integration, change management*

### At Pilot Kickoff (Stage 8 / Day 0)

| Asset | File | What It Does |
|-------|------|-------------|
| Pilot Scope Checklist | [docs/pilot/01-scope-checklist.md](../pilot/01-scope-checklist.md) | What's included in this pilot, what isn't — prevents scope creep and misalignment |
| Data Onboarding Guide | [docs/pilot/02-data-onboarding.md](../pilot/02-data-onboarding.md) | Step-by-step data migration and onboarding — reduces ops team anxiety about "getting data in" |
| Monitoring and SLOs | [docs/pilot/04-monitoring-and-slos.md](../pilot/04-monitoring-and-slos.md) | What they can expect to see, how issues get surfaced |
| Demo Script | [docs/pilot/05-demo-script.md](../pilot/05-demo-script.md) | For ops-led internal demo to stewards or staff who weren't at the exec briefing |

### During Pilot

| Asset | File | What It Does |
|-------|------|-------------|
| Pilot Readiness Checklist | [docs/buyers/pilot-readiness-checklist.md](../buyers/pilot-readiness-checklist.md) | Week 1 onboarding validation — confirms the org is set up for success |

---

## Board / Governance Body (BOARD)

*Needs: validation from a trusted source, risk framing, precedent that peer orgs have adopted this*

*Board contacts rarely interact directly — they review materials prepared by the executive.*

### For Executive to Share Internally

| Asset | File | What It Does |
|-------|------|-------------|
| Union Eyes Buyer Pack | [docs/buyers/union-eyes-buyer-pack.md](../buyers/union-eyes-buyer-pack.md) | Full buyer narrative — exec can submit to board as vendor assessment |
| Governance Architecture | [docs/governance/GOVERNANCE_ARCHITECTURE.md](../governance/GOVERNANCE_ARCHITECTURE.md) | Demonstrates evidence governance is built into the product |
| Platform Readiness | [docs/governance/platform-readiness.md](../governance/platform-readiness.md) | Production-readiness proof in structured format |
| BCP/DR Overview | [docs/governance/bcp-dr-overview.md](../governance/bcp-dr-overview.md) | Risk mitigation for the board's "what if" questions |

---

## Proof Artifacts (Use in Demo / Conversations)

These are living proof outputs from the running platform — more credible than static docs.

| Artifact | Location | When to Use |
|----------|---------|------------|
| Evidence Pack Samples | [proof-artifacts/evidence-packs/](../../proof-artifacts/evidence-packs/) | Show in demo — "here's what an actual evidence pack looks like at resolution" |
| AI-Controlled Request Proof | [proof-artifacts/ai-controlled-request/](../../proof-artifacts/ai-controlled-request/) | For IT/EXEC: demonstrates AI governance — no uncontrolled AI action |
| Compliance-Sensitive Action Proof | [proof-artifacts/compliance-sensitive-action/](../../proof-artifacts/compliance-sensitive-action/) | For SEC: shows how compliance-flagged actions are handled |
| Governed Mutation Proof | [proof-artifacts/ue-governed-mutation/](../../proof-artifacts/ue-governed-mutation/) | For IT/SEC: demonstrates that all data mutations are audited and governed |
| Latest Proof Summary | [proof-artifacts/latest-proof-summary.json](../../proof-artifacts/latest-proof-summary.json) | At-a-glance proof status — useful for vendor questionnaires |

---

## FairCase Engine (for Labour-Specialist Conversations)

| Asset | File | When to Use |
|-------|------|-------------|
| FairCase Engine Overview | [docs/gtm/faircase-engine.md](../gtm/faircase-engine.md) | With senior labour executives or legal contacts — positions Union Eyes as a reasoning-driven platform, not just a case tracker |

---

## Asset Usage Quick Reference

*At each key sales moment, pull the assets for the relevant personas in the room.*

| Moment | Personas in Room | Send / Show |
|--------|----------------|------------|
| Cold intro email | EXEC | Executive one-pager, pilot tier overview |
| First call (30 min) | EXEC | One-pager + offer stack (verbal) |
| Readiness briefing | EXEC + OPS | Buyer pack, deployment models |
| Technical review | IT + SEC | Integration matrix, security summary, audit logging |
| Proposal presentation | EXEC + PROC | SLA model, procurement pack, pricing proposal |
| Pilot kickoff | OPS + EXEC | Pilot scope checklist, data onboarding guide |
| Pilot review (Week 4) | EXEC | Pilot KPI snapshot, case study agreement draft |
| Pilot close + conversion | EXEC + PROC | Outcome report, SaaS proposal, contract |
| Board presentation (by exec) | BOARD | Governance architecture, platform readiness, BCP/DR |
