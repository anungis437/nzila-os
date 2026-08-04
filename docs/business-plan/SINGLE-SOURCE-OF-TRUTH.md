# Single Source of Truth

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** AUTHORITATIVE — governs all document conflicts

---

## Purpose

When two documents disagree, this document defines which one governs. No one should need to ask "which version is correct?" if they apply the hierarchy below.

---

## Part 1 — Document Authority Hierarchy

The following hierarchy defines precedence when documents conflict. The document higher in the hierarchy is authoritative. The document lower in the hierarchy must be corrected to align with the higher source, not the reverse.

```
1. Corporate Records (highest authority)
   Certificate of incorporation
   Shareholder register
   Board resolutions
   IP assignment agreements
   Legal entity name as registered
   ↓
2. Shareholder Agreements
   Signed equity and ownership agreements
   Founder compensation agreements
   ↓
3. Accounting Records
   Financial statements
   Bank statements
   Shareholder advance ledger
   Signed founder investment declarations
   ↓
4. Business Plan — Evidence Book
   Nzila-Evidence-and-Commercial-Readiness-Dossier.md
   Section files 00–15
   ↓
5. BDC Remediation Register (BDC-U9)
   Consolidated findings and required source evidence
   ↓
6. Evidence Register (10-Evidence-Register.md)
   Claim-by-claim traceability matrix
   ↓
7. Gap Register (11-Gap-Register.md)
   Honest gap log
   ↓
8. Commercial Readiness Assessment (12-Commercial-Readiness.md)
   Scored readiness view
   ↓
9. Commercial Assets
   Pricing framework
   Sales kit
   Buyer packs
   Trust center
   ↓
10. Sales Material
    Outreach templates
    Demo scripts
    Objection handling
    Close packages
    ↓
11. Investor Materials
    Revenue scenarios
    Investor one-pager
    Growth narrative
    ↓
12. Website and Marketing Material
    Public-facing content
    Marketing copy decks
    ↓
13. Demo Material
    Demo runbooks
    Demo scripts
    Controlled demonstration environments
    ↓
14. Historical Material (lowest authority)
    Historical archive
    Superseded documents
    FairCase historical lineage sections
    One Lab Technologies historical context
```

---

## Part 2 — Precedence Rules

### Rule 1 — Corporate Records Override Everything

If a corporate record (certificate of incorporation, shareholder register, board resolution) disagrees with a business plan statement, the corporate record wins. The business plan must be updated to align with corporate records, never the reverse.

**Example:** If the certificate of incorporation shows "Nzila Ventures Inc." as the registered name but a business plan passage uses "Nzila Digital Ventures," the business plan passage must be corrected. The certificate of incorporation is not changed.

### Rule 2 — Accounting Records Override Financial Estimates

If a verified accounting record (bank statement, signed founder declaration, financial statement) disagrees with an estimate in any business plan or evidence-book document, the accounting record wins. All estimated figures in the evidence book must be replaced with verified figures once accounting records are available.

**Example:** If the founder investment ledger (U5) estimates $48,700 in cash contributions but the accounting records show $31,500, the ledger must be updated to show $31,500. The accounting records are not questioned.

### Rule 3 — Evidence Book Overrides Commercial Assets

If the evidence book documents a claim as "Not Yet Evidenced" or "Planned," no commercial asset may represent the same claim as "Verified" or "Demonstrated." Commercial assets may not elevate claims beyond the level established in the evidence book.

**Example:** If the evidence book documents CourtLens as "Planned," no sales kit or buyer pack may describe CourtLens as commercially available or production-certified.

### Rule 4 — Remediation Register Overrides Evidence Book on Open Findings

If the remediation register (BDC-U9) identifies a finding as "Open," the relevant evidence-book passage is not cleared for lender use, even if the evidence-book passage itself does not carry a warning label. The remediation register governs submission readiness.

### Rule 5 — BDC Control Documents Override Workstream Documents

`BDC-FREEZE-RECORD.md` and `BDC-WORKSTREAM-HANDOFF.md` define the scope of authorized agent actions. If a prior workstream document appears to authorize an action that `BDC-FREEZE-RECORD.md` explicitly prohibits, `BDC-FREEZE-RECORD.md` governs.

### Rule 6 — This Document Overrides Vocabulary Conflicts

`CONTROLLED-VOCABULARY.md` governs terminology conflicts. `SINGLE-SOURCE-OF-TRUTH.md` (this document) governs hierarchy conflicts. Neither overrides corporate records or accounting records.

### Rule 7 — Historical Material Has No Precedence

Historical archive documents, superseded documents, FairCase historical lineage sections, and One Lab Technologies historical context have no precedence over any active document. Historical material informs institutional memory but does not override current claims.

### Rule 8 — Absence of Evidence is Not Evidence

If a claim exists in a lower-hierarchy document (e.g., a sales material) but has no cited evidence in the evidence register or evidence book, the claim is unsubstantiated. It may not be used in lender-facing or investor-facing materials until it is substantiated and reflected in the evidence book.

---

## Part 3 — Specific Conflict Resolutions

The following specific conflicts are known to exist in the repository. This section records their authoritative resolution.

### Conflict 1 — Entity Naming

| Source | Claim |
|---|---|
| Certificate of incorporation (corporate record) | Nzila Ventures Inc. |
| `README.business.md` (marketing material) | Nzila Digital Ventures |
| Legacy commercial artifact (historical) | Nzila OS Inc. |

**Resolution:** "Nzila Ventures Inc." governs in all lender-facing, investor-facing, and corporate contexts. "Nzila Digital Ventures" is acceptable only as a brand identifier in marketing-facing materials. "Nzila OS Inc." must not be used in any new document.

### Conflict 2 — Founder Investment Figures

| Source | Claim |
|---|---|
| `BDC-U5-Founder-Investment-Ledger.md` (stress-test estimate) | ~$48,700–$99,100 cash; ~$600,000 total |
| Accounting records (not yet provided) | Not yet available |

**Resolution:** The ledger estimates are clearly labeled as estimates and must not be used as accounting facts. When accounting records are provided, they govern. Until then, the only permissible lender-facing statement is: "The founders have personally funded the company's documented cash expenses and contributed substantial uncompensated development and commercialization effort."

### Conflict 3 — Pipeline Values

| Source | Claim |
|---|---|
| `FOUNDER_REVENUE_COCKPIT.md` (data seed) | $368,750 weighted pipeline |
| Evidence book (evidence-based assessment) | Pipeline infrastructure complete; no confirmed commercial outreach logged |

**Resolution:** The evidence-book characterization governs. The seeded pipeline values must be removed from all lender-facing documents. The cockpit's system architecture is valid; the deal data is not.

### Conflict 4 — Repository Metrics

| Source | Claim |
|---|---|
| `README.business.md` (marketing material, outdated) | 47 workflows; 215 packages |
| Evidence book (verified 2026-08-01) | 52 workflows; 225 packages |

**Resolution:** The evidence-book figures (52 workflows; 225 packages) are authoritative as of the last verified scan. `README.business.md` must be updated before lender-facing or public use.

### Conflict 5 — SOC 2 Status

| Source | Claim |
|---|---|
| `pricing-framework.md` (commercial asset) | SOC 2 Type II included in subscription |
| Gap register (evidence-based assessment) | SOC 2 not yet completed |

**Resolution:** The gap register governs. SOC 2 may not be represented as a current subscription inclusion until the certification is completed. The pricing framework must be corrected per REM-010.

---

## Part 4 — Single Source per Topic

| Topic | Authoritative Source |
|---|---|
| Registered legal entity name | `governance/corporate/Incorporation-Constitution.pdf` (corporate record) |
| Shareholder structure | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` (pending verification) |
| Product maturity | `docs/business-plan/evidence-book/12-Commercial-Readiness.md` |
| TRL estimates | `docs/business-plan/evidence-book/00-Executive-Summary.md` |
| Pricing tiers | `docs/categories/stakeholders/commercial/pricing-framework.md` |
| Founder investment | Accounting records (not yet available); pending `BDC-FOUNDER-INPUT-CHECKLIST.md` Section 5 |
| Commercial pipeline | `docs/categories/stakeholders/commercial/FOUNDER_REVENUE_COCKPIT.md` (architecture valid; data not valid until seeded data replaced with real records) |
| BDC readiness verdict | `docs/business-plan/evidence-book/BDC-U10-Credit-Package-Readiness.md` |
| Open findings | `docs/business-plan/evidence-book/BDC-U9-Remediation-Register.md` |
| Document distribution restrictions | `docs/business-plan/BDC-DOCUMENT-CONTROL-INDEX.md` |
| Authorized agent actions | `docs/business-plan/BDC-FREEZE-RECORD.md` |
| Canonical terminology | `docs/business-plan/CONTROLLED-VOCABULARY.md` |
| Document lifecycle stages | `docs/business-plan/DOCUMENT-LIFECYCLE.md` |

---

*This document is authoritative for conflict resolution. It does not supersede corporate records, legal agreements, or accounting records, which always govern over any repository document.*
