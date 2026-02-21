# NzilaOS — App Adoption Guide

> **Audience**: Any vertical app repository that wants to inherit NzilaOS governance posture.
> **Terminology**: Use "Org" everywhere. Do NOT introduce "tenant".

---

## 1. Required Dependencies

Add these `@nzila/*` packages (exact versions recommended):

```json
{
  "dependencies": {
    "@nzila/os-core": "workspace:*",
    "@nzila/db": "workspace:*"
  },
  "devDependencies": {
    "@nzila/config": "workspace:*"
  }
}
```

For **external (non-monorepo)** app repos, install published versions:

```bash
pnpm add @nzila/os-core @nzila/db
pnpm add -D @nzila/config
```

---

## 2. Required Scripts

Add these scripts to your `package.json`:

| Script | Command | Purpose |
|--------|---------|---------|
| `contract-tests` | `vitest run --project contract-tests` | Run architectural invariant tests |
| `evidence:collect` | `tsx scripts/evidence/collect.ts` | Collect evidence pack artifacts |
| `evidence:seal` | `tsx scripts/evidence/seal.ts` | Seal evidence pack (HMAC + Merkle) |
| `ga-check` | `tsx scripts/governance/ga-check.ts` | (Optional) Local GA readiness gate |
| `typecheck` | `tsc --noEmit` | TypeScript type checking |
| `lint` | `eslint .` | Lint with governance rules |

---

## 3. Required CI (GitHub Actions)

### 3.1 Use `workflow_call` templates from NzilaOS

```yaml
# .github/workflows/ci.yml
name: CI
on:
  pull_request:
  push:
    branches: [main]

jobs:
  governance:
    uses: nzila-automation/.github/workflows/nzila-governance.yml@main
    secrets: inherit

  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm test

  contract-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm contract-tests

  evidence:
    needs: [lint-and-typecheck, test, contract-tests]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm evidence:collect
      - run: pnpm evidence:seal
      - uses: actions/upload-artifact@v4
        with:
          name: evidence-pack
          path: |
            evidence/pack.json
            evidence/seal.json
          retention-days: 365
```

### 3.2 Required checks (PR-blocking)

| Check | Severity | Notes |
|-------|----------|-------|
| Secret scan (Gitleaks + TruffleHog) | CRITICAL | Block merge on any finding |
| Dependency audit | CRITICAL | Block on CRITICAL/HIGH advisories |
| Trivy scan | CRITICAL | Container or FS scan |
| SBOM generation | Required | CycloneDX format |
| Contract tests | Required | Architectural invariants |
| Evidence seal + verify | Required | `verifySeal` must pass |

---

## 4. Required Org Terminology

- All docs, comments, test descriptions, and error messages use **"Org"**.
- No references to "tenant", "multi-tenant", or "entity isolation".
- DB column `entity_id` is the internal column name — do not change it, but never surface "entity" in user-facing text.

---

## 5. File Structure

After adoption, your repo should have:

```
.github/
  workflows/
    ci.yml              ← workflow_call templates + evidence
scripts/
  evidence/
    collect.ts          ← draft → add artifacts → output pack.json
    seal.ts             ← seal pack.json → seal.json
docs/
  platform/
    NZILAOS_ADOPTION.md ← this document
    CI_REQUIRED_CHECKS.md
    EVIDENCE_PACKS.md
CODEOWNERS              ← protect governance paths
```

---

## 6. Scaffolding with CLI

For monorepo verticals, use the NzilaOS CLI:

```bash
npx nzila create-vertical <name> --profile <profile>
```

Valid profiles: `union-eyes`, `abr-insights`, `fintech`, `commerce`, `agtech`, `media`, `advisory`.

The CLI generates a governance-complete skeleton including scopedDb, withAudit, ESLint rules, RBAC, contract test stubs, and evidence collector stubs.

---

## 7. Evidence Pack Lifecycle

1. **Collect** — gather CI artifacts (scan reports, test results, SBOM)
2. **Seal** — SHA-256 digest + Merkle root + optional HMAC
3. **Verify** — `verifySeal` validates integrity
4. **Upload** — CI stores `pack.json` + `seal.json` as artifacts

Draft packs are in-memory only. Persistence requires sealing (`assertSealed`).

---

## 8. Verification Checklist

- [ ] `@nzila/os-core` and `@nzila/db` installed
- [ ] `contract-tests`, `evidence:collect`, `evidence:seal` scripts defined
- [ ] CI uses `workflow_call` governance templates
- [ ] All scanners are PR-blocking
- [ ] `verifySeal` is a required CI step
- [ ] CODEOWNERS protects `.github/workflows/` and `scripts/evidence/`
- [ ] No "tenant" terminology anywhere
- [ ] Evidence packs produced and uploaded on every PR + main
