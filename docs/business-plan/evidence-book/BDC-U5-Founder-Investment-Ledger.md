# Founder Investment Ledger

**Prepared:** 2026-08-01
**Scope:** Nzila Ventures Inc. — pre-commercial founder investment
**Purpose:** Lender understanding. This is not a valuation exercise.
**Instruction:** Estimate and document all founder-funded investment. Separate cash invested from sweat equity from intellectual property created.

---

## Preliminary Note

The dossier does not contain exact cash expenditure records, invoices, or payroll data. All cash estimates below are derived from repository artifacts (infrastructure references, tool references, corporate filings) and reasonable market-rate assumptions. **All figures are estimates pending a formal founder declaration.** They are presented here as a structured basis for the formal BDC filing document, not as audited figures.

---

## Part 1 — Cash Invested

Cash categories represent actual out-of-pocket expenditures made by the founder(s) before any external capital event.

### 1.1 Cloud Infrastructure (Azure)

| Item | Basis for estimate | Estimated annual spend | Years estimated | Subtotal estimate |
|---|---|---|---|---|
| Azure Canada Central — production environment (Union Eyes) | Production-certified multi-tenant platform with dedicated provisioning per pilot | $3,600–$9,600/yr | 2 years | $7,200–$19,200 |
| Azure development/staging environments | Shared platform with 26 apps, CI/CD pipelines | $1,200–$3,600/yr | 2 years | $2,400–$7,200 |
| Azure DevOps / GitHub Actions minutes | 52 workflows running on every commit | $600–$1,800/yr | 2 years | $1,200–$3,600 |
| **Azure total estimate** | | | | **$10,800–$30,000** |

*Conservative mid-point used for summary: ~$18,000*

---

### 1.2 Domains and Web Properties

| Item | Basis | Estimated cost |
|---|---|---|
| nziladigital.com / nzilaventures.com | Primary corporate domains | $200–$500 |
| unioneyes.app | Primary Union Eyes commercial domain | $200–$500 |
| Sector-specific domains (civic, courtlens, abr) | Referenced in product documentation | $300–$800 |
| Domain registrar annual renewals (2 years) | Multiple properties | $400–$1,200 |
| **Domains total estimate** | | **$1,100–$3,000** |

*Conservative mid-point: ~$1,800*

---

### 1.3 Software and Subscriptions

| Item | Basis | Estimated annual | Years | Subtotal |
|---|---|---|---|---|
| GitHub (Team/Enterprise) | 52 workflows, 225 packages, CI/CD | $500–$2,000/yr | 2 | $1,000–$4,000 |
| Design tools (Figma or equivalent) | UI/UX referenced in product docs | $300–$600/yr | 2 | $600–$1,200 |
| Communication tools (Slack, Notion, or equivalent) | Governance documentation workflow | $200–$500/yr | 2 | $400–$1,000 |
| Azure OpenAI / GPT API usage | AI backbone referenced in platform | $600–$2,400/yr | 1 | $600–$2,400 |
| Security tools (Snyk, Trivy, ZAP/DAST) | All referenced in .github/workflows | $0–$2,400/yr | 2 | $0–$4,800 |
| Monitoring / observability tools | OpenTelemetry stack referenced | $300–$1,200/yr | 1 | $300–$1,200 |
| **Software/subscriptions total estimate** | | | | **$2,900–$14,600** |

*Conservative mid-point: ~$7,000*

---

### 1.4 Legal and Corporate Filings

| Item | Basis | Estimated cost |
|---|---|---|
| Federal incorporation (Nzila Ventures Inc.) | Corporations Canada filing, evidenced by constitution PDF in-repo | $200–$500 |
| OptivaCare Inc. incorporation | Listed as separately incorporated in corporate structure | $200–$500 |
| IP assignment agreement drafting | Policy requires signed agreements for all contributors | $500–$2,000 |
| Corporate structure and shareholder agreement drafting | Documented in governance/corporate | $1,500–$4,000 |
| Trademark / trade name filings | Brand names Union Eyes, CIVIC, CourtLens, OCI Method™ | $500–$2,500 |
| SR&ED consultant (2025 filing) | Boast.AI or equivalent at 20% contingency on $140K claim | $28,000 (contingency basis) |
| Other legal (employment, contractor agreements) | Ongoing operating requirement | $1,000–$3,000 |
| **Legal total estimate** | | **$31,900–$40,500** |

*Conservative mid-point: ~$35,000*

---

### 1.5 Prototype Development and External Contractors

| Item | Basis | Estimated cost |
|---|---|---|
| External design or UX contractor | UI assets referenced, no evidence of in-house design role | $2,000–$8,000 |
| External security review or audit inputs | Pentest readiness self-assessment implies prior work | $0–$3,000 |
| External SR&ED technical narrative drafting | Documented in funding strategy | Included in legal above |
| **External contractor total estimate** | | **$2,000–$11,000** |

*Conservative mid-point: ~$5,000*

---

### Cash Invested — Summary

| Category | Conservative | Aggressive | Mid-point estimate |
|---|---|---|---|
| Azure cloud infrastructure | $10,800 | $30,000 | $18,000 |
| Domains | $1,100 | $3,000 | $1,800 |
| Software and subscriptions | $2,900 | $14,600 | $7,000 |
| Legal and corporate filings | $31,900 | $40,500 | $35,000 |
| External contractors | $2,000 | $11,000 | $5,000 |
| **Total cash invested** | **$48,700** | **$99,100** | **~$66,800** |

**Interpretation for lender:** The founder has invested approximately $50,000–$100,000 in out-of-pocket cash before this loan request. The most significant cash category is legal (primarily SR&ED consultant fees, which are contingency-based against a $140,000 tax refund claim).

---

## Part 2 — Sweat Equity

Sweat equity represents the market value of founder time invested. It is documented here as a lender-transparency exhibit, not as an asset on the balance sheet.

### 2.1 Engineering Hours

| Basis | Detail | Estimate |
|---|---|---|
| Repository scale | 26 apps, 225 shared packages, 52 CI/CD workflows, extensive documentation | — |
| Minimum lines-of-code proxy | Architecture, monorepo, multi-product deployment at this scale represents tens of thousands of hours of engineering work across the lifecycle | — |
| Conservative senior developer rate | $80–$120 CAD/hour | — |
| Estimated engineering hours (2–3 year project) | 3,000–8,000 hours across all contributors | — |
| **Engineering sweat equity estimate** | 3,000 hr × $100/hr = $300,000; 8,000 hr × $100/hr = $800,000 | **$300,000–$800,000** |

*Note: Actual hours are not independently verified. These estimates are directional for lender understanding.*

---

### 2.2 Commercialization Work

| Category | Estimate |
|---|---|
| Pricing framework, sales kit, pilot offer, buyer packs, claims ledger, proof playbook | ~200 hours × $120/hr = $24,000 |
| CIVIC thesis, OCI methodology whitepapers, doctrine corpus | ~300 hours × $120/hr = $36,000 |
| Governance framework, gate taxonomy, portfolio truth system | ~150 hours × $100/hr = $15,000 |
| Government funding strategy, IRAP/SR&ED preparation | ~100 hours × $150/hr (specialized) = $15,000 |
| **Commercialization work total** | **~$90,000** |

---

### 2.3 Documentation Corpus

The repository contains thousands of pages of architecture, governance, doctrine, commercial, and operational documentation. At a conservative 2,000 documentation hours × $80/hr:

**Documentation sweat equity estimate: ~$160,000**

---

### Sweat Equity — Summary

| Category | Estimate |
|---|---|
| Engineering (conservative) | $300,000 |
| Commercialization work | $90,000 |
| Documentation corpus | $160,000 |
| **Total sweat equity (conservative)** | **~$550,000** |

---

## Part 3 — Intellectual Property Created

This section inventories IP assets by category. Values are not stated — this is an existence inventory for lender understanding.

### 3.1 Software

| Asset | Status | Location |
|---|---|---|
| Union Eyes application (grievance management, governance, elections, communications) | Production-certified | `apps/union-eyes/` |
| ABR / FairCase tribunal intelligence application | Implemented | `apps/abr/` |
| 225 shared platform packages (auth, database, UI, analytics, AI, security) | Implemented | `packages/` |
| CourtLens migration and planning artifacts | Planned | `docs/courtlens/` |
| CIVIC platform components (OCI-aligned) | In development | `docs/public-service/` |

---

### 3.2 Methodology and Doctrine

| Asset | Status | Location |
|---|---|---|
| Institutional Intelligence doctrine | Published canonical | `docs/doctrine/DOCTRINE.md` |
| OCI Method™ whitepaper v1 | Published canonical | `docs/oci/methodology/OCI_METHOD_WHITEPAPER_v1.md` |
| OCRA diagnostic instrument | Documented | `docs/oci/` |
| CLEAR evidence framework | Documented canonical | `docs/public-service/clear-method-canonical.md` |
| Continuity Gap master whitepaper | Published canonical | `docs/doctrine/whitepapers/CONTINUITY_GAP_MASTER_WHITEPAPER.md` |

---

### 3.3 Commercial Assets

| Asset | Status | Location |
|---|---|---|
| Union Eyes pricing framework | Published | `docs/categories/stakeholders/commercial/pricing-framework.md` |
| CUPE pilot offer | Published | `docs/categories/stakeholders/commercial/pilot-offer-cupe.md` |
| Sales kit (45-min demo script, objection sheet, ROI assumptions) | Verified | `docs/categories/stakeholders/commercial/sales-kit/` |
| CIVIC forwardable briefings and executive materials | Published | `docs/public-service/forwardable/` |
| Investor one-pager and shared-platform leverage model | Published | `docs/categories/stakeholders/investor/` |
| Claims ledger governance framework | Published | `docs/categories/stakeholders/commercial/claims-ledger.md` |

---

## Summary for Lender

| Category | Conservative estimate |
|---|---|
| Cash invested | $48,700–$99,100 |
| Sweat equity (engineering, commercial, documentation) | ~$550,000 |
| IP created (software, methodology, commercial) | Not valued; existence documented above |
| **Total pre-commercial founder investment** | **$600,000–$650,000** |

> The $75,000 BDC financing request represents approximately 10–12% of the estimated pre-commercial founder investment. The request is for commercialization and scale of existing assets — not for concept development.

---

## Gaps in This Ledger

- Exact cash expenditure records (invoices, bank statements) are not in-repository and must be sourced from accounting records.
- Exact engineering hours are not independently verified; founder time logs would be required for an audited claim.
- No third-party IP valuation has been completed.
- Patent application numbers and filing costs are not confirmed.

## Next Step

The founder should produce a signed declaration with actual figures drawn from accounting records, cross-referencing the categories above. This ledger serves as the framework for that declaration.
