# Contributing to Nzila OS

## Branch Model

All work happens on feature branches merged via pull request to `main`.

```
main ← feature/your-work
```

CI runs on every PR: lint, typecheck, contract tests, governance gates.

## Before You Code

1. Pick a product/package from the [product catalog](../../governance/portfolio/product-catalog.json)
2. Check the lifecycle status — don't invest in `frozen` or `sunset` products
3. Read the relevant app README under `apps/<name>/`

## Development Workflow

```bash
pnpm dev:<app>         # Start the app you're working on
pnpm test:changed      # Test only changed packages
pnpm lint              # Lint check
pnpm typecheck         # Type check
```

## Package Conventions

- All shared code lives in `packages/`
- Platform packages are prefixed `platform-` and owned by the platform team
- Domain packages use the product name prefix (e.g., `agri-`, `zonga-`, `trade-`)
- Use extensionless imports in packages consumed by Next.js apps (Turbopack constraint)

## Auth

All apps use `@nzila/platform-auth`. Email/password with Argon2id is the default; Entra SSO is optional.

## Testing

- Unit tests: Vitest (`*.test.ts`)
- Contract tests: `tooling/contract-tests/` (200+ tests enforcing platform boundaries)
- Use `pnpm test:fast` for quick iteration (skips contract tests)
- Use `pnpm contract-tests` when touching platform packages

## Commit Hooks

Lefthook runs pre-commit checks. To bypass in bulk operations:

```powershell
$env:LEFTHOOK = "0"   # PowerShell
LEFTHOOK=0            # bash
```

## Creating a New App

```bash
pnpm create-app       # Scaffolds a governed app with auth, telemetry, and contracts
```

## Creating a New Package

Follow the pattern in existing `packages/` directories. Ensure:

- `package.json` has the `@nzila/` scope
- TypeScript with `tsconfig.json` extending root config
- `src/index.ts` as the main entry point

## PR Checklist

- [ ] `pnpm lint` passes
- [ ] `pnpm typecheck` passes
- [ ] `pnpm test:fast` passes
- [ ] No governance drift (`pnpm validate:governance`)
- [ ] README updated if public API changed

## AI Workflow (gstack Pilot)

gstack is enabled in optional pilot mode for this repository.

- Use gstack for plan quality, review quality, QA reporting, and security analysis.
- Do not use gstack as a replacement for required repository checks.
- Maintainers control when deployment or shipping automation is permitted.

Allowed during pilot:

- `/office-hours`, `/autoplan`, `/plan-*`, `/review`, `/qa-only`, `/investigate`, `/cso`, `/retro`

Restricted unless explicitly approved by a maintainer on the active PR or issue:

- `/ship`, `/land-and-deploy`, `/canary`, `/setup-deploy`, `/setup-gbrain`, `/sync-gbrain`, `/gstack-upgrade`
