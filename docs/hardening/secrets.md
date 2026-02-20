# Secret Scanning & Pre-commit Guardrails

## Overview

Nzila uses a **defense-in-depth** approach to prevent secrets from entering the repository:

1. **Pre-commit hooks** (local) — catch secrets before they're committed
2. **CI scanning** (remote) — catch anything that slips through locally
3. **Custom config** — tuned for the monorepo's specific secret patterns

## Architecture

```
Developer workstation          GitHub CI
┌─────────────────────┐        ┌──────────────────────┐
│  git commit          │        │  push / PR            │
│    ↓                 │        │    ↓                  │
│  lefthook pre-commit │        │  secret-scan.yml      │
│    ├─ gitleaks       │        │    ├─ TruffleHog OSS  │
│    ├─ lint           │        │    └─ Gitleaks        │
│    └─ typecheck      │        │       (uses .gitleaks │
│                      │        │        .toml config)  │
│  lefthook pre-push   │        │                      │
│    └─ contract-tests │        │                      │
└─────────────────────┘        └──────────────────────┘
```

## Setup (One-time)

After cloning the repo, run:

```bash
pnpm install
```

This triggers the `prepare` script, which runs `lefthook install` to set up Git hooks automatically.

### Verify hooks are active

```bash
npx lefthook run pre-commit --dry-run
```

## Pre-commit Hooks

The following checks run on every `git commit`:

| Hook | What it checks | Runs on |
|------|---------------|---------|
| `gitleaks` | Scans staged files for secrets | `*.ts, *.tsx, *.js, *.json, *.env, *.yml, *.yaml, *.md, *.sh, *.ps1, *.py` |
| `lint-staged` | ESLint on changed packages | `*.ts, *.tsx, *.js, *.jsx, *.mjs` |
| `typecheck-staged` | TypeScript compilation | `*.ts, *.tsx` |

## Pre-push Hooks

| Hook | What it checks |
|------|---------------|
| `contract-tests` | Repo invariants (no shadow AI/ML, authorize on routes, etc.) |

## Gitleaks Configuration

The custom config (`.gitleaks.toml`) extends the default Gitleaks ruleset with:

### Custom Rules
- **Clerk secret keys** (`sk_live_*`) — production Clerk tokens
- **Stripe secret keys** (`sk_live_*`) and webhook secrets (`whsec_*`)
- **Azure Key Vault URIs** with embedded SAS tokens
- **Database connection strings** with passwords (excluding `localhost`)
- **QuickBooks Online client secrets**

### Allowlisted Paths
- CI workflow files (contain placeholder env vars like `sk_test_placeholder`)
- `.env.example` and `.env.test` files
- Lock files, snapshots, and documentation

### Allowlisted Patterns
- `sk_test_placeholder`, `pk_test_placeholder` — CI test fixtures
- `postgresql://postgres:postgres@localhost` — local dev DB

## CI Integration

The `.github/workflows/secret-scan.yml` workflow runs on every push and PR:

1. **TruffleHog OSS** — scans full git history for verified secrets
2. **Gitleaks** — uses the `.gitleaks.toml` config for pattern-based detection

Both must pass for PRs to merge.

## What to Do If a Secret Is Detected

### In pre-commit (local)
1. **Do not force-push past the hook.**
2. Remove the secret from the staged file.
3. If it was a real credential: **rotate it immediately** via Azure Key Vault.
4. Re-stage and commit.

### In CI
1. The PR will be blocked — the secret-scan job will fail.
2. Remove the secret, push a fixup commit.
3. If the secret was a real credential: follow the [Incident Response playbook](../../ops/incident-response/README.md).
4. Report to `security@nzila.app`.

### If a Real Secret Was Exposed
1. **Rotate the credential immediately** — do not wait for PR review.
2. File a P2 incident per the IR playbook.
3. Audit access logs for the compromised credential.
4. Document the incident in `ops/incident-response/`.

## Skipping Hooks (Emergency Only)

```bash
# Skip pre-commit hooks (use ONLY in emergencies, document why)
git commit --no-verify -m "emergency: <reason>"
```

CI scanning still applies — this only skips local hooks. Any `--no-verify` usage on a security-sensitive path will be flagged in PR review.

## Maintenance

- **Update Gitleaks rules**: Edit `.gitleaks.toml` when new secret patterns are introduced.
- **Update Lefthook config**: Edit `lefthook.yml` to add/modify hooks.
- **Dependencies**: Lefthook and Gitleaks are updated via standard dependency management.
