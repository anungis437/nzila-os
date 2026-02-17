# {{PRODUCT_NAME}} — Deployment Guide

This document describes the OIDC-based deployment pipeline for
{{PRODUCT_NAME}} targeting {{DEPLOY_PROVIDER}} (Azure Container Apps).

## Prerequisites

Before deploying, ensure the following are in place:

- An active Azure subscription with Container Apps enabled
- An Azure Container Registry (ACR) instance for storing images
- OIDC federation configured between GitHub Actions and Azure AD
- The Azure CLI installed locally for manual operations

## Secrets Contract

The following GitHub Actions secrets **must** be configured at the repository
or environment level:

| Secret | Description |
|---|---|
| `AZURE_CLIENT_ID` | Azure AD application (client) ID for OIDC |
| `AZURE_TENANT_ID` | Azure AD tenant ID |
| `AZURE_SUBSCRIPTION_ID` | Target Azure subscription ID |
| `AZURE_ACR_IMAGE_REPO` | Full ACR image repository path (e.g. `{{IMAGE_REPO}}`) |

## Staging Deployment

Staging deployments are triggered automatically on every push to the `main`
branch.

1. The CI workflow builds and tags the Docker image with the commit SHA.
2. The image is pushed to ACR at `{{IMAGE_REPO}}:sha-<commit>`.
3. The Azure Container App revision is updated to use the new image.
4. Smoke tests run against `{{STAGING_URL}}`.

## Production Deployment

Production deployments are triggered when a tag matching `v*` is pushed.

1. The CI workflow builds and tags the Docker image with the release version.
2. The image is pushed to ACR at `{{IMAGE_REPO}}:<tag>`.
3. The Azure Container App production revision is updated.
4. Health checks validate the deployment at `{{PRODUCTION_URL}}`.

## Rollback Procedure

If a deployment causes issues, roll back with the following steps:

1. Identify the last known-good revision in the Azure Portal or via CLI.
2. Run the rollback command:

   ```bash
   az containerapp revision activate \
     --name {{PRODUCT_NAME}} \
     --resource-group <resource-group> \
     --revision <previous-revision>
   ```

3. Verify the rollback at the appropriate URL (`{{STAGING_URL}}` or `{{PRODUCTION_URL}}`).
4. Investigate the root cause before re-deploying.
