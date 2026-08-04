# Product Governance

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** AUTHORITATIVE — governs all current and future product commercialization

---

## Purpose

This document establishes the official commercialization sequence for Nzila Ventures products. Every current product followed — or must demonstrate compliance with — this governance process. Every future product must follow the same sequence from discovery through scale.

---

## Part 1 — Official Commercialization Sequence

The Nzila commercialization sequence is:

```
Institutional Intelligence (thesis and methodology)
         ↓
    Union Eyes (labour sector)
         ↓
       CIVIC (public institutions)
         ↓
    CourtLens (legal sector)
```

This sequence is not arbitrary. Each product level builds on the evidence, methodology, and technical foundation established at the level above it. Union Eyes is the lead commercial vehicle because it has the strongest evidence base, the narrowest and most defined target market, and the highest near-term conversion probability.

---

## Part 2 — Current Product Status

| Product | Stage | Evidence Status | Notes |
|---|---|---|---|
| Institutional Intelligence | Methodology | Verified | Platform thesis; implemented across all products |
| Union Eyes | Pilot | Production-certified; pilot GO clearance | Lead commercial vehicle; no paying customers on record |
| CIVIC | Discovery / Evidence | Documented thesis; OCI alignment documented | No pricing, no active paid pipeline |
| CourtLens | Discovery / Prototype | Planned; ABR codebase provides technical foundation | TRL 3; not commercially deployed |

---

## Part 3 — Stage Gate Definitions

Every product must pass through six defined stages. No product may be represented commercially at a stage above its verified position.

### Stage 1 — Discovery

**Definition:** The institutional problem is identified and framed. The sector is defined. The product thesis is documented.

**Required outputs:**
- Sector thesis document (e.g., `docs/public-service/civic-thesis.md`)
- Institutional problem statement
- Initial target buyer profile

**Evidence gate:** Thesis document exists and is committed. No commercial claims may be made at this stage.

**Current products at this stage:** None (all products have advanced beyond Discovery)

---

### Stage 2 — Evidence

**Definition:** The technical foundation for the product exists in the repository. The core capabilities are implemented or demonstrably reusable from a prior product.

**Required outputs:**
- Core codebase committed to `apps/[product-name]/`
- Architecture document
- Technical reuse analysis (if building on an existing codebase)

**Evidence gate:** Repository artifacts exist that support the product's core capability claims. Confidence label: "Documented" or "Demonstrated."

**Current products at this stage:** CourtLens (ABR codebase provides the technical foundation; pipeline defined in roadmap)

---

### Stage 3 — Prototype

**Definition:** A functional prototype exists that demonstrates the product's key value proposition in a controlled environment.

**Required outputs:**
- Functional prototype committed to the repository
- Demo runbook
- Product readiness assessment (equivalent to `PRODUCT_READINESS_REPORT.md`)
- Initial pricing hypothesis

**Evidence gate:** A demo can be run from the repository. At least one internal walkthrough has been documented. Confidence label: "Demonstrated."

**Current products at this stage:** CourtLens (approaching; ABR demo capability exists)

---

### Stage 4 — Pilot

**Definition:** The product is deployed in a controlled pilot with a real client organization. The pilot has a documented scope, timeline, and success criteria.

**Required outputs:**
- Pilot scope document (`PILOT_SCOPE.md` equivalent)
- Client organization name and engagement date documented
- Pilot validation record (`PILOT_VALIDATION.md` equivalent)
- At minimum, an internal walkthrough with documented observations if no external client pilot has been initiated

**Evidence gate:** A documented pilot engagement exists with a real client organization, or a controlled demonstration environment has been validated with a documented run. Confidence label: "Demonstrated."

**Current products at this stage:** Union Eyes (GO clearance; pilot validation documented; no converting client as of last scan)

---

### Stage 5 — Commercial

**Definition:** The product has at least one paying customer. A signed subscription agreement and a collected first payment are documented. Revenue is in accounting records.

**Required outputs:**
- Signed client agreement (committed to repository or referenced by document path)
- First collected payment reflected in accounting records
- Commercial traction section updated in evidence book
- Seeded pipeline data (if any) removed and replaced with real customer records

**Evidence gate:** A signed agreement and collected revenue from at least one paying customer. Confidence label: "Verified" for commercial traction claims.

**Current products at this stage:** None — Union Eyes is the closest to achieving this stage but has not yet converted a pilot to a paying subscription.

---

### Stage 6 — Scale

**Definition:** Multiple paying customers across at least two client organizations. Revenue is tracking against projections. Customer retention data exists.

**Required outputs:**
- Multiple signed agreements
- Revenue performance tracking document
- Customer retention and expansion metrics
- Scale narrative for investor and lender materials

**Evidence gate:** Documented revenue from multiple paying customers. Confidence label: "Verified."

**Current products at this stage:** None.

---

## Part 4 — Future Product Governance Requirements

Any product that is proposed for the Nzila portfolio in the future must satisfy the following governance requirements before it may be added to any commercial or lender-facing document:

### 4.1 Founder Authorization

A new product may only enter the repository as a commercial concept if Aubert Nungisa has explicitly authorized it in writing. The authorization must state:

- Product name (canonical)
- Target sector
- Relationship to the existing product trio (complementary, replacement, or extension)
- Whether the product uses an existing codebase or requires new development

### 4.2 Thesis Document

Before any commercial claims are made, a thesis document must be committed to `docs/[product-category]/[product-name]-thesis.md`. The thesis must describe the institutional problem, the target buyer, and the methodology.

### 4.3 Maturity Declaration

The new product must be assigned a starting maturity stage (Discovery or Evidence) and documented in the corporate knowledge map. No new product may be introduced at the Pilot or Commercial stage without the prior stages being evidenced.

### 4.4 Portfolio Truth System Compliance

The new product must not be added to:

- The commercial pricing framework (until Stage 5)
- The commercial traction pipeline (until a real client record exists)
- Lender-facing or investor-facing materials (until Stage 4, and then only with accurate maturity disclosure)
- Any revenue projection (until Stage 5 actuals exist or Stage 4 pilot terms are documented)

### 4.5 Controlled Vocabulary Compliance

The product name must be defined in `CONTROLLED-VOCABULARY.md` before it appears in any commercial document.

---

## Part 5 — Product Retirement Governance

If a product is retired or repositioned, the following governance requirements apply:

1. A retirement record must be committed explaining: the product name, the reason for retirement, the date of the founder decision, and the disposition of the codebase (retained for reuse, archived, or removed).
2. The product must be removed from all active commercial and lender-facing documents.
3. If the product has institutional memory value (e.g., FairCase as the predecessor to CourtLens), it must be preserved in a dedicated historical lineage section with the mandatory notice: "This section documents [product name] as historical lineage only."
4. The corporate knowledge map must be updated to reflect the product's retired status.

---

## Part 6 — Current Product Boundaries (Non-Negotiable)

These boundaries are frozen and must not be modified by any agent without verified founder authorization:

### Union Eyes

- Stage: Pilot — production-certified; controlled-pilot GO clearance
- Boundary: No paying customers on record. Commercial readiness is documented. Pipeline infrastructure exists but contains seeded data only (REM-004).
- Must not be described as: having deployed paying customers, having validated recurring revenue, or having completed SOC 2 certification.

### CIVIC

- Stage: Discovery / Evidence — market-development stage; OCI methodology aligned
- Boundary: No published pricing. No active paid pipeline. No deployed clients.
- Must not be described as: a deployed government product, a procured solution, generating recurring revenue, or having validated adoption.

### CourtLens

- Stage: Discovery / Prototype — TRL 3; ABR codebase provides technical foundation
- Boundary: No commercial deployment. No pilot engagement. Planning stage only.
- Must not be described as: commercially available, production-ready, deployed, customer-validated, or pilot-engaged.

---

*This document governs all current and future product commercialization. It is authoritative and may only be revised by Aubert Nungisa or through the governance process it establishes.*
