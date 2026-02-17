# Nzila Scripts Book Template Kit

A production-grade, auditable template kit that standardizes governance, CI/CD,
Azure Postgres, Azure Container Apps, Clerk auth, security, observability, and
Bash + PowerShell + Python parity across all Nzila repositories.

## Overview

This template repository provides:

- **Reusable template files** — scripts-book chapters, docs, CI/CD workflows, Dockerfiles
- **Generator CLI** — reads a per-repo manifest and generates content into target repos
- **Stack profiles** — pre-configured module bundles for common app types
- **Parity enforcement** — ensures every `.sh` script has a matching `.ps1` and `.py` (and vice versa)

## Quick Start

1. Clone this template repo
2. Add `scripts-book.manifest.json` to your target repo root (see [Manifest](#manifest))
3. Run the generator:

```bash
cd nzila-scripts-book-template
pnpm install
pnpm build
pnpm sb:apply -- --target ../your-repo
```

## Manifest

Every target repo needs a `scripts-book.manifest.json` at its root. Example:

```json
{
  "template_version": "1.0.0",
  "product_name": "MyApp",
  "repo_name": "myapp-platform",
  "owner_github": "your-org",
  "primary_app_path": "apps/web",
  "app_port": 3000,
  "tenant_key": "orgId",
  "image_repo": "myapp-web",
  "auth_provider": "clerk",
  "db_provider": "azure_postgresql",
  "deploy_provider": "azure_container_apps",
  "environments": {
    "staging_url": "https://myapp-staging.azurecontainerapps.io",
    "production_url": "https://myapp.azurecontainerapps.io"
  },
  "profile": "nextjs-aca-azurepg-clerk",
  "modules": [
    "core-governance",
    "repo-bootstrap",
    "monorepo-pnpm-turbo",
    "auth-clerk",
    "db-azurepg",
    "deploy-aca-oidc",
    "security-baseline",
    "observability-audit",
    "exports-compliance"
  ],
  "options": {
    "enable_ci": true,
    "enable_deploy_workflows": true,
    "enable_ai_ops": false,
    "strict_parity": true
  }
}
```

## CLI Commands

| Command | Description |
|---|---|
| `pnpm sb:validate` | Validate template integrity, parity, and markdown |
| `pnpm sb:apply -- --target <path>` | Generate scripts-book into target repo |
| `pnpm sb:apply -- --target <path> --update` | Update only unchanged generated files |
| `pnpm sb:diff -- --target <path>` | Preview changes without writing |
| `pnpm sb:doctor -- --target <path>` | Check target repo for required files and secrets docs |

## Stack Profiles

| Profile | Stack | Default Modules |
|---|---|---|
| `nextjs-aca-azurepg-clerk` | Next.js + Azure Container Apps + Azure PG + Clerk | All core modules |
| `nodeapi-aca-azurepg-clerk` | Node API + Azure Container Apps + Azure PG + Clerk | API-focused modules |
| `django-aca-azurepg` | Django + Azure Container Apps + Azure PG | Python-focused modules |

## Overrides

To customize generated content without losing updates, create override directories
in your target repo:

- `scripts-book-overrides/` — overrides for scripts-book files
- `docs-overrides/` — overrides for docs files

Override files are copied last and take precedence over generated content.

## Lockfiles

When `sb:apply` runs, it generates `scripts-book.lock.json` in the target repo.
This records:

- Template version used
- Applied modules
- Timestamp
- SHA-256 file hashes for all generated files

In `--update` mode, only files whose hashes match the lockfile are updated.
Files that have been manually edited are skipped with a warning.

## Parity Enforcement

Every `.sh` script must have a matching `.ps1` and `.py` script (same basename, same folder).
Python is a first-class scripting language in this template kit.

- With `strict_parity: true` — generation fails if any script lacks its triplet
- With `strict_parity: false` — stubs are auto-generated for missing pairs

### Script Headers

All scripts must start with strict-mode headers:

- **Bash** (`.sh`): `#!/usr/bin/env bash` + `set -euo pipefail`
- **PowerShell** (`.ps1`): `Set-StrictMode -Version Latest` + `$ErrorActionPreference = "Stop"`
- **Python** (`.py`): `#!/usr/bin/env python3` + standard imports (`sys`, `os`, `subprocess`, `pathlib`)

## Markdownlint

Template docs enforce MD032 (blank lines around lists). To run full linting:

```bash
npx markdownlint-cli2 "template/**/*.md"
```

## Upgrading

1. Pull the latest template version
2. Update `template_version` in your manifest
3. Run `pnpm sb:apply -- --target ../your-repo --update`
4. Review warnings for manually edited files
5. Commit the updated lockfile

## Repo Structure

```text
nzila-scripts-book-template/
  template/          # Reusable template files
  generator/         # TypeScript CLI tool
  profiles/          # Stack profile definitions
  modules/           # Module definitions
  examples/          # Example output
```

## License

Proprietary — Nzila internal use only.
