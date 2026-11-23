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

Preferred machine receipt (read-only; `b005Closure` stays `NOT_PROVEN`):

```bash
# Requires Azure CLI + `az login` to the Nzila subscription (staging-scoped).
# If `az` is missing, install via Microsoft's package feed (Azure MCP
# `extension_cli_install` / aka.ms/InstallAzureCLIDeb) before continuing.
node tooling/scripts/sage-b005-azure-revision-inspect.mjs \
  --out reports/proof-runs/sage-b005-azure-revision-before.json \
  --resource-group nzila-canada-staging-rg \
  --app-name nzila-os-platform-admin \
  --include-system-logs
```

Equivalent manual control-plane queries (same fields the script records):

```bash
# Identity
az account show --query '{name:name,id:id}' -o json

# Container app revision + image
az containerapp show \
  -g nzila-canada-staging-rg \
  -n nzila-os-platform-admin \
  --query '{fqdn:properties.configuration.ingress.fqdn,image:properties.template.containers[0].image,latestRevisionName:properties.latestRevisionName,targetPort:properties.configuration.ingress.targetPort}' -o json

# Optional: list revisions
az containerapp revision list -g nzila-canada-staging-rg -n nzila-os-platform-admin -o table

# Optional: system logs when image pull / revision creation fails
az containerapp logs show -g nzila-canada-staging-rg -n nzila-os-platform-admin --type system --tail 50
```

Probe health (expect JSON with `buildInfo.commit` when healthy):

```bash
curl -sS "https://staging-admin.nzilaventures.com/api/health" | jq .
# fallback FQDN from az / inspect receipt:
# curl -sS "https://<fqdn>/api/health" | jq .
```

Record `BEFORE_IMAGE`, `BEFORE_REVISION`, and `BEFORE_COMMIT` in the proof-run notes.
A data-plane health timeout alone is **not** a control-plane outage attestation.

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
- Later Union Eyes root migrations may occupy `0045`–`0049` on the same track
  (not `*_sage_*`; the SAGE applier skips them by filename).
- **Required institutional tail for B-005:**
  - `0050_sage_institutional_mandate_authority.sql` — mandate / commitment / action ledger
  - `0051_sage_institutional_capacity_recusal.sql` — office holdings + conflict attestations
  - `0052_sage_accountability_adoption.sql` — CLEAR adoption ledger + fingerprint

Offline checksum + apply tooling (does **not** close B-005):

```bash
node tooling/scripts/sage-b005-build-provenance.mjs \
  --git-sha "$(git rev-parse HEAD)" \
  --out reports/proof-runs/sage-b005-build-provenance.json \
  [--expected-image-digest sha256:…]
node tooling/scripts/sage-b005-migration-preflight.mjs verify
node tooling/scripts/sage-b005-migration-preflight.mjs apply --url "$SAGE_PG_TEST_URL"
node tooling/scripts/sage-b005-migration-preflight.mjs receipt --out reports/proof-runs/sage-b005-migration.json
```

Before apply, record local checksums for the exact SHA being deployed:

```bash
git rev-parse HEAD
pnpm verify:migrations
node -e "import('./tooling/scripts/lib/sage-migration-chain.mjs').then(m=>console.log(JSON.stringify(m.verifySageMigrationChain(),null,2)))" \
  | tee /tmp/sage-migration-checksums.json
```

Apply with the project’s approved migration executor for the target DB
(`node tooling/scripts/sage-b005-migration-preflight.mjs apply` for isolated
Postgres). If the shared staging DB has no applier for root `migrations/*.sql`,
provision an isolated Postgres and document the applier command used.

After apply:

1. Re-run the `sage_%` inventory; expect tables present including
   `sage_institutional_mandate`, `sage_institutional_office_holding`,
   `sage_institutional_conflict_attestation`, `sage_accountability_adoption`.
2. Apply `fixtures/sage-b005-institutional/rls-roles.sql` then `bootstrap.sql`
   (fictional identities only).
3. Env/secrets name inventory: `B005_ENV_SECRETS_INVENTORY.md`.

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

1. Anonymous preflight (read-only; never closes B-005):

```bash
node tooling/scripts/sage-staging-http-preflight.mjs \
  --base https://staging-admin.nzilaventures.com/ \
  --expected-sha <40-char-sha> \
  --receipt reports/proof-runs/sage-b005-http-preflight.json
```

2. Authenticated HTTP smoke (requires staging session cookie for a **fictional** identity):

```bash
export SAGE_B005_BASE_URL=https://staging-admin.nzilaventures.com/
export SAGE_B005_SESSION_COOKIE='…'
export SAGE_B005_EXPECTED_SHA=<40-char-sha>
node tooling/scripts/sage-b005-authenticated-http-smoke.mjs \
  --receipt reports/proof-runs/sage-b005-auth-smoke.json
```

3. Create draft workspace in staging (human)
4. Register one **fictional** internal evidence source
5. Confirm incoming-style principal without sensitive grant cannot read sensitive fixture
6. Confirm audit event emitted for material action

Compose the machine-readable qualification receipt (still `b005Closure: NOT_PROVEN` until staging proofs complete):

```bash
node tooling/scripts/sage-b005-qualification-receipt.mjs \
  --git-sha <40-char-sha> \
  --out reports/proof-runs/sage-b005-qualification.json \
  --migration-receipt reports/proof-runs/sage-b005-migration.json \
  --http-preflight reports/proof-runs/sage-b005-http-preflight.json \
  --auth-smoke reports/proof-runs/sage-b005-auth-smoke.json \
  --restore-harness reports/proof-runs/sage-b005-restore.json
```

Full **G12/G13/G11 manual** remain separate blockers (B-001…B-004). Local restore harness:

```bash
node tooling/scripts/sage-b005-restore-harness.mjs \
  --receipt reports/proof-runs/sage-b005-restore.json
```

## G. Evidence to file when closing B-005

- Workflow run URL + run id
- Image digest / revision name
- `/api/health` JSON (`buildInfo.commit`)
- `sage_%` table list (names only)
- Migration preflight + authenticated smoke + qualification receipts
- Statement that prod RG was not modified

Then update / open proof-run evidence (e.g. 006) — do not silently edit 005 history.

## Explicit non-claims

- Running this checklist in a laptop without Azure auth does **not** close B-005.
- Anonymous HTTP preflight does **not** prove authenticated institutional routes.
- Union Eyes deploy success ≠ platform-admin SAGE deploy.
- `b005Closure` remains `NOT_PROVEN` until every staging acceptance criterion in the Wave 2 mandate is evidenced.
