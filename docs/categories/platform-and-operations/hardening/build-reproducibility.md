# Build Reproducibility Policy

**PR 4 — Hardening Pass**  
**Status**: Implemented  
**Owner**: `@nzila/platform`

---

## Summary

This document specifies how the Nzila monorepo achieves reproducible builds and what guardrails prevent non-determinism from reaching production.

---

## What We Enforce

### 1. Locked Dependencies (`pnpm-lock.yaml`)

All CI jobs run `pnpm install --frozen-lockfile`, which errors if the lockfile is out of sync with `package.json`. This prevents:

- "Works on my machine" dependency drift
- Silent upgrades to dependencies with breaking changes

**Enforcement**: All workflows in `.github/workflows/` use `pnpm install --frozen-lockfile`.

### 2. Pinned Base Images (Dockerfiles)

All `Dockerfile` base images are pinned to a specific version tag (e.g., `node:22.13.1-alpine3.21`) rather than a floating tag (e.g., `node:22-alpine`). This prevents unexpected OS-level changes between builds.

**To update the base image:**

```bash
# Search for the specific digest on Docker Hub or via:
docker manifest inspect node:22.13.1-alpine3.21 --verbose
# Update all Dockerfiles with the new version tag
```

**Files**: `Dockerfile`, `apps/orchestrator-api/Dockerfile`

### 3. Turbo Cache (Build Caching)

Turborepo caches build outputs based on input hashes. The cache key covers:

- Source files
- Environment variables listed in `turbo.json#globalDependencies`
- All transitive dependencies

**Cache busting**: When a dependency changes (lockfile, source, env vars), Turbo automatically invalidates.

### 4. TypeScript `isolatedModules`

`isolatedModules: true` in `packages/config/tsconfig.base.json` ensures each file can be type-checked independently, preventing non-deterministic type resolution across build invocations.

### 5. Strict ESM

All packages use `"type": "module"` and `"moduleResolution": "bundler"`, eliminating CommonJS dual-mode ambiguity.

---

## Reproduction Steps

Any build from a given commit SHA should be reproducible:

```bash
# Clone the exact commit
git clone --branch main --depth 1 https://github.com/nzila/nzila-automation
git checkout <commit-sha>

# Reproduce the build
pnpm install --frozen-lockfile
pnpm build

# Reproduce the Docker image
docker build --no-cache -f Dockerfile -t nzila:local .
```

---

## Future Enhancements

| Priority | Enhancement | Notes |
|----------|-------------|-------|
| Medium | Pin Docker base to digest (`@sha256:...`) | Requires automated digest update tooling |
| Low | Add `--platform linux/amd64` to all Docker builds | Ensures cross-arch consistency |
| Low | Use Turbo Remote Cache | Reduces redundant CI builds |

---

*Part of the Nzila Hardening Pass — Phase 1 (PR 4)*
