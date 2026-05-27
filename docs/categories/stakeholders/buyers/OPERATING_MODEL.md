# Operating Model

## How Nzila OS Operates

### Governance-First

Every product, package, and deployment is governed through a single truth source: `governance/portfolio/product-catalog.json`. Changes to the catalog cascade through generated artifacts, CI gates, and deployment controls.

### Release Cadence

| Stage | Trigger | Gates |
|-------|---------|-------|
| Development | Feature branch | Lint, typecheck, unit tests |
| PR merge | Pull request to main | + Contract tests, governance checks, Lighthouse |
| Staging | Auto-deploy on merge to main | Smoke tests, migration safety, drift detection |
| Production | Manual promotion | + Secret audit, full deployment resolution |

### Capital Allocation

Engineering time, founder attention, and financial capital are allocated by a model-driven engine:

1. Product catalog defines financial, resource, and risk parameters
2. Capital engine scores and ranks products by weighted criteria
3. Override governance tracks leadership deviations from model recommendations
4. Runway scenarios stress-test different futures

### Evidence Chain

All operational actions produce tamper-evident evidence:

- Hash-chained audit trails in Azure Blob Storage
- Monthly evidence packs for compliance and buyer diligence
- Deployment evidence packs for each release
- Control test results archived per run

### Ownership

- Package ownership matrix: `docs/platform/PACKAGE_OWNERSHIP_MATRIX.md`
- Ownership registry: `docs/ops/ownership-registry.md`
- CODEOWNERS: Root-level GitHub CODEOWNERS file

### Incident Response

- Incident runbooks: `docs/ops/incident-response.md`
- On-call procedures: `docs/ops/on-call.md`
- Staging recovery: `docs/ops/staging-recovery-runbook.md`
- DR playbooks: `docs/ops/disaster-recovery.md`

### Monitoring & Reporting

| Report | Frequency | Command |
|--------|-----------|---------|
| Portfolio status | On-demand | `pnpm exec tsx scripts/generate-portfolio-artifacts.ts` |
| Capital allocation | On-demand | `pnpm exec tsx scripts/generate-capital-allocation.ts` |
| SRE dashboard | On-demand | `pnpm exec tsx scripts/sre/generate-executive-dashboard.ts` |
| FinOps report | On-demand | `pnpm exec tsx scripts/finops/build-portfolio-finops.ts` |
| Evidence pack | Monthly | `pnpm exec tsx scripts/proof/build-monthly-evidence-pack.ts` |
| DORA metrics | On-demand | `node tooling/scripts/collect-dora-metrics.mjs` |
