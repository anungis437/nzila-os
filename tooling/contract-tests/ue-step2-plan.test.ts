import { spawnSync } from 'node:child_process'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('Union Eyes Step 2 planning package', () => {
  it('reconciles the frozen denominators without moving a release gate', () => {
    const result = spawnSync(process.execPath, ['tooling/scripts/ue-step2-plan-validate.mjs'], {
      cwd: join(__dirname, '..', '..'),
      encoding: 'utf8',
    })
    expect(result.status).toBe(0)
    expect(result.stdout).toContain('654 scope nodes')
    expect(result.stderr).toBe('')
  })
})
