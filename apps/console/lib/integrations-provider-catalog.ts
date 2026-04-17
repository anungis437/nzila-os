import { z } from 'zod'
import { resendAdapter, sendgridAdapter, mailgunAdapter } from '@nzila/comms-email'
import { twilioAdapter } from '@nzila/comms-sms'
import { firebaseAdapter } from '@nzila/comms-push'
import { slackAdapter } from '@nzila/chatops-slack'
import { teamsAdapter } from '@nzila/chatops-teams'
import { hubspotAdapter } from '@nzila/crm-hubspot'

export const providerKeys = [
  'resend',
  'sendgrid',
  'mailgun',
  'twilio',
  'firebase',
  'slack',
  'teams',
  'hubspot',
  'm365',
  'google-workspace',
  'webhooks',
] as const

export type ProviderKey = (typeof providerKeys)[number]

export interface ProviderDefinition {
  key: ProviderKey
  displayName: string
  channel: 'email' | 'sms' | 'push' | 'chatops' | 'crm' | 'productivity' | 'webhooks'
  requiredSecrets: readonly string[]
  testConnection: (secrets: Record<string, string>) => Promise<{ ok: boolean; error?: string }>
}

const requiredSecretsMap: Record<ProviderKey, readonly string[]> = {
  resend: ['apiKey', 'fromAddress'],
  sendgrid: ['apiKey', 'fromAddress'],
  mailgun: ['apiKey', 'domain', 'fromAddress'],
  twilio: ['accountSid', 'authToken', 'fromNumber'],
  firebase: ['projectId', 'clientEmail', 'privateKey'],
  slack: ['webhookUrl'],
  teams: ['webhookUrl'],
  hubspot: ['apiKey'],
  m365: ['tenantId', 'clientId', 'clientSecret'],
  'google-workspace': ['clientId', 'clientSecret', 'refreshToken'],
  webhooks: ['signingSecret'],
}

function validateRequiredSecrets(provider: ProviderKey, secrets: Record<string, string>): { ok: boolean; error?: string } {
  const required = requiredSecretsMap[provider]
  const missing = required.filter((key) => !secrets[key])
  if (missing.length > 0) {
    return { ok: false, error: `Missing required secrets: ${missing.join(', ')}` }
  }
  return { ok: true }
}

async function testM365(secrets: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const validation = validateRequiredSecrets('m365', secrets)
  if (!validation.ok) return validation

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: secrets.clientId,
    client_secret: secrets.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
  })

  const res = await fetch(`https://login.microsoftonline.com/${secrets.tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const detail = await res.text()
    return { ok: false, error: `M365 token exchange failed (${res.status}): ${detail}` }
  }

  return { ok: true }
}

async function testGoogleWorkspace(secrets: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const validation = validateRequiredSecrets('google-workspace', secrets)
  if (!validation.ok) return validation

  const body = new URLSearchParams({
    client_id: secrets.clientId,
    client_secret: secrets.clientSecret,
    refresh_token: secrets.refreshToken,
    grant_type: 'refresh_token',
  })

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!res.ok) {
    const detail = await res.text()
    return { ok: false, error: `Google token refresh failed (${res.status}): ${detail}` }
  }

  return { ok: true }
}

async function testWebhooks(secrets: Record<string, string>): Promise<{ ok: boolean; error?: string }> {
  const validation = validateRequiredSecrets('webhooks', secrets)
  if (!validation.ok) return validation
  if (secrets.signingSecret.length < 16) {
    return { ok: false, error: 'signingSecret must be at least 16 characters' }
  }
  return { ok: true }
}

function adapterTest(adapter: { healthCheck: (credentials: Record<string, unknown>) => Promise<{ status: 'ok' | 'degraded' | 'down'; details: string | null }> }, provider: ProviderKey) {
  return async (secrets: Record<string, string>) => {
    const validation = validateRequiredSecrets(provider, secrets)
    if (!validation.ok) return validation
    const result = await adapter.healthCheck(secrets)
    return result.status === 'ok'
      ? { ok: true }
      : { ok: false, error: result.details ?? `${provider} health check failed` }
  }
}

export const providerCatalog: Record<ProviderKey, ProviderDefinition> = {
  resend: {
    key: 'resend',
    displayName: 'Resend',
    channel: 'email',
    requiredSecrets: requiredSecretsMap.resend,
    testConnection: adapterTest(resendAdapter, 'resend'),
  },
  sendgrid: {
    key: 'sendgrid',
    displayName: 'SendGrid',
    channel: 'email',
    requiredSecrets: requiredSecretsMap.sendgrid,
    testConnection: adapterTest(sendgridAdapter, 'sendgrid'),
  },
  mailgun: {
    key: 'mailgun',
    displayName: 'Mailgun',
    channel: 'email',
    requiredSecrets: requiredSecretsMap.mailgun,
    testConnection: adapterTest(mailgunAdapter, 'mailgun'),
  },
  twilio: {
    key: 'twilio',
    displayName: 'Twilio',
    channel: 'sms',
    requiredSecrets: requiredSecretsMap.twilio,
    testConnection: adapterTest(twilioAdapter, 'twilio'),
  },
  firebase: {
    key: 'firebase',
    displayName: 'Firebase Cloud Messaging',
    channel: 'push',
    requiredSecrets: requiredSecretsMap.firebase,
    testConnection: adapterTest(firebaseAdapter, 'firebase'),
  },
  slack: {
    key: 'slack',
    displayName: 'Slack',
    channel: 'chatops',
    requiredSecrets: requiredSecretsMap.slack,
    testConnection: adapterTest(slackAdapter, 'slack'),
  },
  teams: {
    key: 'teams',
    displayName: 'Microsoft Teams',
    channel: 'chatops',
    requiredSecrets: requiredSecretsMap.teams,
    testConnection: adapterTest(teamsAdapter, 'teams'),
  },
  hubspot: {
    key: 'hubspot',
    displayName: 'HubSpot',
    channel: 'crm',
    requiredSecrets: requiredSecretsMap.hubspot,
    testConnection: adapterTest(hubspotAdapter, 'hubspot'),
  },
  m365: {
    key: 'm365',
    displayName: 'Microsoft 365',
    channel: 'productivity',
    requiredSecrets: requiredSecretsMap.m365,
    testConnection: testM365,
  },
  'google-workspace': {
    key: 'google-workspace',
    displayName: 'Google Workspace',
    channel: 'productivity',
    requiredSecrets: requiredSecretsMap['google-workspace'],
    testConnection: testGoogleWorkspace,
  },
  webhooks: {
    key: 'webhooks',
    displayName: 'Webhooks',
    channel: 'webhooks',
    requiredSecrets: requiredSecretsMap.webhooks,
    testConnection: testWebhooks,
  },
}

const providerKeySchema = z.enum(providerKeys)

export function parseProviderKey(raw: string): ProviderKey {
  return providerKeySchema.parse(raw)
}

export function listProviderDefinitions(): ProviderDefinition[] {
  return providerKeys.map((key) => providerCatalog[key])
}

export function requiredSecretsForProvider(key: ProviderKey): readonly string[] {
  return providerCatalog[key].requiredSecrets
}
