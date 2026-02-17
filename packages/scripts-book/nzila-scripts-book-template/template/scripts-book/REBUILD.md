# Rebuilding the Scripts-Book from Template

This document explains how to regenerate or update the scripts-book using the
template system.

## Template version

This scripts-book was generated from **nzila-scripts-book-template v1.0.0**.

## When to rebuild

- After upgrading the template to a new version.
- When onboarding a new product that needs its own scripts-book.
- After changing placeholder values in the configuration file.

## Prerequisites

- Node.js ≥ 18
- The `nzila-scripts-book-template` repository cloned locally.

## Configuration

Create a `scripts-book.config.json` in the target repository root with your
placeholder values:

```json
{
  "PRODUCT_NAME": "My Product",
  "REPO_NAME": "my-org/my-repo",
  "OWNER_GITHUB": "my-org",
  "AUTH_PROVIDER": "Clerk",
  "DB_PROVIDER": "Azure Database for PostgreSQL",
  "DEPLOY_PROVIDER": "Azure",
  "IMAGE_REPO": "myregistry.azurecr.io/my-repo",
  "STAGING_URL": "https://staging.example.com",
  "PRODUCTION_URL": "https://app.example.com",
  "PRIMARY_APP_PATH": "app",
  "APP_PORT": "3000",
  "TENANT_KEY": "organization_id"
}
```

## Generator commands

```bash
# Generate a fresh scripts-book from the template
npx nzila-generate-scripts-book \
  --template ./nzila-scripts-book-template/template \
  --config   ./scripts-book.config.json \
  --output   ./scripts-book

# Preview without writing files
npx nzila-generate-scripts-book \
  --template ./nzila-scripts-book-template/template \
  --config   ./scripts-book.config.json \
  --dry-run
```

## Post-generation checklist

1. Review generated files for accuracy.
2. Run the parity check to verify .sh/.ps1 pairs:

   ```bash
   ./scripts-book/01-repo-bootstrap/parity-check.sh
   ```

3. Commit the generated scripts-book to the target repository.
4. Update the `scripts-book.config.json` version field if applicable.

## Customization

After generation, you may add project-specific content to any chapter.
Custom additions should be placed **below** the generated content so that
future regenerations can merge cleanly.

## Updating

To update an existing scripts-book after a template upgrade:

1. Pull the latest template version.
2. Re-run the generator with `--output ./scripts-book`.
3. Review the diff and resolve any conflicts with custom additions.
4. Commit the updated scripts-book.
