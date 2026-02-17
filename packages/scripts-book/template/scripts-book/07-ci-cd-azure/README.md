# Chapter 07 — CI/CD ({{DEPLOY_PROVIDER}})

This chapter documents the continuous integration and deployment pipelines for
**{{PRODUCT_NAME}}**.

## Pipeline overview

```
Push / PR
  └─ CI ─────────────────────────────────────┐
       ├── Lint + Typecheck                  │
       ├── Unit + Integration tests          │
       ├── E2E tests (Playwright)            │
       ├── Build Docker image                │
       └── Security scan (CodeQL / Trivy)    │
                                             ▼
  └─ CD (on main merge) ────────────────────┐
       ├── Push image → {{IMAGE_REPO}}       │
       ├── Deploy to staging ({{STAGING_URL}})│
       ├── Smoke tests against staging       │
       └── Promote to prod ({{PRODUCTION_URL}})
```

## Authentication

CI authenticates to {{DEPLOY_PROVIDER}} using **OIDC federation** — no
long-lived credentials are stored in the repository. The GitHub Actions
workflow exchanges a short-lived OIDC token for cloud credentials at runtime.

## Environments

| Environment | URL                  | Trigger                |
| ----------- | -------------------- | ---------------------- |
| Staging     | {{STAGING_URL}}      | Push to `main`         |
| Production  | {{PRODUCTION_URL}}   | Manual approval / tag  |

## Image registry

Docker images are pushed to **{{IMAGE_REPO}}**. Images are tagged with the
Git SHA and `latest` for the most recent successful build.

## Deployment strategy

- **Staging** — Automatic deploy on every merge to `main`.
- **Production** — Blue-green deployment triggered by a manual workflow dispatch or a Git tag matching `v*`.

## Rollback

To roll back production:

1. Identify the last known-good image tag in {{IMAGE_REPO}}.
2. Re-run the deploy workflow with that tag.
3. Verify health checks at {{PRODUCTION_URL}}/api/health.

## Secrets management

All secrets are stored in the GitHub repository environment secrets and
injected at deploy time. Never commit secrets to source control.
