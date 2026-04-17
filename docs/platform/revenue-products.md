# Revenue Products — Nzila OS

> **Audience:** Buyers, partners, sales leads, and stakeholders evaluating Nzila products for procurement or piloting.
>
> **Truth anchor:** `governance/portfolio/product-catalog.json` — all status claims below derive from the canonical catalog.
>
> **Date:** April 2026

---

## The Two Products Worth Selling Now

Based on the April 2026 repo snapshot, two products have sufficient code maturity, governance depth, and narrative clarity for active sales:

| # | Product | Vertical | Stage | Priority |
|---|---------|----------|-------|---------|
| 1 | **UnionEyes** | Labour / LegalTech | Pilot-safe | SELL NOW |
| 2 | **Flow** | SMB Operations | Pilot-safe | SELL NOW |

A third product — **CFO** — is a strong build-next candidate with real integration depth.

---

## Product 1: UnionEyes

> "Air traffic control for unions."

### ICP — Ideal Customer Profile

| Attribute | Detail |
|-----------|--------|
| Organization type | Labour unions, union federations, national labour bodies |
| Size | 500–50,000 members |
| Key role | Director of Operations, National Rep, Legal/Arbitration Lead |
| Pain | Grievances managed in spreadsheets and email; no audit trail; reps fly blind on case status; leadership has no systemic view |
| Geography | Canada (primary), North America, Anglophone Africa |
| Example | CUPE locals, trade union federations, national labour organizations |

### Problem Solved

Unions operate the world's most evidence-sensitive organizations — yet most run on spreadsheets, email threads, and tribal knowledge.

- Grievances get lost between stewards
- Arbitration prep is manual and error-prone
- Leadership has no real-time case intelligence
- Member trust erodes when follow-through is invisible

### Value Proposition

UnionEyes gives every union a single governed platform for the full representation lifecycle — from intake to outcome — with:

- **Grievance lifecycle management** — intake, review, assignment, escalation, resolution
- **Steward + LRO workflows** — structured work surfaces for reps at every level
- **Evidence-sealed audit trails** — every material action is hash-sealed and tamper-evident
- **Member inbox + outcome tracking** — transparency that rebuilds member trust
- **Leadership intelligence** — real-time patterns, risk scoring, representation analytics
- **RBAC** — role-appropriate access from member to officer to federation admin

### Why Now

- CUPE pilot is live and generating real operational feedback
- Labour relations are increasing in complexity post-pandemic
- Digital transformation in labour sector is 10 years behind healthcare/finance
- Competitors are generic CRM/case tools — not purpose-built for union workflows
- Evidence-sealed audit requirement is unique differentiator (no competitor has it)

### Feature Proof

| Capability | Code Evidence | Status |
|------------|---------------|--------|
| Grievance intake workflow | apps/union-eyes/app/ | Implemented |
| Case management (steward/LRO) | apps/union-eyes/app/ | Implemented |
| Member inbox | apps/union-eyes/app/ | Implemented |
| RBAC (member/steward/LRO/officer/admin) | packages/platform-policy-engine | Implemented |
| Hash-sealed evidence trails | packages/evidence, packages/platform-evidence-pack | Implemented |
| Django AI sidecar (case intelligence) | apps/union-eyes/ (Django backend) | Implemented |
| Pilot admin tooling | apps/union-eyes/ | Implemented |
| CUPE pilot docs | docs/pilot/cupe/ | Complete |
| Procurement evidence pack | docs/governance/procurement-pack.md | Complete |

### Readiness Truth

| Dimension | Status |
|-----------|--------|
| Product tier | PRODUCTION (canonical registry) |
| Deployment status | pilot |
| Readiness tier | pilot-safe |
| Exposure | internal (not yet public-facing) |
| Can claim production deployment | ❌ NO |
| Can claim pilot-ready | ✅ YES |
| Can claim audit-hardened | ✅ YES |

### Deployment Truth

- Staging: Azure Container Apps (Canada Central) — `nzila-os-union-eyes`
- Database: PostgreSQL Flexible (Canada Central)
- Auth: `@nzila/platform-auth` (Argon2id + Entra SSO)
- No Redis dependency (removed April 2026)
- Sidecar: Django AI backend deployed alongside Next.js

### Onboarding Path

1. Org account provisioned in control plane (< 30 min)
2. RBAC roles assigned (member, steward, LRO, officer, admin)
3. Pilot admin runbook → [docs/pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md](../pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md)
4. Member onboarding guide → [docs/union-eyes/quick-start.md](../union-eyes/quick-start.md)
5. Readiness checklist → [docs/pilot/cupe/CUPE_READINESS_CHECKLIST.md](../pilot/cupe/CUPE_READINESS_CHECKLIST.md)

### Pricing Hypothesis

| Model | Target | Rationale |
|-------|--------|-----------|
| Per-member SaaS | $3–8/member/month | Aligns cost to scale; unions understand per-member billing |
| Annual platform fee | $15k–60k/year | Larger locals and federations prefer annual contracts |
| Pilot contract | Fixed fee, 90–180 days | Lowers barrier; generates evidence |

_(Pricing is a hypothesis. Not committed. Validate with first 3 deals.)_

### Evidence Artifacts

- [CUPE Pilot Overview](../pilot/cupe/CUPE_PILOTING_QUICK_START.md)
- [CUPE Readiness Checklist](../pilot/cupe/CUPE_READINESS_CHECKLIST.md)
- [RBAC Matrix](../pilot/cupe/CUPE_RBAC_MATRIX.md)
- [Procurement Pack](../governance/procurement-pack.md)
- [Admin Runbook](../pilot/cupe/CUPE_PILOT_ADMIN_RUNBOOK.md)
- [Go/No-Go Review](../pilot/cupe/CUPE_PILOT_GO_NO_GO_REVIEW.md)

### Next Milestone

- [ ] Convert CUPE pilot to contracted SaaS agreement
- [ ] Document pilot outcomes (cases managed, time savings, member NPS)
- [ ] Open second pilot with a union federation
- [ ] Build public-facing product page on `apps/web`

---

## Product 2: Flow

> "Grow without the chaos."

### ICP — Ideal Customer Profile

| Attribute | Detail |
|-----------|--------|
| Organization type | SMBs, retail operators, service businesses, distributors |
| Size | 2–200 employees |
| Key role | Owner/operator, sales manager, ops manager |
| Pain | Managing customers in spreadsheets; deals fall through cracks; invoices are late; no pipeline visibility; no follow-up discipline |
| Geography | Canada, West Africa (ShopMoiCa-type operators) |
| Example | Retail chains, distributors, service businesses, franchise operators |

### Problem Solved

SMB operators lose revenue every week because their commercial process is fragmented:

- Contacts in one app, deals in another, invoices in email
- Follow-ups missed because no system owns reminders
- Pipeline invisible to the owner
- Quoting is manual and slow
- No connection between sales activity and cash flow

### Value Proposition

Flow is the SMB ops platform that connects CRM, pipeline, invoicing, tasks, and reminders without the enterprise complexity — so operators can focus on customers, not their stack.

- **CRM** — contacts, accounts, interaction history
- **Pipeline** — deal stages, forecasting, close tracking
- **Follow-up engine** — automated reminders, task ownership, zero-slip accountability
- **Quoting + invoicing** — create, send, track — integrated with revenue layer
- **Campaign basics** — target existing customers, drive repeat orders
- **10-minute onboarding** — live with real data in one session

### Why Now

- SMB software is crowded but fragmented — no player owns the Africa/diaspora SMB
- Shopify-connected operator segment is underserved for ops tooling
- Stripe + Zoho integrations already wired in code
- Revenue pipeline enforces all financial events (`@nzila/platform-revenue`) — billing is structural

### Feature Proof

| Capability | Code Evidence | Status |
|------------|---------------|--------|
| CRM (contacts/accounts) | apps/flow/app/ | Implemented |
| Pipeline / deal management | apps/flow/app/ | Implemented |
| Invoicing | apps/flow/app/ + platform-revenue | Implemented |
| Revenue event tracking | packages/platform-revenue | Implemented |
| Stripe integration | packages/payments-stripe | Implemented |
| Shopify integration | packages/integrations | Implemented |
| Zoho integration | packages/integrations-m365 | Partial |
| Task management | apps/flow/app/ | Implemented |
| Reminders / follow-up | apps/flow/app/ | Partial |

### Readiness Truth

| Dimension | Status |
|-----------|--------|
| Product tier | PRODUCTION (canonical registry) |
| Deployment status | pilot |
| Readiness tier | pilot-safe |
| Exposure | internal |
| Can claim production deployment | ❌ NO |
| Can claim pilot-ready | ✅ YES |
| Can claim audit-hardened | ✅ YES |

### Deployment Truth

- Staging: Azure Container Apps (Canada Central) — `nzila-os-web` (bundled)
- All financial events pass through `@nzila/platform-revenue` — non-negotiable
- Auth: `@nzila/platform-auth` (Argon2id + PG sessions)

### Onboarding Path

1. Org provisioned in control plane
2. CRM contacts imported (CSV or Shopify sync)
3. Pipeline stages configured for business model
4. First invoice created and sent
5. Follow-up rules set
6. Owner demo: < 10 minutes to live pipeline

### Pricing Hypothesis

| Model | Target | Rationale |
|-------|--------|-----------|
| Flat monthly SaaS | $49–149/month | Simple, owner-friendly |
| Per-seat | $15–25/seat/month | Scales with team |
| Pilot / proof-of-concept | Free 30-day or fixed fee | Lowers barrier |

_(Pricing is a hypothesis. Not committed. Validate with first 3 deals.)_

### Evidence Artifacts

- Portfolio matrix: [docs/platform/portfolio-matrix.md](../platform/portfolio-matrix.md)
- Revenue architecture: [docs/platform/revenue-architecture.md](../platform/revenue-architecture.md)
- Revenue system: [docs/platform/revenue-system.md](../platform/revenue-system.md)

### Next Milestone

- [ ] Define and document ICP in a one-pager
- [ ] Run ShopMoiCa-type operator pilot (3–5 operators)
- [ ] Document pilot outcomes (invoices sent, deals closed, follow-up rate)
- [ ] Build public product page on `apps/web`
- [ ] Create demo script for sales calls

---

## Product 3: CFO (Build Next)

> "Your finance layer — without hiring a CFO."

**Status:** Pilot-safe, real integrations (QuickBooks Online, Plaid), but no pilot path documented yet.

**ICP:** Finance operators, controllers, and operators who need accounting intelligence without full CFO overhead.

**Gap to close:**
- Document the pilot path (mirror the union-eyes pilot playbook)
- Define which integrations are live vs. partial (QBO sync is partial per claim-verification)
- Create a buyer-facing product brief

**Classification:** BUILD NEXT — not ready to sell today, but closest to ready after union-eyes and flow.

---

## What Is NOT For Sale

The following are **not products** — they are platform components or incubation assets:

| Item | Why Not For Sale |
|------|-----------------|
| console | Internal ops tool — not externally sold |
| control-plane | Governance hub — internal platform infrastructure |
| web | Marketing site — lead gen channel, not a product |
| zonga | INCUBATING — internal only, no pilot path yet |
| agrimo, trade, cora | INCUBATING — domain validation not complete |
| mobility, nacp-exams | INCUBATING — no active pilot or commercial partner |
| platform-admin | EXPERIMENTAL scaffold — archive candidate |
| orchestrator-api | EXPERIMENTAL scaffold — archive candidate |
