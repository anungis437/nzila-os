# OIDC Migration Certification (Phase 4A)

- **As of:** 2026-07-03
- **Validator:** `pnpm validate:production-deploy-authority`

## Verdict

```
OIDC READY
```

Verified via Azure CLI (2026-07-03): the production deploy identity has a
GitHub-issued, environment-scoped federated credential. Both the repo side
(OIDC-only, no `secrets.AZURE_CREDENTIALS`) and the Azure side are now proven.

## Azure-side evidence (az CLI)

- App registration `nzila-os-deploy-prod` (`5d05ed4c-****`) federated credential
  `gha-production`:
  - issuer: `https://token.actions.githubusercontent.com`
  - subject: `repo:anungis437/nzila-os:environment:production` (**environment-scoped, not wildcard**)
- Per-environment deploy identities also exist: `nzila-os-deploy-staging`,
  `nzila-os-deploy-pilot`, `nzila-os-deploy-demo`, plus `nzila-os-build` / `nzila-os-cicd`.
- No user-assigned managed identities (`az identity list` empty) — federation via App registrations.

## Repo-side evidence (unchanged from Phase 4A)

- Removed the `creds: ${{ secrets.AZURE_CREDENTIALS }}` fallback step from
  `deploy-web.yml`, `deploy-console.yml`, `deploy-partners.yml`,
  `retire-legacy-union-eyes-ca.yml`.
- Replaced each with a **fail-closed guard**: if
  `AZURE_CLIENT_ID`/`AZURE_TENANT_ID`/`AZURE_SUBSCRIPTION_ID` are unset the job
  now `exit 1`s instead of silently using a long-lived credential.

## Repo-provable OIDC posture (PASS)

- All deploy workflows declare `permissions: id-token: write`.
- All use `azure/login@v3` with `client-id` (federated), not `creds`.
- No `secrets.AZURE_CREDENTIALS` usage remains in `.github/workflows`.
- `gitops-deploy`, `deploy-union-eyes`, `deploy-staging`, `br5-proof-deploy-staging`
  bind jobs to GitHub Environments so `azure/login` resolves per-environment,
  environment-scoped federated identities.

## EXTERNAL VERIFICATION REQUIRED (cannot be proven from the repo)

- Azure AD federated credential entries exist for each GitHub Environment subject
  (`repo:anungis437/nzila-os:environment:<env>`), audience `api://AzureADTokenExchange`.
- Each identity is least-privilege (AcrPull/AcrPush + Contributor on its own RG only).
- Production GitHub Environment has required reviewers / protection rules.
- The `AZURE_CREDENTIALS` secret should now be **deleted** from the repo/org since
  no workflow consumes it (retain only if an audited external rollback demands it).

## OIDC subject/audience expectations (documented)

- Subject: `repo:anungis437/nzila-os:environment:{production|staging|demo|pilot|build}`
- Audience: `api://AzureADTokenExchange`
- Token: GitHub OIDC via `id-token: write`.
