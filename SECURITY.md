# Security Policy

## Reporting Vulnerabilities

**Do not file a public GitHub issue for security vulnerabilities.**

Report security issues by emailing: security@nzila.app

We will acknowledge within 24 hours and provide a fix timeline within 72 hours.

## Supply Chain Security

### Dependency Scanning
- **Workflow**: `.github/workflows/dependency-audit.yml` runs `pnpm audit --audit-level=high` on every PR
- **Waiver Process**: High/critical CVEs that cannot be immediately patched require a waiver artifact stored in Azure Blob (`evidence` container) with expiry date
- **SBOM**: Generated on every release tag via `.github/workflows/sbom.yml` (CycloneDX format)

### Secret Scanning  
- **Workflow**: `.github/workflows/secret-scan.yml` (Gitleaks) runs on every PR
- **Pre-commit**: Gitleaks pre-commit hook recommended for all contributors

### Static Analysis
- **Workflow**: `.github/workflows/codeql.yml` — CodeQL analysis for TypeScript and Python

### Container Security
- Base images pinned to exact digest in `Dockerfile`
- Images rebuilt weekly to pick up OS patches

## Access Control
- Production secrets stored in Azure Key Vault (never in `.env` files or repo)
- Clerk authentication on all apps
- RBAC via `@nzila/os-core/policy` — `authorize()` required on every API route
- Partner access gated by `partner_entities` table

## Audit Trail
- All material actions produce hash-chained `audit_events` rows
- Evidence packs stored in Azure Blob with immutable access tier
- Audit chain verified by `verifyChain()` from `@nzila/os-core/hash`

## Incident Response
Playbooks at `ops/incident-response/`. Primary contact: `ops@nzila.app`

## Compliance
- SOC 2 Type I controls mapped at `ops/compliance/`
- Control test schedule at `ops/compliance/Control-Test-Plan.md`
