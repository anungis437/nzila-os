import { spawnSync } from 'node:child_process'
import { dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const appDir = dirname(fileURLToPath(import.meta.url))

describe('registerNodeProcessHandlers', () => {
  it('logs one uncaught exception and exits without recursive re-entry', () => {
    const script = `
      import { registerNodeProcessHandlers } from './instrumentation.node.ts'

      registerNodeProcessHandlers()
      const error = new Error('synthetic reset')
      error.code = 'ECONNRESET'
      throw error
    `

    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', '--input-type=module', '--eval', script],
      {
        cwd: appDir,
        encoding: 'utf8',
        timeout: 5_000,
        maxBuffer: 256 * 1024,
        windowsHide: true,
      },
    )

    const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
    const telemetryCount = output.match(/Uncaught exception/g)?.length ?? 0

    expect(result.error).toBeUndefined()
    expect(result.status).not.toBeNull()
    expect(result.status).not.toBe(0)
    expect(telemetryCount).toBe(1)
    expect(output).toContain('ECONNRESET')
  })
})