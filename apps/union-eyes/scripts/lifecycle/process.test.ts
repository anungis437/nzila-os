/**
 * Phase 0C.1 §9/§11 tests — process/port primitives.
 *
 * These tests use a HIGH-numbered port to avoid collision with any real
 * dev server and never spawn a real Next.js — they use `node -e` to
 * simulate a controllable child process.
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  _internal,
  allocatePort,
  bootServer,
  isPortFree,
  pollReadiness,
  preflight,
  stopServer,
  verifyPortRelease,
} from './process'

// Use a randomly-chosen high port to avoid clashing with anything real.
const TEST_PORT = 34771
const TEST_PORT_B = 34772

function cleanPidFile(): void {
  const p = _internal.pidFile()
  if (existsSync(p)) rmSync(p, { force: true })
}

beforeEach(() => cleanPidFile())
afterEach(async () => {
  // best-effort tear-down: stop any tracked process
  try {
    await stopServer({ gracefulTimeoutMs: 500 })
  } catch {
    /* ignore */
  }
  cleanPidFile()
})

describe('isPortFree / allocatePort / verifyPortRelease', () => {
  it('returns true for a port with no listener', async () => {
    expect(await isPortFree(TEST_PORT)).toBe(true)
  })

  it('returns false when a listener holds the port', async () => {
    const srv = net.createServer()
    await new Promise<void>((r) => srv.listen(TEST_PORT_B, '127.0.0.1', () => r()))
    try {
      expect(await isPortFree(TEST_PORT_B)).toBe(false)
    } finally {
      await new Promise<void>((r) => srv.close(() => r()))
    }
  })

  it('allocatePort with autoAssign walks to the next free port', async () => {
    const srv = net.createServer()
    await new Promise<void>((r) => srv.listen(TEST_PORT, '127.0.0.1', () => r()))
    try {
      const res = await allocatePort({ preferred: TEST_PORT, autoAssign: true })
      expect(res.free).toBe(true)
      expect(res.port).toBeGreaterThan(TEST_PORT)
    } finally {
      await new Promise<void>((r) => srv.close(() => r()))
    }
  })

  it('allocatePort without autoAssign refuses when busy', async () => {
    const srv = net.createServer()
    await new Promise<void>((r) => srv.listen(TEST_PORT, '127.0.0.1', () => r()))
    try {
      const res = await allocatePort({ preferred: TEST_PORT, autoAssign: false })
      expect(res.free).toBe(false)
      expect(res.reason).toMatch(/in use/)
    } finally {
      await new Promise<void>((r) => srv.close(() => r()))
    }
  })

  it('verifyPortRelease agrees with isPortFree', async () => {
    const rel = await verifyPortRelease(TEST_PORT)
    expect(rel.free).toBe(true)
  })
})

describe('preflight', () => {
  it('reports node version and clean pid state', async () => {
    const res = await preflight(TEST_PORT)
    const idIndex = new Map(res.checks.map((c) => [c.id, c]))
    expect(idIndex.get('node.version')?.ok).toBe(true)
    expect(idIndex.get('pid.clean')?.ok).toBe(true)
  })
})

describe('bootServer / stopServer PID discipline', () => {
  it('refuses to double-boot when pid.json tracks a live PID', async () => {
    // Spawn a long-running sleeper via node.
    const child = spawn(process.execPath, ['-e', 'setInterval(()=>{}, 1000)'], {
      stdio: 'ignore',
      detached: false,
    })
    try {
      _internal.writePidRecord({
        pid: child.pid!,
        port: TEST_PORT,
        startedAt: new Date().toISOString(),
        command: 'sleeper',
        runId: 'test-double-boot',
      })
      // Try to boot a new one — must refuse.
      expect(() =>
        bootServer({
          runId: 'test-2',
          port: TEST_PORT,
          cwd: process.cwd(),
          env: {},
          command: process.execPath,
          args: ['-e', 'process.exit(0)'],
        }),
      ).toThrow(/double-boot/)
    } finally {
      child.kill('SIGKILL')
    }
  })

  it('clears stale pid.json when tracked PID is dead', async () => {
    _internal.writePidRecord({
      pid: 999999, // guaranteed dead
      port: TEST_PORT,
      startedAt: new Date().toISOString(),
      command: 'dead',
      runId: 'test-stale',
    })
    // preflight should clear it
    const res = await preflight(TEST_PORT)
    const rec = _internal.readPidRecord()
    expect(rec).toBeNull()
    expect(res.checks.find((c) => c.id === 'pid.clean')?.ok).toBe(true)
  })

  it('boot → stop lifecycle records and clears pid.json', async () => {
    // Spawn a script that stays alive
    const result = bootServer({
      runId: 'test-lifecycle',
      port: TEST_PORT,
      cwd: process.cwd(),
      env: {},
      command: process.execPath,
      args: ['-e', 'setInterval(()=>{},1000)'],
    })
    expect(result.pid).toBeGreaterThan(0)

    const pidPath = _internal.pidFile()
    expect(existsSync(pidPath)).toBe(true)
    const rec = JSON.parse(readFileSync(pidPath, 'utf8'))
    expect(rec.pid).toBe(result.pid)
    expect(rec.port).toBe(TEST_PORT)
    expect(rec.runId).toBe('test-lifecycle')

    const stopRes = await stopServer({ gracefulTimeoutMs: 2000 })
    expect(stopRes.stopped).toBe(true)
    expect(existsSync(pidPath)).toBe(false)
  })

  it('stopServer returns no-record when nothing is tracked', async () => {
    const res = await stopServer()
    expect(res.method).toBe('no-record')
    expect(res.stopped).toBe(true)
  })
})

describe('pollReadiness', () => {
  it('returns ready=true when endpoint returns 200', async () => {
    // Trivial HTTP server that returns 200 immediately.
    const srv = net.createServer((sock) => {
      sock.once('data', () => {
        sock.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\n\r\n{}')
      })
    })
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()))
    const addr = srv.address() as net.AddressInfo
    try {
      const res = await pollReadiness({
        url: `http://127.0.0.1:${addr.port}/`,
        timeoutMs: 5000,
        intervalMs: 100,
      })
      expect(res.ready).toBe(true)
      expect(res.lastStatus).toBe(200)
    } finally {
      await new Promise<void>((r) => srv.close(() => r()))
    }
  })

  it('returns ready=false when endpoint never responds', async () => {
    const res = await pollReadiness({
      url: 'http://127.0.0.1:1/', // bogus
      timeoutMs: 400,
      intervalMs: 100,
    })
    expect(res.ready).toBe(false)
    expect(res.attempts).toBeGreaterThan(0)
  })

  it('caps each fetch with a per-request timeout (Phase 0C.2 §11)', async () => {
    // Server that ACCEPTS the connection but NEVER writes a response.
    // Without a per-request timeout, fetch would hang the entire poll
    // window on a single attempt. With the §11 fix, each fetch aborts
    // after ~10s and we advance to the next attempt.
    const sockets: net.Socket[] = []
    const srv = net.createServer((sock) => {
      sockets.push(sock)
      // Never respond — hold the socket open.
    })
    await new Promise<void>((r) => srv.listen(0, '127.0.0.1', () => r()))
    const addr = srv.address() as net.AddressInfo
    try {
      const startedAt = Date.now()
      // Budget: pollReadiness inner per-request timeout is 10s. Give the
      // overall poll 15s so we get ≥2 attempts even against a hanging
      // socket (attempt 1 aborts at ~10s, attempt 2 fires ~10.1s and
      // aborts ~20.1s at which point the outer loop has already exited).
      const res = await pollReadiness({
        url: `http://127.0.0.1:${addr.port}/`,
        timeoutMs: 15_000,
        intervalMs: 100,
      })
      const elapsed = Date.now() - startedAt
      expect(res.ready).toBe(false)
      // The bug this guards against: a single 15s+ fetch consuming the
      // whole window. We expect at least 2 attempts to have fired.
      expect(res.attempts).toBeGreaterThanOrEqual(2)
      // Overall completion must be bounded: at worst attempt-2 aborts at
      // ~20s. Anything past 25s would indicate the abort itself hung.
      expect(elapsed).toBeLessThan(25_000)
    } finally {
      for (const s of sockets) s.destroy()
      await new Promise<void>((r) => srv.close(() => r()))
    }
  }, 40_000)
})
