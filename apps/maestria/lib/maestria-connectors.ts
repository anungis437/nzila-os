import { getConnectorStub, type ConnectorSystem } from '@/lib/connector-stubs'
import {
  consumeConnectorOAuthState,
  getConnectorAccount,
  saveConnectorOAuthState,
  upsertConnectorAccount,
} from '@/lib/maestria-persistence'

interface ConnectorConfig {
  authBase: string
  scopes: string[]
}

const connectorConfig: Record<ConnectorSystem, ConnectorConfig> = {
  shopify: {
    authBase: 'https://shopify.com/oauth/authorize',
    scopes: ['read_orders', 'read_products', 'read_customers'],
  },
  'google-ads': {
    authBase: 'https://accounts.google.com/o/oauth2/v2/auth',
    scopes: ['https://www.googleapis.com/auth/adwords'],
  },
  zoho: {
    authBase: 'https://accounts.zoho.com/oauth/v2/auth',
    scopes: ['ZohoCRM.modules.ALL'],
  },
}

function randomToken(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 14)}`
}

export function buildConnectorAuthUrl(system: ConnectorSystem, actorId: string): { state: string; authUrl: string; scopes: string[] } {
  const state = saveConnectorOAuthState(system, actorId)
  const cfg = connectorConfig[system]
  const redirectUri = `${process.env.MAESTRIA_BASE_URL ?? 'http://localhost:3021'}/api/maestria/connectors/${system}/callback`
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: process.env[`MAESTRIA_${system.toUpperCase().replace('-', '_')}_CLIENT_ID`] ?? 'pending-client-id',
    redirect_uri: redirectUri,
    state,
    scope: cfg.scopes.join(' '),
    access_type: 'offline',
    prompt: 'consent',
  })

  upsertConnectorAccount({
    system,
    status: 'pending',
    scopes: cfg.scopes,
    metadata: { stage: 'auth_initiated', actorId },
  })

  return {
    state,
    scopes: cfg.scopes,
    authUrl: `${cfg.authBase}?${params.toString()}`,
  }
}

export function completeConnectorAuth(system: ConnectorSystem, state: string, code: string) {
  const consumed = consumeConnectorOAuthState(state)
  if (!consumed || consumed.system !== system) {
    return { ok: false as const, error: 'invalid_state' }
  }

  const account = upsertConnectorAccount({
    system,
    status: 'connected',
    externalAccountId: `${system}-acct-${code.slice(0, 6)}`,
    accessToken: randomToken(`${system}_at`),
    refreshToken: randomToken(`${system}_rt`),
    tokenExpiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
    scopes: connectorConfig[system].scopes,
    lastSyncAt: new Date().toISOString(),
    metadata: {
      stage: 'auth_completed',
      actorId: consumed.actorId,
      callbackCode: code.slice(0, 4),
    },
  })

  return {
    ok: true as const,
    account,
  }
}

export function getConnectorOperationalSnapshot(system: ConnectorSystem) {
  const stub = getConnectorStub(system)
  const account = getConnectorAccount(system)

  return {
    ...stub,
    account: account ?? {
      id: null,
      status: 'disconnected',
      scopes: connectorConfig[system].scopes,
      lastSyncAt: null,
      externalAccountId: null,
    },
  }
}
