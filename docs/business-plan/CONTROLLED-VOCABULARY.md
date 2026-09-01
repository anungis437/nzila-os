# Controlled Vocabulary

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** CANONICAL — AUTHORITATIVE FOR ALL FUTURE DOCUMENTS, **except** the OCI/OCRA
expansions below, which [`docs/oci/CANON.md`](../oci/CANON.md) owns (see note in place of those
two entries in Part 1).

Every definition in this document is canonical. When two documents disagree on terminology, this document governs. Deprecated terms must not appear in future commercial, lender-facing, or investor-facing materials.

---

## Part 1 — Canonical Definitions

### Institutional Intelligence

**Canonical definition:** The systematic engineering discipline of capturing, governing, transferring, and preserving the operational knowledge, decision logic, and continuity capacity of an institution — so that the institution can function reliably regardless of personnel change, system failure, or knowledge fragmentation.

**Use in lender/buyer materials:** "Institutional Intelligence" is the platform thesis and the product family descriptor.  
**Do not confuse with:** "Institutional Memory" (narrower — see below); "Knowledge Management" (broader and less precise)  
**Products that implement it:** Union Eyes (labour sector); CIVIC (public institutions); CourtLens (legal sector)

---

### Institutional Engineering

**Canonical definition:** The technical implementation discipline underlying Institutional Intelligence — specifically, the software architecture, data models, governance runtimes, and workflow logic that enable institutional knowledge to be encoded, validated, transferred, and enforced programmatically.

**Use in lender/buyer materials:** Acceptable as a secondary technical descriptor. Should not be used as a product name or as the primary thesis label in lender-facing materials.  
**Primary label in all external materials:** "Institutional Intelligence"

---

### Institutional Memory

**Canonical definition:** The stored, accessible record of an institution's decisions, processes, case history, and operational knowledge — as maintained by the Nzila platform.

**Use:** Acceptable in product descriptions as a specific outcome the platform delivers.  
**Do not use as a synonym for:** "Institutional Intelligence" (the broader methodology)

---

### Continuity

**Canonical definition:** The capacity of an institution to maintain consistent governance, knowledge, and operational function across personnel transitions, system changes, and institutional events.

**Use:** Acceptable in all contexts. Core product outcome.

---

### Governance

**Canonical definition:** The structured application of rules, roles, and accountability mechanisms to ensure institutional decisions are made, recorded, and enforceable. In Nzila's context, governance is the operating layer of the Institutional Intelligence platform.

**Use:** Acceptable in all contexts. Core product concept.  
**Technical use:** "Governance runtime" refers to the software layer that enforces governance rules in real time.

---

### Operational Continuity

**Canonical definition:** The state in which an institution's essential operations continue without disruption regardless of external events, personnel changes, or system states.

**Use:** Acceptable in all contexts. Core value proposition of the CIVIC product line and OCI doctrine.

---

### OCI / OCRA — owned by `docs/oci/CANON.md`

**This document does not define OCI or OCRA.** The canonical expansions and definitions live in
[`docs/oci/CANON.md`](../oci/CANON.md) ("What is OCI? What is OCRA? Which comes first?"):

- **OCI** = **Organizational Continuity Intelligence**.
- **OCRA** = **Organizational Continuity Recognition Assessment** — Product 1 (Recognition phase)
  inside OCI, not a separate product and not "first" in a temporal sense.

An earlier version of this document expanded OCI as "Operational Continuity Intelligence" and
OCRA as "Operational Continuity and Resilience Assessment." Those expansions are **superseded**
by the OCI canon collapse and must not be used. If this section and `docs/oci/CANON.md` ever
disagree again, `docs/oci/CANON.md` governs for these two terms specifically — this document
remains authoritative for every other definition below.

---

### Evidence

**Canonical definition:** A repository-observable artifact that directly supports a business claim. Evidence must be traceable to a specific file path, commit, workflow result, or documented artifact. Evidence cannot be inferred, synthesized, or estimated.

**Use in evidence documents:** "Evidence: [path]" — always cite the specific evidence source.  
**Do not use:** "evidence" to describe strategy documents, aspirational plans, or internal frameworks that have not been implemented.

---

### Trust

**Canonical definition:** In the Nzila commercial context, trust is the outcome of verifiable, auditable, and governed institutional operations. It is not a claim — it is a demonstrated property that must be evidenced through security posture, governance controls, and verifiable operational records.

**Use in commercial materials:** Trust claims must be backed by evidence (e.g., SOC 2 readiness, security posture documentation, governance runtime evidence).  
**Do not claim:** "trust" without citing the underlying evidence.

---

### Assessment

**Canonical definition:** A structured, evidence-backed evaluation of a specific domain (commercial readiness, security posture, privacy posture, continuity posture). Assessments produce scored, documented outputs.

**Types in the repository:**
- Commercial readiness assessment (`12-Commercial-Readiness.md`)
- Privacy readiness assessment (`governance/privacy/readiness-assessment.md`)
- Security audit readiness (`governance/security/AUDIT_READINESS.md`)
- Product readiness assessment (`apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`)

---

### Pilot

**Canonical definition:** A time-limited, controlled deployment of the Union Eyes platform to a single client organization for the purpose of demonstrating operational value and validating product-market fit prior to a full subscription commitment.

**Preferred form:** "controlled pilot" — emphasizes that the deployment is structured and supervised.  
**Do not use interchangeably with:** "proof of concept" (implies uncertain outcome); "trial" (implies informal deployment)  
**Current status:** Union Eyes has a controlled-pilot GO clearance. No pilot has been converted to a paid subscription as of the last verified repository scan.

---

### Controlled Pilot

**Canonical definition:** See "Pilot" above. The canonical term for a Union Eyes pre-commercial client engagement.

---

### Commercialization

**Canonical definition:** The process of transitioning a product from development/validation to market-generating revenue — through commercial motions (outreach, pilots, contract signing, onboarding) resulting in collected subscription revenue.

**Stages:** Discovery → Evidence → Prototype → Pilot → Commercial → Scale  
**Current commercialization stage for Union Eyes:** Pilot-ready; no paying customers on record.

---

### Validation

**Canonical definition:** Evidence that a product, feature, or claim has been tested and confirmed by a documented, repeatable process. Validation can be internal (self-certified) or external (independent party).

**Hierarchy:**
1. External validation (independent audit, pentest, third-party certification) — highest weight
2. Internal validation (documented test results, CI/CD pass records, governance simulation outputs) — middle weight
3. Assertion (claims without documented test results) — not validation; must not be labeled as validated

---

### Readiness

**Canonical definition:** A scored or declared state indicating that a product, document set, or organization meets a defined threshold for a specific purpose (lender-facing, commercial use, pilot deployment, etc.).

**Official readiness states for the BDC credit package:**
- `NOT READY` — one or more Critical findings are open
- `CONDITIONALLY READY` — all Critical findings closed with documentation
- `READY FOR BDC REVIEW` — all Critical and High findings addressed

---

### Platform

**Canonical definition:** The shared multi-product software infrastructure on which Union Eyes, CIVIC, and CourtLens are built. The platform provides governance runtime, shared packages, CI/CD, security controls, and institutional intelligence capabilities that are shared across all products.

**Use in external materials:** "Nzila's Institutional Intelligence platform" is the canonical phrase.  
**Do not use:** "Nzila OS" in lender-facing or customer-facing materials as the primary product descriptor.

---

### Framework

**Canonical definition:** A documented set of principles, structures, and processes that govern a specific domain (e.g., the Institutional Intelligence framework, the evidence framework, the pricing framework). Frameworks are documented but not necessarily software-implemented.

**Do not use interchangeably with:** "Platform" (software system); "Methodology" (analytical approach)

---

### Methodology

**Canonical definition:** A structured analytical or operational approach applied consistently to achieve a specific outcome. Examples: the OCI methodology; the evidence methodology; the OCRA assessment methodology.

---

### Operating Model

**Canonical definition:** The documented description of how Nzila Ventures operates — including governance structure, role assignments, decision rights, revenue model, and commercial execution processes.

**Key document:** `governance/corporate/governance/strategy-operating-model-dashboard.md`

---

### Advisory

**Canonical definition:** External guidance or support provided by a qualified third party (legal, financial, technical, or commercial). In the BDC context, advisory relationships must be documented in writing to be represented in the credit package.

**Current advisory relationships:** SR&ED advisor (Boast.AI or equivalent — engagement not yet confirmed); legal counsel (not named in repository). No named advisory board members as of the last verified scan.

---

### Product

**Canonical definition:** A commercially addressable software offering built on the Nzila platform that targets a specific institutional sector. Current products: Union Eyes, CIVIC, CourtLens.

**Deprecated products (historical lineage only):** FairCase (see Part 2)

---

---

## Part 2 — Deprecated Language

The following terms and usages are deprecated. They must not appear in new commercial, lender-facing, or investor-facing documents.

### FairCase

**Deprecated status:** Historical lineage only.  
**Why deprecated:** FairCase was the earlier naming and framing for the justice and institutional-governance platform. The codebase (`apps/abr/`) now serves as the technical reuse foundation for CourtLens. FairCase is retained only in explicitly labeled historical lineage sections.  
**Acceptable use:** Only in a section explicitly titled "FairCase — Historical Lineage" with the mandatory notice: "This section documents FairCase as historical lineage only. FairCase is not an active commercial offering."  
**Prohibited use:** Any description of FairCase as an active product, portfolio item, future expansion line, or source of current revenue.

### One Lab Technologies

**Deprecated status:** Historical reference only.  
**Why deprecated:** One Lab Technologies is a prior entity associated with Aubert Nungisa's entrepreneurial history. It is relevant only as potential BDC credit history context (subject to Aubert's formal decision to disclose).  
**Acceptable use:** Only in a BDC credit history disclosure section, if Aubert decides disclosure is required.  
**Prohibited use:** Any description of One Lab Technologies as a current operating entity, a current product, a current revenue source, or any component of the Nzila Ventures operating model.

### "Nzila OS Inc."

**Deprecated status:** Legacy entity name — must not be used.  
**Why deprecated:** "Nzila OS Inc." appears in a legacy commercial artifact and is not the registered corporate name. The registered legal name is "Nzila Ventures Inc."  
**Prohibited use:** All lender-facing, customer-facing, and investor-facing materials. All new internal documents.

### "Proof of Concept" (for Union Eyes pre-commercial engagements)

**Deprecated status:** Do not use as the primary descriptor.  
**Why deprecated:** "Proof of concept" implies uncertain technical outcome. Union Eyes is production-certified. The correct term is "controlled pilot."  
**Acceptable alternative:** "controlled pilot"

### Pipeline values from the data seed

**Deprecated status:** Must not be used as commercial evidence.  
**Why deprecated:** The FOUNDER_REVENUE_COCKPIT deal table header reads "as of data seed," indicating developer-inserted illustrative data. Figures including $368,750 weighted pipeline, $85,000 (CUPE Local 123), $120,000 (CAPE-ACEP), and $250,000 (CLC National) are seeded values, not actual customer records.  
**Prohibited use:** Any lender-facing, investor-facing, or external commercial document.

### "Estimated founder investment" presented as accounting fact

**Deprecated status:** Must not be used as accounting fact.  
**Why deprecated:** The $48,700–$99,100 cash estimate and $600,000 total investment figures are estimates derived from repository artifacts, not verified accounting records. They are labeled as such in the source documents.  
**Prohibited use:** Any presentation of these figures as verified accounting facts without a signed founder declaration supported by bank statements and accounting records.

### Unqualified "SOC 2 included in subscription"

**Deprecated status:** Must not appear in any current materials.  
**Why deprecated:** SOC 2 Type II certification has not been completed. Offering it as "always included" without a completion date creates a contingent liability.  
**Acceptable alternative:** "SOC 2 Type II readiness program is underway; certification timeline to be confirmed." (pending REM-010 closure)

### "15+ engineers" hiring in the BDC loan context

**Deprecated status:** Must not appear as a near-term BDC loan deliverable.  
**Why deprecated:** The 15+ engineers hiring reference in the government funding strategy is a future grant-funded aspiration, not a $75,000 BDC loan deliverable. Presenting it in the BDC loan context misrepresents the loan's scope.  
**Acceptable alternative:** Clear separation of near-term loan-funded activities from medium-term grant-funded hiring plans.

---

## Part 3 — Language Governance Rules

1. **Every document must use the registered legal name "Nzila Ventures Inc." in all lender-facing and corporate contexts.**
2. **"Nzila Digital Ventures" is acceptable as a brand identifier in marketing-facing materials only, and only when accompanied by a clarification that Nzila Ventures Inc. is the registered legal entity.**
3. **Confidence labels (Verified / Demonstrated / Documented / Planned / Not Yet Evidenced) are authoritative and must not be changed without evidence-book methodology compliance.**
4. **Product maturity boundaries must not be elevated without documented stage-gate evidence.** Union Eyes may not be described as having paying customers without actual customer records. CIVIC may not be described as a deployed government product. CourtLens may not be described as commercially available.
5. **No term appearing in the "Deprecated Language" section may be used in any new document without the mandatory historical-lineage framing.**
6. **OCI and OCRA must always be expanded on first use in any document, using the expansions owned by [`docs/oci/CANON.md`](../oci/CANON.md)** — Organizational Continuity Intelligence (OCI) and Organizational Continuity Recognition Assessment (OCRA). Not this document's former "Operational" expansions, which are superseded.

---

*This document is canonical. In the event of terminology conflict between any other document and this vocabulary, this document governs.*
