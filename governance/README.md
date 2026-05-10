# Governance

Governance policy, controls, assurance, and portfolio strategy.

## Quick Navigation

### Strategy and Portfolio
- [business/](./business/) - Vertical strategy, financial models, investor materials
- [portfolio/](./portfolio/) - Portfolio operating model and cross-product governance
- [capital/](./capital/) - Capital planning and investment governance
- [commercial/](./commercial/) - Commercial governance and GTM controls

### Security, Risk, and Compliance
- [security/](./security/) - Security controls and governance enforcement
- [privacy/](./privacy/) - Privacy policy and data governance
- [exceptions/](./exceptions/) - Approved governance exceptions and waivers
- [resilience/](./resilience/) - Resilience policy and continuity governance
- [release/](./release/) - Release governance controls
- [releases/](./releases/) - Historical release governance records

### Operating Controls
- [ga/](./ga/) - Governance automation checks and gating logic
- [finops/](./finops/) - Financial operations governance
- [sre/](./sre/) - Reliability governance and SRE controls
- [reports/](./reports/) - Governance reports and audits

### Knowledge and Content
- [docs/](./docs/) - Governance architecture and specification docs
- [corporate/](./corporate/) - Corporate policy and legal governance
- [profiles/](./profiles/) - Governance profile definitions
- [rollout/](./rollout/) - Governance rollout plans
- [ai/](./ai/) - AI governance controls and operating doctrine

### Foundations
- [foundations/analytics/](./foundations/analytics/) - Governance analytics artifacts
- [foundations/content/](./foundations/content/) - Governance content standards
- [foundations/knowledge/](./foundations/knowledge/) - Institutional knowledge governance
- [foundations/releases/](./foundations/releases/) - Historical release governance records
- [foundations/repo/](./foundations/repo/) - Repository governance rules and standards

## Root Metadata Files

These files remain at governance root because they are referenced by automation and CI scripts:
- `api-inventory.json`
- `final-ga-check.ts`
- `ga-check.ts`
- `platform-exceptions.yaml`
- `platform-package-authority.json`
- `platform-package-owners.yaml`
- `runtime-adoption-matrix.json`

## Optimization Notes

Governance subfolder moves are intentionally conservative due high path coupling across scripts and policies.
A future migration can relocate subfolders only after introducing a compatibility mapping layer and updating all references.
