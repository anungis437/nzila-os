import { existsSync, realpathSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

// CI starts the Union Eyes project from the repository root and a developer starts it from apps/union-eyes. Tests that read application files by a
// relative path must see the same directory either way (vitest.working-directory.ts), or they fail in one place and pass in the other.
describe('the working directory of a Union Eyes test', () => {
  const applicationDirectory = resolve(dirname(fileURLToPath(import.meta.url)), '../..')

  it('is the application directory, whichever directory vitest was started from', () => {
    expect(realpathSync(process.cwd())).toBe(realpathSync(applicationDirectory))
  })

  it('finds the application, the repository docs and the repository tooling by the relative paths the tests use', () => {
    expect(existsSync(resolve(process.cwd(), 'app/api'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), 'db/migrations-cache'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), '../../docs/union-eyes'))).toBe(true)
    expect(existsSync(resolve(process.cwd(), '../../tooling/scripts'))).toBe(true)
  })
})
