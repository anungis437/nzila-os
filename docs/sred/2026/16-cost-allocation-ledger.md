# 2026 Cost Allocation Ledger

Status: Draft for CPA/SR&ED advisor review.

Purpose: maintain financial claim readiness for SR&ED by linking people, time, contractor cost, and allocation rationale to advancement evidence.

Scope:
- Advancement A1 (Confidence-Aware Institutional Measurement)
- Advancement A5 (Institutional Knowledge Architecture)
- Additional advancements only when approved in registry

## Allocation Rules
- Allocation must map to explicit work evidence.
- SR&ED percentage must be justified with uncertainty/experiment context.
- Non-SR&ED percentage must be explicitly declared.
- If evidence is missing, do not allocate to SR&ED.

## Personnel Ledger
| Entry ID | Date | Person | Role | Advancement | Hours | SR&ED % | Non-SR&ED % | Allocation Rationale | Evidence Link |
|---|---|---|---|---|---:|---:|---:|---|---|
| P-2026-001 | YYYY-MM-DD |  |  | A1 or A5 | 0.0 | 0 | 0 |  |  |

## Contractor Ledger
| Entry ID | Date | Contractor | Work Description | Advancement | Cost (CAD) | SR&ED % | Non-SR&ED % | Allocation Rationale | Invoice Ref | Evidence Link |
|---|---|---|---|---|---:|---:|---:|---|---|---|
| C-2026-001 | YYYY-MM-DD |  |  | A1 or A5 | 0.00 | 0 | 0 |  |  |  |

## Monthly Rollup
| Month | Personnel Hours | Contractor Cost (CAD) | SR&ED Allocated Cost (CAD) | Non-SR&ED Cost (CAD) | Notes |
|---|---:|---:|---:|---:|---|
| 2026-01 | 0.0 | 0.00 | 0.00 | 0.00 |  |

## Project / Advancement Allocation
| Advancement | Project Container | Personnel Cost (CAD) | Contractor Cost (CAD) | Total SR&ED Cost (CAD) | Allocation Basis | Evidence Link |
|---|---|---:|---:|---:|---|---|
| A1 - Confidence-Aware Institutional Measurement | A: Institutional Intelligence Measurement | 0.00 | 0.00 | 0.00 | uncertainty/experiment hours linked to registry | docs/sred/2026/11-advancement-registry.md |
| A5 - Institutional Knowledge Architecture | B: Institutional Intelligence Knowledge Architecture | 0.00 | 0.00 | 0.00 | uncertainty/experiment hours linked to registry | docs/sred/2026/11-advancement-registry.md |

## SR&ED vs Non-SR&ED Split
| Cost Pool | Total Cost (CAD) | SR&ED Eligible (CAD) | Non-SR&ED (CAD) | Split Rationale |
|---|---:|---:|---:|---|
| Personnel | 0.00 | 0.00 | 0.00 | per-row allocation tied to uncertainty/experiment evidence |
| Contractors | 0.00 | 0.00 | 0.00 | per-invoice allocation tied to experimental work |
| Total | 0.00 | 0.00 | 0.00 | excluded categories removed before eligible total |

## Excluded Cost Categories
Do not allocate the following categories to SR&ED:
- marketing and campaigns
- sales and GTM operations
- demos and presentation prep
- UI design and localization
- platform deployment and routine DevOps
- authentication plumbing and routine CRUD
- standard integrations and customer onboarding
- pilot implementation and customer-specific delivery

## Review Controls
- Finance review cadence: monthly
- Technical validation cadence: weekly
- Reconciliation artifacts required:
  - payroll extracts
  - contractor invoices
  - time logs
  - advancement evidence links

## Rejection Criteria
Do not allocate costs to SR&ED if:
- work is productization, GTM, demo, deployment, or routine integration
- uncertainty/experiment chain is absent
- evidence cannot be linked to an advancement entry

## Finance Review Checklist
- Payroll source data attached for each personnel entry.
- Contractor invoices linked and attributable.
- SR&ED vs non-SR&ED split justified per row.
- Allocation rationale references uncertainty/experiment work.
- Evidence links resolve to registry/failure/timeline artifacts.
- Excluded categories reviewed and removed from SR&ED totals.
- Monthly rollup reconciles to ledger rows.
- Outstanding evidence gaps reviewed against 15-evidence-gap-register.md.

## Evidence Links
- docs/sred/2026/11-advancement-registry.md (advancement allocation basis)
- docs/sred/2026/12-failure-ledger.md (experimental work and failures)
- docs/sred/2026/13-research-timeline.md (dated work chronology)
- docs/sred/2026/14-evidence-priority-matrix.md (artifact strength weighting)
- docs/sred/2026/15-evidence-gap-register.md (disclosed provenance gaps)
- docs/sred/2026/07-supporting-evidence/institutional-intelligence/evidence-index.md (A1)
- docs/sred/2026/07-supporting-evidence/knowledge-architecture/evidence-index.md (A5)

## Open Finance Inputs Required from Aubert
- Payroll extracts for each person contributing to A1/A5 experimental work (period, gross pay, hours).
- Contractor invoices attributable to A1/A5 experimental work (vendor, date, amount, work description).
- Confirmed SR&ED vs non-SR&ED time-code split per contributor.
- Per-person eligible hours for the claim period.
- Confirmation of any provincial/federal incentive interactions or prior-year carryforwards.
- Confirmation that excluded categories (GTM, deployment, CRUD, onboarding) are tracked separately.
- Sign-off authority and target filing window for the claim.
