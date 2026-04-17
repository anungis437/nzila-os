# Nzila OS — Investor Brief

> **Date:** April 2026  
> **Stage:** Pre-revenue / Pilot  
> **Status:** This document reflects the honest current state of the platform. No claims are inflated. No fantasy unicorn language.

---

## What Is Nzila OS

Nzila OS is a multi-product software platform incubated and operated by Nzila Digital Ventures.

It is a **shared-engine model**: one platform, one governance system, one engineering team, multiple commercial products each targeting a distinct vertical.

The platform is built on a modern TypeScript monorepo (pnpm workspaces, Turbo pipeline) with 17 apps, 130+ shared packages, and a full governance stack (contract tests, GA gates, truth authority).

**We are not a single SaaS company.** We are a software studio that builds governed products on a shared foundation — lowering the cost-per-product of launch, governance, and compliance.

---

## The Portfolio Model

Most software studios fail because every product reinvents the wheel. Nzila's model avoids this:

| Layer | What We Share | Benefit |
|-------|--------------|---------|
| Auth | `@nzila/platform-auth` — Argon2id + Entra SSO | No auth rebuild per product |
| Billing | `@nzila/platform-revenue` — Stripe + Shopify events | Financial rails are structural |
| Evidence | `@nzila/evidence` — hash-sealed audit trails | Compliance baked into every product |
| Governance | Contract tests (1,973), GA gates (23/23), truth authority | Credibility without per-product audit |
| Multi-tenancy | RBAC policy engine, org isolation, control plane | Enterprise-grade tenancy from day one |
| Infrastructure | Azure Container Apps, PostgreSQL, shared CI/CD | Single deployment model for all products |

**Economics:** The cost of launching a new product on this platform is a fraction of a standalone build — because auth, billing, governance, and infra are already proven.

---

## The Two Products Worth Selling Now

### 1. UnionEyes — Labour / LegalTech

**Segment:** Labour unions (CUPE locals, federations, national bodies)  
**Stage:** Pilot-safe — CUPE pilot live  
**Moat:** Hash-sealed evidence trails + purpose-built union workflow semantics — no credible competitor  
**Revenue model:** $3–8/member/month SaaS or $15k–60k/year enterprise  
**Why it wins:** Unions manage the most evidence-sensitive workflows in the world on spreadsheets. UnionEyes is the first governed, purpose-built platform for this work. The CUPE pilot is generating real evidence.

### 2. Flow — SMB Operations

**Segment:** SMB operators (distributors, retailers, service businesses)  
**Stage:** Pilot-safe — pilot path defined, code complete  
**Moat:** Full ops chain (quote → PO → production → invoice → payment) with Africa/diaspora SMB as primary segment  
**Revenue model:** $49–149/month SaaS  
**Why it wins:** General CRM tools weren't built for operators. Flow connects the commercial chain that SMBs actually run.

---

## Build-Next Pipeline

| Product | Why It Matters | Gap to Close |
|---------|----------------|-------------|
| CFO | Finance intelligence with QuickBooks + Plaid integration | Pilot path documentation |
| Partners | Channel partner management | Pilot with first partner |
| Zonga | Music distribution + royalties (Africa-first) | INCUBATING — validate market first |

---

## Governance Moat

Nzila has built governance infrastructure that most venture-backed startups don't build until Series B:

| Layer | Evidence |
|-------|---------|
| 1,973 contract tests | `tooling/contract-tests/` — enforced in CI |
| 23/23 GA gates passing | `tooling/ga-check/` — every gate green |
| Truth authority model | `nzila-truth-manifest.json` — single source of truth for all 17 apps |
| Claim integrity enforcement | `scripts/validate-truth-authority.ts` — rejects illegal marketing claims |
| Product catalog validator | `scripts/validate-product-catalog.ts` — cross-source contradiction detection |
| Evidence-sealed audit trails | `packages/evidence/` — hash-sealed, tamper-evident records |
| Procurement pack | `docs/governance/procurement-pack.md` — enterprise buyer artifact |

This governance stack is a **durable competitive advantage**: it makes every Nzila product enterprise-sale-ready by default, because the compliance infrastructure is structural — not bolted on per deal.

---

## Efficient Launch Model

Nzila is not spending VC money on infrastructure reinvention. The model:

1. **Build shared packages once** — auth, billing, evidence, RBAC, tenancy
2. **Launch products on top of the engine** — dramatically faster and cheaper than standalone
3. **Validate the best bets commercially** — CUPE pilot for union-eyes, SMB pilot for flow
4. **Turn pilots into contracted revenue** — not implied, not projected — actual contracts
5. **Expand on revenue** — not on hype

This is how a small, disciplined team can credibly own multiple verticals simultaneously.

---

## Current Maturity — Honest Assessment

| Category | Score | Notes |
|----------|-------|-------|
| Repo credibility | 8/10 | Deep governance, real code, clean truth authority |
| Commercial readiness | 4/10 | Pilot-safe products exist; no paying customers yet |
| Evidence pack quality | 7/10 | CUPE pilot docs are strong; Flow evidence is weaker |
| Technical architecture | 8/10 | Shared engine model is sound and proven |
| Investor narrative | 5/10 | Story is clear but unproven commercially |
| Governance maturity | 9/10 | Contract tests, GA gates, truth authority — rare at this stage |

**We are a pre-revenue platform with production-quality governance and two pilot-safe products.**  
The ask is not "fund a dream" — it is "accelerate the commercial conversion of what is already built."

---

## What We Are Not Claiming

We are disciplined about this. The following claims **do not appear** in any Nzila document:

- ❌ "Production-deployed revenue verticals" (no paying customers yet)
- ❌ "Enterprise-ready" (pilot-safe is the honest tier)
- ❌ TAM estimates (we do not manufacture market size numbers)
- ❌ Revenue projections (we don't project what we haven't validated)
- ❌ "AI-powered" as a marketing claim without specific capability evidence

This is a governance discipline — the same truth authority that prevents illegal claims in our codebase prevents them in our investor docs.

---

## The Opportunity

Labour unions globally have no purpose-built governance platform. The market is large, underserved, and under-digitized — and the first credible player with a governed, evidence-sealed system wins by default.

SMB operators in emerging markets (Canada, West Africa) face the same operational fragmentation as SMBs everywhere — but are underserved by US-centric tools. A governed, affordable, operator-first platform has a clear wedge.

The Nzila model — shared engine, multiple verticals, governed at the foundation — means that commercial success in one vertical doesn't just prove one product. It proves the entire platform model.

---

## Contact

For commercial or investor discussions: contact@nziladigital.com  
For technical and governance due diligence: see `docs/architecture/`, `tooling/`, `governance/`
