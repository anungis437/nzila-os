import { execSync } from 'node:child_process'

function resolveRange(): string {
  const explicitRange = process.argv[2]
  if (explicitRange) return explicitRange

  const before = process.env.GITHUB_EVENT_BEFORE
  const sha = process.env.GITHUB_SHA
  if (before && sha && before !== '0000000000000000000000000000000000000000') {
    return `${before}..${sha}`
  }

  try {
    execSync('git rev-parse --verify --quiet HEAD~1', { stdio: 'ignore' })
    return 'HEAD~1..HEAD'
  } catch {
    return 'HEAD'
  }
}

const range = resolveRange()

function getChangedFiles(): string[] {
  const command = range.includes('..')
    ? `git diff --name-only ${range}`
    : `git show --pretty="" --name-only ${range}`
  const output = execSync(command, { encoding: 'utf8' })
  return output.split('\n').map((f) => f.trim()).filter(Boolean)
}

function main() {
  const changed = getChangedFiles()
  const migrationFiles = changed.filter((file) =>
    file.startsWith('migrations/') ||
    file.includes('/migrate-') ||
    file.endsWith('.sql'),
  )

  if (migrationFiles.length === 0) {
    console.log('No migration files changed. Migration safety check passed.')
    return
  }

  const hasRunbookUpdate = changed.some((file) =>
    file === 'docs/ops/ENVIRONMENT_OPERATIONS.md' ||
    file.startsWith('ops/runbooks/') ||
    file.startsWith('docs/ops/release-governance/'),
  )

  if (!hasRunbookUpdate) {
    console.error('Migration files changed but no runbook/release-governance docs were updated in the same change.')
    console.error(`Changed migration files: ${migrationFiles.join(', ')}`)
    process.exit(1)
  }

  console.log('Migration safety check passed with required operational documentation updates.')
}

main()
