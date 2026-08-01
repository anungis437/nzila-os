# 11 — Gap Register

## Objective

Identify material evidence gaps, documentation conflicts, and readiness shortfalls honestly.

| Gap | Category | Rank | Why it matters | Supporting artifact(s) |
|---|---|---|---|---|
| No completed SOC 2 examination evidenced in-repo. | Compliance | Critical | External diligence will ask for independent control assurance. Current posture is readiness scaffold only. | `docs/compliance/soc2/README.md`, `docs/compliance/soc2/gap-log.md` |
| No completed product-specific external pentest evidence for products in scope was found. | Security | Critical | Commercial collateral should not imply more than readiness or planned status. | `docs/categories/stakeholders/commercial/claims-ledger.md`, `docs/compliance/soc2/gap-log.md`, `docs/categories/platform-and-operations/security/pentest-readiness-self-assessment.md` |
| Union Eyes readiness report explicitly says user-testing results do not yet exist. | Product validation | Critical | Controlled pilot may proceed, but broader commercialization proof remains incomplete without user-test outcomes. | `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md` |
| CourtLens has no implemented runtime evidence. | Product maturity | Critical | Must not be presented as an active shipped product. | `docs/courtlens/README.md`, `docs/courtlens/pilot-readiness-plan.md` |
| FairCase procurement/trust collateral includes claims stronger than stronger evidence supports (e.g., legal entity, active certification timing, annual pentest language). | Commercial accuracy | Critical | Risks credibility loss in procurement and lender diligence. | `docs/categories/products-and-market/faircase/procurement-trust-kit.md`, `docs/compliance/soc2/gap-log.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md` |
| Corporate naming is inconsistent (Nzila Ventures Inc., Nzila Digital Ventures, and Nzila OS Inc. in one commercial file). | Corporate governance | Important | Counterparties need one authoritative legal identity. | `README.business.md`, `governance/corporate/governance/legal-shareholder-and-corporate-structure-summary.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md` |
| Published repository counts are stale relative to current repo state (e.g., 47 workflows vs. 52 observed; 215 packages vs. 225 observed). | Documentation hygiene | Important | Signals drift between external narrative and current operational truth. | `README.business.md`, `README.md`, `.github/workflows/`, `packages/` |
| FairCase maturity file records partial backup/restore, analytics lineage, and access-review evidence. | Product operations | Important | Product is saleable in narrative terms but not yet as operationally evidenced as Union Eyes. | `apps/abr/maturity.json` |
| Platform-wide accessibility evidence is fragmented and not centrally validated. | Compliance / UX | Important | Public-sector and institutional buyers may require stronger accessibility proof. | `apps/union-eyes/README.md`, `docs/categories/products-and-market/faircase/procurement-trust-kit.md` |
| Product-level observability is partial in both Union Eyes and FairCase maturity records. | Operations | Important | Monitoring maturity affects pilot safety and supportability. | `apps/union-eyes/maturity.json`, `apps/abr/maturity.json` |
| Signed contracts, live ARR, or closed-revenue evidence are not surfaced in the reviewed repository. | Commercial traction | Important | Lenders will differentiate packaging from booked commercial performance. | `governance/portfolio/product-catalog.json` classifications |
| CLEAR Method requested in the brief was not found as a canonical artifact in the reviewed materials. | Methodology evidence | Future | Important for taxonomy completeness but not a blocker if omitted honestly. | Repository review |
| Board/advisory governance evidence is lighter than engineering/governance automation evidence. | Governance | Future | Would improve institutional diligence depth. | `governance/corporate/board/README.md` |
| FinOps evidence is operationally wired but not yet summarized into one external-friendly proof pack. | Operations / finance | Future | Would strengthen lender-grade operating discipline narrative. | `README.md`, `package.json`, `governance/corporate/finance/` |

## Priority Interpretation

- **Critical** — directly affects diligence credibility or product-readiness claims.
- **Important** — should be resolved before scaling external outreach or procurement.
- **Future** — not an immediate blocker, but would materially strengthen institutional confidence.

## Supporting Artifacts

- `docs/compliance/soc2/`
- `apps/union-eyes/docs/procurement/PRODUCT_READINESS_REPORT.md`
- `apps/abr/maturity.json`
- `docs/courtlens/`
- `docs/categories/products-and-market/faircase/procurement-trust-kit.md`
- `README.md`
- `README.business.md`

## Next Milestone

Resolve the claim-discipline issues first: entity naming, compliance status wording, and product-maturity boundaries. Then add outcome-grade customer and validation evidence.
