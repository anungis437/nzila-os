# Versioning Rules

## Semantic Versioning

All packages in `packages/` use [Semantic Versioning](https://semver.org/).

| Change Type | Required Bump | Notes |
|-------------|--------------|-------|
| Bug fix, non-breaking | PATCH | `0.1.x` |
| New feature, backward-compatible | MINOR | `0.x.0` |
| Breaking API change | MAJOR | `x.0.0` |

## Breaking Change Protocol

1. Bump the MAJOR version in `package.json`
2. Add a `BREAKING.md` or section in `CHANGELOG.md` describing:
   - What changed
   - Migration path for callers
3. Update all internal callers before merging
4. Add contract test if the breaking change affects an SDK contract

## Package Dependency Rules

- `packages/*` may depend on other `packages/*` but NOT on `apps/*`
- `apps/*` may depend on `packages/*` 
- `tooling/*` may depend on `packages/*` (dev/test only)

## Release Gating

Every release tag (`v*`) triggers `.github/workflows/release-train.yml` which:
1. Generates evidence pack artifact
2. Runs AI eval harness
3. Generates SBOM
4. Updates release notes in GitHub Releases

## Contract Test Enforcement

`tooling/contract-tests/sdk-contracts.test.ts` fails if:
- SDK exports drift from their declared types
- API endpoint signatures change without a version bump
