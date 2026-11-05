import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * Union Eyes tests read application files relative to the application directory (readFileSync(join(process.cwd(), 'app/api/...'))) and the
 * repository's docs and tooling as '../../docs'. CI starts vitest at the repository root (`vitest run --project union-eyes`), where none of those
 * paths exist, so every such test failed there and passed on a machine started from apps/union-eyes. A test result must not depend on where vitest
 * was started, so each worker moves to the application directory before its file runs.
 */
const applicationDirectory = dirname(fileURLToPath(import.meta.url))

if (process.cwd() !== applicationDirectory) {
  try {
    process.chdir(applicationDirectory)
  } catch (error) {
    // process.chdir is not available in a worker thread. Running the suite from the wrong directory would fail test by test and look like
    // hundreds of unrelated defects, so it fails once, here, saying why.
    throw new Error(
      `The Union Eyes tests need ${applicationDirectory} as the working directory and could not change to it (${(error as Error).message}). Run them with the forks pool.`,
    )
  }
}
