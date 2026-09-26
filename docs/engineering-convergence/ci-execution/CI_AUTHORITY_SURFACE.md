# CI authority surface

Decision: architecture B. Canonical merge-authority contexts are published by a reporter. The existing CI and secret-scan jobs keep their names and remain the engineering implementation.

Architecture A would make today's job display names the required contract. Those names already collide (`Lint & Typecheck`, `Unit Tests`, `Red-Team Adversarial`), and CI `paths-ignore` means a documentation-only pull request never creates them. Renaming the jobs would not fix that, and it would couple every workflow refactor to the future ruleset.

## What reports

| Context | Underlying CI job | Docs-only result |
| --- | --- | --- |
| `Merge Authority / Lint & Typecheck` | `lint-and-typecheck` | `NOT_APPLICABLE` |
| `Merge Authority / Unit Tests` | `test` (`pnpm test:coverage`) | `NOT_APPLICABLE` |
| `Merge Authority / Schema Integrity` | `schema-drift` | `NOT_APPLICABLE` |
| `Merge Authority / PostgreSQL RLS` | `sage-postgres-concurrency` | `NOT_APPLICABLE` |
| `Merge Authority / Migration Chain` | `sage-live-postgres` | `NOT_APPLICABLE` |
| `Merge Authority / Affected Build` | `build` (`turbo run build --affected`) | `NOT_APPLICABLE` |

`Merge Authority / Affected Build` is not a portfolio build. `PORTFOLIO_BUILD_AUTHORITY` stays unresolved. `Merge Authority / Unit Tests` does not retire `pnpm test:fast`. `TEST_FAST_SUBSET` stays unresolved.

Secret safety stays on the jobs that already run for every pull request to `main`: `Gitleaks`, `TruffleHog OSS`, and `Docker Secret Policy`. A wrapper check would either duplicate the scans or be able to pass before they finish. The classifier does not waive them.

## Classifier

`DOC_ONLY` only when every changed path is proven unable to affect the six engineering invariants:

- `LICENSE`, `LICENSE.md`, `.gitignore`, `.editorconfig`, `.github/CODEOWNERS`, or
- a `.md` / `.markdown` file that is outside `apps/`, `packages/`, `services/`, `tooling/`, `scripts/`, `.github/`, `migrations/`, `db/`, and `supabase/`, and whose path segments are not `schema`, `migration`, `migrations`, `drizzle`, or `rls`.

Anything else, including an empty change set, is `CODE_OR_UNKNOWN`.

`CODE_OR_UNKNOWN` defers to the CI reporter when CI will run. When CI `paths-ignore` will skip the workflow anyway, the fast path publishes `UNRESOLVED` failure. It does not publish success.

A skipped, cancelled, missing, or failed CI job never becomes `NOT_APPLICABLE` or success.

Documentation under `docs/` can still be read by governance, ops-pack, and doc-consistency tooling. Those tools are not this authority surface. The check summary names them when they match, and secret scanning still runs.

## Ruleset

This slice does not activate `main-merge-authority`, does not enable required status checks, and does not modify Reliability Guard.

`E2` stays `E2_BLOCKED_AUTHORITY`.
