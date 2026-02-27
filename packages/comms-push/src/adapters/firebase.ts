/**
 * Nzila OS — Comms Push: Firebase Cloud Messaging Adapter
 */
import type {
  IntegrationAdapter,
  SendRequest,
  SendResult,
  HealthCheckResult,
} from '@nzila/integrations-core'

interface FirebaseCredentials {
  projectId: string
  clientEmail: string
  privateKey: string
}

function parseCredentials(creds: Record<string, unknown>): FirebaseCredentials {
  const projectId = creds['projectId']
  const clientEmail = creds['clientEmail']
  const privateKey = creds['privateKey']
  if (typeof projectId !== 'string' || !projectId) throw new Error('Missing Firebase projectId')
  if (typeof clientEmail !== 'string' || !clientEmail) throw new Error('Missing Firebase clientEmail')
  if (typeof privateKey !== 'string' || !privateKey) throw new Error('Missing Firebase privateKey')
  return { projectId, clientEmail, privateKey }
}

export const firebaseAdapter: IntegrationAdapter = {
  provider: 'firebase',
  channel: 'push',

  async send(request: SendRequest, credentials: Record<string, unknown>): Promise<SendResult> {
    const { projectId, clientEmail, privateKey } = parseCredentials(credentials)
    const admin = await import('firebase-admin')

    // Initialize app if not already done (multi-org: use a named app per org)
    const appName = `nzila-push-${request.orgId}`
    let app: ReturnType<typeof admin.initializeApp>
    try {
      app = admin.app(appName)
    } catch {
      app = admin.initializeApp(
        {
          credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
        },
        appName,
      )
    }

    try {
      const messaging = admin.messaging(app)
      const result = await messaging.send({
        token: request.to,
        notification: {
          title: request.subject ?? 'Notification',
          body: request.body ?? '',
        },
        data: request.variables
          ? Object.fromEntries(
              Object.entries(request.variables).map(([k, v]) => [k, String(v)]),
            )
          : undefined,
      })
      return { ok: true, providerMessageId: result }
    } catch (err) {
      return {
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      }
    }
  },

  async healthCheck(credentials: Record<string, unknown>): Promise<HealthCheckResult> {
    const start = Date.now()
    try {
      parseCredentials(credentials)
      return {
        provider: 'firebase',
        status: 'ok',
        latencyMs: Date.now() - start,
        details: null,
        checkedAt: new Date().toISOString(),
      }
    } catch (err) {
      return {
        provider: 'firebase',
        status: 'down',
        latencyMs: Date.now() - start,
        details: err instanceof Error ? err.message : String(err),
        checkedAt: new Date().toISOString(),
      }
    }
  },
}
