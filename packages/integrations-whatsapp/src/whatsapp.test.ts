import { describe, it, expect } from 'vitest'
import {
  createTwilioProvider,
  createWhatsAppBusinessProvider,
  createOpenClawProvider,
} from './providers'
import type { WhatsAppProvider, CommunicationLogger } from './index'
import {
  sendNotification,
  sendCaseStatusUpdate,
  sendDocumentRequest,
  sendRenewalReminder,
} from './messaging'

describe('providers', () => {
  it('creates Twilio provider', () => {
    const provider = createTwilioProvider({
      accountSid: 'AC_test',
      authToken: 'token',
      fromNumber: '+15551234567',
    })
    expect(provider.name).toBe('twilio')
  })

  it('creates WhatsApp Business provider', () => {
    const provider = createWhatsAppBusinessProvider({
      phoneNumberId: 'phone-1',
      accessToken: 'token',
    })
    expect(provider.name).toBe('whatsapp_business_api')
  })

  it('creates OpenClaw provider', () => {
    const provider = createOpenClawProvider({
      apiUrl: 'https://api.openclaw.com',
      apiKey: 'key',
    })
    expect(provider.name).toBe('openclaw')
  })

  it('sendMessage returns queued result', async () => {
    const provider = createTwilioProvider({
      accountSid: 'AC_test',
      authToken: 'token',
      fromNumber: '+15551234567',
    })

    const result = await provider.sendMessage('+1234', 'Hello')
    expect(result.status).toBe('queued')
    expect(result.externalId).toBeTruthy()
    expect(result.timestamp).toBeInstanceOf(Date)
  })

  it('sendTemplate returns queued result', async () => {
    const provider = createWhatsAppBusinessProvider({
      phoneNumberId: 'phone-1',
      accessToken: 'token',
    })

    const result = await provider.sendTemplate('+1234', 'welcome', { name: 'John' })
    expect(result.status).toBe('queued')
  })

  it('sendMessage works for WhatsApp Business provider', async () => {
    const provider = createWhatsAppBusinessProvider({
      phoneNumberId: 'phone-1',
      accessToken: 'token',
    })

    const result = await provider.sendMessage('+1234', 'Hello from WABA')
    expect(result.externalId).toContain('waba_')
    expect(result.status).toBe('queued')
  })

  it('OpenClaw provider handles both message and template sends', async () => {
    const provider = createOpenClawProvider({
      apiUrl: 'https://api.openclaw.com',
      apiKey: 'key',
    })

    const msgResult = await provider.sendMessage('+1234', 'Hello from OpenClaw')
    expect(msgResult.externalId).toContain('oc_')

    const tplResult = await provider.sendTemplate('+1234', 'reminder', { dueDate: 'tomorrow' })
    expect(tplResult.externalId).toContain('oc_tpl_')
  })
})

describe('messaging', () => {
  const provider: WhatsAppProvider = createTwilioProvider({
    accountSid: 'AC_test',
    authToken: 'token',
    fromNumber: '+15551234567',
  })

  const mockLogger: CommunicationLogger = {
    log: async () => {},
  }

  it('sendNotification logs and returns result', async () => {
    let loggedEntry: unknown = null
    const logger: CommunicationLogger = {
      log: async (entry) => { loggedEntry = entry },
    }

    const result = await sendNotification(provider, {
      clientId: 'client-1',
      caseId: 'case-1',
      recipientPhone: '+1234567890',
      messageType: 'case_status',
      body: 'Your case is approved',
    }, 'org-1', logger)

    expect(result.clientId).toBe('client-1')
    expect(result.sendResult.status).toBe('queued')
    expect(loggedEntry).not.toBeNull()
  })

  it('sendCaseStatusUpdate sends status message', async () => {
    const result = await sendCaseStatusUpdate(
      provider, 'client-1', 'case-1', '+1234567890',
      'Application submitted', 'org-1', mockLogger,
    )

    expect(result.messageType).toBe('case_status')
  })

  it('sendDocumentRequest formats document list', async () => {
    const result = await sendDocumentRequest(
      provider, 'client-1', 'case-1', '+1234567890',
      ['Passport', 'Bank statement', 'Police clearance'],
      'org-1', mockLogger,
    )

    expect(result.messageType).toBe('document_request')
  })

  it('sendNotification uses template branch when template data is provided', async () => {
    let loggedEntry: unknown = null
    const logger: CommunicationLogger = {
      log: async (entry) => {
        loggedEntry = entry
      },
    }

    const result = await sendNotification(
      provider,
      {
        clientId: 'client-2',
        caseId: 'case-2',
        recipientPhone: '+1234567890',
        messageType: 'case_status',
        body: 'Template fallback body',
        templateName: 'case_status_update',
        templateParams: { status: 'approved' },
      },
      'org-1',
      logger,
    )

    expect(result.sendResult.externalId).toContain('twilio_tpl_')
    expect(loggedEntry).toMatchObject({
      caseId: 'case-2',
      channel: 'whatsapp',
      direction: 'outbound',
    })
  })

  it('sendRenewalReminder sends renewal_reminder message type', async () => {
    const result = await sendRenewalReminder(
      provider,
      'client-3',
      '+1234567890',
      'Your permit renewal is due in 14 days',
      'org-1',
      mockLogger,
    )

    expect(result.messageType).toBe('renewal_reminder')
    expect(result.caseId).toBeUndefined()
  })
})
