# Security Summary

## Authentication & Authorization

- **Auth layer**: `@nzila/platform-auth` — unified across all 17 apps
- **Password storage**: Argon2id with OWASP-recommended parameters
- **Session management**: Opaque tokens in PostgreSQL, secure cookies
- **SSO**: Optional Microsoft Entra ID integration
- **Account lockout**: 5 failed attempts → 15-minute lockout
- **RBAC**: Centralized policy engine with row-level isolation

## Infrastructure Security

- **Hosting**: Azure Container Apps (Canada Central)
- **Secrets**: Azure Key Vault — no secrets in source
- **TLS**: Enforced on all endpoints
- **Container scanning**: Trivy (weekly + on every PR)
- **DAST**: OWASP ZAP (weekly + on PR)
- **Secret detection**: Gitleaks on every push
- **SBOM**: Auto-generated on release (`pnpm exec tsx scripts/generate-sbom.ts`)

## Supply Chain

- **Dependency management**: pnpm with lockfile integrity
- **Security overrides**: Centralized in `package.json` `pnpm.overrides`
- **Dependabot**: Auto-merge for patch-level updates
- **Supply chain policy**: `tooling/security/supply-chain-policy.ts` with waiver tracking

## Evidence & Compliance

- **Tamper-evident audit trails**: Hash-chained evidence stored in Azure Blob
- **SOC 2 Type II controls**: Automated via `compliance.yml` workflow (daily/weekly)
- **ISO 27001 alignment**: Compliance drift detection on every PR
- **Monthly evidence packs**: Generated and stored in `proof-artifacts/`
- **200+ contract tests**: Enforcing security boundaries, policy compliance, and operating standards

## Adversarial Testing

- **Red-team tests**: Nightly automated adversarial testing (`red-team.yml`)
- **Game-day exercises**: Weekly chaos engineering (`game-day.yml`)
- **Penetration test scope**: Documented in `governance/security/PENTEST_SCOPE.md`
- **Threat model**: `governance/security/THREAT_MODEL.md`

## Security Governance

- **Vulnerability disclosure**: [SECURITY.md](../../SECURITY.md)
- **Vendor risk register**: `docs/platform/THIRD_PARTY_RISK_REGISTER.md`
- **Data residency policy**: `docs/platform/DATA_RESIDENCY_POLICY.md`
- **Secure coding training**: `docs/governance/secure-coding-training.md`

## Certifications & Reports

Available upon request:

- Compliance snapshots
- Evidence packs
- SBOM
- Container scan reports
- Penetration test scope
