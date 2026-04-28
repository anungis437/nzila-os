import { describe, expect, it } from 'vitest'
import { mailgunAdapter, resendAdapter, sendgridAdapter } from '../index'

describe('comms-email adapters', () => {
  it('exposes expected provider metadata', () => {
    expect(resendAdapter.provider).toBe('resend')
    expect(sendgridAdapter.provider).toBe('sendgrid')
    expect(mailgunAdapter.provider).toBe('mailgun')

    expect(resendAdapter.channel).toBe('email')
    expect(sendgridAdapter.channel).toBe('email')
    expect(mailgunAdapter.channel).toBe('email')
  })

  it('reports unhealthy status when resend credentials are missing', async () => {
    const result = await resendAdapter.healthCheck({})
    expect(result.status).toBe('down')
    expect(result.details).toContain('Missing Resend apiKey')
  })

  it('reports unhealthy status when mailgun credentials are incomplete', async () => {
    const result = await mailgunAdapter.healthCheck({ apiKey: 'key', fromAddress: 'noreply@nzila.app' })
    expect(result.status).toBe('down')
    expect(result.details).toContain('Missing Mailgun domain')
  })

  it('returns healthy status for sendgrid with structurally valid credentials', async () => {
    const result = await sendgridAdapter.healthCheck({
      apiKey: 'SG.fake-key',
      fromAddress: 'noreply@nzila.app',
    })

    expect(result.status).toBe('ok')
    expect(result.provider).toBe('sendgrid')
    expect(result.details).toBeNull()
  })

  it('fails fast on send when required credentials are missing', async () => {
    await expect(
      sendgridAdapter.send(
        { to: 'user@nzila.app', subject: 'Hello', body: 'Body' },
        { fromAddress: 'noreply@nzila.app' },
      ),
    ).rejects.toThrow('Missing SendGrid apiKey')
  })
})
