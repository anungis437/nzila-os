# UnionEyes — Revenue Product Profile

> **Classification:** SELL NOW · Pilot-safe · Priority 1  
> **Truth anchor:** `governance/portfolio/product-catalog.json` · `nzila-truth-manifest.json`  
> **Last updated:** April 2026

---

## The One-Sentence Pitch

> "Air traffic control for unions — the governed platform for grievance management, member representation, and leadership intelligence."

---

## Problem

Labour unions are the most evidence-sensitive organizations in the world. A grievance resolved incorrectly, or without a defensible audit trail, can cost a union its arbitration — and its credibility with members.

Yet most unions still run their representation work on spreadsheets, email threads, and institutional memory. The result:

- Grievances fall through the cracks between stewards
- Arbitration prep is a fire drill every time
- Leadership has no systemic view of case risk or load
- Members lose trust when follow-through is invisible

No purpose-built governed platform exists for this work. General CRM and case tools don't understand union workflow semantics, evidence requirements, or multi-level representation hierarchy.

**UnionEyes does.**

---

## Solution

UnionEyes is a governed SaaS platform that manages the full union representation lifecycle — from first-contact grievance intake through arbitration outcome — with built-in audit trails, RBAC, and member transparency.

### Core Capabilities

| Module | Description |
|--------|-------------|
| Grievance Intake | Structured submission by member or steward, timestamped, categorized |
| Case Management | Full lifecycle: review → assignment → escalation → resolution |
| Steward Workspace | Task surface for reps: assigned cases, follow-up, evidence, notes |
| LRO Workspace | Senior rep oversight: case escalation, arbitration prep, outcome recording |
| Officer Dashboard | Real-time load, case risk patterns, outcome analytics |
| Member Inbox | Outcome visibility so members see progress on their grievances |
| Evidence Pack | Hash-sealed, tamper-evident case record — arbitration-ready |
| AI Case Intelligence | Sidecar analysis: pattern extraction, precedent signals, risk scoring |
| Multi-org Federation | Support for locals + national federation in one governed system |

---

## Why UnionEyes Wins

| Competitor | Gap vs. UnionEyes |
|------------|-------------------|
| Generic CRM (Salesforce, etc.) | No union workflow semantics; no evidence sealing; high config cost |
| Email + spreadsheet | No audit trail; no role separation; breaks at scale |
| Generic case tools | Not designed for multi-level representation; no AI sidecar |
| Union-specific tools (legacy) | On-prem, no AI, outdated UX, no real-time analytics |

**UnionEyes unique moat:**
1. Hash-sealed evidence trails built into every case action — unique in market
2. Purpose-built role model: member / steward / LRO / officer / federation admin
3. AI sidecar wired to Django backend for case pattern intelligence
4. Full governance engine behind it (GA gate, contract tests, truth authority)

---

## Readiness Truth

| Gate | Status |
|------|--------|
| Product tier | PRODUCTION |
| Deployment status | pilot |
| Readiness tier | pilot-safe |
| Can claim pilot-ready | ✅ YES |
| Can claim audit-hardened | ✅ YES |
| Can claim production deployment | ❌ NOT YET |

**Honest summary:** UnionEyes is pilot-safe. It is live in staging, has a full pilot runbook, governance docs, and CUPE evidence pack. It is NOT yet in production with a paying customer — that is the next milestone.

---

## CUPE Pilot — Evidence Anchors

The CUPE pilot is the current live engagement. All artifacts are in `docs/pilot/cupe/`:

| Document | Purpose |
|----------|---------|
| [CUPE_PILOTING_QUICK_START.md](../pilot/cupe/CUPE_PILOTING_QUICK_START.md) | Pilot overview and onboarding guide |
| [CUPE_READINESS_CHECKLIST.md](../pilot/cupe/CUPE_READINESS_CHECKLIST.md) | Pre-launch readiness gates |
| [CUPE_PILOT_ADMIN_RUNBOOK.md](../pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md) | Admin operational guide |
| [CUPE_RBAC_MATRIX.md](../pilot/cupe/CUPE_RBAC_MATRIX.md) | Role permissions reference |
| [CUPE_PILOT_GO_NO_GO_REVIEW.md](../pilot/cupe/CUPE_PILOT_GO_NO_GO_REVIEW.md) | Go/No-Go gate review |
| [Procurement Pack](../governance/procurement-pack.md) | Buyer-facing governance evidence |

---

## Pricing Hypothesis

| Package | Price | For |
|---------|-------|-----|
| Local Starter | $3/member/month (min $500/mo) | Locals under 2,000 members |
| Local Professional | $5/member/month | Locals 2,000–10,000 members |
| Federation | $60k–120k/year (negotiated) | National federations |
| Pilot contract | $5k–25k fixed fee (90 days) | First-time buyers |

**Note:** Pricing is a hypothesis based on comparables. No pricing is committed. Validate with first 3 deals.

---

## ICP Summary

**Target buyer:** Labour unions and federation operations leads  
**Segment:** CUPE locals → national federation → provincial bodies  
**Geography:** Canada (primary), North America, anglophone Africa  
**Trigger events:**
- Grievance arbitration loss due to poor documentation
- New ED or National Rep inheriting chaos
- Contract renewal year (union wants to show operational credibility to members)
- Failed digital transformation attempt with generic tools

---

## Sales Narrative

> "Every year, unions lose arbitrations they should have won — because the evidence wasn't organized, the timeline wasn't clean, and the audit trail didn't exist. UnionEyes is the platform that makes sure that never happens again. We built it from the ground up for how unions actually work — not a CRM with a union skin on top."

---

## Onboarding Path

1. **Day 0:** Org provisioned in control plane — 30 minutes
2. **Day 1:** Roles assigned (member/steward/LRO/officer/admin), test cases created
3. **Week 1:** First real grievances logged; steward workflows validated
4. **Week 2:** Officer dashboard live; pilot feedback cycle begins
5. **Day 30:** Pilot review vs. readiness checklist — go/no-go for expansion

Full runbook: [docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md](../pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md)

---

## Next Milestones

- [ ] Convert CUPE pilot to a contracted SaaS agreement
- [ ] Document pilot outcomes: cases managed, time-to-resolution delta, rep NPS
- [ ] Open second pilot with a union federation or provincial body
- [ ] Build public product page on `apps/web`
- [ ] Define revenue milestone for "production-deployed" status claim
