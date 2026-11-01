import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('@/lib/email-service', () => ({ getFromEmail: () => 'reports@example.test', sendResendEmail: m.send }))

import { sendScheduledReportEmail } from '../report-email-templates'

const params = {
  schedule: { recipients: ['a@example.com'], format: 'pdf', frequency: 'weekly', report_name: 'Quarterly' },
  fileUrl: 'https://example.test/r.pdf',
  fileBuffer: Buffer.from('x'),
} as never

describe('scheduled report email delivery', () => {
  beforeEach(() => { m.send.mockReset(); delete process.env.EMAIL_PROVIDER })
  afterEach(() => { delete process.env.EMAIL_PROVIDER })

  it('sends through the one function that applies the platform address suppression', async () => {
    m.send.mockResolvedValue({ success: true })
    await sendScheduledReportEmail(params)
    expect(m.send).toHaveBeenCalledTimes(1)
  })

  it('reports a suppressed or failed send as a failure, not a delivered report', async () => {
    m.send.mockResolvedValue({ success: false, error: 'Every recipient address is suppressed', code: 'ADDRESS_SUPPRESSED' })
    await expect(sendScheduledReportEmail(params)).rejects.toThrow('Every recipient address is suppressed')
  })

  it.each(['sendgrid', 'smtp', 'console'])('refuses provider %s instead of reporting success without sending', async (provider) => {
    process.env.EMAIL_PROVIDER = provider
    await expect(sendScheduledReportEmail(params)).rejects.toThrow(/no email was sent/)
    expect(m.send).not.toHaveBeenCalled()
  })
})
