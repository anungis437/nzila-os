# Chapter 08 — Security Hardening

This chapter defines the security baseline for **{{PRODUCT_NAME}}** and the
processes that keep the application secure over time.

## Security baseline

- All traffic is encrypted in transit (TLS 1.2+).
- Authentication is delegated to {{AUTH_PROVIDER}} (see Chapter 03).
- Tenant data isolation is enforced via `{{TENANT_KEY}}` at the query and RLS layer (see Chapter 03).
- Content Security Policy (CSP) headers are configured in `next.config.mjs`.

## Secrets hygiene

- Secrets are stored in GitHub environment secrets or {{DEPLOY_PROVIDER}} vault.
- `.env.local` is git-ignored and never committed.
- Rotate secrets on a quarterly cadence and immediately after any compromise.

## Dependency scanning

- **Dependabot** is enabled for automated dependency update PRs.
- `pnpm audit` is run in CI on every pull request.
- Critical / high vulnerabilities block merge.

## Vulnerability management

| Severity | SLA to remediate |
| -------- | ---------------- |
| Critical | 24 hours         |
| High     | 7 days           |
| Medium   | 30 days          |
| Low      | Next sprint      |

## Static analysis

- **ESLint security rules** (e.g., `no-eval`, SQL injection patterns) are enforced in CI.
- **CodeQL** scans run on every push to `main` and on pull requests.

## Audit logging

All privileged actions (user creation, role changes, data exports) are logged
to an append-only audit table with the following fields:

- `actor_id` — Who performed the action.
- `{{TENANT_KEY}}` — Which tenant context.
- `action` — Machine-readable action name.
- `timestamp` — UTC timestamp.
- `metadata` — JSON payload with before/after state.

## Incident response

1. Detect via alerting (see Chapter 09).
2. Contain — disable affected credentials or endpoints.
3. Eradicate — patch the vulnerability.
4. Recover — restore service and verify.
5. Post-mortem — document root cause and preventive measures.
