import {
  classifyChangedFiles,
  getChangedFiles,
  resolveRange,
  UnresolvableRangeError,
} from './migration-safety-policy'

function main() {
  const range = resolveRange(process.argv, process.env)

  let changed: string[]
  try {
    changed = getChangedFiles(range)
  } catch (error) {
    if (error instanceof UnresolvableRangeError) {
      console.error(error.message)
      console.error('Refusing to treat an unresolvable comparison range as migration-free.')
      process.exit(1)
    }
    throw error
  }

  const { migrationFiles, hasRunbookUpdate } = classifyChangedFiles(changed)

  if (migrationFiles.length === 0) {
    console.log('No migration files changed. Migration safety check passed.')
    return
  }

  if (!hasRunbookUpdate) {
    console.error('Migration files changed but no runbook/release-governance docs were updated in the same change.')
    console.error(`Changed migration files: ${migrationFiles.join(', ')}`)
    process.exit(1)
  }

  console.log('Migration safety check passed with required operational documentation updates.')
}

main()
