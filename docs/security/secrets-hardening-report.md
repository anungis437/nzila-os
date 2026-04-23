# Secrets Hardening Report

Date: 2026-04-22  
Scope: Docker build chain, GitHub Actions, Azure Container Apps runtime configuration, env templates, and CI exposure risks.

## Executive Summary

Status: Hardening pass completed for the primary exposure path.  
Main risk removed: runtime auth secrets were being passed as Docker build args in deployment workflows.

## Audit Findings

### Finding 1: Runtime secret passed at build time

Severity: High  
Evidence:
- `.github/workflows/gitops-deploy.yml` previously added `--build-arg AUTH_SECRET=${{ secrets.AUTH_SECRET }}`.
- `.github/workflows/deploy-web.yml` previously added `--build-arg AUTH_SECRET=${{ secrets.AUTH_SECRET }}`.
- Root `Dockerfile` declared `ARG AUTH_SECRET`.

Risk:
- Build args can leak via builder metadata, logs, or accidental debug output.
- Violates runtime-only secret injection principle.

Fix implemented:
- Replaced secret build arg flow with non-sensitive placeholder build arg `BUILD_AUTH_PLACEHOLDER`.
- Updated root `Dockerfile` to remove `ARG AUTH_SECRET` and consume `BUILD_AUTH_PLACEHOLDER` only for build-time requirements.
- Updated both workflows to stop reading/propagating runtime auth secret into docker build.

Changed files:
- `Dockerfile`
- `.github/workflows/gitops-deploy.yml`
- `.github/workflows/deploy-web.yml`

### Finding 2: Azure login still uses `AZURE_CREDENTIALS` secret blob

Severity: Medium  
Evidence:
- Workflows use `azure/login@v3` with `creds: ${{ secrets.AZURE_CREDENTIALS }}`.

Risk:
- Long-lived JSON credential remains a privileged secret.

Current state:
- OIDC-first login path is now implemented in `gitops-deploy.yml`, `deploy-web.yml`, `deploy-console.yml`, `deploy-partners.yml`, and `deploy-union-eyes.yml`.
- Credential-json auth remains as explicit fallback when OIDC secrets are not configured.

Next hardening target:
- Remove `AZURE_CREDENTIALS` fallback once OIDC variables are present in all required environments.
- Enforce OIDC-only policy on protected branches/environments.

### Finding 3: Runtime secret references in ACA are present but not universal

Severity: Medium  
Evidence:
- Staging Container Apps show secret stores configured (`secrets` count > 0 per app).
- Existing pattern includes `secretref:` usage (e.g., `SENTRY_DSN=secretref:sentry-dsn`).

Risk:
- Inconsistent secretref adoption can leave plain env var drift across apps.

Action:
- Keep runtime-only posture and standardize all sensitive variables to `secretref:` in app-by-app rollout.

### Finding 4: Local plaintext `.env` with real-looking values exists (untracked)

Severity: Medium  
Evidence:
- `.env` contains API key-like values.
- `git ls-files` confirms `.env` is not tracked; `.env.example` is tracked.

Risk:
- Local compromise risk; accidental copy/paste risk.

Action:
- Keep `.env` untracked.
- Rotate any real credentials that were ever placed in local `.env`.
- Continue using `.env.example` with blanks/placeholders only.

## Implemented Controls

1. Runtime-only secret principle enforced in build workflows.
2. Removed secret-named Docker build arg (`AUTH_SECRET`) from Dockerfile.
3. Build now uses explicit non-sensitive placeholder value for build-time auth checks.
4. Preserved runtime secret injection via Container Apps secret references.
5. Added OIDC-first Azure authentication path in primary and emergency deploy workflows.
6. Added CI policy gate to fail on sensitive Docker ARG/ENV and workflow `--build-arg` names.

## Validation Checklist (Completed)

- Secret build arg removed from deployment workflows: Yes.
- Dockerfile no longer declares `ARG AUTH_SECRET`: Yes.
- Runtime apps still healthy after hardening edits: Yes (previous health checks remain green).
- Internal apps remain `noindex` hardened: Yes (from prior pass).

## Remaining Honest Risks

1. OIDC fallback still allows long-lived `AZURE_CREDENTIALS` where OIDC env variables are absent.
2. Inconsistent `secretref:` standardization across all ACA env vars.
3. Local developer secret hygiene depends on endpoint controls and rotation discipline.

## Recommended Next 7-Day Actions

1. Remove `AZURE_CREDENTIALS` fallback from deploy workflows after OIDC rollout validation.
2. Standardize secret material in ACA to `secretref:` for all apps and sensitive keys.
3. Keep CI Docker secret policy gate required on `main` and release branches.
4. Add pre-commit guard for accidental high-entropy secrets in tracked files.
