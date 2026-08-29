# CI Critical Path Analysis (Phase 4)

Baseline: run 33101255112 on `main` (2026-08-27).

## Job Durations (top 5)

| Job                          | Duration  | Blocking? |
| ---------------------------- | --------- | --------- |
| Unit Tests                   | **39m13s** | Yes — was gating build |
| Lint & Typecheck             | 17m42s    | Yes — gates build      |
| Build All                    | 12m29s    | Gated                  |
| Governance Gates             | 1m47s     | Independent            |
| ML Tooling Gates             | 1m29s     | Independent            |

## Critical Path Before Phase 4

```
lint-and-typecheck (17m) ─┐
                          ├──> build (12m)  ──> perf-regression (~4m)
test (39m) ───────────────┘
                          └──> contract-tests (2m)  ──> ci-summary (~1m)
```

Wall clock ≈ **max(test) + build + summary ≈ 40 + 12 + 1 = 53m** to full green.

## Phase 4 Applied Change

**Drop `test` from `build.needs`.** Build is TypeScript compilation; unit tests are runtime validation — they don't depend on each other. Downstream jobs keep their own explicit dependencies, so behaviour for the rest of the graph is unchanged.

### New Critical Path

```
lint-and-typecheck (17m) ──> build (12m)     ─┐
                                              ├──> perf-regression (~4m)
test (39m) ──────────────────────────────────┴──> contract-tests, ci-summary
```

Wall clock ≈ **max(test = 40m, lint + build + perf = 17 + 12 + 4 = 33m) + summary = ~40m + 1m = ~41m**. **Saves ~12 minutes** per green run on the critical path.

## Follow-ups (not in this PR)

Ranked by expected impact / risk.

### 1. Matrix-split Unit Tests (biggest remaining win)

- Break `pnpm test:coverage` into a matrix keyed by workspace slice (`@nzila/platform-*`, `apps/*`, `packages/sage-*`, etc.). Turbo already scopes execution; wire the filter into a `strategy.matrix` entry.
- Estimated: 4-way split → ~12m per leg + 2m setup → **wall ≈ 15m** (vs 40m today). Combined with the Phase 4 change above → total wall ≈ 20m (vs 53m baseline). **~60% reduction**.
- Risk: coverage aggregation needs re-work (upload per shard, merge in `ci-summary`).

### 2. Split `lint` and `typecheck` into separate jobs

- Runs them in parallel: 17m → max(lint, typecheck) ≈ 10m.
- Downstream `needs:` becomes `[lint, typecheck]` — one-liner change.
- Marginal on critical path today (test dominates), but frees the queue and improves PR feedback latency for lint errors.

### 3. Cache `pnpm test:coverage` across runs

- Turbo remote cache would let unchanged packages skip test execution entirely.
- Requires provisioning a remote cache (S3/CloudFront or Turbo Cloud) and adding `TURBO_TOKEN`/`TURBO_TEAM`.
- Highest infra effort; largest steady-state savings on partial-touch PRs.

### 4. Move `Contract Tests` off the critical path

- Currently gates `ci-summary`. If contract tests can run in parallel with the final summary step, we save ~2m.
- Requires `ci-summary` to depend on the actual test outcomes (via GitHub check output) instead of job graph.

### 5. Reduce `build` fan-out via targeted builds

- On PRs, run `turbo build --filter=[HEAD^1]` to only build changed apps and their dependents.
- Green push to main still needs the full build for artefacts.
