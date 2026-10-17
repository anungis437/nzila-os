import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import net from 'node:net'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { describe, expect, it, vi } from 'vitest'
import {
  environmentClassifications,
  observedNetworkEvents,
  safeSnapshotEntry,
  syntheticNextEnvironment,
} from './next-acceptance'

describe('isolated actual Next acceptance boundary', () => {
  it('retains original licensed Poppins weights without a Google build-time fetch', () => {
    const directory = fileURLToPath(new URL('../../public/fonts/poppins/', import.meta.url))
    const provenance = JSON.parse(
      readFileSync(path.join(directory, 'provenance.json'), 'utf8'),
    ) as { files: Record<string, string>; modified: boolean; license: string }
    expect(provenance.modified).toBe(false)
    expect(provenance.license).toBe('SIL Open Font License 1.1')
    for (const [file, expected] of Object.entries(provenance.files))
      expect(
        createHash('sha256')
          .update(readFileSync(path.join(directory, file)))
          .digest('hex'),
      ).toBe(expected)
    const layout = readFileSync(
      fileURLToPath(new URL('../../app/layout.tsx', import.meta.url)),
      'utf8',
    )
    expect(layout).toContain("from 'next/font/local'")
    expect(layout).not.toContain('next/font/google')
    expect(readFileSync(path.join(directory, 'OFL.txt'), 'utf8')).toContain(
      'Copyright 2020 The Poppins Project Authors',
    )
  })
  it('does not copy any Next dotenv variant or dependency/build output', () => {
    for (const name of [
      '.env',
      '.env.local',
      '.env.production',
      '.env.production.local',
      'node_modules',
      '.next',
      '.git',
    ])
      expect(safeSnapshotEntry(path.join('source', name))).toBe(false)
    expect(safeSnapshotEntry(path.join('source', 'instrumentation.ts'))).toBe(true)
  })

  it('constructs synthetic children without inherited credentials, proxies or node injection', () => {
    vi.stubEnv('STRIPE_SECRET_KEY', 'must-not-propagate')
    vi.stubEnv('NODE_OPTIONS', '--require workstation-injection')
    vi.stubEnv('HTTP_PROXY', 'http://external.invalid')
    try {
      const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture'
      const env = syntheticNextEnvironment(
        { runtimeUrl: url, systemUrl: url, authUrl: url },
        43210,
        'local-boundary.cjs',
      )
      expect(env.STRIPE_SECRET_KEY).toBeUndefined()
      expect(env.HTTP_PROXY).toBeUndefined()
      expect(env.NODE_OPTIONS).not.toContain('workstation')
      expect(env.SKIP_DB_STARTUP_CHECK).toBeUndefined()
      expect(env.PLAYWRIGHT_TEST_AUTH).toBeUndefined()
      expect(env.OTEL_SDK_DISABLED).toBe('true')
      expect(
        environmentClassifications(env).filter(
          (entry) => entry.classification === 'OWNED_LOOPBACK_FIXTURE',
        ),
      ).toHaveLength(4)
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('rejects external database URLs before a child can start', () => {
    expect(() =>
      syntheticNextEnvironment(
        {
          runtimeUrl: 'postgresql://user:password@external.invalid/db',
          systemUrl: '',
          authUrl: '',
        },
        43210,
        'boundary.cjs',
      ),
    ).toThrow()
  })

  it('loads the real Windows preload and denies external and unowned loopback sockets', () => {
    const boundary = fileURLToPath(new URL('./next-network-boundary.cjs', import.meta.url))
    const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture'
    const env = syntheticNextEnvironment(
      { runtimeUrl: url, systemUrl: url, authUrl: url },
      43210,
      boundary,
    )
    const child = spawnSync(
      process.execPath,
      [
        '-e',
        `const net=require('node:net'); const dns=require('node:dns');
        for(const [host,port] of [['external.invalid',54321],['127.0.0.1',54322],['169.254.169.254',80],['127.0.0.1',0]]) {
          try { net.connect({host,port}); process.exit(2); }
          catch(e) { if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED') throw e; }
        }
        try { dns.lookup('external.invalid',()=>{}); process.exit(3); }
        catch(e) { if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED') throw e; }
        try { net.connect({path:'\\\\\\\\.\\\\pipe\\\\unowned'}); process.exit(4); }
        catch(e) { if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED') throw e; }
        console.log('BOUNDARY_DENIALS_PROVEN');`,
      ],
      { env, encoding: 'utf8', timeout: 10000 },
    )
    const observations = observedNetworkEvents(child.stderr)
    expect(observations).toHaveLength(6)
    expect(observations.every((event) => event.allowed === false)).toBe(true)
    expect(child.stderr).not.toContain('external.invalid')
    expect(child.stderr).not.toContain('unowned')
    expect(child.status).toBe(0)
    expect(child.stdout).toContain('BOUNDARY_DENIALS_PROVEN')
  })

  it('permits owned HTTP while containing fetch, DNS, UDP and inherited workers', async () => {
    const server = net.createServer((socket) => {
      socket.on('data', () =>
        socket.end('HTTP/1.1 200 OK\r\nContent-Length: 2\r\nConnection: close\r\n\r\nok'),
      )
    })
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('Owned listener not created')
    const boundary = fileURLToPath(new URL('./next-network-boundary.cjs', import.meta.url))
    const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/local_fixture'
    const env = syntheticNextEnvironment(
      { runtimeUrl: url, systemUrl: url, authUrl: url },
      address.port,
      boundary,
    )
    try {
      const child = spawn(
        process.execPath,
        [
          '-e',
          `const assert=require('node:assert/strict'); const dns=require('node:dns');
          const dgram=require('node:dgram'); const {Worker}=require('node:worker_threads');
          (async()=>{
            assert.equal(await (await fetch('http://127.0.0.1:${address.port}')).text(),'ok');
            await assert.rejects(fetch('http://external.invalid'),e=>e.cause.code==='UE_V2_EXTERNAL_NETWORK_DENIED');
            assert.throws(()=>dns.promises.lookup('external.invalid'),/UE_V2_EXTERNAL_NETWORK_DENIED/);
            assert.throws(()=>dns.resolve4('external.invalid',()=>{}),/UE_V2_EXTERNAL_NETWORK_DENIED/);
            const socket=dgram.createSocket('udp4');
            assert.throws(()=>socket.send('no',53,'external.invalid'),/UE_V2_EXTERNAL_NETWORK_DENIED/);
            socket.close();
            await new Promise((resolve,reject)=>{
              const worker=new Worker("const net=require('node:net'); const {parentPort}=require('node:worker_threads'); try {net.connect({host:'external.invalid',port:80}); process.exit(2)} catch(e) {if(e.code!=='UE_V2_EXTERNAL_NETWORK_DENIED')throw e;parentPort.postMessage('denied')}",{eval:true});
              worker.once('message',m=>m==='denied'?resolve():reject(new Error(m)));
              worker.once('error',reject);
            });
            console.log('OWNED_HTTP_AND_WORKER_CONTAINMENT_PROVEN');
          })().catch(e=>{console.error(e);process.exitCode=1});`,
        ],
        { env, stdio: ['ignore', 'pipe', 'pipe'] },
      )
      let output = ''
      child.stdout.on('data', (bytes: Buffer) => (output += bytes.toString()))
      child.stderr.on('data', (bytes: Buffer) => (output += bytes.toString()))
      const exit = await new Promise<number | null>((resolve, reject) => {
        child.once('error', reject)
        child.once('exit', resolve)
      })
      expect(output).toContain('OWNED_HTTP_AND_WORKER_CONTAINMENT_PROVEN')
      expect(exit).toBe(0)
      const observations = observedNetworkEvents(output)
      expect(observations.some((event) => event.allowed === true)).toBe(true)
      expect(observations.some((event) => event.transport === 'UDP')).toBe(true)
      expect(observations.some((event) => event.transport === 'DNS_RESOLVE')).toBe(true)
      expect(
        observations
          .filter((event) => event.allowed === true)
          .every((event) => event.targetClass === 'LOOPBACK' && event.port === address.port),
      ).toBe(true)
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 15000)
})
