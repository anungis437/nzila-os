/**
 * One contract for the Union Eyes Playwright process and the children it spawns.
 * The application is started from runtimeEnv(). This module is the only export of that
 * environment into GitHub Actions. A missing binding fails here, before a shard runs.
 *
 * Consumers: Playwright, authority-admin, external-admin, document-upload quota release,
 * download-lease minting, persistence inspection, and the Redis outage tests.
 * Provider: tooling/scripts/ue-runtime-up.mjs plus the owned loopback containers.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { connect } from 'node:net'
import { isAbsolute } from 'node:path'
import { hasOwnedContainerLabels } from './ue-disposable-container-ownership.mjs'

export const E2E_CONTRACT_FIELDS = Object.freeze([
  'QA_TEST_ENV',
  'UE_CANONICAL_BOOTSTRAP_V2',
  'UE_ENVIRONMENT',
  'PLAYWRIGHT_TEST_AUTH',
  'PLAYWRIGHT_BASE_URL',
  'UE_RUNTIME_STATE_DIR',
  'DATABASE_URL',
  'UE_RUNTIME_OPERATOR_DATABASE_URL',
  'UE_RUNTIME_DATABASE_URL',
  'SYSTEM_DATABASE_URL',
  'PLATFORM_DATABASE_URL',
  'AUTH_DATABASE_URL',
  'AUTH_SYSTEM_DATABASE_URL',
  'AUTH_MFA_ENCRYPTION_KEY',
  'EVIDENCE_SEAL_KEY',
  'REDIS_URL',
  'UE_RUNTIME_REDIS_CONTAINER',
  'AZURE_STORAGE_ACCOUNT_NAME',
  'AZURE_STORAGE_ACCOUNT_KEY',
  'AZURE_STORAGE_BLOB_ENDPOINT',
  'AZURE_BLOB_CONTAINER',
  'CLAMAV_URL',
])

export const E2E_CONTRACT_SECRETS = Object.freeze([
  'DATABASE_URL',
  'UE_RUNTIME_OPERATOR_DATABASE_URL',
  'UE_RUNTIME_DATABASE_URL',
  'SYSTEM_DATABASE_URL',
  'PLATFORM_DATABASE_URL',
  'AUTH_DATABASE_URL',
  'AUTH_SYSTEM_DATABASE_URL',
  'AUTH_MFA_ENCRYPTION_KEY',
  'EVIDENCE_SEAL_KEY',
  'AZURE_STORAGE_ACCOUNT_KEY',
])

const SERVICE_BINDINGS = Object.freeze({
  'ue-runtime-pg': { port: '5432/tcp', binding: '127.0.0.1:55430' },
  'ue-runtime-redis': { port: '6379/tcp', binding: '127.0.0.1:56379' },
  'ue-runtime-azurite': { port: '10000/tcp', binding: '127.0.0.1:10000' },
  'ue-runtime-clamav': { port: '3310/tcp', binding: '127.0.0.1:3310' },
})

function reject(name) {
  throw new Error(`E2E runtime contract rejected ${name}`)
}

function postgres(value, name, username, database) {
  let url
  try { url = new URL(value) } catch { reject(name) }
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.username !== username ||
    url.pathname !== `/${database}` ||
    !url.port ||
    !/^[a-f0-9]{48,64}$/.test(url.password)
  ) reject(name)
  return url
}

/** Returns a new object. Does not read the process environment and does not print values. */
export function validateE2eRuntimeContract(env, options = {}) {
  if (!env || typeof env !== 'object') reject('environment')
  const missing = E2E_CONTRACT_FIELDS.filter((name) => typeof env[name] !== 'string' || env[name].length === 0)
  if (missing.length > 0) throw new Error(`E2E runtime contract missing ${missing.join(', ')}`)
  for (const name of E2E_CONTRACT_FIELDS) {
    if (/[\r\n]/.test(env[name])) reject(name)
  }
  if (env.QA_TEST_ENV !== 'true') reject('QA_TEST_ENV')
  if (env.UE_CANONICAL_BOOTSTRAP_V2 !== '1') reject('UE_CANONICAL_BOOTSTRAP_V2')
  if (env.UE_ENVIRONMENT !== 'local') reject('UE_ENVIRONMENT')
  if (env.PLAYWRIGHT_TEST_AUTH !== 'false') reject('PLAYWRIGHT_TEST_AUTH')
  if (env.PLAYWRIGHT_BASE_URL !== 'http://127.0.0.1:3002') reject('PLAYWRIGHT_BASE_URL')
  if (!isAbsolute(env.UE_RUNTIME_STATE_DIR)) reject('UE_RUNTIME_STATE_DIR')
  if (env.REDIS_URL !== 'redis://127.0.0.1:56379') reject('REDIS_URL')
  if (env.UE_RUNTIME_REDIS_CONTAINER !== 'ue-runtime-redis') reject('UE_RUNTIME_REDIS_CONTAINER')
  if (env.AZURE_STORAGE_ACCOUNT_NAME !== 'devstoreaccount1') reject('AZURE_STORAGE_ACCOUNT_NAME')
  if (env.AZURE_STORAGE_BLOB_ENDPOINT !== 'http://127.0.0.1:10000/devstoreaccount1') reject('AZURE_STORAGE_BLOB_ENDPOINT')
  if (env.AZURE_BLOB_CONTAINER !== 'union-eyes') reject('AZURE_BLOB_CONTAINER')
  if (env.CLAMAV_URL !== 'http://127.0.0.1:18080') reject('CLAMAV_URL')
  if (!/^[a-f0-9]{64}$/.test(env.AUTH_MFA_ENCRYPTION_KEY)) reject('AUTH_MFA_ENCRYPTION_KEY')
  if (!/^[a-f0-9]{48,}$/.test(env.EVIDENCE_SEAL_KEY)) reject('EVIDENCE_SEAL_KEY')
  if (options.azuriteKey && env.AZURE_STORAGE_ACCOUNT_KEY !== options.azuriteKey) reject('AZURE_STORAGE_ACCOUNT_KEY')

  const operator = postgres(env.DATABASE_URL, 'DATABASE_URL', 'uev2admin', 'ue_runtime')
  const namedOperator = postgres(env.UE_RUNTIME_OPERATOR_DATABASE_URL, 'UE_RUNTIME_OPERATOR_DATABASE_URL', 'uev2admin', 'ue_runtime')
  if (env.DATABASE_URL !== env.UE_RUNTIME_OPERATOR_DATABASE_URL) reject('UE_RUNTIME_OPERATOR_DATABASE_URL')
  const runtime = postgres(env.UE_RUNTIME_DATABASE_URL, 'UE_RUNTIME_DATABASE_URL', 'ue_runtime_web', 'ue_runtime')
  const system = postgres(env.SYSTEM_DATABASE_URL, 'SYSTEM_DATABASE_URL', 'ue_runtime_system', 'ue_runtime')
  const platform = postgres(env.PLATFORM_DATABASE_URL, 'PLATFORM_DATABASE_URL', 'ue_runtime_nar', 'ue_platform_sandbox')
  const auth = postgres(env.AUTH_DATABASE_URL, 'AUTH_DATABASE_URL', 'ue_runtime_auth', 'ue_runtime')
  const authSystem = postgres(env.AUTH_SYSTEM_DATABASE_URL, 'AUTH_SYSTEM_DATABASE_URL', 'ue_runtime_auth_system', 'ue_runtime')
  const port = operator.port
  for (const url of [namedOperator, runtime, system, auth, authSystem]) {
    if (url.port !== port) reject('database port')
  }
  if (platform.port !== port) reject('PLATFORM_DATABASE_URL')
  const passwords = [operator, runtime, system, platform, auth, authSystem].map((url) => url.password)
  if (new Set(passwords).size !== passwords.length) reject('database credentials')
  if (options.requireFixture) assertPrivateFixture(env)
  return true
}

export function assertPrivateFixture(env) {
  const file = `${env.UE_RUNTIME_STATE_DIR}/fixture-auth.json`
  let mode
  try { mode = statSync(file).mode } catch { reject('fixture record') }
  if ((mode & 0o077) !== 0) reject('fixture record')
}

export function assertOwnedServiceBindings(bindings, token) {
  for (const [name, expected] of Object.entries(SERVICE_BINDINGS)) {
    const actual = bindings[name]
    if (!actual || actual.binding !== expected.binding || !hasOwnedContainerLabels(actual.labels, token)) {
      throw new Error(`E2E runtime contract rejected ${name}`)
    }
  }
}

function docker(args) {
  const result = spawnSync('docker', args, { encoding: 'utf8' })
  if (result.status !== 0) return null
  return (result.stdout ?? '').trim()
}

export function readOwnedServiceBindings(tokenFile) {
  const token = readFileSync(tokenFile, 'utf8').trim()
  const bindings = {}
  for (const [name, expected] of Object.entries(SERVICE_BINDINGS)) {
    let labels = null
    try { labels = JSON.parse(docker(['inspect', '--format', '{{json .Config.Labels}}', name]) ?? '') } catch { labels = null }
    bindings[name] = { binding: docker(['port', name, expected.port]), labels }
  }
  assertOwnedServiceBindings(bindings, token)
  return bindings
}

function probe(port) {
  return new Promise((resolveProbe, rejectProbe) => {
    const socket = connect({ host: '127.0.0.1', port })
    const fail = () => { socket.destroy(); rejectProbe(new Error(`E2E runtime contract unreachable 127.0.0.1:${port}`)) }
    socket.setTimeout(2_000)
    socket.once('connect', () => { socket.end(); resolveProbe() })
    socket.once('timeout', fail)
    socket.once('error', fail)
  })
}

export async function probeContractPorts() {
  for (const port of [3002, 55430, 56379, 10000, 3310, 18080]) await probe(port)
}

export function contractEnvFromRuntime(runtime, operatorUrl, azuriteKey) {
  const env = {
    QA_TEST_ENV: 'true',
    UE_CANONICAL_BOOTSTRAP_V2: '1',
    UE_ENVIRONMENT: 'local',
    PLAYWRIGHT_TEST_AUTH: 'false',
    PLAYWRIGHT_BASE_URL: runtime.PLAYWRIGHT_BASE_URL,
    UE_RUNTIME_STATE_DIR: runtime.UE_RUNTIME_STATE_DIR,
    DATABASE_URL: operatorUrl,
    UE_RUNTIME_OPERATOR_DATABASE_URL: operatorUrl,
    UE_RUNTIME_DATABASE_URL: runtime.DATABASE_URL,
    SYSTEM_DATABASE_URL: runtime.SYSTEM_DATABASE_URL,
    PLATFORM_DATABASE_URL: runtime.PLATFORM_DATABASE_URL,
    AUTH_DATABASE_URL: runtime.AUTH_DATABASE_URL,
    AUTH_SYSTEM_DATABASE_URL: runtime.AUTH_SYSTEM_DATABASE_URL,
    AUTH_MFA_ENCRYPTION_KEY: runtime.AUTH_MFA_ENCRYPTION_KEY,
    EVIDENCE_SEAL_KEY: runtime.EVIDENCE_SEAL_KEY,
    REDIS_URL: 'redis://127.0.0.1:56379',
    UE_RUNTIME_REDIS_CONTAINER: 'ue-runtime-redis',
    AZURE_STORAGE_ACCOUNT_NAME: 'devstoreaccount1',
    AZURE_STORAGE_ACCOUNT_KEY: azuriteKey,
    AZURE_STORAGE_BLOB_ENDPOINT: 'http://127.0.0.1:10000/devstoreaccount1',
    AZURE_BLOB_CONTAINER: 'union-eyes',
    CLAMAV_URL: 'http://127.0.0.1:18080',
  }
  validateE2eRuntimeContract(env, { azuriteKey, requireFixture: true })
  return env
}

export function githubEnvLines(env) {
  return E2E_CONTRACT_FIELDS.map((name) => `${name}=${env[name]}`).join('\n') + '\n'
}
