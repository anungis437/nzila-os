import { mkdtemp, readFile, readdir } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { localSandboxEnabled, writeNarToLocalSandbox } from './local-sandbox'
import type { NarRecord } from '../types'

const local = { NAR_STORAGE_MODE: 'local_sandbox', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local', NODE_ENV: 'development' } as NodeJS.ProcessEnv

describe('NAR local sandbox storage gate', () => {
  it('is enabled only when every local-QA condition holds', () => {
    expect(localSandboxEnabled(local)).toBe(true)
  })

  it.each([
    ['no mode', { ...local, NAR_STORAGE_MODE: undefined }],
    ['a different mode', { ...local, NAR_STORAGE_MODE: 'azure' }],
    ['not a QA environment', { ...local, QA_TEST_ENV: 'false' }],
    ['not the local environment', { ...local, UE_ENVIRONMENT: 'staging' }],
    ['a production UE environment', { ...local, UE_ENVIRONMENT: 'production' }],
    ['a production deployment type', { ...local, NZILA_DEPLOYMENT_TYPE: 'production' }],
    ['a production deployment environment', { ...local, DEPLOYMENT_ENVIRONMENT: 'Production eu' }],
    ['a production Vercel environment', { ...local, VERCEL_ENV: 'production' }],
    ['a production app environment', { ...local, NEXT_PUBLIC_APP_ENV: 'production' }],
    ['a production NZILA mode', { ...local, NZILA_MODE: 'production' }],
    ['a production UE deployment type', { ...local, UE_DEPLOYMENT_TYPE: 'production' }],
  ])('is refused for %s', (_label, env) => {
    expect(localSandboxEnabled(env as NodeJS.ProcessEnv)).toBe(false)
  })

  it('is allowed for a production build run locally, because NODE_ENV describes the build and not the deployment', () => {
    expect(localSandboxEnabled({ ...local, NODE_ENV: 'production' } as NodeJS.ProcessEnv)).toBe(true)
  })

  it('writes an honest, non-immutable reference and never overwrites a record', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nar-sandbox-test-'))
    const env = { ...local, NAR_LOCAL_SANDBOX_DIR: dir } as NodeJS.ProcessEnv
    const record = { id: 'rec-1', organizationId: 'org-1', createdAt: '2026-10-28T00:00:00.000Z' } as unknown as NarRecord
    const ref = await writeNarToLocalSandbox(record, env)
    expect(ref).toMatchObject({ type: 'local_sandbox', immutable: false })
    expect(ref.uri.startsWith('file://')).toBe(true)
    const files = await readdir(join(dir, 'org-1'))
    expect(files).toEqual(['rec-1.nar.json'])
    expect(JSON.parse(await readFile(join(dir, 'org-1', files[0]), 'utf8')).id).toBe('rec-1')
    await expect(writeNarToLocalSandbox(record, env)).rejects.toThrow()
  })

  it('refuses to write outside the gate', async () => {
    const record = { id: 'rec-2', organizationId: 'org-1', createdAt: '2026-10-28T00:00:00.000Z' } as unknown as NarRecord
    await expect(writeNarToLocalSandbox(record, { ...local, QA_TEST_ENV: 'false' } as NodeJS.ProcessEnv)).rejects.toThrow(/not enabled/)
  })
})
