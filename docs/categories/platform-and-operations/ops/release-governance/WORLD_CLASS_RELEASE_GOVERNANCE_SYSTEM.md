# World-Class Monorepo Release Governance System (Nzila OS Portfolio)

## Canonical Release Paths

- Staging canonical path: .github/workflows/gitops-deploy.yml
- Production canonical path: .github/workflows/deploy-production.yml
- App-specific deploy workflows are emergency/manual only.

## Governance Tiers and Promotion Policy

- Tier 1 (prod-approved): union-eyes, faircase, flow, web, partners, cfo, abr
- Tier 2 (staging-first): zonga, agrimo, cora, trade, mobility, nacp-exams
- Internal-only: console, control-plane, orchestrator-api
- Frozen/legacy: mobility-client-portal, platform-admin

Source files:

- governance/release/deployment-inventory.json
- governance/release/app-ownership.json
- governance/release/domain-routing-registry.json

## Zonga Pilot Rule

- Zonga is staging-only by default.
- Production deployment is blocked unless explicit override is passed in production promotion workflow.

## Required Gates

Before staging deploy:

- lint
- typecheck
- test:fast
- migration safety validation
- governance checks

Before production deploy:

- artifact provenance validation (staging run artifact)
- governance gate
- contract tests
- smoke tests post-deploy
- rollback evidence trail

## Operational Scripts

- Governance audit: pnpm tsx scripts/release/generate-governance-audit.ts
- Secret inventory audit: pnpm tsx scripts/release/audit-secrets.ts
- Resolve policy-approved app set: pnpm tsx scripts/release/resolve-deploy-apps.ts --env staging --apps all
- Smoke tests: pnpm tsx scripts/release/run-smoke.ts --env staging --apps web,console
- Migration safety: pnpm tsx scripts/release/validate-migration-safety.ts

## Release Evidence Pack

Each release should include:

- artifact manifest and digest
- SBOM hash
- attestation reference
- smoke report
- governance snapshot
- rollback record (if rollback happened)

## Non-Negotiable Rules

- Build once in staging, promote same immutable artifact to production.
- No push-triggered direct production deployments.
- All prod promotions must align with deployment inventory and ownership registry.
- Emergency workflows must be manual and auditable.
- Every production release must produce evidence artifacts.
