# Branching and Tagging Governance

Date: 2026-04-22
Scope: All future development and release operations for nzila-os.

## Branch Strategy

Allowed branch names:

- main
- develop
- feat/<summary>
- fix/<summary>
- chore/<summary>
- docs/<summary>
- refactor/<summary>
- perf/<summary>
- test/<summary>
- ci/<summary>
- hotfix/<summary>
- release/X.Y.Z
- dependabot/<summary>
- renovate/<summary>

Rules:

- All normal work lands via PR into main.
- release/X.Y.Z is reserved for release stabilization only.
- hotfix/* is reserved for production correction work.

## Tag Strategy

Allowed tag patterns:

- vX.Y.Z
- vX.Y.Z-rc.N
- vX.Y.Z-beta.N
- vX.Y.Z-alpha.N

Rules:

- Never create ad-hoc or lightweight release tags manually.
- Use the release script to create signed annotated tags.
- Production release tags should be generated from main.

## Release Commands

Validate refs locally:

- pnpm exec tsx scripts/release/validate-branch-tag-policy.ts --mode branch --ref feat/example
- pnpm exec tsx scripts/release/validate-branch-tag-policy.ts --mode tag --ref v1.2.3

Create a release tag (recommended flow):

- pnpm exec tsx scripts/release/tag-release.ts --bump patch
- pnpm exec tsx scripts/release/tag-release.ts --bump minor
- pnpm exec tsx scripts/release/tag-release.ts --bump major

Dry-run without creating a tag:

- pnpm exec tsx scripts/release/tag-release.ts --bump patch --dry-run --allow-non-main

## CI Enforcement

Workflow: .github/workflows/branch-tag-governance.yml

- PRs to main: validates head branch name.
- Pushes of tags v*: validates tag format.

This enforcement complements existing release gates in:

- .github/workflows/release-train.yml
- scripts/release/tag-release.ts

## Why GitHub still shows v1.0.0

GitHub Releases are tag-driven. If no new tag beyond v1.0.0 is pushed, the latest GitHub release remains v1.0.0 even when unreleased changes exist in main or feature branches.

Current state (2026-04-22):

- Latest git tag: v1.0.0
- Latest GitHub release: v1.0.0

That confirms version control is working as configured.
