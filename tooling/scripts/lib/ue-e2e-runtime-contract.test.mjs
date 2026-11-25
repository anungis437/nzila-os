import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { AZURITE_FIXTURE_KEY } from '../ue-runtime-up.mjs'
import {
  E2E_CONTRACT_FIELDS,
  assertOwnedServiceBindings,
  contractEnvFromRuntime,
  validateE2eRuntimeContract,
} from './ue-e2e-runtime-contract.mjs'

const hex = (size, seed) => seed.repeat(size).slice(0, size)

function sample(dir = '/tmp/ue-contract') {
  const url = (user, password, database) => {
    const value = new URL('http://127.0.0.1')
    value.username = user
    value.password = password
    value.port = '55430'
    value.pathname = `/${database}`
    return value.toString().replace(/^http:/, 'postgresql:')
  }
  return {
    QA_TEST_ENV: 'true',
    UE_CANONICAL_BOOTSTRAP_V2: '1',
    UE_ENVIRONMENT: 'local',
    PLAYWRIGHT_TEST_AUTH: 'false',
    PLAYWRIGHT_BASE_URL: 'http://127.0.0.1:3002',
    UE_RUNTIME_STATE_DIR: dir,
    DATABASE_URL: url('uev2admin', hex(48, 'a'), 'ue_runtime'),
    UE_RUNTIME_OPERATOR_DATABASE_URL: url('uev2admin', hex(48, 'a'), 'ue_runtime'),
    UE_RUNTIME_DATABASE_URL: url('ue_runtime_web', hex(64, 'b'), 'ue_runtime'),
    SYSTEM_DATABASE_URL: url('ue_runtime_system', hex(64, 'c'), 'ue_runtime'),
    PLATFORM_DATABASE_URL: url('ue_runtime_nar', hex(64, 'd'), 'ue_platform_sandbox'),
    AUTH_DATABASE_URL: url('ue_runtime_auth', hex(64, 'e'), 'ue_runtime'),
    AUTH_SYSTEM_DATABASE_URL: url('ue_runtime_auth_system', hex(64, 'f'), 'ue_runtime'),
    AUTH_MFA_ENCRYPTION_KEY: hex(64, '1'),
    EVIDENCE_SEAL_KEY: hex(48, '2'),
    REDIS_URL: 'redis://127.0.0.1:56379',
    UE_RUNTIME_REDIS_CONTAINER: 'ue-runtime-redis',
    AZURE_STORAGE_ACCOUNT_NAME: 'devstoreaccount1',
    AZURE_STORAGE_ACCOUNT_KEY: AZURITE_FIXTURE_KEY,
    AZURE_STORAGE_BLOB_ENDPOINT: 'http://127.0.0.1:10000/devstoreaccount1',
    AZURE_BLOB_CONTAINER: 'union-eyes',
    CLAMAV_URL: 'http://127.0.0.1:18080',
  }
}

test('accepts one complete loopback contract', () => {
  assert.equal(validateE2eRuntimeContract(sample(), { azuriteKey: AZURITE_FIXTURE_KEY }), true)
  assert.deepEqual(Object.keys(sample()).sort(), [...E2E_CONTRACT_FIELDS].sort())
})

test('names every binding that disappears', () => {
  for (const name of E2E_CONTRACT_FIELDS) {
    const env = sample()
    delete env[name]
    assert.throws(() => validateE2eRuntimeContract(env), new RegExp(`missing ${name}`))
  }
})

test('refuses a production host, a shared password, a short seal, and test-auth mode', () => {
  const remote = sample()
  remote.DATABASE_URL = remote.DATABASE_URL.replace('127.0.0.1', 'db.example.com')
  remote.UE_RUNTIME_OPERATOR_DATABASE_URL = remote.DATABASE_URL
  assert.throws(() => validateE2eRuntimeContract(remote), /rejected DATABASE_URL/)
  const shared = sample()
  shared.AUTH_SYSTEM_DATABASE_URL = shared.AUTH_SYSTEM_DATABASE_URL.replace(hex(64, 'f'), hex(64, 'e'))
  assert.throws(() => validateE2eRuntimeContract(shared), /rejected database credentials/)
  const seal = sample()
  seal.EVIDENCE_SEAL_KEY = 'short'
  assert.throws(() => validateE2eRuntimeContract(seal), /rejected EVIDENCE_SEAL_KEY/)
  const bypass = sample()
  bypass.PLAYWRIGHT_TEST_AUTH = 'true'
  assert.throws(() => validateE2eRuntimeContract(bypass), /rejected PLAYWRIGHT_TEST_AUTH/)
  const redis = sample()
  redis.REDIS_URL = 'redis://:secret@127.0.0.1:56379'
  assert.throws(() => validateE2eRuntimeContract(redis), /rejected REDIS_URL/)
  const cloud = sample()
  cloud.AZURE_STORAGE_ACCOUNT_NAME = 'productionstore'
  assert.throws(() => validateE2eRuntimeContract(cloud), /rejected AZURE_STORAGE_ACCOUNT_NAME/)
})

test('refuses an unowned or non-loopback container', () => {
  const token = 'a'.repeat(32)
  const labels = { 'nzila.mission': 'UE_DISPOSABLE_LOCAL_RUNTIME', 'nzila.qualification-owner': token }
  const bindings = {
    'ue-runtime-pg': { binding: '127.0.0.1:55430', labels },
    'ue-runtime-redis': { binding: '127.0.0.1:56379', labels },
    'ue-runtime-azurite': { binding: '127.0.0.1:10000', labels },
    'ue-runtime-clamav': { binding: '127.0.0.1:3310', labels },
  }
  assert.doesNotThrow(() => assertOwnedServiceBindings(bindings, token))
  assert.throws(() => assertOwnedServiceBindings({ ...bindings, 'ue-runtime-redis': { binding: '0.0.0.0:56379', labels } }, token), /ue-runtime-redis/)
  assert.throws(() => assertOwnedServiceBindings(bindings, 'b'.repeat(32)), /ue-runtime-pg/)
})

test('builds the Playwright environment from the provisioner without a second list', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ue-contract-'))
  writeFileSync(join(dir, 'fixture-auth.json'), '{}\n', { mode: 0o600 })
  chmodSync(join(dir, 'fixture-auth.json'), 0o600)
  const values = sample(dir)
  const runtime = {
    PLAYWRIGHT_BASE_URL: values.PLAYWRIGHT_BASE_URL,
    UE_RUNTIME_STATE_DIR: dir,
    DATABASE_URL: values.UE_RUNTIME_DATABASE_URL,
    SYSTEM_DATABASE_URL: values.SYSTEM_DATABASE_URL,
    PLATFORM_DATABASE_URL: values.PLATFORM_DATABASE_URL,
    AUTH_DATABASE_URL: values.AUTH_DATABASE_URL,
    AUTH_SYSTEM_DATABASE_URL: values.AUTH_SYSTEM_DATABASE_URL,
    AUTH_MFA_ENCRYPTION_KEY: values.AUTH_MFA_ENCRYPTION_KEY,
    EVIDENCE_SEAL_KEY: values.EVIDENCE_SEAL_KEY,
  }
  const built = contractEnvFromRuntime(runtime, values.DATABASE_URL, AZURITE_FIXTURE_KEY)
  assert.equal(built.UE_ENVIRONMENT, 'local')
  assert.equal(built.PLATFORM_DATABASE_URL, values.PLATFORM_DATABASE_URL)
  assert.equal(built.UE_RUNTIME_REDIS_CONTAINER, 'ue-runtime-redis')
  assert.equal(built.EVIDENCE_SEAL_KEY, values.EVIDENCE_SEAL_KEY)
  const workflow = readFileSync(new URL('../../../.github/workflows/e2e.yml', import.meta.url), 'utf8')
  assert.equal(workflow.match(/ue-e2e-runtime-contract\.mjs export/g)?.length, 2)
  assert.equal(workflow.match(/ue-e2e-runtime-contract\.mjs check/g)?.length, 2)
  assert.equal(workflow.includes('EVIDENCE_SEAL_KEY='), false)
  assert.equal(workflow.includes("lines.push('REDIS_URL="), false)
})
