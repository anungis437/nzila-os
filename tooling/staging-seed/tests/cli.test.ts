import { describe, expect, it } from 'vitest'
import { main } from '../src/cli'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

function tmpReport(): string {
  return path.join(os.tmpdir(), `seed-report-${Date.now()}-${Math.random()}.json`)
}

describe('cli.main', () => {
  it('prints help on --help', async () => {
    const code = await main(['--help'])
    expect(code).toBe(0)
  })

  it('rejects unknown command with exit 2', async () => {
    const code = await main(['nope'])
    expect(code).toBe(2)
  })

  it('reset without --yes exits 2', async () => {
    const code = await main(['reset'])
    expect(code).toBe(2)
  })

  it('seed succeeds with no registered seeders and writes a placeholder report', async () => {
    const out = tmpReport()
    const code = await main(['seed', `--report=${out}`])
    expect(code).toBe(0)
    const payload = JSON.parse(fs.readFileSync(out, 'utf-8')) as { note?: string; command: string }
    expect(payload.command).toBe('seed')
    expect(payload.note).toMatch(/Phase 1/)
    fs.unlinkSync(out)
  })

  it('reseed without --app exits 2', async () => {
    const code = await main(['reseed'])
    expect(code).toBe(2)
  })

  it('rejects invalid profile', async () => {
    const code = await main(['seed', '--profile=garbage'])
    expect(code).toBe(2)
  })

  it('rejects invalid app', async () => {
    const code = await main(['seed', '--app=garbage'])
    expect(code).toBe(2)
  })

  it('rejects negative --seed', async () => {
    const code = await main(['seed', '--seed=-1'])
    expect(code).toBe(2)
  })
})
