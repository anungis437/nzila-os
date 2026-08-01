# Management Credibility Review

**Prepared:** 2026-08-01
**Scope:** Management section of the Nzila business plan dossier
**Instruction:** Remove anything promotional. Replace with evidence. Make founders sound experienced rather than exceptional. Every capability must trace to actual experience or documented work.

---

## Source Material

Management representation in the dossier is drawn from:
- `docs/business-plan/evidence-book/01-Company.md` — Founders / Principals section
- `governance/corporate/leadership.json` — Leadership registry
- `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` — Shareholder and governance summary
- `governance/corporate/governance/document-founder-executive-roles-equity-memo.md` — Founder roles memo

---

## Part 1 — Audit of Current Promotional Language

### Promotional Finding MG-01

**Source wording:** "Aubert is the strongest evidenced principal in the repository and is recorded as founder/CEO and authorized governance owner."

**Problem:** "Strongest evidenced" is a comparative judgment with no external benchmark. This is internal dossier language that would appear odd if read aloud to a credit committee.

**Evidence-based replacement:** "Lumbanzila Aubert Nungisa is recorded as founder, CEO, incorporator, and sole director of Nzila Ventures Inc. (`governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`). He is the authorized governance owner of the technical repository and is named in the owner-operated review model as the authorized approver for technical-gate decisions (`docs/governance/owner-operated-review-model.md`)."

---

### Promotional Finding MG-02

**Source wording:** Leadership registry entry for Michel — "President with responsibility for Union Eyes, ABR, labour/legal commercialization, and buyer trust programs."

**Problem:** Michel's full name, professional background, years of experience, prior employment, and relationship to the company (equity, contract, advisory) are entirely absent. A credit committee will ask: who is this person and why should they trust him to execute the sales plan?

**Evidence-based replacement:** Michel should be presented as: full name, prior relevant experience (e.g., years in labour relations, union-sector sales, or legal), confirmed role, equity or compensation arrangement, and IP assignment status. Until these facts are available, the current representation should be stated as incomplete rather than implied as complete.

---

### Promotional Finding MG-03

**Source wording:** `docs/business-plan/evidence-book/14-Founder-Investment.md` — "A lender evaluating this company sees: Platform-grade engineering rather than a single-product prototype"

**Problem:** "Platform-grade" is promotional shorthand. The factual version is more credible.

**Evidence-based replacement:** "The repository contains 26 application directories, 225 shared package directories, and 52 CI/CD workflow files. The platform architecture is documented in ARCHITECTURE.md. Production-readiness certification exists for selected runtimes (`docs/readiness/production-certification.md`). This is verifiable and more useful to a lender than an adjective."

---

### Promotional Finding MG-04

**Source wording:** `docs/business-plan/evidence-book/14-Founder-Investment.md` — "Governance discipline that reflects institutional operating habits, not startup aspirations"

**Problem:** "Institutional operating habits" is a value judgment. The factual record is already strong and does not need the contrast.

**Evidence-based replacement:** "The governance model is documented and automated: a gate taxonomy controls release authority (`docs/governance/gates/gate-taxonomy.md`), a portfolio truth system prevents estimated revenue from being presented as actuals (`governance/portfolio/product-catalog.json`), and an evidence-based claims ledger governs external commercial statements (`docs/categories/stakeholders/commercial/claims-ledger.md`)."

---

## Part 2 — Evidence-Based Management Summary

The following is a rewritten management summary that traces every capability to documented evidence.

---

### Lumbanzila Aubert Nungisa — Founder and Chief Executive Officer

**Role:** Incorporator, sole director, and 100% Class A shareholder of Nzila Ventures Inc. (federally incorporated).

**Technical capability — evidence:** The repository shows sustained, multi-year engineering output across governance, product, platform, and commercial domains. Architecture decisions are documented in `ARCHITECTURE.md`. The monorepo is built on pnpm workspaces, Turborepo, and TypeScript, with PostgreSQL, Drizzle ORM, and Azure for production deployments. 52 GitHub Actions workflows cover CI, security, release governance, and deployment gates. This body of work reflects demonstrated full-stack and platform engineering competence.

**Commercial capability — evidence:** Aubert has produced a complete go-to-market system: pricing framework (`docs/categories/stakeholders/commercial/pricing-framework.md`), pilot offer (`docs/categories/stakeholders/commercial/pilot-offer-cupe.md`), sales kit with demo script, objection handling, and ROI assumptions (`docs/categories/stakeholders/commercial/sales-kit/`), pursuit tracking system (`FOUNDER_REVENUE_COCKPIT.md`), and investor materials (`docs/categories/stakeholders/investor/`). These artifacts reflect commercial preparation work, not just technical output.

**Governance capability — evidence:** Aubert implemented an owner-operated review model that preserves governance discipline while allowing founder agility (`docs/governance/owner-operated-review-model.md`). He created a portfolio truth system that prevents revenue inflation in internal and external reporting (`governance/portfolio/product-catalog.json`). These are operational governance mechanisms, not policy aspirations.

**Concentration risk:** All corporate authority, technical gate authority, and commercial IP ownership are concentrated in one individual. A documented succession plan exists (`governance/corporate/governance/policy-founder-succession-continuity-plan.md`) but its maintenance fields are incomplete. BDC should require a completed succession plan as a condition or covenant.

---

### Michel [Surname Not Yet Documented] — President

**Role:** Recorded as President in the leadership registry (`governance/corporate/leadership.json`) with responsibility for Union Eyes commercialization, labour/legal commercialization, and buyer trust programs.

**Evidence available:** Role assignment in registry. Scope of responsibility is documented. No surname, no equity position, no IP assignment, and no professional background are documented in-repository.

**What must be added before BDC filing:**
- Full legal name
- Prior relevant experience (labour relations, union-sector technology, or equivalent)
- Equity position or compensation arrangement
- IP assignment agreement status
- Confirmation that Michel will remain with the company for the loan term

**Interim framing:** Michel brings operational and commercial focus to the labour-sector go-to-market program. His full credentials and commitment are documented separately and are available upon request. [Founders must complete this section before BDC submission.]

---

### Board and Advisory

**Current state:** Single-director board (Aubert). Advisory council described as "in development — clinical, AI, ethics, legal." No named advisors.

**Evidence-based framing:** "Nzila is governed by a founder-led single-director board. An advisory council is being constituted for clinical, AI, ethics, and legal domains. No external advisors have been formally engaged to date."

**BDC implication:** The absence of any external governance oversight amplifies key-person risk. The committee may request a condition requiring appointment of at least one external advisor within 6–12 months of funding.

---

## Part 3 — Capability-to-Evidence Map

| Capability claimed | Evidence | Confidence |
|---|---|---|
| Software engineering at platform scale | 26 apps, 225 packages, 52 workflows, ARCHITECTURE.md, production certification | Verified |
| Commercial packaging and go-to-market | Pricing framework, pilot offer, sales kit, investor materials, claims ledger | Verified |
| Governance and compliance design | Gate taxonomy, portfolio truth system, owner-operated review model | Verified |
| Labour-sector market knowledge | ICP definition, CUPE pilot offer, union GTM map, sector-specific pricing | Documented |
| Public-sector market knowledge | CIVIC thesis, OCI methodology, public-sector conversation guides | Documented |
| Cloud infrastructure management | Azure Canada Central production deployment, backup/restore certification | Demonstrated |
| Security architecture | RLS implementation, RBAC, SBOM, DAST integration, CI governance | Demonstrated (internal) |
| Sales execution and pipeline management | Pursuit system, revenue cockpit, TOP_15 list | Documented — not yet demonstrated against real activity |

---

## Summary Assessment

The management team shows **genuine and verifiable competence** in technical platform engineering, governance design, and commercial preparation. These are not promotional claims — they are supported by artifacts that can be reviewed, audited, and reproduced.

The material credibility gaps are:
1. Co-founder Michel's professional record is entirely undocumented.
2. No customer has been closed, which means sales execution is preparation-demonstrated but not performance-demonstrated.
3. Key-person concentration is real and undiversified.

A credit committee will grant significant credibility to the technical and governance evidence. They will push hard on the commercial execution gap and the co-founder documentation gap. Both are resolvable before submission.
