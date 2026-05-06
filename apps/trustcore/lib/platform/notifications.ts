import {
  createInMemoryNotificationService,
  type NotificationService,
} from '@nzila/platform-notifications'
import {
  mailgunAdapter,
  resendAdapter,
  sendgridAdapter,
} from '@nzila/comms-email'

type EmailPayload = {
  to: string
  subject: string
  body: string
}

type EmailProviderConfig =
  | {
      adapter: typeof resendAdapter
      credentials: { apiKey: string; fromAddress: string }
    }
  | {
      adapter: typeof sendgridAdapter
      credentials: { apiKey: string; fromAddress: string }
    }
  | {
      adapter: typeof mailgunAdapter
      credentials: { apiKey: string; fromAddress: string; domain: string; region?: 'us' | 'eu' }
    }

const notificationService = createInMemoryNotificationService()

function resolveEmailProvider(): EmailProviderConfig | null {
  const resendFrom = process.env.RESEND_FROM_EMAIL ?? process.env.RESEND_FROM_ADDRESS
  const sendgridFrom = process.env.SENDGRID_FROM_EMAIL ?? process.env.SENDGRID_FROM_ADDRESS
  const mailgunFrom = process.env.MAILGUN_FROM_EMAIL ?? process.env.MAILGUN_FROM_ADDRESS

  if (process.env.RESEND_API_KEY && resendFrom) {
    return {
      adapter: resendAdapter,
      credentials: {
        apiKey: process.env.RESEND_API_KEY,
        fromAddress: resendFrom,
      },
    }
  }

  if (process.env.SENDGRID_API_KEY && sendgridFrom) {
    return {
      adapter: sendgridAdapter,
      credentials: {
        apiKey: process.env.SENDGRID_API_KEY,
        fromAddress: sendgridFrom,
      },
    }
  }

  if (
    process.env.MAILGUN_API_KEY &&
    mailgunFrom &&
    process.env.MAILGUN_DOMAIN
  ) {
    return {
      adapter: mailgunAdapter,
      credentials: {
        apiKey: process.env.MAILGUN_API_KEY,
        fromAddress: mailgunFrom,
        domain: process.env.MAILGUN_DOMAIN,
        region: process.env.MAILGUN_REGION === 'eu' ? 'eu' : 'us',
      },
    }
  }

  return null
}

export function getTrustcoreNotificationService(): NotificationService {
  return notificationService
}

export async function sendTrustcoreEmail(payload: EmailPayload): Promise<{
  ok: boolean
  provider: string | null
  providerMessageId?: string
  error?: string
}> {
  const provider = resolveEmailProvider()

  if (!provider) {
    return {
      ok: false,
      provider: null,
      error: 'No TrustCore email provider is configured',
    }
  }

  const result = await provider.adapter.send(
    {
      to: payload.to,
      subject: payload.subject,
      body: payload.body,
    },
    provider.credentials,
  )

  return {
    ok: result.ok,
    provider: provider.adapter.provider,
    providerMessageId: result.providerMessageId,
    error: result.error,
  }
}
