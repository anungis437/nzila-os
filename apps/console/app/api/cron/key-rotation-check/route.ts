/**
 * API — Key Rotation Health Check
 * POST /api/cron/key-rotation-check
 *
 * Queries Azure Key Vault for secret/key properties and evaluates rotation
 * health. Returns overdue, upcoming, and healthy secrets.
 *
 * Designed to be called from an external cron scheduler (e.g. daily).
 * Secured via CRON_SECRET bearer token.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createLogger } from '@nzila/os-core'

const logger = createLogger('cron.key-rotation-check')

const TRACKED_SECRETS = [
  { name: 'pii-master-key', rotationType: 'api_key' as const, rotationIntervalDays: 90, notifyDaysBeforeExpiry: 14 },
  { name: 'qbo-token-encryption-key', rotationType: 'api_key' as const, rotationIntervalDays: 90, notifyDaysBeforeExpiry: 14 },
  { name: 'clerk-secret-key', rotationType: 'oauth_secret' as const, rotationIntervalDays: 180, notifyDaysBeforeExpiry: 30 },
]

export async function POST(req: NextRequest) {
  // Authenticate via CRON_SECRET bearer token
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vaultUrl = process.env.AZURE_KEY_VAULT_URL
  if (!vaultUrl) {
    return NextResponse.json({ error: 'AZURE_KEY_VAULT_URL not configured' }, { status: 503 })
  }

  try {
    const { DefaultAzureCredential } = await import('@azure/identity')
    const { SecretClient } = await import('@azure/keyvault-secrets')
    const credential = new DefaultAzureCredential()
    const client = new SecretClient(vaultUrl, credential)

    const now = Date.now()
    const results: {
      name: string
      status: 'overdue' | 'upcoming' | 'healthy' | 'not_found'
      daysUntilRotation: number | null
      lastUpdated: string | null
      rotationIntervalDays: number
    }[] = []

    for (const tracked of TRACKED_SECRETS) {
      try {
        const secret = await client.getSecret(tracked.name)
        const updatedOn = secret.properties.updatedOn ?? secret.properties.createdOn
        const lastUpdated = updatedOn ? new Date(updatedOn).toISOString() : null
        const ageDays = updatedOn
          ? (now - new Date(updatedOn).getTime()) / 86_400_000
          : Infinity

        const daysUntilRotation = tracked.rotationIntervalDays - ageDays

        let status: 'overdue' | 'upcoming' | 'healthy'
        if (daysUntilRotation < 0) {
          status = 'overdue'
          logger.warn(`Secret "${tracked.name}" is OVERDUE for rotation by ${Math.abs(Math.round(daysUntilRotation))} days`)
        } else if (daysUntilRotation < tracked.notifyDaysBeforeExpiry) {
          status = 'upcoming'
          logger.warn(`Secret "${tracked.name}" needs rotation in ${Math.round(daysUntilRotation)} days`)
        } else {
          status = 'healthy'
        }

        results.push({
          name: tracked.name,
          status,
          daysUntilRotation: Math.round(daysUntilRotation),
          lastUpdated,
          rotationIntervalDays: tracked.rotationIntervalDays,
        })
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err)
        if (message.includes('SecretNotFound') || message.includes('not found')) {
          results.push({
            name: tracked.name,
            status: 'not_found',
            daysUntilRotation: null,
            lastUpdated: null,
            rotationIntervalDays: tracked.rotationIntervalDays,
          })
        } else {
          throw err
        }
      }
    }

    const overdue = results.filter((r) => r.status === 'overdue')
    const upcoming = results.filter((r) => r.status === 'upcoming')
    const healthy = results.filter((r) => r.status === 'healthy')
    const notFound = results.filter((r) => r.status === 'not_found')

    logger.info('Key rotation check complete', {
      overdue: overdue.length,
      upcoming: upcoming.length,
      healthy: healthy.length,
      notFound: notFound.length,
    })

    return NextResponse.json({
      checkedAt: new Date().toISOString(),
      summary: {
        overdue: overdue.length,
        upcoming: upcoming.length,
        healthy: healthy.length,
        notFound: notFound.length,
      },
      secrets: results,
    })
  } catch (err) {
    logger.error('Key rotation check failed', { error: err instanceof Error ? err.message : String(err) })
    return NextResponse.json(
      { error: 'Key rotation check failed', detail: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}
