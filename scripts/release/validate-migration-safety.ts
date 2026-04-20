import { execSync } from 'node:child_process'

const range = process.argv[2] ?? 'HEAD~1..HEAD'

function getChangedFiles(): string[] {
  const output = execSync(`git diff --name-only ${range}`, { encoding: 'utf8' })
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
