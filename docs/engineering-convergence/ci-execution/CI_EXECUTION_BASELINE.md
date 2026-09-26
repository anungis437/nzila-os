# CI execution baseline

Measurement only. No workflow, cache, or Azure behavior was changed.

| Field | Value |
| --- | --- |
| Recorded from | `origin/main` |
| SHA | `0d30e316423da50e2e7bdb9fd323d89070ec5f85` |
| Commit | `fix(union-eyes): fail closed on unattributed governance policy writes (#829)` |
| Root workflows | 54 under `.github/workflows` |
| Composite setup | `.github/actions/setup-monorepo` |
| Run sample | 200 most recent GitHub Actions runs |
| Anchor run | Reliability Guard `36253094988` on this SHA |

The dirty primary checkout is not this baseline. `ci.yml` and `gitops-deploy.yml` differ there. Every command below was read from `origin/main`.

## Reliability Guard on this SHA

Workflow `.github/workflows/reliability-guard.yml`. Triggers: `pull_request`, `push` to `main`, `workflow_dispatch`. No `paths-ignore`. Concurrency cancels in-progress runs only for `pull_request`.

Run `36253094988` (push, success), job `reliability-validation`:

| Step | Wall clock |
| --- | --- |
| Checkout | 5s |
| setup-monorepo | 43s |
| `pnpm typecheck` | 10m54s |
| `pnpm lint` | 3m57s |
| `pnpm test:fast` | 4m10s |
| `pnpm build` | 11m21s |
| Health contract | 1s |
| Synthetic dry-run | <1s |
| Alert routing dry-run | 1s |
| Reliability audit | <1s |
| Executive dashboard | 1s |
| Job total | 31m21s (15:46:23Z–16:17:44Z) |

The reliability scripts together are about 3 seconds. Generic validation is the rest.

Recent sample averages, completed runs only:

| Event | Runs | Average | Max in sample |
| --- | --- | --- | --- |
| pull_request | 7 | 29.5 min | not separately stored |
| push | 4 | 37.8 min | not separately stored |

Sample totals: PR 206 runner-minutes, push 151 runner-minutes.

`setup-monorepo` restores Turbo cache only when `turbo-cache-key` is non-empty. This workflow does not pass that input, so the restore step is skipped. The cache key, when used, includes `github.sha`, so an exact key never matches the next commit.

## Same SHA, CI

CI run `36253094980` on the same push started at 15:46:19Z and finished at 16:06:37Z (20m18s).

On current main, CI `Build All` runs `pnpm exec turbo run build --affected`. It does not run `pnpm build`. Lint and typecheck run as `pnpm lint` and `pnpm typecheck` in `Lint & Typecheck`, with `turbo-cache-key: lint`. Unit tests run `pnpm test:coverage`. The unit-test job does not pass `turbo-cache-key`.

## Sample runner-minutes

Completed, non-skipped runs in the 200-run window. This is not a billed month and is not a dollar figure.

| Workflow | Event | Runs | Avg min | Total min |
| --- | --- | --- | --- | --- |
| Reliability Guard | pull_request | 7 | 29.5 | 206 |
| CI | pull_request | 8 | 20.4 | 163 |
| E2E Tests | pull_request | 8 | 19.4 | 155 |
| Reliability Guard | push | 4 | 37.8 | 151 |
| CodeQL | dynamic | 12 | 11.0 | 132 |
| E2E Tests | push | 4 | 23.3 | 93 |
| CI | push | 4 | 20.8 | 83 |
| CUPE Pilot Readiness Gates | pull_request | 8 | 8.2 | 65 |

One pull request starts on the order of 20 workflows at the same timestamp. Nineteen workflows trigger on both `pull_request` and `push` to `main`. CI and E2E ignore markdown and `docs/**`. Reliability Guard does not.

## Turbo

`turbo.json` on this SHA:

- `build` depends on `^build`, outputs `.next/**` (excluding `.next/cache/**`) and `dist/**`, and hashes several `NEXT_PUBLIC_*` and `AUTH_SECRET` env vars.
- `lint`, `typecheck`, and `test` depend on `^build` and declare no outputs.
- `remoteCache.signature` is true. GitHub Actions cache is local `node_modules/.cache/turbo` only, and only for callers that pass `turbo-cache-key`.

A prior observation of 5 cached tasks out of 40 was reported for a full `pnpm build`. This pass did not re-download that log. The structural reasons above are sufficient to explain poor reuse: Reliability Guard does not restore the cache, and lint/typecheck cannot emit a reusable output.

## What this baseline does not claim

Ruleset membership was not re-read from the GitHub rules API in this pass. Required-check status is inferred from workflows that actually run on pull requests, not from a ruleset export.

Azure spend, replica counts, and Log Analytics ingestion were not queried. Azure findings in the companion map are repository triggers only.
