import { existsSync, readdirSync } from 'node:fs'
import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { DecisionRecord } from '@nzila/decision-core'
import { createNarProofAdapter } from '../adapter'

/**
 * Containment of the local audit sandbox, driven through the real adapter (not only the gate function): a configuration that
 * names the sandbox but carries ANY deployment signal other than an explicit local one must not write a local record and must
 * not produce a proof; and a sandbox record can never present itself as immutable.
 */
const decision = (): DecisionRecord => ({
  id: 'decision-sandbox',
  organizationId: 'org-sandbox',
  domain: 'platform',
  resourceType: 'workflow',
  resourceId: 'wf-1',
  actor: { id: 'actor-1', type: 'user', authorityScope: ['workflow:execute'] },
  input: { workflowId: 'wf-1' },
  policy: { id: 'platform.workflow.execution', version: '1.0.0', domain: 'platform' },
  outcome: { status: 'approved' },
  createdAt: '2026-01-01T00:00:00.000Z',
})
const context = {
  decisionType: 'platform.workflow.executed',
  actionType: 'workflow:execute',
  entry: {
    type: 'platform.workflow.executed', domain: 'platform', resourceType: 'workflow-execution', requiredAuthority: ['workflow:execute'],
    requiredPolicy: 'platform.workflow.execution', auditRequired: true, replaySupported: true, exportSupported: true,
    retentionClass: 'platform_7_year', proofRequired: true, enforcementLevel: 'block',
  },
} as never

const adapterWith = (persisted: { count: number }) =>
  createNarProofAdapter({
    keyId: 'unit',
    getPreviousHash: async () => undefined,
    getSigningSecret: async () => 'unit-secret',
    persistRecord: async (record) => {
      persisted.count += 1
      return { auditRecordId: record.id }
    },
  })

const LOCAL = { NAR_STORAGE_MODE: 'local_sandbox', QA_TEST_ENV: 'true', UE_ENVIRONMENT: 'local' }

afterEach(() => vi.unstubAllEnvs())

describe('local audit sandbox containment (through the adapter)', () => {
  it.each([
    ['a staging environment', { UE_ENVIRONMENT: 'staging' }],
    ['a production environment', { UE_ENVIRONMENT: 'production' }],
    ['a pilot environment', { UE_ENVIRONMENT: 'pilot' }],
    ['a demo environment', { UE_ENVIRONMENT: 'demo' }],
    ['a production deployment type', { NZILA_DEPLOYMENT_TYPE: 'production' }],
    ['a production Vercel deployment', { VERCEL_ENV: 'production' }],
    ['a production app environment', { NEXT_PUBLIC_APP_ENV: 'production' }],
    ['a production NZILA mode', { NZILA_MODE: 'production' }],
    ['a production deployment environment', { DEPLOYMENT_ENVIRONMENT: 'Production eu' }],
    ['no QA flag', { QA_TEST_ENV: 'false' }],
    ['no sandbox mode', { NAR_STORAGE_MODE: 'azure' }],
  ])('writes nothing and produces no proof under %s', async (_label, overrides) => {
    const dir = await mkdtemp(join(tmpdir(), 'nar-containment-'))
    for (const [key, value] of Object.entries({ ...LOCAL, NAR_LOCAL_SANDBOX_DIR: dir, ...overrides })) vi.stubEnv(key, value)
    // The Azure path is the only remaining route; with no storage account configured it must fail closed.
    vi.stubEnv('AZURE_STORAGE_ACCOUNT_NAME', '')
    const persisted = { count: 0 }
    await expect(adapterWith(persisted).createProof(decision(), context)).rejects.toThrow()
    expect(persisted.count, 'no audit record may be persisted without immutable storage').toBe(0)
    expect(existsSync(dir) ? readdirSync(dir) : [], 'no local record may be written').toEqual([])
  })

  it('under the explicit local acceptance configuration it persists a sandbox record that says it is not immutable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nar-containment-'))
    for (const [key, value] of Object.entries({ ...LOCAL, NAR_LOCAL_SANDBOX_DIR: dir })) vi.stubEnv(key, value)
    const stored: Array<{ storage?: { type: string; immutable: boolean } }> = []
    const adapter = createNarProofAdapter({
      keyId: 'unit',
      getPreviousHash: async () => undefined,
      getSigningSecret: async () => 'unit-secret',
      persistRecord: async (record) => {
        stored.push(record as never)
        return { auditRecordId: record.id }
      },
    })
    await adapter.createProof(decision(), context)
    expect(stored).toHaveLength(1)
    expect(stored[0].storage).toMatchObject({ type: 'local_sandbox', immutable: false })
    expect(readdirSync(join(dir, 'org-sandbox'))).toHaveLength(1)
  })

  it('has no option or configuration that lets a sandbox record present itself as immutable', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'nar-containment-'))
    for (const [key, value] of Object.entries({ ...LOCAL, NAR_LOCAL_SANDBOX_DIR: dir, NAR_STORAGE_IMMUTABLE: 'true', NAR_IMMUTABLE: 'true' })) vi.stubEnv(key, value)
    const stored: Array<{ storage?: { immutable: boolean } }> = []
    const adapter = createNarProofAdapter({
      keyId: 'unit',
      getPreviousHash: async () => undefined,
      getSigningSecret: async () => 'unit-secret',
      persistRecord: async (record) => {
        stored.push(record as never)
        return { auditRecordId: record.id }
      },
    })
    await adapter.createProof(decision(), context)
    expect(stored[0].storage?.immutable).toBe(false)
  })
})
