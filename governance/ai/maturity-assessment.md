# AI Governance Maturity Assessment

**Doc ID:** AI-MAT-2026-001
**Methodology:** Info-Tech AI Governance Maturity Assessment, mapped to NIST AI RMF and ISO/IEC 42001
**Assessed:** 2026-04-28
**Owner:** AI Governance Committee
**Next review:** 2026-Q3

Maturity scale: **1 Initial · 2 Repeatable · 3 Defined · 4 Managed · 5 Optimized**

| # | Capability area | Current | Target (12 mo) | Evidence | Gap → Action |
|---|-----------------|:-------:|:--------------:|----------|--------------|
| 1 | AI Strategy & Vision | 2 | 3 | AI strategy implicit in product roadmaps | Document explicit AI strategy ratified by AIGC |
| 2 | Foundational Principles | 3 | 4 | [principles.md](principles.md) ratified | Roll into PR template + onboarding |
| 3 | Governance Structure | 2 | 4 | [governance-committee-charter.md](governance-committee-charter.md) drafted | Convene first AIGC; populate roles |
| 4 | AI Policy | 3 | 4 | [ai-policy.md](ai-policy.md) v1 | Ratify; train; enforce via PR review |
| 5 | Risk Classification | 3 | 4 | [risk-classification.md](risk-classification.md) §3 | Complete pending classifications |
| 6 | Risk & Compliance Program | 2 | 4 | Per-surface PIAs partial; regulation tracking ad-hoc | Quarterly regulation briefing; AIGC risk register |
| 7 | AI Inventory | 3 | 4 | [inventory.md](inventory.md) v1 | Add machine-readable inventory.json + CI check |
| 8 | Lifecycle Integration (SDLC) | 2 | 4 | [lifecycle-gates.md](lifecycle-gates.md) defined | Implement `governance/ai/lifecycle-check.ts` |
| 9 | Assurance & Monitoring | 1 | 3 | [assurance-program.md](assurance-program.md) defined; not implemented | Build eval harness in cognition packages |
| 10 | Bias & Fairness Testing | 1 | 3 | None today | Author bias panel for ue-cognition + console-actions |
| 11 | Adversarial Testing | 1 | 3 | None today | Adopt prompt-injection regression suite |
| 12 | Reasoning Traceability | 2 | 4 | Envelope contract designed (per memory note); not enforced | Add contract test gate |
| 13 | Vendor / Model Management | 3 | 4 | Azure-only; documented | Build provider review template; sub-processor watch |
| 14 | Incident Response (AI-specific) | 2 | 4 | [assurance-program.md §4](assurance-program.md#4-ai-incident-playbook-addendum-to-security-incident-management-plan) | Add tabletop scenario |
| 15 | Transparency to Users | 1 | 3 | Privacy notice draft mentions AI; UI surfaces inconsistent | Standardize "AI assisted" badge |
| 16 | Training & Awareness | 1 | 3 | None today | Annual AI policy training |
| 17 | Metrics & Reporting | 1 | 3 | None today | Monthly AIGC report from assurance program |
| 18 | Synthetic Data Practice | 3 | 4 | `packages/staging-seed-*` uses synthetic | Document via [synthetic-data-policy.md](synthetic-data-policy.md) |
| 19 | Cost & Sustainability | 3 | 4 | `packages/platform-cost-control` exists | Per-surface budgets in inventory |
| 20 | External Assurance | 1 | 2 | None | Schedule first red-team for Tier-1 surfaces |

## Composite scores

- **Current average:** 2.0 / 5 (Repeatable; foundational artifacts now exist on paper)
- **Target average (12 months):** 3.5 / 5
- **Highest-risk gaps:** Assurance (#9), Bias (#10), Adversarial (#11), Transparency (#15), Training (#16), Metrics (#17), External assurance (#20)

## 12-month roadmap

| Quarter | Milestones |
|---------|------------|
| 2026 Q2 | Convene AIGC; ratify principles + policy + charter; complete risk classifications; train all engineers |
| 2026 Q3 | Eval harness live for `ue-cognition` and `console-rag`; reasoning envelope CI gate; bias panel for Tier-1 surfaces |
| 2026 Q4 | Adversarial test suite; AI-specific tabletop; first monthly AI assurance report |
| 2027 Q1 | First independent red-team on a Tier-1 surface; first annual AI Governance Report; ISO/IEC 42001 readiness check |
