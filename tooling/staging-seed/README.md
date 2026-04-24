# @nzila/staging-seed

Shared **Phase 1** foundation for the cross-app staging seeding framework.

This package provides the framework only — per-app seeders are added in
follow-up PRs that import from `@nzila/staging-seed`.

## What's here (Phase 1)

- **Profiles** — `demo-light`, `demo-standard`, `executive-showcase`,
  `investor-showcase` with target volumes per entity.
- **Deterministic RNG** — `mulberry32`-based seeded generator so reseeding
  yields identical data given the same `(profile, seed)`.
- **Time realism helpers** — `dateDaysAgo`, `last12MonthsWindow`,
  `futureWindow`, `todayInUtc` for back-dated history + scheduled future.
- **Seeder registry** — apps register via `registerSeeder({ app, ... })`
  and the CLI orchestrates them.
- **Shared fakers** — `people`, `organizations`, `users`, `invoices`,
  `tickets`, `events`, `notifications`, `activityLogs`. Synthetic but
  realistic (no production data).
- **CLI** — `seed`, `reseed`, `reset` commands wired into root scripts.

## CLI

From the repo root:

```bash
pnpm seed:staging                                # all registered apps, demo-standard profile
pnpm seed:staging -- --profile=executive-showcase
pnpm seed:staging -- --app=union-eyes --dry-run
pnpm reseed:app -- --app=union-eyes              # reset+seed a single app
pnpm reset:staging -- --yes                      # reset all registered apps (DESTRUCTIVE)
```

Flags:

| Flag                    | Default          | Notes                                  |
| ----------------------- | ---------------- | -------------------------------------- |
| `--profile=<name>`      | `demo-standard`  | One of the four profiles               |
| `--app=<name>`          | _all_            | Restrict to a single app                |
| `--seed=<int>`          | `20260423`       | Deterministic RNG seed                  |
| `--dry-run`             | off              | Compute plan + report, no writes        |
| `--yes`                 | off              | Required to actually reset              |
| `--report=<path>`       | `demo-output/seed-report.json` | Where to write the JSON report |

## Adding a per-app seeder (future PRs)

```ts
// apps/<app>/lib/staging-seed.ts
import { registerSeeder } from '@nzila/staging-seed'

registerSeeder({
  app: 'union-eyes',
  description: 'Unions, members, cases, governance.',
  supportedProfiles: ['demo-light', 'demo-standard', 'executive-showcase'],
  async seed(ctx) {
    // ctx.profile, ctx.rng, ctx.time, ctx.dryRun, ctx.logger, ctx.report
    return ctx.report.finish()
  },
  async reset(ctx) {
    return ctx.report.finish()
  },
})
```

Then have the CLI loader (`src/cli.ts`) import the file. Phase 1 keeps
the registry empty — the CLI cleanly prints "no seeders registered" and
exits 0 so CI does not fail.

## Rules (from request)

1. No production data — all data synthetic.
2. Org scoping & auth rules preserved (per-app seeders enforce).
3. Seeds deterministic given `(profile, seed)`.
4. Reset/reseed supported.
5. No regressions — framework is additive, no existing code touched.
