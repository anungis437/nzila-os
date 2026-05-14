# Snapshot 28 Final Scorecard

> **Date:** April 2026  
> **Mandate:** Honest rescore of the Nzila OS platform after the Snapshot 28 execution pass  
> **Methodology:** Every score is anchored to verifiable artifacts. No score is aspirational. Rationale explains what would move the needle.

---

## Platform Scorecard — Five Dimensions

| Dimension | Score | Prior Score | Delta |
|-----------|-------|-------------|-------|
| Repo Credibility | 8/10 | 7/10 | +1 |
| Commercial Credibility | 4/10 | 3/10 | +1 |
| Governance Credibility | 9/10 | 8/10 | +1 |
| Investor Narrative Readiness | 6/10 | 4/10 | +2 |
| Technical Leadership Discipline | 8/10 | 7/10 | +1 |
| **Platform Total** | **35/50** | **29/50** | **+6** |

---

## Dimension Scores — Rationale

### Repo Credibility: 8/10

**What earns the 8:**

- 17 apps, 130+ shared packages — real code, not stubs
- 1,973 contract tests enforced in CI — rare depth at this stage
- 23/23 GA gates passing — every health gate green
- Truth authority model (`nzila-truth-manifest.json`) as canonical status arbiter
- Product catalog with Phase 3 schema including claim permissions — structured commercial intelligence
- Zero illegal claims in public-facing docs (all P0s fixed this session)

**What holds it below 10:**

- Flow and CFO docs_entrypoint still points to portfolio-matrix.md, not dedicated READMEs
- Some apps (mobility, nacp-exams, trade) have near-zero test coverage and low code maturity
- `orchestrator-api` and `platform-admin` are scaffold-only — should be archived or moved to `research/`

**What would push it to 9:** Archive/remove scaffold-only apps from main product count. Add app-level README files for all incubating products.

---

### Commercial Credibility: 4/10

**What earns the 4:**

- CUPE pilot live and generating operational evidence — this is real
- Full pilot runbook, readiness checklist, RBAC matrix, go/no-go review — professional buyer artifact set
- Procurement pack exists and is buyer-ready
- Flow has implemented code across the full commercial chain
- Revenue product profiles created this session (union-eyes, flow) — structured sales narrative exists

**What holds it to 4:**

- Zero paying customers — no contracted SaaS agreement yet
- No documented pilot outcomes (cases managed, time-to-resolution, operator metrics)
- Flow has no pilot evidence at all — code is ahead of commercial validation
- CFO pilot path is not documented

**What would push it to 7:** Convert CUPE pilot to a signed contract. Document 3 measurable outcomes from the pilot. Run one Flow operator pilot.

---

### Governance Credibility: 9/10

**What earns the 9:**

- 1,973 contract tests across 23 test suites
- 23/23 GA gates — all green, enforced in CI
- Truth authority validator prevents illegal claim promotion
- Product catalog validator enforces cross-source consistency (now with Phase 3 fields)
- Hash-sealed evidence trails (`packages/evidence`) built into products by default
- Billing factory guard prevents revenue event bypass
- RBAC policy engine with role-level claim permissions
- Procurement pack with governance evidence artifacts

**What holds it below 10:**

- Evidence status is "partial" for most pilot-tier products — no independently verified outcomes yet
- No third-party security audit on record

**What would push it to 10:** Independent security audit. Documented pilot outcomes with verifiable metrics.

---

### Investor Narrative Readiness: 6/10

**What earns the 6:**

- Investor brief created this session — honest, claim-safe, clear model explanation
- Two "Sell Now" products with credible value props and evidence anchors
- Shared-engine economics clearly articulated
- No inflated TAM, no phantom unicorn language
- Governance moat is real and differentiating

**What holds it to 6:**

- No revenue — pre-commercial platform
- No pilot outcomes documented — CUPE is live but metrics not captured
- CFO and Zonga have no commercial timeline
- Portfolio model is unproven commercially (though technically sound)

**What would push it to 8:** Convert CUPE to contracted revenue. Document metrics. Define CFO commercial path.

---

### Technical Leadership Discipline: 8/10

**What earns the 8:**

- Turbo monorepo pipeline with shared package architecture — sophisticated
- Shared auth (`@nzila/platform-auth`), billing (`@nzila/platform-revenue`), evidence (`@nzila/evidence`) are foundational
- Azure Container Apps deployment — modern, operationally clean
- Argon2id passwords, Entra SSO fallback, PG session model — OWASP-compliant auth
- Vitest + contract test layers — proper testing discipline
- Lefthook pre-commit hooks — enforced quality gates
- TypeScript-first across all apps and packages

**What holds it below 10:**

- Some packages have mixed test coverage
- Django sidecars (union-eyes, agrimo) introduce Python maintenance burden
- No documented API versioning strategy

**What would push it to 9:** Consistent test coverage above 80% on all pilot-tier apps. Document Django sidecar deprecation path.

---

## Product Scorecard

| Product | Sell/Build/Hold/Cut | Code | Evidence | Commercial Priority | Score |
|---------|--------------------|----|----------|-------------------|-------|
| union-eyes | **SELL NOW** | full | partial | 1 | 7/10 |
| flow | **SELL NOW** | full | none | 2 | 5/10 |
| cfo | **BUILD NEXT** | full | none | 3 | 4/10 |
| partners | **BUILD NEXT** | full | none | 4 | 3/10 |
| zonga | **HOLD** | full | none | 3 | 3/10 |
| agrimo | **HOLD** | partial | none | 4 | 2/10 |
| console | internal | full | partial | 5 | — |
| control-plane | internal | full | partial | 5 | — |
| web | lead-gen | full | none | 5 | — |
| platform-admin | **CUT / ARCHIVE** | scaffold | none | 5 | 1/10 |
| orchestrator-api | **CUT / ARCHIVE** | scaffold | none | 5 | 1/10 |

---

## Sell/Build/Hold/Cut Matrix

### SELL NOW

| Product | Rationale |
|---------|-----------|
| **UnionEyes** | CUPE pilot live, full governance docs, purpose-built moat, no credible competitor |
| **Flow** | Full ops chain implemented, ICP defined, pilot path ready, Africa SMB segment underserved |

### BUILD NEXT

| Product | Rationale |
|---------|-----------|
| **CFO** | Real integrations (QBO, Plaid), finance intelligence is high-value, but pilot path needs documentation |
| **Partners** | Channel partner monetization multiplier; needs one pilot partner to validate |

### HOLD

| Product | Rationale |
|---------|-----------|
| **Zonga** | Africa-first music platform is a compelling vision but needs market validation first |
| **Agrimo** | Agtech is real, but domain validation not complete; hold until core verticals generate revenue |
| **Cora** | Dependent on Agrimo validation; hold |
| **Trade** | Cross-border ops is real but requires a commercial partner to drive requirements |
| **Mobility** | Investment migration is complex; hold until bandwidth exists for dedicated go-to-market |
| **NACP Exams** | Assessment platform; hold until institutional partner engaged |

### CUT / ARCHIVE

| Product | Rationale |
|---------|-----------|
| **platform-admin** | Scaffold-only, no active use case, creates maintenance surface with no return |
| **orchestrator-api** | Scaffold-only, concept-stage, archive until a real orchestration use case justifies it |

---

## 90-Day Execution Roadmap

### Month 1: Commercial Conversion

- [ ] Execute CUPE pilot contract conversion — get signed SaaS agreement
- [ ] Document CUPE pilot outcomes: cases managed, time-to-resolution, rep feedback
- [ ] Identify 3 Flow operator pilot targets (ShopMoiCa-type)
- [ ] Brief 2 union federation contacts on UnionEyes

### Month 2: Evidence and Expansion

- [ ] Collect and publish first CUPE pilot outcome metrics
- [ ] Run at least 1 Flow operator pilot
- [ ] Start CFO pilot documentation (mirror union-eyes pilot playbook)
- [ ] Archive platform-admin and orchestrator-api apps (or move to research/)
- [ ] Update apps/web with product pages for union-eyes and flow

### Month 3: Revenue and Narrative

- [ ] First paying customer — either UnionEyes contracted or Flow operator signed
- [ ] Publish outcome metrics publicly (on web app or investor brief)
- [ ] Define CFO commercial path and first pilot target
- [ ] Investor brief updated with real numbers
- [ ] Update platform scorecard with actual commercial evidence

---

## What Success Looks Like at Snapshot 29

| Gate | Target |
|------|--------|
| Paying customers | ≥ 1 (UnionEyes or Flow) |
| CUPE pilot outcomes documented | ≥ 3 measurable metrics |
| Flow pilot started | ≥ 1 operator engaged |
| Commercial Credibility score | 6/10 (from 4/10) |
| Platform Total | 38/50 (from 35/50) |

---

## Summary

The Nzila OS platform has a genuine governance moat, real code depth, and two commercially viable products. The gap is purely commercial: no paying customers, no documented outcomes.

The 90-day mandate is simple: **convert pilots into revenue**. Everything else is secondary.

> "The repo is ready. The products are pilot-safe. The governance is institutional-grade. The only thing missing is the first signed contract."
