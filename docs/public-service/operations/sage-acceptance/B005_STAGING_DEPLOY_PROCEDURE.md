# B-005 — SAGE-enabled staging deploy / parity procedure

> **Human-runbook.** Do not mark B-005 closed until every verification step passes.  
> This document does **not** claim a deploy has succeeded.  
> Investigation date context: main tip was `ff989637…`; staging-admin health was Unavailable; `az` was not available in the agent environment.

## Goal

Close **B-005**: deploy a SAGE-enabled `platform-admin` revision to an **isolated staging** plane with migrations applied, then prove commit SHA parity and `sage_%` tables exist.

## Preconditions

1. Azure CLI authenticated to subscription **Nzila** with staging-scoped rights (`nzila-canada-staging-rg` / `nzila-staging-rg` as applicable).
2. GitHub Environment **staging** OIDC configured (BR-4); never use prod credentials.
3. Working copy of `anungis437/nzila-os` at the intended SHA (prefer current `main` or a release tag that contains `packages/sage-core` + `apps/platform-admin/app/sage` + `migrations/0032`–`0044`).
4. Confirm you are **not** writing to production RGs (`nzila-canada-prod-rg`).

## A. Record current live state (before)

```bash
# Identity
az account show --query '{name:name,id:id}' -o json

# Container app revision + image
az containerapp show \
  -g nzila-canada-staging-rg \
  -n nzila-os-platform-admin \
  --query '{fqdn:properties.configuration.ingress.fqdn,image:properties.template.containers[0].image,revisions:properties.latestRevisionName}' -o json

# Optional: list revisions
az containerapp revision list -g nzila-canada-staging-rg -n nzila-os-platform-admin -o table
```

Probe health (expect JSON with `buildInfo.commit` when healthy):

```bash
curl -sS "https://staging-admin.nzilaventures.com/api/health" | jq .
# fallback FQDN from az output:
# curl -sS "https://<fqdn>/api/health" | jq .
```

Record `BEFORE_IMAGE` and `BEFORE_COMMIT` in the proof-run notes.

## B. Database inventory (before)

Prefer an **isolated** staging database for SAGE proofs. If using shared `nzila-staging-db`, open a **temporary** firewall rule for your IP only, run read-only inventory, remove the rule immediately:

```sql
SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_name LIKE 'sage_%'
ORDER BY 1, 2;
```

Expectation before remediation (historical): **0 rows**.

## C. Apply SAGE migrations (isolated data plane)

Root migrations (authoritative for SAGE):

- `migrations/0032_sage_phase_1_access_domain_lock.sql` … through …
- `migrations/0044_sage_phase_8b_destruction_attempts.sql`

Apply with the project’s approved migration executor for the target DB (do **not** invent a new path). If the shared staging DB has no applier for root `migrations/*.sql`, provision an isolated Postgres and document the applier command used.

After apply, re-run the `sage_%` inventory; expect tables present.

## D. Deploy platform-admin with SAGE composition

Preferred (repo workflows — pick the live canonical path):

1. **GitOps matrix** includes `platform-admin`: `.github/workflows/gitops-deploy.yml`
2. **Manual staging** (if re-enabled): `.github/workflows/deploy-staging.yml` with apps including `platform-admin`  
   Note: Actions metadata previously showed `deploy-staging.yml` as `disabled_manually` — confirm current state in the Actions UI before relying on it.

Example dispatch (adjust to current workflow inputs):

```bash
gh workflow run gitops-deploy.yml --ref <branch-or-main-sha>
# or, if deploy-staging is enabled:
gh workflow run deploy-staging.yml --ref <sha> -f apps=platform-admin
```

Ensure container env includes SAGE operational composition required by `apps/platform-admin/lib/sage/runtime.ts` (DB URL, audit sink, delivery/notifier secrets from Key Vault — **do not print secrets**).

Watch the run:

```bash
gh run list --workflow gitops-deploy.yml --limit 5
gh run watch <run_id>
```

## E. Verify SHA / health (after)

```bash
curl -sS "https://staging-admin.nzilaventures.com/api/health" | jq '{status, app, buildInfo, checks, timestamp}'
```

Pass criteria:

- HTTP 200 JSON (not Azure “Unavailable” HTML)
- `buildInfo.commit` equals the deployed git SHA (or documented image digest pinned to that SHA)
- `checks.db` is `ok`

Also confirm routes exist (authenticated session as needed):

- `/sage` operator UI
- `/api/sage/...` handlers respond (not 404 from missing build)

```bash
az containerapp show \
  -g nzila-canada-staging-rg \
  -n nzila-os-platform-admin \
  --query 'properties.template.containers[0].image' -o tsv
```

## F. Minimal live smoke (still not full GO)

After B-005 deploy only:

1. Create draft workspace in staging (human)
2. Register one **fictional** internal evidence source
3. Confirm incoming-style principal without sensitive grant cannot read sensitive fixture
4. Confirm audit event emitted for material action

Full **G12/G13/G11 manual** remain separate blockers (B-001…B-004).

## G. Evidence to file when closing B-005

- Workflow run URL + run id
- Image digest / revision name
- `/api/health` JSON (`buildInfo.commit`)
- `sage_%` table list (names only)
- Statement that prod RG was not modified

Then update / open proof-run evidence (e.g. 006) — do not silently edit 005 history.

## Explicit non-claims

- Running this checklist in a laptop without Azure auth does **not** close B-005.
- Union Eyes deploy success ≠ platform-admin SAGE deploy.
