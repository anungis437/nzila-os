import { spawn } from 'node:child_process'
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { openLocalVaultFixture } from './local-vault-fixture'
import { observedNetworkEvents, syntheticNextEnvironment } from './next-acceptance'
import { root } from './source'

describe('owned real-SDK production vault bootstrap', () => {
  it.each(['accepted', 'revoked', 'untrusted-tls'] as const)(
    'executes production durable encryption with %s authority',
    async (mode) => {
      const state = path.join(root, 'artifacts', `ue-v2-local-vault-${randomUUID()}`)
      mkdirSync(state, { recursive: true })
      const fixture = await openLocalVaultFixture(state)
      const implementation = fileURLToPath(new URL('../../lib/encryption.ts', import.meta.url))
      const sourceDigest = createHash('sha256').update(readFileSync(implementation)).digest('hex')
      const boundary = fileURLToPath(new URL('./next-network-boundary.cjs', import.meta.url))
      const url = 'postgresql://synthetic:synthetic@127.0.0.1:54321/synthetic'
      const env: NodeJS.ProcessEnv = {
        ...syntheticNextEnvironment(
          { runtimeUrl: url, systemUrl: url, authUrl: url },
          43210,
          boundary,
          state,
        ),
        ...fixture.environment,
      }
      env.UE_V2_LOCAL_PORTS += `,${fixture.ports.join(',')}`
      if (mode === 'revoked') fixture.revoke()
      if (mode === 'untrusted-tls') delete env.NODE_EXTRA_CA_CERTS
      let output = ''
      let exitCode: number | null = null
      let cleanup: Awaited<ReturnType<typeof fixture.dispose>> | undefined
      try {
        const child = spawn(
          process.execPath,
          [
            '--require',
            createRequire(import.meta.url).resolve('tsx/cjs'),
            '-e',
            `const assert=require('node:assert/strict');
          const service=require(${JSON.stringify(implementation)});
          (async()=>{
            if(${JSON.stringify(mode)}==='accepted'){
              const value='owned-synthetic-credential-only';
              const encrypted=await service.encryptSecret(value);
              assert.notEqual(encrypted,value);
              assert.equal(await service.decryptSecret(encrypted),value);
              assert.equal(service.shouldReEncryptData(encrypted),false);
              await service.forceKeyRotation();
              assert.equal(service.shouldReEncryptData(encrypted),true);
              assert.equal(await service.decryptSecret(encrypted),value);
              const rotated=await service.encryptSecret(value);
              assert.equal(service.shouldReEncryptData(rotated),false);
              assert.equal(await service.decryptSecret(rotated),value);
              const legacy=JSON.parse(Buffer.from(encrypted,'base64').toString('utf8'));
              delete legacy.keyId;
              delete legacy.wrappedKey;
              delete legacy.wrapAlgorithm;
              await assert.rejects(service.decryptSecret(Buffer.from(JSON.stringify(legacy)).toString('base64')),
                /Failed to decrypt data/);
              const corrupted=JSON.parse(Buffer.from(encrypted,'base64').toString('utf8'));
              const ciphertext=Buffer.from(corrupted.ciphertext,'base64');
              ciphertext[0]^=1;
              corrupted.ciphertext=ciphertext.toString('base64');
              await assert.rejects(service.decryptSecret(Buffer.from(JSON.stringify(corrupted)).toString('base64')),
                /Failed to decrypt data/);
              const forged=JSON.parse(Buffer.from(encrypted,'base64').toString('utf8'));
              forged.keyId='https://untrusted.invalid/keys/pii-encryption-key/v1';
              await assert.rejects(service.decryptSecret(Buffer.from(JSON.stringify(forged)).toString('base64')),
                /Failed to decrypt data/);
              console.log('UE_V2_RESTART_ENVELOPES:'+JSON.stringify([encrypted,rotated]));
              console.log('UE_V2_LOCAL_VAULT_PROOF:ENCRYPT_DECRYPT_AND_TAMPER_DENIAL');
            }else{
              await assert.rejects(service.encryptSecret('owned-synthetic-credential-only'),
                /Azure Key Vault initialization failed in production environment/);
              console.log('UE_V2_LOCAL_VAULT_PROOF:AUTHORITY_REFUSED');
            }
            process.exit(0);
          })().catch(e=>{console.error(e);process.exit(1)});`,
          ],
          { env, stdio: ['ignore', 'pipe', 'pipe'] },
        )
        child.stdout.on('data', (bytes: Buffer) => (output += bytes.toString()))
        child.stderr.on('data', (bytes: Buffer) => (output += bytes.toString()))
        exitCode = await new Promise<number | null>((resolve, reject) => {
          const timer = setTimeout(() => {
            child.kill()
            reject(new Error('UE_V2_LOCAL_VAULT_CHILD_TIMEOUT'))
          }, 200000)
          child.once('error', (error) => {
            clearTimeout(timer)
            reject(error)
          })
          child.once('exit', (code) => {
            clearTimeout(timer)
            resolve(code)
          })
        })
        expect(exitCode, output).toBe(0)
        expect(output).toContain('UE_V2_LOCAL_VAULT_PROOF:')
        if (mode === 'accepted') {
          const envelopes = output.match(/^UE_V2_RESTART_ENVELOPES:(.+)$/m)?.[1]
          expect(envelopes).toBeDefined()
          const restarted = spawn(
            process.execPath,
            [
              '--require',
              createRequire(import.meta.url).resolve('tsx/cjs'),
              '-e',
              `const assert=require('node:assert/strict');
            const service=require(${JSON.stringify(implementation)});
            (async()=>{
              for(const encrypted of ${envelopes}){
                assert.equal(await service.decryptSecret(encrypted),'owned-synthetic-credential-only');
              }
              const envelopes=${envelopes};
              assert.equal(service.shouldReEncryptData(envelopes[0]),true);
              assert.equal(service.shouldReEncryptData(envelopes[1]),false);
              console.log('UE_V2_RESTART_PROOF:OLD_AND_ROTATED_DECRYPTED');
              process.exit(0);
            })().catch(e=>{console.error(e);process.exit(1)});`,
            ],
            { env, stdio: ['ignore', 'pipe', 'pipe'] },
          )
          let restartOutput = ''
          restarted.stdout.on('data', (bytes: Buffer) => (restartOutput += bytes.toString()))
          restarted.stderr.on('data', (bytes: Buffer) => (restartOutput += bytes.toString()))
          const restartCode = await new Promise<number | null>((resolve, reject) => {
            const timer = setTimeout(() => {
              restarted.kill()
              reject(new Error('UE_V2_RESTART_CHILD_TIMEOUT'))
            }, 200000)
            restarted.once('error', (error) => {
              clearTimeout(timer)
              reject(error)
            })
            restarted.once('exit', (code) => {
              clearTimeout(timer)
              resolve(code)
            })
          })
          expect(restartCode, restartOutput).toBe(0)
          expect(restartOutput).toContain('OLD_AND_ROTATED_DECRYPTED')
          output += restartOutput
          expect(fixture.observations.identityAccepted).toBeGreaterThan(0)
          expect(fixture.observations.keysAccepted).toBeGreaterThan(0)
          expect(fixture.observations.rotationsAccepted).toBe(1)
          expect(fixture.observations.wrapsAccepted).toBe(2)
          expect(fixture.observations.unwrapsAccepted).toBeGreaterThanOrEqual(5)
          expect(output).toContain('ENCRYPT_DECRYPT_AND_TAMPER_DENIAL')
        } else {
          expect(fixture.observations.keysAccepted).toBe(0)
          if (mode === 'revoked') expect(fixture.observations.identityDenied).toBeGreaterThan(0)
          else expect(fixture.observations.challenges).toBe(0)
        }
        const network = observedNetworkEvents(output)
        expect(network.length).toBeGreaterThan(0)
        expect(
          network.filter((event) => event.allowed && event.targetClass === 'NON_LOOPBACK'),
        ).toHaveLength(0)
        for (const secret of fixture.secrets) expect(output).not.toContain(secret)
      } finally {
        cleanup = await fixture.dispose()
        rmSync(state, { recursive: true, force: true })
      }
      expect(existsSync(state)).toBe(false)
      expect(createHash('sha256').update(readFileSync(implementation)).digest('hex')).toBe(
        sourceDigest,
      )
      writeFileSync(
        path.join(root, 'artifacts', `ue-v2-local-vault-${mode}.json`),
        JSON.stringify(
          {
            mode,
            nodeEnvironment: env.NODE_ENV,
            sourceDigest,
            exitCode,
            sdkMocked: false,
            certificateValidationDisabled: false,
            fallbackKeyPresent: false,
            productionCustodyProvisioning: 'NOT_QUALIFIED_BY_LOCAL_FIXTURE',
            observations: fixture.observations,
            networkObservations: observedNetworkEvents(output),
            cleanup: { ...cleanup, ownedStateRemoved: !existsSync(state) },
          },
          null,
          2,
        ) + '\n',
      )
    },
    240000,
  )
})
