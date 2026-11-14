import { NextResponse } from 'next/server'
import { getBuildMetadata, isReadyFromChecks, normalizeHealthChecks } from '@nzila/os-core/health'
import { evaluateCatalogAdmission } from '@/lib/operations/catalog-admission'
import { probeQueue, probeStorage } from '@/lib/operations/service-probes'
import { evaluateTestBypassGuard, readTestBypassGuardEnv } from '@/lib/reality/test-bypass-guard'

const APP = 'union-eyes'

async function checkDecisionProofReady(): Promise<boolean> {
  try {
    const { getNarSigningSecret } = await import('@nzila/nar')
    return (await getNarSigningSecret()).trim().length >= 32
  } catch {
    return false
  }
}

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

async function checkCatalogReady(): Promise<boolean> {
  try {
    return (await evaluateCatalogAdmission()).ok
  } catch {
    return false
  }
}

async function checkQueueReady(): Promise<boolean> {
  return (await probeQueue()).state === 'ok'
}

async function checkStorageReady(): Promise<boolean> {
  return (await probeStorage()).state === 'ok'
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

export async function GET() {
  const requireDecisionProof = parseBoolEnv(process.env.READY_REQUIRE_DECISION_PROOF, false)
  const requireQueue = parseBoolEnv(process.env.READY_REQUIRE_QUEUE, false)
  const requireStorage = parseBoolEnv(process.env.READY_REQUIRE_STORAGE, false)
  const [database, queue, storage, catalogAuthority] = await Promise.all([
    checkDatabaseReady(),
    requireQueue ? checkQueueReady() : Promise.resolve(false),
    requireStorage ? checkStorageReady() : Promise.resolve<'unknown'>('unknown'),
    checkCatalogReady(),
  ])
  const requireCalendarIntegrations = parseBoolEnv(process.env.READY_REQUIRE_CALENDAR_INTEGRATIONS, false)
  const requireEmailDelivery = parseBoolEnv(process.env.READY_REQUIRE_EMAIL_DELIVERY, false)
  const requireCalendarTokenEncryption = parseBoolEnv(
    process.env.READY_REQUIRE_CALENDAR_TOKEN_ENCRYPTION,
    false,
  )

  // Directive 2026-11-04 item 4: a test-auth / risk-bypass switch in a
  // deployed environment makes the revision not-ready, with a reason code.
  const testBypass = evaluateTestBypassGuard(readTestBypassGuardEnv())

  const checksInput: Record<string, boolean | 'unknown'> = {
    process: true,
    noTestBypass: testBypass.ok,
    database,
    catalogAuthority,
    storage,
    thirdParty: 'unknown',
  }

  if (requireDecisionProof) {
    checksInput.decisionProof = await checkDecisionProofReady()
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

  const checks = normalizeHealthChecks(checksInput)

  const requiredChecks = [
    'process',
    'noTestBypass',
    'database',
    'catalogAuthority',
    ...(requireDecisionProof ? ['decisionProof'] : []),
    ...(requireStorage ? ['storage'] : []),
    ...(requireQueue ? ['queue'] : []),
    ...(requireCalendarIntegrations ? ['calendarIntegrations'] : []),
    ...(requireEmailDelivery ? ['emailDelivery'] : []),
    ...(requireCalendarTokenEncryption ? ['calendarTokenEncryption'] : []),
  ]
  const ready = isReadyFromChecks(checks, requiredChecks)

  return NextResponse.json(
    {
      ready,
      status: ready ? 'ready' : 'not_ready',
      ...getBuildMetadata(APP),
      checks,
      ...(testBypass.ok
        ? {}
        : {
            reasonCodes: [testBypass.reasonCode],
            testBypass: {
              switchesPresent: testBypass.switchesPresent,
              classifiedBy: testBypass.classifiedBy,
            },
          }),
    },
    { status: ready ? 200 : 503 },
  )
}
