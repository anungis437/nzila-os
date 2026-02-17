# Example Output Preview — Next.js + ACA + Azure PG + Clerk

This folder demonstrates the output of the Nzila Scripts Book Template Kit
applied with the `nextjs-aca-azurepg-clerk` profile.

## Manifest

See [`scripts-book.manifest.json`](scripts-book.manifest.json) for the input configuration.

## Generated Output

The `generated/` directory contains all files produced by `sb:apply`:

- `scripts-book/` — Governance chapters with `.sh` / `.ps1` / `.py` triplet parity
- `docs/` — Deployment, governance, contributing, and security documentation
- `.github/workflows/` — CI verification and staging/production deployment workflows
- `Dockerfile.nextjs` — Multi-stage Next.js container image
- `.dockerignore` — Standard Node.js Docker ignore rules
- `scripts-book.lock.json` — Lockfile recording template version, modules, and file hashes

## Reproduce

From the template kit root:

```bash
pnpm install
pnpm build
node generator/dist/index.js apply --target examples/nextjs-aca-azurepg-clerk/generated
```

## Placeholders Resolved

| Placeholder | Value |
|---|---|
| `{{PRODUCT_NAME}}` | CourtLens |
| `{{REPO_NAME}}` | courtlens-platform |
| `{{OWNER_GITHUB}}` | anungis437 |
| `{{PRIMARY_APP_PATH}}` | apps/web |
| `{{APP_PORT}}` | 3000 |
| `{{TENANT_KEY}}` | orgId |
| `{{IMAGE_REPO}}` | courtlens-web |
| `{{AUTH_PROVIDER}}` | clerk |
| `{{DB_PROVIDER}}` | azure_postgresql |
| `{{DEPLOY_PROVIDER}}` | azure_container_apps |
| `{{STAGING_URL}}` | https://courtlens-staging.azurecontainerapps.io |
| `{{PRODUCTION_URL}}` | https://courtlens.azurecontainerapps.io |
