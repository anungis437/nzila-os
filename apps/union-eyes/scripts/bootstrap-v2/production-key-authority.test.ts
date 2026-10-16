import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash, randomUUID } from 'node:crypto'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { observedNetworkEvents, syntheticNextEnvironment } from './next-acceptance'
import { root } from './source'

describe('actual production encryption authority requirement', () => {
  it.each([false, true])(
    'rejects a credential write without the production vault (fallback present: %s)',
    (fallback) => {
      const boundary = fileURLToPath(new URL('./next-network-boundary.cjs', import.meta.url))
      const implementation = fileURLToPath(new URL('../../lib/encryption.ts', import.meta.url))
      const sourceDigest = createHash('sha256').update(readFileSync(implementation)).digest('hex')
      const loader = createRequire(import.meta.url).resolve('tsx/cjs')
      const state = path.join(root, 'artifacts', `ue-v2-key-authority-${randomUUID()}`)
      mkdirSync(state)
      const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/synthetic'
      const env = syntheticNextEnvironment(
        { runtimeUrl: url, systemUrl: url, authUrl: url },
        43210,
        boundary,
        state,
      )
      if (fallback) env.FALLBACK_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64')
      const child = spawnSync(
        process.execPath,
        [
          '--require',
          loader,
          '-e',
          `const service=require(${JSON.stringify(implementation)});
          (async()=>{
          try {
            await service.encryptSecret('owned-synthetic-credential-only');
            throw new Error('PRODUCTION_KEY_AUTHORITY_UNEXPECTEDLY_BYPASSED');
          } catch(error) {
            const expected='Azure Key Vault initialization failed in production environment';
            if(!error.message.includes(expected)) throw error;
            console.log('CURRENT_PRODUCTION_ENCRYPT_SECRET_REFUSED');
            console.log('UE_V2_KEY_AUTHORITY_RESULT:'+JSON.stringify({error:error.message}));
            process.exit(0);
          }
          })().catch(error=>{console.error(error);process.exit(1)});`,
        ],
        { env, encoding: 'utf8', timeout: 90000 },
      )
      rmSync(state, { recursive: true })
      assert.equal(child.error, undefined)
      expect(child.status, child.stderr).toBe(0)
      expect(child.stdout).toContain('CURRENT_PRODUCTION_ENCRYPT_SECRET_REFUSED')
      if (fallback)
        expect(child.stdout + child.stderr).toContain(
          'Fallback encryption keys are not permitted in production',
        )
      expect(observedNetworkEvents(child.stderr).every((event) => !event.allowed)).toBe(true)
      expect(child.stderr).toContain('UE_V2_BOUNDARY_LOADED:')
      expect(createHash('sha256').update(readFileSync(implementation)).digest('hex')).toBe(
        sourceDigest,
      )
      const observation = child.stdout.match(/^UE_V2_KEY_AUTHORITY_RESULT:(\{[^\r\n]*\})$/m)
      expect(observation).not.toBeNull()
      writeFileSync(
        path.join(
          root,
          'artifacts',
          `ue-v2-production-key-authority-${fallback ? 'fallback-refused' : 'absent'}.json`,
        ),
        JSON.stringify(
          {
            nodeVersion: process.version,
            nodeEnvironment: env.NODE_ENV,
            source: path.relative(root, implementation),
            sourceDigest,
            fallbackPresent: fallback,
            cloudCredentialsInherited: false,
            encryptSecret: 'REFUSED',
            observedError: JSON.parse(observation![1]).error as string,
            networkObservations: observedNetworkEvents(child.stderr),
            httpCallerExecution: 'NOT_EXECUTED',
            authorityProviderQualification: 'NOT_PROVEN',
          },
          null,
          2,
        ) + '\n',
      )
    },
    120000,
  )
})
