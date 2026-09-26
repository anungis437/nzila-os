# CI performance budget

Targets. Not met. No workflow was edited to chase them.

| Surface | Target | Measured on `0d30e3164` / sample | Status |
| --- | --- | --- | --- |
| Reliability Guard normal path | ≤ 2 min | 31m21s anchor run; PR average 29.5 min; push average 37.8 min | Miss |
| PR critical path | ≤ 10 min | CI PR average 20.4 min; E2E PR average 19.4 min; Reliability Guard is longer than both | Miss |
| Fast deterministic gates | ≤ 5 min | Several governance workflows finish near 1 min. They are not the critical path | Partial |
| Documentation-only change | 0 app builds, 0 image builds, 0 Azure deploys | CI and E2E `paths-ignore` `**/*.md` and `docs/**`. Reliability Guard, Trivy, secret scan, and most governance workflows do not | Not met for Reliability Guard |
| No-op deployment | 0 Azure deployment operations | Not measured per revision. GitOps run `36254278073` lasted ~40s after CI on this SHA | `PENDING_MEASUREMENT` for revision count |

## Why 2 minutes is blocked

Reliability-specific steps on the anchor run cost about 3 seconds plus 43 seconds of install. The remaining ~30 minutes are typecheck, lint, `test:fast`, and full `pnpm build`.

Typecheck and lint have an authoritative owner in CI. `test:fast` does not, until it is shown to be contained in `pnpm test:coverage`. Full `pnpm build` does not, because CI builds with `--affected` only.

Moving the full build to a scheduled job would meet the 2-minute developer path and would also drop portfolio buildability from the merge path. That is an assurance change and is not authorized by this measurement.

## Budgets that must not be faked

A green Reliability Guard that skips typecheck without CI being required is a weaker gate. A cache hit that skips a task with undeclared outputs is a weaker gate. `continue-on-error` is out of scope.
