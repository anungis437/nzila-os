# Contributing to Nzila OS

## Quick Start

```bash
pnpm install
pnpm dev:console   # or dev:web, dev:partners
```

## Repo Contract

Read [docs/repo-contract/README.md](docs/repo-contract/README.md) before contributing. Key rules:

1. No direct AI provider imports in apps — use `@nzila/ai-sdk`
2. No direct ML table reads in apps — use `@nzila/ml-sdk`
3. Evidence generator logic belongs only in `@nzila/os-core`
4. Every API route must call `authorize()` from `@nzila/os-core/policy`
5. Schema changes require migrations

## PR Requirements

- [ ] `pnpm lint` passes (includes no-shadow-ai, no-shadow-ml)
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test` passes
- [ ] Contract tests pass (`pnpm --filter tooling test` or CI)
- [ ] If schema changed: migration file included
- [ ] If breaking change: MAJOR version bump + migration notes
- [ ] If new invariant gap found: gate added before merging

## Adding a New Package

1. Create `packages/<name>/` with `package.json`, `tsconfig.json`, `src/index.ts`
2. Add to `pnpm-workspace.yaml`
3. Link with `pnpm link-workspaces` (see `scripts/link-workspaces.ps1`)
4. Add exports to `package.json`

## Adding a New App

Before a new app can be merged, it must pass the **App Alignment Checklist**:
- Health endpoint at `/api/health`
- Consumes AI via `@nzila/ai-sdk`
- Consumes ML via `@nzila/ml-sdk`
- All API routes call `authorize()` 
- Passes `api-authz-coverage.test.ts`

See `docs/migration/app-alignment/` for examples.

## Commit Messages

Use conventional commits: `feat:`, `fix:`, `chore:`, `docs:`, `refactor:`, `test:`.

## Code Style

- TypeScript strict mode
- Prettier (auto-formatted)
- ESLint with `@typescript-eslint/recommended`

## Security

See [SECURITY.md](SECURITY.md). Never commit secrets. Use `.env.local` for local dev.
