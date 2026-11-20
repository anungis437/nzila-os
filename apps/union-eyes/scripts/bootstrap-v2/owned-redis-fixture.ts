/**
 * Owned disposable Redis for the V2 production-build runtime.
 *
 * The production build rate-limits through Redis and, without it, explicit per-route limits refuse every request (fail closed).
 * Acceptance must therefore run against a real Redis, never a fail-open bypass. This fixture follows the native PostgreSQL fixture's
 * ownership contract: a digest-pinned image that is never pulled implicitly, an ownership label checked before removal, a loopback-only
 * random host port, no persistence, and a dispose step whose result the acceptance qualification asserts.
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import net from 'node:net'

/** redis:7.4-alpine OCI index (multi-architecture), 2026-11-20. No mutable tag fallback is allowed. */
export const OWNED_REDIS_IMAGE =
  'redis:7.4-alpine@sha256:7f7d30b7fdd09467bac58198a1f166dd69789d348d4fe859cccb20e0cf287fbe'
export const OWNED_REDIS_MISSION = 'UE_BOOTSTRAP_V2_RUNTIME_REDIS'

/** One PING over the RESP protocol: proves the server answers on the owned loopback port. */
function ping(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host: '127.0.0.1', port })
    const done = (ok: boolean) => {
      socket.destroy()
      resolve(ok)
    }
    socket.setTimeout(2_000, () => done(false))
    socket.once('error', () => done(false))
    socket.once('connect', () => socket.write('*1\r\n$4\r\nPING\r\n'))
    socket.once('data', (data) => done(data.toString('utf8').startsWith('+PONG')))
  })
}

export async function openOwnedRedisFixture() {
  const ownership = randomUUID()
  const name = `ue-v2-redis-${ownership}`
  let container: string | undefined
  /** Keys the application wrote: evidence the production rate limiter actually consulted this Redis. */
  const keyCount = () =>
    container ? Number(execFileSync('docker', ['exec', container, 'redis-cli', 'DBSIZE'], { encoding: 'utf8' }).trim()) : 0
  const dispose = async (): Promise<{ ownedRedisRemoved: boolean; keysObservedBeforeRemoval: number }> => {
    if (!container) return { ownedRedisRemoved: true, keysObservedBeforeRemoval: 0 }
    const keysObservedBeforeRemoval = keyCount()
    const inspection = JSON.parse(execFileSync('docker', ['inspect', container], { encoding: 'utf8' })) as {
      Id: string
      Name: string
      Config: { Labels: Record<string, string> }
    }[]
    assert.equal(inspection[0].Id, container)
    assert.equal(inspection[0].Name, `/${name}`)
    assert.equal(inspection[0].Config.Labels['nzila.mission'], OWNED_REDIS_MISSION)
    assert.equal(inspection[0].Config.Labels['nzila.qualification-owner'], ownership)
    execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' })
    const remaining = execFileSync('docker', ['ps', '-aq', '--filter', `id=${container}`], { encoding: 'utf8' }).trim()
    container = undefined
    return { ownedRedisRemoved: remaining === '', keysObservedBeforeRemoval }
  }
  try {
    container = execFileSync(
      'docker',
      [
        'run', '-d', '--pull', 'never', '--name', name,
        '--label', `nzila.mission=${OWNED_REDIS_MISSION}`,
        '--label', `nzila.qualification-owner=${ownership}`,
        '--memory', '256m', '--cpus', '1',
        '-p', '127.0.0.1::6379',
        OWNED_REDIS_IMAGE,
        // Disposable: nothing is written to disk and nothing survives the container.
        'redis-server', '--save', '', '--appendonly', 'no',
      ],
      { encoding: 'utf8' },
    ).trim()
    const binding = execFileSync('docker', ['port', container, '6379/tcp'], { encoding: 'utf8' }).trim().split('\n')[0]
    assert.ok(binding.startsWith('127.0.0.1:'), 'Owned Redis must publish on loopback only')
    const port = Number(binding.split(':').at(-1))
    assert.ok(Number.isInteger(port) && port > 0, 'Owned Redis port required')
    for (let attempt = 0; !(await ping(port)); attempt++) {
      if (attempt >= 60) throw new Error('Owned Redis did not answer PING')
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    return { environment: { REDIS_URL: `redis://127.0.0.1:${port}` }, ports: [port], dispose }
  } catch (error) {
    await dispose().catch(() => undefined)
    throw error
  }
}
