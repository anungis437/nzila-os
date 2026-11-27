/** Private credentials for an owned disposable fixture; never an application auth adapter. */
import { createHash, randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { generateTotpSecret } from '@nzila/platform-auth/mfa'

export interface RuntimeFixturePerson {
  userId: string
  email: string
  orgId: string
}
export interface RuntimeFixtureAuth {
  contractVersion: '1'
  databaseFingerprint: string
  users: Record<
    string,
    { email: string; organizationId: string; sessionToken: string; mfaSecret: string }
  >
}
export function ownedRuntimeOperatorUrl() {
  const value = process.env.UE_RUNTIME_OPERATOR_DATABASE_URL
  if (!value || process.env.QA_TEST_ENV !== 'true' || process.env.UE_CANONICAL_BOOTSTRAP_V2 !== '1')
    throw new Error('Explicit owned canonical fixture operator required')
  const url = new URL(value)
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.username !== 'uev2admin' ||
    url.pathname !== '/ue_runtime' ||
    !url.port
  )
    throw new Error('Owned loopback fixture operator required')
  if (!readRuntimeFixtureAuth(value))
    throw new Error('Private owned fixture namespace must be initialized')
  return value
}
export function runtimeFixtureAuthorityContext() {
  const operatorUrl = ownedRuntimeOperatorUrl()
  const runtimeUrl = process.env.UE_RUNTIME_DATABASE_URL ?? process.env.DATABASE_URL
  if (
    !runtimeUrl ||
    new URL(runtimeUrl).username !== 'ue_runtime_web' ||
    fingerprint(runtimeUrl) !== fingerprint(operatorUrl)
  )
    throw new Error('Restricted fixture runtime credential required')
  const doc = readRuntimeFixtureAuth(operatorUrl)
  if (!doc) throw new Error('Private canonical fixture identity data required')
  return {
    operatorUrl,
    runtimeUrl,
    sessions: Object.fromEntries(
      Object.entries(doc.users).map(([id, person]) => [id, person.sessionToken]),
    ),
  }
}
function fingerprint(databaseUrl: string) {
  const url = new URL(databaseUrl)
  if (
    url.protocol !== 'postgresql:' ||
    url.hostname !== '127.0.0.1' ||
    url.pathname !== '/ue_runtime'
  )
    throw new Error('Owned fixture database required')
  return createHash('sha256').update(`${url.hostname}:${url.port}${url.pathname}`).digest('hex')
}
export function runtimeFixtureAuthPath(stateDir = process.env.UE_RUNTIME_STATE_DIR) {
  if (!stateDir || !path.isAbsolute(stateDir))
    throw new Error('Absolute private runtime state directory required')
  return path.join(stateDir, 'fixture-auth.json')
}
export function createRuntimeFixtureAuth(
  databaseUrl: string,
  people: readonly RuntimeFixturePerson[],
): RuntimeFixtureAuth {
  const users: RuntimeFixtureAuth['users'] = {}
  for (const person of people) {
    if (users[person.userId]) throw new Error('Duplicate runtime fixture principal')
    users[person.userId] = {
      email: person.email,
      organizationId: person.orgId,
      sessionToken: randomBytes(32).toString('base64url'),
      mfaSecret: generateTotpSecret(),
    }
  }
  return { contractVersion: '1', databaseFingerprint: fingerprint(databaseUrl), users }
}
export function writeRuntimeFixtureAuth(
  doc: RuntimeFixtureAuth,
  stateDir = process.env.UE_RUNTIME_STATE_DIR,
) {
  const file = runtimeFixtureAuthPath(stateDir)
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  const pending = file + '.pending'
  writeFileSync(pending, JSON.stringify(doc), { mode: 0o600, flag: 'wx' })
  renameSync(pending, file)
}
export function readRuntimeFixtureAuth(
  databaseUrl: string,
  stateDir = process.env.UE_RUNTIME_STATE_DIR,
): RuntimeFixtureAuth | null {
  const file = runtimeFixtureAuthPath(stateDir)
  if (!existsSync(file)) return null
  if ((statSync(file).mode & 0o077) !== 0)
    throw new Error('Runtime fixture credential file must be private')
  const doc = JSON.parse(readFileSync(file, 'utf8')) as RuntimeFixtureAuth
  if (
    doc?.contractVersion !== '1' ||
    doc.databaseFingerprint !== fingerprint(databaseUrl) ||
    !doc.users ||
    typeof doc.users !== 'object' ||
    Array.isArray(doc.users)
  )
    throw new Error('Private runtime fixture provenance differs')
  for (const [userId, person] of Object.entries(doc.users))
    if (
      !userId ||
      typeof person.email !== 'string' ||
      typeof person.organizationId !== 'string' ||
      typeof person.sessionToken !== 'string' ||
      !/^[A-Za-z0-9_-]{43}$/.test(person.sessionToken) ||
      person.sessionToken.startsWith('ue-seed-session-') ||
      !/^[A-Z2-7]{32}$/.test(person.mfaSecret)
    )
      throw new Error('Private runtime fixture credentials are malformed')
  return doc
}
