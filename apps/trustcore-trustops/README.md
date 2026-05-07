# @nzila/trustcore-trustops-app

TrustCore Trust-Ops console (Next.js 16). Operates mandates, creditors, and
claims workflows backed by `@nzila/db` and `@nzila/trustcore-core`.

## Dev

```pwsh
pnpm --filter @nzila/trustcore-trustops-app dev
```

App runs on http://localhost:3018.

## Scripts

- `pnpm --filter @nzila/trustcore-trustops-app build`
- `pnpm --filter @nzila/trustcore-trustops-app lint`
- `pnpm --filter @nzila/trustcore-trustops-app typecheck`
- `pnpm --filter @nzila/trustcore-trustops-app test` — vitest

## Environment

See [.env.example](.env.example). The companion marketing/portal app lives in
[`apps/trustcore`](../trustcore/README.md).
