# Release Governance Audit

Generated: 2026-06-02T14:54:35.566Z

## Scores

- Release Governance Score: 9/10
- Deployment Risk Score: 10/10
- Workflow Sprawl Score: 9/10
- Environment Drift Score: 8/10

## Canonical Workflows

- gitops-deploy.yml
- deploy-production.yml

## App-Specific Deployment Workflows (Active)

- deploy-union-eyes.yml

## App-Specific Deployment Workflows (Demoted to Emergency/Manual)

- deploy-console.yml
- deploy-partners.yml
- deploy-web.yml

## Inventory Coverage

- Governed applications: 27
- Active workflow files discovered: 50

## Risk Notes

- Production path is locked to immutable artifact promotion from staging workflow output.
- Staging remains canonical via gitops-deploy with policy-based app eligibility.
- Zonga requires explicit production override and is excluded by default.
