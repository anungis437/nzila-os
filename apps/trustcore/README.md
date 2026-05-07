# @nzila/trustcore

Trustcore commercial site / portal app (Next.js 16). Marketing surface for the
TrustCore product line and entry point for authenticated trust-ops dashboards.

## Dev

```pwsh
pnpm --filter @nzila/trustcore dev
```

App runs on http://localhost:3010.

## Scripts

- `pnpm --filter @nzila/trustcore build` — production build
- `pnpm --filter @nzila/trustcore lint`
- `pnpm --filter @nzila/trustcore typecheck`
- `pnpm --filter @nzila/trustcore test` — vitest

## Environment

See [.env.example](.env.example) for the variables required to run locally.
The companion ops console lives in [`apps/trustcore-trustops`](../trustcore-trustops/README.md).
