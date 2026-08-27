import { NextResponse } from 'next/server'
import { getBuildMetadata, isReadyFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'

const APP = 'union-eyes'

function parseBoolEnv(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

async function checkDatabaseReady(): Promise<boolean> {
  try {
    const { db } = await import('@nzila/db')
    const { sql } = await import('drizzle-orm')
    await db.execute(sql`SELECT 1`)
    return true
  } catch {
    return false
  }
}

async function checkQueueReady(): Promise<boolean> {
  const djangoUrl = process.env.DJANGO_API_URL || process.env.NEXT_PUBLIC_DJANGO_API_URL || ''
  if (!djangoUrl) {
    return false
  }

  try {
    const base = djangoUrl.replace(/\/$/, '')
    const response = await fetch(`${base}/api/auth_core/ready/`, {
      cache: 'no-store',
      signal: AbortSignal.timeout(3000),
    })
    return response.ok
  } catch {
    return false
  }
}

async function checkStorageReady(): Promise<boolean> {
  const containerName = process.env.AZURE_BLOB_CONTAINER
  if (!containerName) {
    return false
  }

  try {
    const { container } = await import('@nzila/blob')
    return await container(containerName).exists()
  } catch {
    return false
  }
}

function hasAll(values: Array<string | undefined>): boolean {
  return values.every((value) => typeof value === 'string' && value.trim().length > 0)
}

function checkCalendarIntegrationsReady(): boolean {
  const googleReady = hasAll([
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI,
  ])

  const microsoftReady = hasAll([
    process.env.MICROSOFT_CALENDAR_CLIENT_ID,
    process.env.MICROSOFT_CALENDAR_CLIENT_SECRET,
    process.env.MICROSOFT_CALENDAR_REDIRECT_URI,
  ])

  return googleReady && microsoftReady
}

function checkEmailDeliveryReady(): boolean {
  const provider = (process.env.EMAIL_PROVIDER || 'resend').toLowerCase()
  const fromAddress = process.env.RESEND_FROM_EMAIL || process.env.EMAIL_FROM || process.env.SENDGRID_FROM_EMAIL

  if (provider === 'console') {
    return true
  }

  if (provider === 'resend') {
    return hasAll([process.env.RESEND_API_KEY, fromAddress])
  }

  if (provider === 'sendgrid') {
    return hasAll([process.env.SENDGRID_API_KEY, fromAddress])
  }

  return false
}

function checkCalendarTokenEncryptionReady(): boolean {
  const key = process.env.CALENDAR_TOKEN_ENCRYPTION_KEY || process.env.FALLBACK_ENCRYPTION_KEY
  return typeof key === 'string' && key.trim().length > 0
}

function checkCalendarSchedulerReady(): boolean {
  const enabled = parseBoolEnv(process.env.CALENDAR_SYNC_CRON_ENABLED, false)
  if (!enabled) return false

  const cronSecret = process.env.CRON_SECRET_KEY || process.env.CRON_SECRET
  return typeof cronSecret === 'string' && cronSecret.trim().length > 0
}

export async function GET() {
  const requireQueue = parseBoolEnv(process.env.READY_REQUIRE_QUEUE, false)
  const requireStorage = parseBoolEnv(process.env.READY_REQUIRE_STORAGE, false)
  const [database, queue, storage] = await Promise.all([
    checkDatabaseReady(),
    requireQueue ? checkQueueReady() : Promise.resolve(false),
    requireStorage ? checkStorageReady() : Promise.resolve<'unknown'>('unknown'),
  ])
  const requireCalendarIntegrations = parseBoolEnv(process.env.READY_REQUIRE_CALENDAR_INTEGRATIONS, false)
  const requireEmailDelivery = parseBoolEnv(process.env.READY_REQUIRE_EMAIL_DELIVERY, false)
  const requireCalendarTokenEncryption = parseBoolEnv(
    process.env.READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION,
    false,
  )
  const requireCalendarScheduler = parseBoolEnv(process.env.READY_REQUIRE_CALENDAR_SCHEDULER, false)

  const checksInput: Record<string, boolean | 'unknown'> = {
    process: true,
    database,
    storage,
    thirdParty: 'unknown',
  }

  if (requireQueue) {
    checksInput.queue = queue
  }

  if (requireCalendarIntegrations) {
    checksInput.calendarIntegrations = checkCalendarIntegrationsReady()
  }

  if (requireEmailDelivery) {
    checksInput.emailDelivery = checkEmailDeliveryReady()
  }

  if (requireCalendarTokenEncryption) {
    checksInput.calendarTokenEncryption = checkCalendarTokenEncryptionReady()
  }

  if (requireCalendarScheduler) {
    checksInput.calendarScheduler = checkCalendarSchedulerReady()
  }

  const checks = normalizeHealthChecks(checksInput)

  const requiredChecks = [
    'process',
    'database',
    ...(requireStorage ? ['storage'] : []),
    ...(requireQueue ? ['queue'] : []),
    ...(requireCalendarIntegrations ? ['calendarIntegrations'] : []),
    ...(requireEmailDelivery ? ['emailDelivery'] : []),
    ...(requireCalendarTokenEncryption ? ['calendarTokenEncryption'] : []),
    ...(requireCalendarScheduler ? ['calendarScheduler'] : []),
  ]
  const ready = isReadyFromChecks(checks, requiredChecks)

  return NextResponse.json(
    {
      ready,
      status: ready ? 'ready' : 'not_ready',
      ...getBuildMetadata(APP),
      checks,
    },
    { status: ready ? 200 : 503 },
  )
}
