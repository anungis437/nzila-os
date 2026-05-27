# Runtime Proof Machinery

> **What is this?** A typed, scored, gate-aware, buyer-exportable runtime evidence system for the Nzila OS platform. It collects signals from releases, CI, Azure Container Apps, health endpoints, drift reports, restore drills, and security scans — then produces a single composite proof document with a grade (A–F) that can be shown to operators, buyers, or auditors.

---

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Scoring Dimensions](#scoring-dimensions)
3. [Grade Thresholds](#grade-thresholds)
4. [Bootstrap Cap](#bootstrap-cap)
5. [Script Reference](#script-reference)
6. [Output Files](#output-files)
7. [Dashboard](#dashboard)
8. [CI Gate](#ci-gate)
9. [Export for Buyers](#export-for-buyers)
10. [Resolving Common Findings](#resolving-common-findings)

---

## Architecture Overview

```
Ingestion layer                 Proof layer              Delivery layer
──────────────                  ───────────              ───────────────
validate-release-ledger.ts  ─┐
ingest-github-actions.ts    ─┤  generate-runtime-       runtime-proof-gate.ts  (CI)
ingest-azure-runtime.ts     ─┤  proof.ts (V2 schema)  → export-runtime-proof.ts (buyer)
check-health.ts             ─┤                           control-plane dashboard
collect-security-proof.ts   ─┘
```

All scripts live under `scripts/proof/` and can be invoked directly via `pnpm exec tsx`.

---

## Scoring Dimensions

Total weight: **100 points**

| Dimension | Weight | What earns full points |
|-----------|-------:|------------------------|
| `release` | 20 | `release-ledger.jsonl` has ≥1 signed entry in the current period |
| `deploy` | 20 | Azure Container Apps deployment in CI runs JSONL for this period |
| `health` | 15 | `health-latest.json` shows all endpoints healthy |
| `drift` | 15 | `drift-{period}.json` exists and has `status: "clean"` |
| `restore` | 10 | `restore-drill-{period}.json` exists; freshness scoring: <90 d → 10 pts, 90–180 d → 6 pts, >180 d → 3 pts, none → 0 pts |
| `security` | 10 | `security-proof-latest.json` shows no critical/high findings unwaived |
| `seal` | 10 | `proof-artifacts/evidence-packs/{period}/snapshot.json` present |

### Per-dimension status

- **0 pts earned** + dimension is `release` or `deploy` → **blocking finding** → blocks production gate
- **0 pts earned** on any other dimension → **advisory finding** (does not block gate but lowers score)
- **Partial points** → advisory finding with context

---

## Grade Thresholds

| Grade | Minimum Score |
|-------|--------------|
| A | 90 |
| B | 75 |
| C | 60 |
| D | 45 |
| F | < 45 |

---

## Bootstrap Cap

When one or more dimensions use **bootstrap evidence** (synthetic, simulated, or placeholder data), the proof system applies a cap:

- A grade becomes **B** — you cannot earn an A with bootstrap sources.
- Lower grades are unaffected.

The `bootstrapSources` array in the proof document lists the affected dimensions. Resolve by replacing bootstrap evidence with real instrumented signals.

---

## Script Reference

### `pnpm exec tsx scripts/proof/validate-release-ledger.ts`

```bash
# Validates release-ledger.jsonl schema + signatures
tsx scripts/proof/validate-release-ledger.ts
```

**Inputs:** `reports/releases/release-ledger.jsonl`  
**Outputs:** Console report (exit 1 on invalid entries)

---

### `pnpm exec tsx scripts/proof/ingest-github-actions.ts`

```bash
tsx scripts/proof/ingest-github-actions.ts
```

**Inputs:** GitHub Actions API (requires `GITHUB_TOKEN`)  
**Outputs:** `reports/runtime/ci-runs.jsonl`

---

### `pnpm exec tsx scripts/proof/ingest-azure-runtime.ts`

```bash
tsx scripts/proof/ingest-azure-runtime.ts
```

**Inputs:** Azure Container Apps API (requires `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_TENANT_ID`, `AZURE_CLIENT_ID`, `AZURE_CLIENT_SECRET` or `az login`)  
**Outputs:** `reports/runtime/azure-runtime-latest.json`

---

### `pnpm exec tsx scripts/proof/check-health.ts`

```bash
tsx scripts/proof/check-health.ts
```

**Inputs:** `scripts/proof/health-config.json` (list of endpoints + expected status)  
**Outputs:** `reports/runtime/health-latest.json`

Configure endpoints in `health-config.json`:

```json
{
  "endpoints": [
    { "name": "web", "url": "https://web.example.com/api/health", "expectedStatus": 200 },
    { "name": "console", "url": "https://console.example.com/api/health", "expectedStatus": 200 }
  ]
}
```

---

### `pnpm exec tsx scripts/proof/run-proof.tstime`

```bash
tsx scripts/proof/generate-runtime-proof.ts [--period YYYY-MM]
```

**Inputs:** All ingested artifacts (see Output Files)  
**Outputs:**  
- `reports/runtime/monthly/runtime-YYYY-MM.json`  
- `reports/runtime/runtime-latest.json`

---

### `pnpm exec tsx scripts/proof/runtime-proof-gate.ts`

```bash
tsx scripts/proof/runtime-proof-gate.ts [--env staging|production]
```

**Exit codes:** `0` = pass, `1` = fail

| Environment | Fails when |
|-------------|-----------|
| `staging` (default) | File missing or Zod parse error |
| `production` | Score < 80 OR any blocking finding |

---

### `pnpm exec tsx scripts/proof/export-runtime-proof.ts`

```bash
tsx scripts/proof/export-runtime-proof.ts [--period YYYY-MM]
```

**Inputs:** `reports/runtime/runtime-latest.json` (or period-specific file)  
**Outputs:**  
- `reports/runtime/export/summary.md` — human-readable markdown for buyer handoff  
- `reports/runtime/export/runtime-redacted.json` — JSON with all API keys / secrets / tokens redacted

---

## Output Files

```
reports/
  releases/
    release-ledger.jsonl           # Signed release entries
  runtime/
    ci-runs.jsonl                  # GitHub Actions run records
    azure-runtime-latest.json      # ACA deployment state snapshot
    health-latest.json             # Endpoint health check results
    security-proof-latest.json     # Security scan summary
    runtime-latest.json            # Latest proof document (V2 schema)
    monthly/
      runtime-YYYY-MM.json         # Archived per-period proof documents
    export/
      summary.md                   # Buyer-facing markdown export
      runtime-redacted.json        # Redacted JSON export
ops/
  drift/
    drift-YYYY-MM.json             # Drift report (status: clean|dirty)
  db/
    restore-drill-YYYY-MM.json     # Restore drill record
proof-artifacts/
  evidence-packs/
    YYYY-MM/
      snapshot.json                # Sealed evidence pack snapshot
```

---

## Dashboard

The runtime proof document is surfaced in the **Control Plane** at `/runtime-proof`.

Navigate to: **Control Plane → Runtime Proof** (sidebar)

The dashboard shows:
- Score / Grade / Health status
- Per-dimension scoring breakdown table
- Blocking and advisory findings
- Next required evidence actions
- Full metrics table

---

## CI Gate

Add to your GitHub Actions workflow after the proof generation step:

```yaml
- name: Runtime proof gate (staging)
  run: pnpm exec tsx scripts/proof/runtime-proof-gate.ts --env staging

- name: Runtime proof gate (production)
  run: pnpm exec tsx scripts/proof/runtime-proof-gate.ts --env production
  if: github.ref == 'refs/heads/main'
```

A non-zero exit code will fail the workflow step.

---

## Export for Buyers

```bash
pnpm exec tsx scripts/proof/export-runtime-proof.ts
```

This produces two files in `reports/runtime/export/`:

1. **`summary.md`** — a clean markdown document suitable for PDF export or attaching to a due-diligence pack. Contains grade, health, scoring table (with bar charts), metrics, and findings.

2. **`runtime-redacted.json`** — the full proof document with all sensitive keys redacted (API keys, secrets, tokens, credentials). Safe to share with external parties.

---

## Resolving Common Findings

### "No signed releases found for period YYYY-MM" (blocking)

Run the release ingestion + validation:
```bash
pnpm exec tsx scripts/proof/validate-release-ledger.ts
```
Ensure at least one release is tagged and pushed within the period.

### "No deploy activity found in CI for period YYYY-MM" (blocking)

Run CI ingestion:
```bash
pnpm exec tsx scripts/proof/ingest-github-actions.ts
```
Ensure `GITHUB_TOKEN` is set and the deployment workflow ran within the period.

### "Health check failed for N endpoints"

Check `reports/runtime/health-latest.json` for failing endpoints. Resolve the underlying service issue, then re-run `pnpm exec tsx scripts/proof/check-health.ts`.

### "Drift report missing for period YYYY-MM"

Generate a drift report and write it to `ops/drift/drift-YYYY-MM.json` with `{ "status": "clean" }` (or `"dirty"` with a `findings` array if there are issues).

### "No restore drill record found for period"

Perform a restore drill, document it, and write the result to `reports/db/restore-drill-YYYY-MM.json`.

### "Security findings: N critical" or "N high (unwaived)"

Review `reports/runtime/security-proof-latest.json`. Either:
- Patch the vulnerable dependency and re-run `pnpm exec tsx scripts/proof/collect-security-proof.ts`
- Add a waiver to `ACTIVE_WAIVERS` in `tooling/security/supply-chain-policy.ts` if the finding is a false positive

### Grade is B with bootstrap cap but all dimensions score well

One or more dimensions used bootstrap (simulated) evidence. Check `bootstrapSources` in `runtime-latest.json` and replace those dimensions' evidence with real instrumented signals.
