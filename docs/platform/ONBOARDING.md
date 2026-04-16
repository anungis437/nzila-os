# Nzila OS — New Engineer Onboarding

> Target: productive first PR within your first working day.

---

## Prerequisites (15 min)

Install these before cloning:

| Tool | Version | Install |
|---|---|---|
| Node.js | 22 LTS | [nodejs.org](https://nodejs.org) or `nvm install 22` |
| pnpm | 10.x | `npm install -g pnpm@10` |
| Docker Desktop | latest | [docker.com](https://docs.docker.com/get-docker/) |
| Git | 2.40+ | system package manager |
| VS Code | latest | [code.visualstudio.com](https://code.visualstudio.com) |

Recommended VS Code extensions: ESLint, Prettier, Tailwind CSS IntelliSense, GitLens.

## Ramp-Up Success Metrics

Onboarding quality is measured monthly from merge and CI telemetry:

| KPI | Target | Data source | Owner |
|---|---|---|---|
| New engineer reaches first merged PR | ≤ 5 business days | GitHub PR metadata + team start dates | Domain lead |
| New engineer reaches independent on-call readiness | ≤ 6 weeks | Incident drill checklist sign-off | Platform Engineering |
| New engineer local setup success without manual intervention | ≥ 90% | `#platform-eng` onboarding issue templates | Developer Experience |
| First-month governance gate failure rate for new engineers | ≤ 10% of PRs | CI workflow outcomes (`governance-gates`) | Platform Governance |

If two consecutive months miss any KPI target, an onboarding improvement action must be added to the next sprint.

---

## Day 1: Up and Running (30 min)

### 1. Clone and install

```bash
git clone https://github.com/anungis437/nzila-os.git
cd nzila-os
pnpm install           # installs all workspace packages
```

### 2. Copy environment files

```bash
cp apps/web/.env.example apps/web/.env.local
cp apps/console/.env.example apps/console/.env.local
cp apps/union-eyes/.env.example apps/union-eyes/.env.local
```

Ask a team member for the `AUTH_SECRET` and `DATABASE_URL` values — never commit secrets.

### 3. Start the development environment

```bash
pnpm dev               # starts all apps concurrently via Turbo
# or start a single app:
pnpm dev:web           # web only (port 3000)
pnpm dev:console       # console only (port 3001)
```

### 4. Verify everything works

```bash
pnpm typecheck         # TypeScript — must exit 0
pnpm lint              # ESLint — must exit 0
pnpm test:fast         # unit tests, skips slow contract suite
```

If any of these fail on a clean checkout, that is a bug — please open an issue immediately.

---

## Repository Map

```
apps/           17 Next.js applications (one per domain)
packages/       Shared libraries (@nzila/*)
tooling/        CI scripts, governance gates, contract tests
scripts/        CLI helpers and validators
ops/            SLO policy, compliance controls, cost data
docs/platform/  This folder — canonical platform documentation
tests/load/     k6 load test suite
.github/        CI/CD workflows
```

Key entry points:

| What | Where |
|---|---|
| All available scripts | `pnpm help:commands` |
| App registry (tiers, owners) | `platform/registry/apps.json` |
| Architecture overview | `ARCHITECTURE.md` |
| SLO targets | `ops/slo-policy.yml` |
| Governance gate checks | `tooling/governance/validate-governance-gate.ts` |
| Security baseline | `docs/hardening/BASELINE.md` |

---

## Domain Orientation (Day 1–2)

Read the domain expertise map to understand team ownership before making cross-domain changes:

- [`docs/platform/DOMAIN_EXPERTISE_MAP.md`](./DOMAIN_EXPERTISE_MAP.md)

Each domain has a designated owner in `CODEOWNERS`. When in doubt, assign the relevant domain owner as reviewer.

---

## Making Your First PR

### Step 1: Branch naming

```bash
git checkout -b feat/<scope>/<short-description>   # new feature
git checkout -b fix/<scope>/<short-description>    # bug fix
git checkout -b docs/<topic>                        # documentation
```

Scopes: `web`, `console`, `union-eyes`, `abr`, `governance`, `platform`, `security`.

### Step 2: Before pushing

```bash
pnpm check:core        # lint + typecheck + changed-package tests
pnpm check:governance  # governance gate (14+ checks, must pass)
```

### Step 3: Pre-commit hooks

Lefthook runs automatically on `git commit`. To bypass during bulk operations only:

```bash
LEFTHOOK=0 git commit -m "..."
```

### Step 4: PR checklist

- [ ] `pnpm check:core` passes (exit 0)
- [ ] `pnpm check:governance` passes (exit 0)
- [ ] No new `any` types without a comment explaining why
- [ ] Evidence exports unchanged or updated with new schema version
- [ ] For new API routes: authz check wired, health endpoint present

---

## Governance-Heavy Processes — Quick Reference

These may feel heavyweight initially. Each has a purpose:

| Process | Command | Why it exists |
|---|---|---|
| Governance gate | `pnpm validate:governance:gate` | Blocks deployment when platform invariants drift |
| Evidence lifecycle | `pnpm validate:evidence:lifecycle` | Ensures retention policy compliance |
| SLO gate | `pnpm contract-tests` (slo-* tests) | Prevents p95 latency regressions reaching production |
| Load test | `pnpm k6:smoke` | Catches throughput regressions before merge |
| Quarterly scorecard | `pnpm strategic:quarterly` | Feeds leadership with adoption + cost + DORA metrics |

All gates are **fail-closed** — they must pass before merging to main.

---

## Getting Help

| Channel | Use for |
|---|---|
| `#platform-eng` Slack | Build failures, governance questions |
| `#security` Slack | Security concerns, CVEs, access requests |
| Domain team leads | See `docs/platform/DOMAIN_EXPERTISE_MAP.md` |
| GitHub Discussions | Architecture proposals (ADRs) |

If a gate is failing on a clean branch and you believe it is a false positive, open an issue with the exact error output before bypassing — never bypass without a tracking ticket.

---

## Common First-Week Pitfalls

| Symptom | Fix |
|---|---|
| `pnpm install` fails | Ensure Node 22; delete `.turbo` and retry |
| Turbo cache miss in CI | See `docs/platform/TURBO_CACHE_STRATEGY.md` |
| `auth()` returns wrong org ID | Read "Entra Auth Gotchas" in `ARCHITECTURE.md` |
| `db.execute()` result is undefined | Use `result[0]` not `result.rows[0]` (Drizzle postgres.js) |
| Lint passes locally, fails CI | Windows CRLF vs LF — configure `core.autocrlf=false` in git |
| Governance gate check fails on new file | Verify all required sections exist in new doc |

### Pitfall Trend Baseline (last 2 quarters)

| Pitfall category | Share of onboarding issues | Prevention action |
|---|---|---|
| Environment drift (Node/pnpm mismatch) | 34% | Auto-check in `pnpm verify:env` during day-1 setup |
| Auth/org context confusion | 23% | Mandatory walkthrough of org resolution flow before first backend PR |
| Data-layer misuse (raw SQL/Drizzle result assumptions) | 21% | Add pair-review checklist item for DB touchpoints |
| CI parity mismatch (CRLF/cache behavior) | 14% | Enforce pre-push git + cache strategy validation |
| Governance gate semantics unclear | 8% | Link each gate to its owning policy/runbook in PR template |

These percentages are refreshed quarterly from onboarding issue labels and retro notes.

## Review Cycle and Feedback Loop

- Document owner: Platform Engineering
- Review cadence: quarterly or after any onboarding KPI breach
- Feedback path: open an issue tagged `onboarding-feedback` with command output and failing step
- Versioning rule: all material changes require PR review by one domain lead and one platform reviewer
