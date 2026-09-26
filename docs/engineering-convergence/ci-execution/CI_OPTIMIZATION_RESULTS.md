# CI optimization results

E1 only. No optimization has been applied.

| Metric | Before | After |
| --- | --- | --- |
| Reliability Guard | 31m21s on `0d30e3164`; PR avg 29.5 min; push avg 37.8 min | `PENDING_MEASUREMENT` |
| PR critical path | CI avg 20.4 min; E2E avg 19.4 min; Reliability Guard longer | `PENDING_MEASUREMENT` |
| Turbo cache | Reliability Guard does not pass `turbo-cache-key`. Lint and typecheck declare no outputs. CI build is `--affected` | `PENDING_MEASUREMENT` |
| Workflow invocations per PR | On the order of 20 workflows from one `pull_request` event | `PENDING_MEASUREMENT` |
| Container builds | Multiple workflows contain `docker build` | `PENDING_MEASUREMENT` |
| Deployment operations | GitOps follows CI; Union Eyes auto-promote is path-filtered | `PENDING_MEASUREMENT` |
| Azure operations | Not counted from Activity Log | `PENDING_MEASUREMENT` |

## Next batch, not started

E2 may remove `pnpm typecheck` and `pnpm lint` from the normal Reliability Guard path only after the required-check ruleset shows CI Lint & Typecheck is mandatory for the same SHA.

E2 may not remove `pnpm build` until another required gate owns portfolio buildability. `turbo run build --affected` is not that owner.

E2 may not remove `pnpm test:fast` until it is shown to be contained in `pnpm test:coverage`.

E3 may fix output declarations and stop putting `github.sha` in the exact Turbo cache key. That does not by itself authorize skipping a gate.
