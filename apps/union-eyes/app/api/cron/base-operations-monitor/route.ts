import { getBuildMetadata } from '@nzila/os-core/health'
import { NextResponse } from 'next/server'
import { withApi } from '@/lib/api/framework'
import { probeDailyAuditSeals } from '@/lib/audit/daily-audit-seal-runtime'
import { parseOperationalArmConfiguration, probeAzureOperations } from '@/lib/operations/arm-operational-probes'
import { jobResponse } from '@/lib/operations/job-result'
import { readinessPolicy } from '@/lib/operations/readiness-policy'
import { probeBaseApplicationReadiness } from '@/lib/operations/base-application-probe'
import { readReminderHealth, readLatestReminderReceipt, probeReminderMailProvider } from '@/lib/operations/reminder-health'
import { withSystemContext } from '@/lib/db/with-rls-context'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export const POST = withApi({ auth: { cron: true }, openapi: {
  tags: ['Cron', 'Observability'], summary: 'Measure base release backup, worker, audit and dependency health',
} }, async () => {
  if (readinessPolicy().profile !== 'union-eyes-v2-base') return NextResponse.json({ error: 'Base operational profile required' }, { status: 503 })
  const sourceSha = getBuildMetadata('union-eyes').gitSha
  let azure
  try {
    azure = await probeAzureOperations(parseOperationalArmConfiguration(process.env.UE_OPERATIONS_ARM_CONFIGURATION), process.env.AZURE_CLIENT_ID ?? '')
  } catch {
    azure = { armConfiguration: { state: 'fail' as const, note: 'Operational resource scope is not configured' } }
  }
  const measured = <T extends { state: 'ok' | 'fail'; note: string }>(work: Promise<T>) =>
    work.catch(() => ({ state: 'fail' as const, note: 'Operational database measurement could not be read' }))
  const [dependencies, audit, queue, mail] = await Promise.all([
    probeBaseApplicationReadiness(sourceSha, process.env.UE_APP_URL), probeDailyAuditSeals(),
    measured(withSystemContext(tx => readReminderHealth(tx))),
    measured(withSystemContext(tx => readLatestReminderReceipt(tx)).then(receipt => probeReminderMailProvider(receipt))),
  ])
  const checks = { ...azure, dependencies, audit, queue, mail }
  const failures = Object.entries(checks).flatMap(([scope, result]) => result.state === 'ok' ? [] : [{ scope, reason: result.note }])
  // Fixed, credential-free payload consumed by the external Azure monitor.
  // A stopped caller produces no heartbeat and is independently alertable.
  console.info(JSON.stringify({ event: 'UE_BASE_OPERATIONAL_MONITOR_V1', sourceSha,
    measuredAt: new Date().toISOString(), ok: failures.length === 0, checks }))
  return jobResponse({ job: 'base-operations-monitor', attempted: Object.keys(checks).length,
    succeeded: Object.keys(checks).length - failures.length, failures, details: { sourceSha, checks } })
})
