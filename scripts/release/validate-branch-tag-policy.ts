#!/usr/bin/env npx tsx
import process from 'node:process'

type Mode = 'branch' | 'tag'

const BRANCH_PATTERNS: RegExp[] = [
  /^main$/,
  /^develop$/,
  /^feat\/.+/,
  /^fix\/.+/,
  /^chore\/.+/,
  /^docs\/.+/,
  /^refactor\/.+/,
  /^perf\/.+/,
  /^test\/.+/,
  /^ci\/.+/,
  /^hotfix\/.+/,
  /^integration\/.+/,
  /^ops\/.+/,
  /^release\/[0-9]+\.[0-9]+\.[0-9]+$/,
  // Dated production-readiness certification branches (release-engineering
  // checkpoints, distinct from semver releases). Strict YYYY-MM-DD suffix
  // preserves naming discipline.
  /^release\/prod-readiness-\d{4}-\d{2}-\d{2}$/,
  /^dependabot\/.+/,
  /^renovate\/.+/,
  /^copilot\/.+/,
]

// Branch names admitted by exact match only. This is not a pattern: it does not open
// the cursor/ family, and a new name needs its own reviewed entry here.
//
// cursor/ue-convergence-p0-cfc5 is the head of open pull request #971. Renaming the head
// branch of an open pull request closes that pull request, so the existing name is
// grandfathered rather than renamed. Remove this entry once that pull request is merged
// or closed.
const GRANDFATHERED_BRANCHES: ReadonlySet<string> = new Set(['cursor/ue-convergence-p0-cfc5'])

const TAG_PATTERN = /^v\d+\.\d+\.\d+(?:-(?:alpha|beta|rc)\.\d+)?$/

function getArg(name: string): string | undefined {
  const idx = process.argv.indexOf(name)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

function fail(message: string): never {
  console.error(`ERROR: ${message}`)
  process.exit(1)
}

function ok(message: string): void {
  console.log(`OK: ${message}`)
}

function validateBranch(ref: string): void {
  const matched = GRANDFATHERED_BRANCHES.has(ref) || BRANCH_PATTERNS.some((pattern) => pattern.test(ref))
  if (!matched) {
    fail(
      `Branch '${ref}' does not match policy. Allowed examples: feat/*, fix/*, chore/*, docs/*, refactor/*, perf/*, test/*, ci/*, hotfix/*, integration/*, ops/*, release/X.Y.Z, release/prod-readiness-YYYY-MM-DD, main, develop, dependabot/*, renovate/*, copilot/*. Grandfathered exact name: cursor/ue-convergence-p0-cfc5`,
    )
  }
  ok(`Branch '${ref}' is policy-compliant`)
}

function validateTag(ref: string): void {
  if (!TAG_PATTERN.test(ref)) {
    fail(`Tag '${ref}' is invalid. Expected: vX.Y.Z or vX.Y.Z-rc.N / -beta.N / -alpha.N`)
  }
  ok(`Tag '${ref}' is policy-compliant`)
}

function main(): void {
  const mode = (getArg('--mode') ?? process.env.REF_POLICY_MODE ?? 'branch') as Mode
  const ref = getArg('--ref') ?? process.env.REF_TO_VALIDATE ?? process.env.GITHUB_REF_NAME ?? ''

  if (!ref) {
    fail('No ref provided. Use --ref <name> or set GITHUB_REF_NAME/REF_TO_VALIDATE.')
  }

  if (mode !== 'branch' && mode !== 'tag') {
    fail(`Invalid mode '${mode}'. Use --mode branch|tag`)
  }

  if (mode === 'branch') {
    validateBranch(ref)
  } else {
    validateTag(ref)
  }
}

main()
