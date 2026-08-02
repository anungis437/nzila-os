# 01 — Company

## Objective

Establish Nzila Ventures' corporate identity, leadership, governance posture, and evidence of operating existence using only repository artifacts.

## Evidence Summary

- **Nzila Ventures Inc. is documented as the federal holding company for the portfolio.** **Confidence: Documented.** Evidence: `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `governance/corporate/Incorporation-Constitution.pdf`.
- **Nzila Digital Ventures is used as an operating/brand identity in business-facing materials.** **Confidence: Documented.** Evidence: `README.business.md`.
- **Aubert is the strongest evidenced principal in the repository and is recorded as founder/CEO and authorized governance owner.** **Confidence: Verified.** Evidence: `governance/corporate/leadership.json`, `docs/governance/owner-operated-review-model.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`.
- **Michel is recorded in the operating leadership registry as President with responsibility for Union Eyes, ABR, labour/legal commercialization, and buyer trust programs.** **Confidence: Documented.** Evidence: `governance/corporate/leadership.json`.
- **The repository explicitly documents an owner-operated governance model with technical gates retained as mandatory controls.** **Confidence: Verified.** Evidence: `docs/governance/owner-operated-review-model.md`.

## Corporate Identity

| Topic | Evidence-based statement | Confidence | Supporting artifacts |
|---|---|---|---|
| Legal entity | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` names **Nzila Ventures Inc.** as the federally incorporated parent company. | Documented | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| Operating brand | `README.business.md` uses **Nzila Digital Ventures** as the business-line umbrella identity. | Documented | `README.business.md` |
| Legal records presence | `governance/corporate/Incorporation-Constitution.pdf` exists as a corporate artifact in-repo. | Verified | `governance/corporate/Incorporation-Constitution.pdf` |
| Portfolio relationship | The portfolio is managed centrally through `governance/portfolio/product-catalog.json`. | Verified | `governance/portfolio/product-catalog.json` |

## Business Structure

- **Holding-company model:** `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` describes Nzila Ventures Inc. as the parent holding company for IP, product lines, and operating ventures. **Confidence: Documented.**
- **Central IP ownership model:** both `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` and `governance/corporate/governance/document-founder-executive-roles-equity-memo.md` state that IP remains centrally controlled unless explicitly assigned or licensed. **Confidence: Documented.**
- **Single-accountability product routing:** `governance/corporate/leadership.json` assigns product decision rights to named roles and states that ambiguous ownership is a failure condition. **Confidence: Verified.**

## Founders / Principals

| Principal fact | Assessment | Confidence | Evidence |
|---|---|---|---|
| Lumbanzila Aubert Nungisa is recorded as founder, CEO, incorporator, and sole director in the shareholder summary. | Strongest legal-identity evidence in repo. | Documented | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| Aubert is recorded as founder_ceo in the leadership registry. | Operating-leadership evidence. | Verified | `governance/corporate/leadership.json` |
| Michel is recorded as president with labour/legal commercialization scope. | Operating-leadership evidence; surname is not included in the registry. | Documented | `governance/corporate/leadership.json` |
| No broader management roster is consistently evidenced in current repo artifacts. | Should be treated as incomplete. | Not Yet Evidenced | Repository-wide review |

## Organization Overview

- **Shared-platform operating model:** the repository supports many domain products over shared platform packages and governance. **Confidence: Verified.** Evidence: `README.md`, `README.business.md`, `ARCHITECTURE.md`, `packages/`, `apps/`.
- **Commercial concentration discipline:** `reports/portfolio-status.md` and `governance/portfolio/product-catalog.json` show explicit focus tiers and sell-now motions. **Confidence: Verified.**
- **Cross-functional operating evidence:** engineering (`package.json`, `.github/workflows/`), governance (`governance/`), commercial (`docs/categories/stakeholders/commercial/`), and compliance (`docs/compliance/`) artifacts coexist in one repository. **Confidence: Verified.**

## Governance Model

| Governance element | Assessment | Confidence | Evidence |
|---|---|---|---|
| Owner-operated review model | Explicitly documented; authorized owner may apply governance/security approvals, but technical gates remain mandatory. | Verified | `docs/governance/owner-operated-review-model.md` |
| Board structure | Shareholder summary describes a single-director structure and evolving advisory model. | Documented | `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `governance/corporate/board/README.md` |
| Founder succession planning | A founder continuity plan exists, but its maintenance fields are incomplete and approval status is not evidenced. | Documented | `governance/corporate/governance/policy-founder-succession-continuity-plan.md` |
| Governance automation | Repository-level governance gates and authority taxonomy are implemented and documented. | Verified | `docs/governance/gates/gate-taxonomy.md`, `governance/gates/`, `.github/workflows/nzila-governance.yml` |

## Repository as Evidence of Operational Existence

- **Observable operating system:** the repository contains current products, platform packages, workflows, governance records, corporate files, compliance scaffolding, commercial packs, and readiness certifications. **Confidence: Verified.**
- **Scale evidence:** repository inspection found 26 app directories, 225 package directories, and 52 workflow files. **Confidence: Verified.** Evidence: `apps/`, `packages/`, `.github/workflows/`.
- **Release and production evidence:** `docs/readiness/production-certification.md` and companion certifications show a current production-readiness corpus. **Confidence: Demonstrated.**

## Supporting Artifacts

- `README.business.md`
- `governance/corporate/leadership.json`
- `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`
- `governance/corporate/governance/document-founder-executive-roles-equity-memo.md`
- `governance/corporate/governance/policy-founder-succession-continuity-plan.md`
- `docs/governance/owner-operated-review-model.md`
- `governance/README.md`
- `governance/portfolio/product-catalog.json`

## Current Maturity

Corporate identity and operating ownership are documented, but board, advisory, and broader executive-governance evidence is not yet as strong as the engineering and product-governance evidence.

## Commercialization Relevance

Lenders and partners can verify that the business is organized around a real operating repository and named corporate artifacts. They should also note that some corporate governance materials appear to be draft-grade or maintained outside the repository.

## Gaps

- Entity naming is inconsistent across the repository (Nzila Ventures Inc., Nzila Digital Ventures, and in one legacy commercial artifact, Nzila OS Inc.).
- Board minutes and formal governance resolutions are referenced conceptually but not surfaced as current in-repo evidence.
- Principals beyond Aubert and Michel are not clearly evidenced.

## Next Milestone

Normalize legal-entity naming across all commercial materials and publish a single authoritative corporate fact sheet sourced from `governance/corporate/`.
