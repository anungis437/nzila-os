# {{PRODUCT_NAME}} — Security Baseline

This document outlines the security practices and expectations for
{{PRODUCT_NAME}}.

## Secrets Hygiene

- **Never** commit secrets, tokens, or credentials to source code.
- Store all secrets in GitHub Actions secrets or Azure Key Vault.
- Use OIDC federation for Azure authentication — no long-lived credentials.
- Rotate secrets on a regular cadence and after any suspected exposure.

## Dependency Scanning

- Dependabot is enabled for automated dependency updates.
- `pnpm audit` runs as part of the CI pipeline.
- Critical and high-severity vulnerabilities must be resolved before merging.
- Pin dependencies to exact versions where possible.

## SAST / DAST Expectations

- **SAST**: Static analysis runs on every pull request via CodeQL or an equivalent tool.
- **DAST**: Dynamic application security testing should be performed before each production release.
- Address all high and critical findings before deploying.

## Audit Logging

- All authentication events must be logged.
- Administrative actions must produce an immutable audit trail.
- Logs must not contain secrets, tokens, or personally identifiable information (PII).
- Retain audit logs for a minimum of 90 days.

## Incident Response

- Report security incidents to {{OWNER_GITHUB}} immediately.
- Follow the organisation's incident response playbook.
- Document findings in a post-incident review within 72 hours.
- Patch and deploy fixes under an expedited release process.
