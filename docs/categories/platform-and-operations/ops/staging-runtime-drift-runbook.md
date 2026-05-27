# Staging Runtime Drift Runbook

**Owner**: Platform Engineering  
**Scope**: Nzila OS — Canada Central Staging (`nzila-canada-staging-rg`)  
**Last updated**: see git blame

---

## What is Staging Drift?

Staging drift is any condition where the running staging environment does not truthfully represent the current state of the `main` branch. Drift is dangerous because it makes staging results non-deterministic and invalidates promotion confidence.

### Categories of drift

| Category | Meaning | Impact |
|---|---|---|
| **Version drift** | Running container has a different git SHA than HEAD | Smoke green ≠ current code tested |
| **Env drift** | Container App is missing required env vars | App crashes or degrades silently |
| **Partial deployment** | Some apps updated, others stale | Cross-app integration tests invalid |
| **Artifact drift** | Image built from different commit than deployed | Image tag matches SHA but content doesn't |
| **Config drift** | `staging.yml` diverges from live Container App config | Declared intent ≠ reality |

---

## Drift Detection Commands

```bash
# Check which apps have stale image SHAs vs HEAD
pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr

# Check which apps have missing/deprecated env vars (static staging.yml)
pnpm exec tsx scripts/release/drift-env.ts --env staging

# Same but queries live Container Apps (requires az login)
pnpm exec tsx scripts/release/drift-env.ts --env staging --live

# Full drift check + smoke
pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr; pnpm exec tsx scripts/release/drift-env.ts --env staging; pnpm exec tsx scripts/release/run-smoke.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr

# Generate reconcile plan (dry run)
pnpm exec tsx scripts/release/staging-reconcile.ts --env staging

# Execute reconcile plan (requires az login)
pnpm exec tsx scripts/release/staging-reconcile.ts --env staging --execute

# Build evidence pack (reads latest drift/smoke reports)
pnpm exec tsx scripts/release/build-deploy-evidence.ts --env staging
```

Reports are written to:

- `ops/drift/version-drift-staging-latest.json`
- `ops/drift/env-drift-staging-latest.json`
- `ops/smoke/smoke-staging-latest.json`
- `ops/reconcile/staging-reconcile-plan-latest.json`
- `ops/evidence/deploy-evidence-latest.json`
- `ops/evidence/deploy-evidence-ledger.json` (append-only, last 50 deploys)

---

## Console 500 Diagnosis

The `nzila-os-console` Container App returning 500 on all routes is a known
failure mode. Diagnosis steps:

### Step 1: Check if it's a stale container

```bash
# Check what SHA the running container reports
curl -sf https://nzila-os-console.jollydune-88c1e97f.canadacentral.azurecontainerapps.io/api/version

# Compare with HEAD
git rev-parse HEAD
```

If `/api/version` returns `gitSha: "local"` or a short SHA that doesn't match HEAD,
the container is running an old build that predates the `/api/version` endpoint.
**Resolution**: trigger a redeploy via `gitops-deploy.yml` or run `pnpm exec tsx scripts/release/staging-reconcile.ts --env staging --execute`.

### Step 2: Check AZ Container App logs

```bash
az containerapp logs show \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --tail 100

# Follow live logs
az containerapp logs show \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --follow
```

Look for:

- `Error: Missing required environment variable`
- `Error: connect ECONNREFUSED` (DATABASE_URL not reachable)
- `TypeError: Cannot read properties of undefined` (missing module initialization)
- Clerk-related errors (should be gone after platform-auth migration; if present, container is very stale)

### Step 3: Check missing env vars

```bash
# List all env vars on the Container App (shows secret refs but not values)
az containerapp show \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --query "properties.template.containers[0].env"
```

Required vars for `console`:

- `NODE_ENV` — should be `production`
- `NEXT_PUBLIC_APP_ENV` — should be `staging`
- `AUTH_SECRET` — must be a secretRef
- `AZURE_AD_CLIENT_ID` — must be a secretRef
- `AZURE_AD_CLIENT_SECRET` — must be a secretRef
- `AZURE_AD_TENANT_ID` — must be a secretRef
- `DATABASE_URL` — must be a secretRef
- `AZURE_STORAGE_CONNECTION_STRING` — optional secretRef

If any are missing, add them:

```bash
# Add/update env vars (upsert — preserves existing)
az containerapp update \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --set-env-vars NODE_ENV=production NEXT_PUBLIC_APP_ENV=staging

# Add a secret ref
az containerapp secret set \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --secrets "database-url=<connection-string>"

az containerapp update \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --set-env-vars "DATABASE_URL=secretref:database-url"
```

### Step 4: Force redeploy with current HEAD

```bash
# Get ACR image tag from the latest version-drift report
cat ops/drift/version-drift-staging-latest.json | jq '.apps[] | select(.app == "console")'

# Manually trigger deploy via GitHub CLI
gh workflow run gitops-deploy.yml --field apps=console

# Or use the az CLI directly with HEAD SHA
HEAD_SHA=$(git rev-parse HEAD)
az containerapp update \
  --name nzila-os-console \
  --resource-group nzila-canada-staging-rg \
  --image nzilacanadaacr.azurecr.io/nzila/console:${HEAD_SHA}
```

---

## Partial Deployment Recovery

When only some apps were updated (partial deploy due to build failures or
workflow failures), use the reconcile command:

```bash
# See which apps are stale
pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr

# Generate reconcile plan
pnpm exec tsx scripts/release/staging-reconcile.ts --env staging

# Review plan in ops/reconcile/staging-reconcile-plan-latest.json
# then execute
pnpm exec tsx scripts/release/staging-reconcile.ts --env staging --execute
```

The reconcile command only updates apps that are actually stale — it does NOT
redeploy apps that are already current.

---

## Full Staging Reset

Use when staging is in an irrecoverable state (multiple failing apps, conflicting
images, env vars corrupted):

```bash
# 1. Verify the problem
pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr; pnpm exec tsx scripts/release/drift-env.ts --env staging; pnpm exec tsx scripts/release/run-smoke.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr

# 2. Rebuild ALL images from HEAD and push to ACR
# Trigger the deploy workflow for all apps:
gh workflow run gitops-deploy.yml \
  --field apps=web,console,partners,union-eyes,cfo,flow,abr

# 3. Wait for workflow to complete (~15-20 min)
gh run list --workflow=gitops-deploy.yml --limit=5

# 4. Post-reset verification
pnpm exec tsx scripts/release/drift-version.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr
pnpm exec tsx scripts/release/run-smoke.ts --env staging --apps web,console,partners,union-eyes,cfo,flow,abr
```

---

## Version Truth Enforcement

The `/api/version` endpoint on each app returns the baked-in `GITHUB_SHA` from
build time. This is how we verify staging truthfulness.

```json
{
  "status": "ok",
  "environment": "staging",
  "gitSha": "a1b2c3d4e5f6...",
  "buildTimestamp": "2025-06-01T12:00:00Z",
  "artifactId": "a1b2c3d4-console"
}
```

If `gitSha` is `"local"`, the container was built without the `GITHUB_SHA` build
arg (old Dockerfile) and drift detection cannot determine staleness. Trigger a
fresh deploy to fix.

If `gitSha` is a short prefix that matches HEAD SHA, the app is current.

---

## Drift Score Interpretation

| Version Drift Score | Meaning |
|---|---|
| 100% | All apps running current HEAD — staging trustworthy |
| 70–99% | Partial drift — 1-2 apps stale, integrations may be invalid |
| < 70% | Severe drift — staging results unreliable, do NOT promote |

| Env Drift Score | Meaning |
|---|---|
| 100% | All required vars declared — no config gaps |
| 80–99% | Optional vars missing — low risk |
| < 80% | Required vars missing — app will likely crash or return 500 |

---

## Alerting and Promotion Gates

The `gitops-deploy.yml` workflow:

1. Fails hard if **any** app fails to deploy (exits 1 — no silent partial failures)
2. Probes canonical health endpoints from `governance/release/deployment-inventory.json` (not `/`)
3. Runs full smoke (`run-smoke.ts`) post-deploy
4. Runs version drift check post-deploy and uploads as artifact
5. Generates deployment evidence pack and uploads as artifact

A deployment is only considered **promotion-ready** when:

- ✅ All required apps return 200 on canonical health endpoint
- ✅ All required apps return 200 on canonical ready endpoint
- ✅ `drift:version:staging` score = 100%
- ✅ `drift:env:staging` reports no blocking gaps
- ✅ Deployment evidence pack shows `promotionVerdict: "ready"`

---

## Azure Portal Quick Links

- [Container Apps (staging)](https://portal.azure.com/#resource/subscriptions/<subscription>/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.App/managedEnvironments/nzila-canada-staging-env)
- [ACR (nzilacanadaacr)](https://portal.azure.com/#resource/subscriptions/<subscription>/resourceGroups/nzila-canada-staging-rg/providers/Microsoft.ContainerRegistry/registries/nzilacanadaacr)
- [Log Analytics](https://portal.azure.com/#resource/subscriptions/<subscription>/resourceGroups/nzila-staging-rg/providers/Microsoft.OperationalInsights/workspaces)

---

## Escalation

| Issue | Owner |
|---|---|
| Persistent 500 after fresh deploy | Platform Engineering |
| DATABASE_URL / secret missing | Infrastructure / DevSecOps |
| ACR push failure | CI/CD |
| Container App crashes at startup | App team (check BUILD logs + runtime logs) |
| `latest` tag ambiguity in ACR | Platform Engineering (see gitops-deploy.yml hardening) |
