/**
 * Releases one synthetic fixture's document-upload counter on the owned disposable Redis.
 * This is a QA fixture operation. It is not an application route and it does not change the
 * production limit of 30 uploads per user per hour.
 */
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { hasOwnedContainerLabels } from '../../../../tooling/scripts/lib/ue-disposable-container-ownership.mjs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { readRuntimeFixtureAuth } from './fixture-auth'

const FIXTURE_USER_IDS = new Set<string>(Object.values(UE_TEST_USERS).map((user) => user.userId))
const KEY_PREFIX = 'ratelimit:document-upload:doc-upload:'

export function documentUploadQuotaKey(userId: string): string {
  if (!FIXTURE_USER_IDS.has(userId)) throw new Error('Synthetic fixture user required')
  return KEY_PREFIX + userId
}

export function ownedRedisReleaseTarget(input: {
  labels: Record<string, string> | null
  token: string
  binding: string
  port: string
}): boolean {
  return hasOwnedContainerLabels(input.labels, input.token) && input.binding === `127.0.0.1:${input.port}`
}

function runtimeOwnerToken(): string {
  const file = path.resolve(__dirname, '../../../../.ue-runtime/runtime-owner.txt')
  const token = readFileSync(file, 'utf8').trim()
  if (!/^[a-f0-9]{32}$/.test(token)) throw new Error('Malformed disposable runtime owner token')
  return token
}

function docker(args: string[]): string | null {
  const result = spawnSync('docker', args, { encoding: 'utf8' })
  if (result.status !== 0) return null
  return (result.stdout ?? '').trim()
}

function ownedRedisContainer(port: string): string {
  const token = runtimeOwnerToken()
  const listed = docker(['ps', '--filter', 'label=nzila.mission=UE_DISPOSABLE_LOCAL_RUNTIME', '--format', '{{.Names}}'])
  if (listed === null) throw new Error('Owned loopback Redis container required')
  const names = listed.split('\n').map((name) => name.trim()).filter(Boolean)
  const matches = names.filter((name) => {
    const rawLabels = docker(['inspect', '--format', '{{json .Config.Labels}}', name])
    const binding = docker(['port', name, '6379/tcp'])
    if (!rawLabels || !binding) return false
    let labels: Record<string, string> | null = null
    try { labels = JSON.parse(rawLabels) } catch { return false }
    return ownedRedisReleaseTarget({ labels, token, binding, port })
  })
  if (matches.length !== 1) throw new Error('Owned loopback Redis container required')
  return matches[0]
}

/** Deletes only `ratelimit:document-upload:doc-upload:<fixture user>`. */
export function releaseOwnedDocumentUploadQuota(userIds: readonly string[]): string[] {
  if (process.env.QA_TEST_ENV !== 'true') throw new Error('QA fixture environment required')
  if (process.env.UE_CANONICAL_BOOTSTRAP_V2 !== '1') throw new Error('Canonical fixture bootstrap required')
  if (userIds.length < 1 || userIds.length > 4) throw new Error('Explicit synthetic fixture users required')
  const keys = userIds.map(documentUploadQuotaKey)
  const redisUrl = process.env.REDIS_URL
  if (!redisUrl) throw new Error('Owned loopback Redis required')
  const url = new URL(redisUrl)
  if (
    url.protocol !== 'redis:' ||
    url.hostname !== '127.0.0.1' ||
    url.username !== '' ||
    url.password !== '' ||
    (url.pathname !== '' && url.pathname !== '/') ||
    !url.port
  ) throw new Error('Loopback Redis without credentials required')
  const operatorUrl = process.env.UE_RUNTIME_OPERATOR_DATABASE_URL
  if (!operatorUrl) throw new Error('Private canonical fixture record required')
  const fixture = readRuntimeFixtureAuth(operatorUrl)
  if (!fixture) throw new Error('Private canonical fixture record required')
  for (const userId of userIds) {
    if (!fixture.users[userId]) throw new Error('Fixture identity is not in the private canonical record')
  }
  const container = ownedRedisContainer(url.port)
  for (const key of keys) {
    if (!key.startsWith(KEY_PREFIX) || key.slice(KEY_PREFIX.length).includes(':')) throw new Error('Exact document-upload key required')
    const removed = docker(['exec', container, 'redis-cli', 'DEL', key])
    if (removed === null || !/^[0-9]+$/.test(removed)) throw new Error('Owned Redis refused the exact key release')
  }
  return keys
}
