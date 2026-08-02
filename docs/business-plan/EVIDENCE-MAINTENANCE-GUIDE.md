# Evidence Maintenance Guide

**Prepared:** 2026-08-01  
**Branch:** `copilot/generate-evidence-and-dossier`  
**Commit SHA:** `cb3440b04a1bd7d1f71ae1b7df60dc386678dcc3`  
**Status:** AUTHORITATIVE — governs all evidence management in this repository

---

## Purpose

This guide explains how evidence is added, upgraded, and downgraded; how confidence levels change; when claims are removed; and how the repository advances from discovery through commercialization. It ensures that the evidence base grows in a controlled, traceable way without compromising the integrity of the dossier.

---

## Part 1 — How Evidence Is Added

### 1.1 The Evidence Addition Sequence

Adding new evidence to the repository follows a strict sequence:

1. **Identify the claim.** Determine which business assertion the evidence supports.
2. **Verify the artifact exists.** Confirm the evidence source (file path, commit record, external document) actually exists and is accessible.
3. **Classify the confidence level.** Apply the correct label from the five-level scale (see Part 3).
4. **Add the citation.** Add the evidence in the form: `Evidence: [repository path or document reference].`
5. **Update the evidence register.** Add or update the entry in `10-Evidence-Register.md`.
6. **Check the gap register.** If the new evidence closes a documented gap, update `11-Gap-Register.md` to reflect the closure.
7. **Check the remediation register.** If the new evidence closes an open finding, update `BDC-U9-Remediation-Register.md` with the closure reference and date.
8. **Update the master dossier.** Ensure the corresponding section of `Nzila-Evidence-and-Commercial-Readiness-Dossier.md` reflects the new evidence.
9. **Commit with a traceable message.** Format: `docs: add evidence — [section] — [brief description of evidence added]`

### 1.2 What Qualifies as Evidence

| Type | Qualifies as evidence | Notes |
|---|---|---|
| Implemented code in `apps/` or `packages/` | Yes | Cite the specific file or directory |
| CI/CD workflow result (`.github/workflows/`) | Yes | Cite the workflow file |
| Signed agreement or contract | Yes | Must be committed to repository or referenced by document path |
| Government-issued certificate | Yes | Must be referenced by document path or filing number |
| Accountant-signed financial statement | Yes | Must be committed or referenced |
| Founder declaration (signed) | Yes | Must be committed |
| Internal policy document | Conditionally | Qualifies as "Documented"; does not qualify as "Verified" |
| Third-party audit report | Yes | Qualifies as "Verified" or "Demonstrated" depending on scope |
| Repository analytics or scan results | Yes | Cite the specific command and output |
| Strategy document without implementation | No | Does not qualify as evidence for implemented claims |
| Estimated figures without accounting support | No | Does not qualify as evidence for financial claims |
| Seeded or illustrative data | No | Explicitly prohibited as evidence |
| AI-inferred facts | No | Explicitly prohibited as evidence |

### 1.3 External Documents as Evidence

If the evidence source is a document held outside the repository (e.g., a signed contract, a bank statement, an advisor letter):

1. The document should be committed to the repository in an appropriate confidential directory if the founder consents.
2. If the document cannot be committed (e.g., for privacy reasons), a reference record should be committed that states: the document type, the date it was verified, the person who verified it, and the location where it is held.
3. The evidence citation in the evidence book should read: `Evidence: [document type] — verified [date] by [name] — held at [location]`

---

## Part 2 — How Evidence Is Upgraded

Evidence is upgraded when a stronger source replaces a weaker source for the same claim.

### 2.1 Upgrade Triggers

| Current confidence | Upgrade trigger | New confidence |
|---|---|---|
| Planned | Implementation completed; artifact exists in repository | Documented or Demonstrated |
| Documented | Third-party test, audit, or external certification | Demonstrated or Verified |
| Demonstrated | Independent external verification | Verified |
| Not Yet Evidenced | Any qualifying artifact | Depends on artifact type |

### 2.2 Upgrade Process

1. Identify the existing claim and its current confidence label.
2. Confirm the new evidence artifact exists and qualifies (see Part 1.2).
3. Update the claim in the relevant section file.
4. Update the evidence citation to reference the stronger source.
5. Update the evidence register entry.
6. If the upgrade closes a gap register item or remediation register item, update those documents.
7. Update the master dossier.
8. Commit with a traceable message: `docs: upgrade evidence — [section] — [confidence level change] — [brief reason]`

### 2.3 Upgrade Restrictions

- An AI agent may not upgrade confidence labels without a qualifying artifact.
- A higher confidence label may not be applied to a claim that has only self-certified or internally produced documentation without external validation, unless the label is "Documented," which explicitly covers internally produced documentation.
- A claim that has been identified as a gap register item or remediation register item may not have its confidence upgraded until the closure evidence requirements in the relevant register entry are met.

---

## Part 3 — Confidence Levels and When to Apply Each

### Verified

**Apply when:** The claim is directly supported by implemented code, a repository artifact (configuration, schema, CI/CD workflow), or a published external document that can be independently reviewed.

**Examples:**
- Union Eyes is production-certified → `Evidence: apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`
- The platform has 52 CI/CD workflows → `Evidence: Repository scan, 2026-08-01, .github/workflows/ (52 files)`

### Demonstrated

**Apply when:** The claim has been proven through demos, working implementations, or repeatable documented processes, even if not independently certified.

**Examples:**
- Demo environments are operational → `Evidence: apps/union-eyes/docs/operations/DEMO_RUNBOOK.md`
- Governance simulation has been run → `Evidence: apps/union-eyes/docs/procurement/GOVERNANCE_SIMULATION_OVERVIEW.md`

### Documented

**Apply when:** The claim is supported by formal documentation (policy, framework, plan) but has not been implemented or validated in operation.

**Examples:**
- Privacy policy is documented → `Evidence: governance/privacy/policies/data-classification-policy.md`
- Succession plan exists (incomplete) → `Evidence: governance/corporate/governance/policy-founder-succession-continuity-plan.md`

### Planned

**Apply when:** The claim describes an approved roadmap item with documented intent but not yet implemented.

**Examples:**
- CourtLens will target legal aid clinics → `Evidence: docs/courtlens/pilot-readiness-plan.md (planned)`
- Advisory council is being formed → `Evidence: governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`

### Not Yet Evidenced

**Apply when:** A claim exists in a strategy or commercial document but has no supporting artifact in the repository.

**Examples:**
- SOC 2 Type II completion → No evidence artifact exists
- Patent applications filed → Claimed in one document; no application numbers available

---

## Part 4 — When Claims Are Downgraded

Claims must be downgraded when:

1. **The supporting evidence is found to be incorrect.** If a claim was labeled "Verified" based on a misread repository artifact, the label must be corrected.
2. **The supporting artifact is removed or replaced.** If a file that served as evidence for a claim is deleted or superseded, the claim's confidence must be re-evaluated.
3. **New contradicting evidence is found.** If the gap register or a stress-test review finds that a "Verified" or "Demonstrated" claim is contested by a stronger source, the claim must be downgraded until the conflict is resolved.
4. **An AI agent or reviewer identifies a prohibited representation.** If a claim is found to use seeded data, estimated founder investment, or deprecated language as evidence, the claim must be downgraded immediately and the source of the error documented.

### 4.1 Downgrade Process

1. Identify the affected claim and its current confidence label.
2. Document the reason for the downgrade in the gap register with a specific explanation.
3. Update the confidence label in the relevant section file.
4. If the downgraded claim was used in a lender-facing document, mark that document as `[INTERNAL REVIEW]` until the claim is corrected.
5. Add a remediation register entry if the downgrade creates a new blocking finding.
6. Commit with a traceable message: `docs: downgrade evidence — [section] — [brief reason]`

---

## Part 5 — How New Products Enter the Repository

A new product enters the repository through the commercialization governance sequence defined in `PRODUCT-GOVERNANCE.md`. From an evidence perspective, the following sequence applies:

### Stage 1 — Discovery

- The product concept is documented in a thesis document.
- A confidence label of "Planned" is assigned.
- The product is added to the gap register as a future evidence development target.

### Stage 2 — Evidence

- A technical foundation or proof-of-concept implementation is committed to the repository.
- An evidence register entry is created.
- Confidence is upgraded to "Documented" or "Demonstrated" based on artifact strength.

### Stage 3 — Prototype

- A functional prototype exists in the repository.
- A product readiness report is created (equivalent to `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`).
- A maturity assessment is completed.

### Stage 4 — Pilot

- A pilot scope document is created.
- At least one pilot engagement is documented with a real organization name, engagement date, and outcome.
- Confidence for pilot-related claims is upgraded to "Demonstrated."

### Stage 5 — Commercial

- A signed subscription agreement or pilot conversion is documented.
- Revenue is recorded in accounting records.
- Confidence for commercial traction claims is upgraded to "Verified."
- The product is added to the commercial readiness scorecard.

### Stage 6 — Scale

- Multiple paying customers are documented.
- Revenue performance is tracked against projections.
- A scale narrative is created for investor and lender materials.

---

## Part 6 — How Pilots Become Validation

A pilot engagement becomes a validation data point when:

1. The pilot has a documented scope (`PILOT_SCOPE.md` equivalent).
2. The pilot has been completed or has reached a defined milestone.
3. A pilot validation record has been produced documenting outcomes, user observations, and platform performance.
4. The validation record has been reviewed and approved by the pilot client contact (or a written disclosure has been made that the validation is internal-only).

**Current status:** Union Eyes has a controlled-pilot GO clearance and a `PILOT_VALIDATION.md` record, but no pilot has been converted to a paying customer as of the last verified scan.

---

## Part 7 — How Validation Becomes Commercialization

Validation becomes commercialization evidence when:

1. A pilot has concluded with a documented conversion decision (pilot converted to subscription, or pilot declined with documented reason).
2. At least one paying customer is on record with a signed agreement and collected first payment.
3. The revenue is reflected in accounting records.
4. The commercial traction section of the evidence book is updated to reflect the conversion.
5. The seeded pipeline data (if still present) is replaced with real customer records.

---

*This guide is authoritative for evidence management. No claim may be added to the evidence book without following the sequence in Part 1.*
