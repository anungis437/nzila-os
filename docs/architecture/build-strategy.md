# Build Strategy — NzilaOS Monorepo

> Optimized build architecture for 72 packages, 12 Next.js apps, and 1 API runtime.

## Architecture Overview

```
┌───────────────────────────────────────────────────┐
│                  turbo build                       │
│                                                   │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐           │
│  │ @nzila/ │  │ @nzila/ │  │ @nzila/ │  ... ×12  │
│  │  web    │  │ console │  │  trade  │           │
│  │(turbo)  │  │(turbo)  │  │(turbo)  │           │
│  └────┬────┘  └────┬────┘  └────┬────┘           │
│       │            │            │                  │
│  ┌────┴────────────┴────────────┴────┐            │
│  │     ~58 packages (raw .ts)        │  No build  │
│  │  Transpiled at consumer build     │  step      │
│  └───────────────────────────────────┘            │
│                                                   │
│  ┌──────────────────┐                             │
│  │ @nzila/cli (tsc) │  Only package with build    │
│  └──────────────────┘                             │
│                                                   │
│  ┌───────────────────────┐                        │
│  │ @nzila/union-eyes     │  Webpack (5.1 min)     │
│  │ Only webpack app      │  Critical path         │
│  └───────────────────────┘                        │
└───────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Internal Packages Pattern (no build step)

All ~58 packages export raw TypeScript source via `"main": "./src/index.ts"`.
Consumer apps (Next.js) transpile them at build time. This eliminates:
- Separate `tsc` compilation per package
- Watch mode rebuild cascades
- Stale `dist/` artifacts

**Exception**: `@nzila/cli` requires `tsc` to produce a standalone `dist/index.mjs` executable.

### 2. Turbopack Default, Webpack Exception

| App | Bundler | Build Time | Notes |
|-----|---------|-----------|-------|
| web, console, partners, abr, cfo, trade, pondu, cora, zonga, nacp-exams, shop-quoter | **Turbopack** | ~15-60s each | Next.js 16 default |
| union-eyes | **Webpack** | ~5 min | Requires `resolve.fallback`, `NormalModuleReplacementPlugin`, custom `splitChunks` |
| orchestrator-api | None | 0s | tsx runtime, no build |

**union-eyes uses webpack because** it has server-only deps (gRPC, BullMQ, pg) that leak
into the client bundle via barrel exports. Turbopack doesn't support `resolve.fallback` or
`NormalModuleReplacementPlugin` yet.

### 3. Turbo Concurrency = 50%

Building 12 Next.js apps in parallel exhausts RAM on CI runners (7GB GitHub Actions).
`concurrency: "50%"` caps parallel tasks to half the available CPU cores, preventing OOM kills
while still maximizing throughput.

### 4. Cache-Scoped `inputs`

`turbo.json` declares explicit `inputs` per task type:
- **build**: `src/**`, `app/**`, `components/**`, `lib/**`, config files
- **lint/typecheck**: source files + configs
- **test**: source + test files

This means changing `README.md`, docs, or governance files **does not invalidate build cache**.

## Local Development

```bash
# Build everything (full monorepo)
pnpm build                    # ~12 min cold, ~30s cached

# Build a single app + its deps
pnpm build:web                # ~60s cold
pnpm build:console            # ~60s cold
pnpm build:union-eyes         # ~5 min cold (webpack)
pnpm build:partners           # ~45s cold
pnpm build:abr                # ~45s cold
pnpm build:trade              # ~30s cold
pnpm build:cfo                # ~30s cold

# Clean turbo cache (reset)
pnpm clean
```

The `...` suffix in filter (e.g. `--filter=@nzila/web...`) means "this package and all
its workspace dependencies". This ensures shared packages are built first.

## CI Pipeline

```
                    ┌──────────────────┐
                    │  lint-and-       │
              ┌────▶│  typecheck       │◀────┐
              │     └────────┬─────────┘     │
              │              │               │
              │     ┌────────▼─────────┐     │
              │     │      test        │     │
              │     │  (with Postgres) │     │
              │     └────────┬─────────┘     │
              │              │               │
              │     ┌────────▼─────────┐     │
              │     │    build all     │     │
              │     │ (turbo cached)   │     │
              │     └──────────────────┘     │
              │                              │
    ┌─────────┴──────┐              ┌────────┴────────┐
    │  contract-tests │              │    red-team     │
    │  ai-eval-gate   │              │  hash-chain-    │
    │  schema-drift   │              │    drift        │
    │  ops-pack       │              │  ml-gates       │
    └─────────────────┘              └─────────────────┘
```

### Turbo Cache in CI

The CI workflow caches `node_modules/.cache/turbo` between runs. On repeat pushes
to the same branch, cached packages skip entirely (~30s total vs ~12 min).

Cache keys:
- `turbo-build-{os}-{lockfile-hash}-{commit-sha}` (exact match)
- `turbo-build-{os}-{lockfile-hash}-` (same deps, different code)
- `turbo-build-{os}-` (fallback)

## Deploy Workflows

Each deploy workflow:
1. Runs **pre-deploy gates** (contract tests + SLO gate)
2. Builds a **Docker image** using the multi-stage Dockerfile
3. The Dockerfile uses `TURBO_FILTER` build-arg to build only the target app

```
deploy-web.yml:     docker build --target web       → builds only @nzila/web
deploy-console.yml: docker build --target console    → builds only @nzila/console
deploy-union-eyes:  docker build --target union-eyes  → builds only @nzila/union-eyes
```

The Dockerfile's `builder` stage runs `pnpm turbo build ${TURBO_FILTER}`, so Docker
only compiles the app being deployed + its package dependencies.

## Optimization Checklist

| Optimization | Status | Impact |
|-------------|--------|--------|
| `"ui": "stream"` in turbo.json | ✅ | Fixes PowerShell exit code capture |
| `"concurrency": 4` | ✅ | Prevents CI OOM (12 apps × ~1GB each) |
| `"inputs"` per task | ✅ | Only source changes invalidate cache |
| `"env"` scoping | ✅ | Clerk/URL vars don't bust cache for non-Clerk apps |
| Per-app `build:*` scripts | ✅ | `pnpm build:web` = ~60s vs `pnpm build` = ~12 min |
| CI turbo cache | ✅ | Repeat builds cached across commits |
| Docker `TURBO_FILTER` | ✅ (existing) | Deploy builds only target app |
| union-eyes `ignoreWarnings` | ✅ | Suppresses OTel webpack noise → clean "Compiled successfully" |
| Remote turbo cache | ❌ Future | Would share cache across CI runners and dev machines |
| `output: 'standalone'` for all | ❌ Future | Reduces Docker image size (currently disabled on Windows dev) |

## Troubleshooting

### Build exits with code 1 but all apps compile

This was caused by turbo's interactive TUI (`"ui": "tui"` default) emitting terminal
control characters that confuse PowerShell's `$LASTEXITCODE`. Fixed by setting
`"ui": "stream"` in `turbo.json`.

### union-eyes "Compiled with warnings"

OpenTelemetry auto-instrumentation uses dynamic `require()` that webpack can't
statically analyze. These warnings are suppressed via `ignoreWarnings` in
`next.config.ts`. The warnings are harmless — OTel instrumentations are externalized
on the server side.

### Cache misses when no code changed

Check `turbo.json` `globalDependencies` — `**/.env.*local` means local env file
changes bust all caches. For CI, ensure env vars listed in `"env"` are stable.
