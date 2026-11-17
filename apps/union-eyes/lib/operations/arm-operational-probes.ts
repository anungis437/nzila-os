import { ManagedIdentityCredential } from '@azure/identity'
import { z } from 'zod'

const RESOURCE_GROUP = /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[a-z0-9_.()-]+$/i
const POSTGRES_ID = /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[a-z0-9_.()-]+\/providers\/Microsoft\.DBforPostgreSQL\/flexibleServers\/[a-z0-9-]+$/i
const JOB_ID = /^\/subscriptions\/[0-9a-f-]{36}\/resourceGroups\/[a-z0-9_.()-]+\/providers\/Microsoft\.App\/jobs\/[a-z0-9-]+$/i
export const BASE_WORKER_CADENCES = { dlrem: 5, dlovd: 15, alert: 10, sla: 15, reap: 30, sigexp: 30 } as const
export const MAX_BACKUP_AGE_MS = 26 * 60 * 60_000
const SKEW_MS = 5 * 60_000

const configurationSchema = z.object({
  postgresResourceId: z.string().regex(POSTGRES_ID),
  jobs: z.array(z.object({ code: z.enum(['dlrem', 'dlovd', 'alert', 'sla', 'reap', 'sigexp']),
    resourceId: z.string().regex(JOB_ID) }).strict()).length(6),
}).strict()
export type OperationalArmConfiguration = z.infer<typeof configurationSchema>
export type OperationalMeasurement = { state: 'ok' | 'fail'; note: string; ageMs?: number }

export function parseOperationalArmConfiguration(value: string | undefined): OperationalArmConfiguration {
  try {
    const parsed = configurationSchema.parse(JSON.parse(value ?? ''))
    const group = parsed.postgresResourceId.split('/providers/')[0]
    if (!RESOURCE_GROUP.test(group) || new Set(parsed.jobs.map(job => job.code)).size !== 6 ||
      new Set(parsed.jobs.map(job => job.resourceId.toLowerCase())).size !== 6 ||
      parsed.jobs.some(job => job.resourceId.split('/providers/')[0].toLowerCase() !== group.toLowerCase())) {
      throw new Error('invalid scope')
    }
    return parsed
  } catch { throw new Error('UE_OPERATIONS_ARM_CONFIGURATION_INVALID') }
}

const backupSchema = z.object({ properties: z.object({
  backupType: z.string(), completedTime: z.iso.datetime({ offset: true }), source: z.string(),
}) })
export function measureAutomaticBackup(records: readonly unknown[], now = Date.now()): OperationalMeasurement {
  try {
    const backups = records.map(record => backupSchema.parse(record).properties)
      .filter(record => record.source === 'Automatic' && record.backupType === 'Full')
    if (!backups.length) return { state: 'fail', note: 'No completed automatic full backup was verified' }
    const newest = Math.max(...backups.map(record => Date.parse(record.completedTime)))
    const ageMs = now - newest
    return ageMs >= -SKEW_MS && ageMs <= MAX_BACKUP_AGE_MS
      ? { state: 'ok', note: 'Recent automatic full backup metadata verified; restore usability is a separate gate', ageMs }
      : { state: 'fail', note: 'Automatic backup timestamp is stale or in the future', ageMs }
  } catch { return { state: 'fail', note: 'Automatic backup metadata could not be verified' } }
}

const executionSchema = z.object({ properties: z.object({
  startTime: z.iso.datetime({ offset: true }), endTime: z.iso.datetime({ offset: true }).nullish(),
  status: z.enum(['Running', 'Processing', 'Stopped', 'Degraded', 'Failed', 'Unknown', 'Succeeded']),
}) })
export function measureWorkerExecutions(records: readonly unknown[], cadenceMinutes: number, now = Date.now()): OperationalMeasurement {
  try {
    const runs = records.map(record => executionSchema.parse(record).properties)
    if (!runs.length) return { state: 'fail', note: 'No worker executions were verified' }
    if (runs.some(run => Date.parse(run.startTime) > now + SKEW_MS ||
      (run.endTime && (Date.parse(run.endTime) < Date.parse(run.startTime) || Date.parse(run.endTime) > now + SKEW_MS)))) {
      return { state: 'fail', note: 'Worker execution timestamps are invalid' }
    }
    const successful = runs.filter(run => run.status === 'Succeeded' && run.endTime)
    if (!successful.length) return { state: 'fail', note: 'No completed successful worker execution was verified' }
    const completedAt = Math.max(...successful.map(run => Date.parse(run.endTime!)))
    const ageMs = now - completedAt
    const maxAgeMs = (2 * cadenceMinutes + 5) * 60_000
    if (ageMs > maxAgeMs || ageMs < -SKEW_MS) return { state: 'fail', note: 'Last successful worker execution is stale', ageMs }
    if (runs.some(run => Date.parse(run.startTime) > completedAt &&
      (!['Succeeded', 'Running', 'Processing'].includes(run.status) ||
        (['Running', 'Processing'].includes(run.status) && now - Date.parse(run.startTime) > 5 * 60_000)))) {
      return { state: 'fail', note: 'A newer worker execution failed or exceeded its run budget', ageMs }
    }
    return { state: 'ok', note: 'Recent successful worker execution verified', ageMs }
  } catch { return { state: 'fail', note: 'Worker execution metadata could not be verified' } }
}

/** Only this resource's ARM endpoint may be followed. Never forward a managed
 * identity token to a nextLink outside the same HTTPS origin and resource. */
export function armPageUrl(resourceId: string, collection: 'backups' | 'executions', nextLink?: string): URL {
  if (!(collection === 'backups' ? POSTGRES_ID : JOB_ID).test(resourceId)) throw new Error('UE_OPERATIONS_ARM_SCOPE_INVALID')
  const path = `${resourceId}/${collection}`
  const url = new URL(nextLink ?? `https://management.azure.com${path}`)
  if (url.origin !== 'https://management.azure.com' || url.pathname.toLowerCase() !== path.toLowerCase() ||
    url.username || url.password || url.hash) throw new Error('UE_OPERATIONS_ARM_PAGE_SCOPE_INVALID')
  url.searchParams.set('api-version', collection === 'backups' ? '2025-08-01' : '2024-03-01')
  return url
}

async function readArmCollection(resourceId: string, collection: 'backups' | 'executions', token: string): Promise<unknown[]> {
  const records: unknown[] = []
  const seen = new Set<string>()
  let url: URL | undefined = armPageUrl(resourceId, collection)
  while (url) {
    if (seen.size >= 10 || seen.has(url.href)) throw new Error('UE_OPERATIONS_ARM_PAGE_LIMIT')
    seen.add(url.href)
    const response = await fetch(url, { cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(5000) })
    if (!response.ok) throw new Error('UE_OPERATIONS_ARM_READ_FAILED')
    const body = z.object({ value: z.array(z.unknown()).max(1000), nextLink: z.string().nullish() }).parse(await response.json())
    records.push(...body.value)
    if (records.length > 1000) throw new Error('UE_OPERATIONS_ARM_RECORD_LIMIT')
    url = body.nextLink ? armPageUrl(resourceId, collection, body.nextLink) : undefined
  }
  return records
}

/** No CLI/default-credential fallback: deployed reads use the explicit app MI,
 * with resource-scoped Reader permissions only. Raw ARM responses (which may
 * include job environment variables) never leave this collector. */
export async function probeAzureOperations(configuration: OperationalArmConfiguration, managedIdentityClientId: string) {
  const failed = (note: string): OperationalMeasurement => ({ state: 'fail', note })
  const results: Record<string, OperationalMeasurement> = {}
  let token: string
  try {
    if (!z.guid().safeParse(managedIdentityClientId).success) throw new Error('missing identity')
    const credential = new ManagedIdentityCredential({ clientId: managedIdentityClientId })
    const access = await credential.getToken('https://management.azure.com/.default', { abortSignal: AbortSignal.timeout(5000) })
    if (!access?.token) throw new Error('missing token')
    token = access.token
  } catch {
    return Object.fromEntries(['backup', ...configuration.jobs.map(job => job.code)].map(code => [code, failed('Managed identity ARM access could not be verified')]))
  }
  await Promise.all([
    (async () => {
      try { results.backup = measureAutomaticBackup(await readArmCollection(configuration.postgresResourceId, 'backups', token)) }
      catch { results.backup = failed('Automatic backup metadata could not be read') }
    })(),
    ...configuration.jobs.map(async job => {
      try { results[job.code] = measureWorkerExecutions(await readArmCollection(job.resourceId, 'executions', token), BASE_WORKER_CADENCES[job.code]) }
      catch { results[job.code] = failed('Worker execution metadata could not be read') }
    }),
  ])
  return results
}
