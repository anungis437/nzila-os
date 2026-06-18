import { providerKeys, requiredSecretsForProvider, type ProviderKey } from './integrations-provider-catalog'

const providerEnvVarMap: Record<ProviderKey, Record<string, string>> = {
  resend: {
    apiKey: 'RESEND_API_KEY',
    fromAddress: 'RESEND_FROM_ADDRESS',
  },
  sendgrid: {
    apiKey: 'SENDGRID_API_KEY',
    fromAddress: 'SENDGRID_FROM_ADDRESS',
  },
  mailgun: {
    apiKey: 'MAILGUN_API_KEY',
    domain: 'MAILGUN_DOMAIN',
    fromAddress: 'MAILGUN_FROM_ADDRESS',
  },
  twilio: {
    accountSid: 'TWILIO_ACCOUNT_SID',
    authToken: 'TWILIO_AUTH_TOKEN',
    fromNumber: 'TWILIO_FROM_NUMBER',
  },
  firebase: {
    projectId: 'FIREBASE_PROJECT_ID',
    clientEmail: 'FIREBASE_CLIENT_EMAIL',
    privateKey: 'FIREBASE_PRIVATE_KEY',
  },
  slack: {
    webhookUrl: 'SLACK_WEBHOOK_URL',
  },
  teams: {
    webhookUrl: 'TEAMS_WEBHOOK_URL',
  },
  hubspot: {
    apiKey: 'HUBSPOT_API_KEY',
  },
  m365: {
    tenantId: 'M365_TENANT_ID',
    clientId: 'M365_CLIENT_ID',
    clientSecret: 'M365_CLIENT_SECRET',
  },
  'google-workspace': {
    clientId: 'GOOGLE_WORKSPACE_CLIENT_ID',
    clientSecret: 'GOOGLE_WORKSPACE_CLIENT_SECRET',
    refreshToken: 'GOOGLE_WORKSPACE_REFRESH_TOKEN',
  },
  webhooks: {
    signingSecret: 'WEBHOOKS_SIGNING_SECRET',
  },
}

export interface ProviderEnvReadiness {
  provider: ProviderKey
  configured: boolean
  missingEnvVars: string[]
  requiredEnvVars: string[]
}

export function envVarForProviderSecret(provider: ProviderKey, secretKey: string): string {
  return providerEnvVarMap[provider]?.[secretKey] ?? `${provider}_${secretKey}`.toUpperCase().replace(/-/g, '_')
}

export function getProviderEnvReadiness(provider: ProviderKey): ProviderEnvReadiness {
  const requiredSecretKeys = requiredSecretsForProvider(provider)
  const requiredEnvVars = requiredSecretKeys.map((key) => envVarForProviderSecret(provider, key))
  const missingEnvVars = requiredEnvVars.filter((envName) => {
    const value = process.env[envName]
    return !value || value.trim().length === 0
  })

  return {
    provider,
    configured: missingEnvVars.length === 0,
    missingEnvVars,
    requiredEnvVars,
  }
}

export function getAllProviderEnvReadiness(): ProviderEnvReadiness[] {
  return providerKeys.map((provider) => getProviderEnvReadiness(provider))
}
