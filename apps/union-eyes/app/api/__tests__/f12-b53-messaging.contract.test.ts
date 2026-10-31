import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const read = (path: string) => readFileSync(join(fileURLToPath(new URL('../../../', import.meta.url)), path), 'utf8')

describe('B53 messaging records and retained communications', () => {
  it.each([
    'app/api/communications/sms/route.ts',
    'app/api/communications/sms/campaigns/route.ts',
    'app/api/communications/sms/conversations/route.ts',
  ])('%s keeps its officer read and creates no row for a send it does not make (DEF-0B5-SMS-ROWS-WRITTEN-WITHOUT-SENDING)', (route) => {
    const text = read(route)
    expect(text).toContain("readRole: 'officer'")
    expect(text).toContain('recordsASendOnly(')
    expect(text).toContain('const { GET } = crudRoutes')
    expect(text).not.toMatch(/export \{ GET, POST \}/)
  })

  it('answers 501 for the conversation read path instead of listing every message (DEF-0B5-SMS-READ-ROUTE-IS-GENERIC-MESSAGE-CRUD)', () => {
    const text = read('app/api/communications/sms/conversations/[conversationId]/read/route.ts')
    expect(text).toContain('ApiError.notImplemented')
    expect(text).toContain("minRole: 'officer'")
    expect(text).not.toContain('crudRoutes')
  })

  it.each([
    'app/api/communications/templates/[id]/route.ts',
    'app/api/messaging/templates/[id]/route.ts',
    'app/api/communications/distribution-lists/[id]/route.ts',
  ])('%s archives on delete instead of removing the row (DEF-0B5-COMMS-TEMPLATE-HARD-DELETE, DEF-0B5-COMMS-LIST-DELETE-ERASES-SUBSCRIBER-CONSENT-TRAIL)', (route) => {
    expect(read(route)).toContain("archiveColumn: 'isActive'")
    expect(read(route)).not.toContain('retainOnDelete')
  })

  it('reports an unknown batch job as not found and discloses no recipient address (DEF-0B4-BATCH-STATUS-FABRICATED-PROCESSING)', () => {
    const text = read('app/api/billing/batch-status/[jobId]/route.ts')
    expect(text.match(/Batch job not found/g)).toHaveLength(2)
    expect(text).not.toContain('recipientEmail')
    expect(text).not.toContain('newsletterRecipients.email')
  })

  it.each([
    'app/api/organizing/forms/generate/route.ts',
    'app/api/organizing/labour-board/route.ts',
    'app/api/organizing/nlrb-filings/route.ts',
    'app/api/meeting-rooms/[id]/bookings/route.ts',
    'app/api/carbon/dashboard/route.ts',
  ])('%s answers 501 and is no longer a generic CRUD or an invented result (verified existing implementation)', (route) => {
    const text = read(route)
    expect(text).toContain('ApiError.notImplemented')
    expect(text).not.toContain('crudRoutes')
    expect(text).not.toContain("searchParams.get('organizationId')")
  })

  it('binds a survey response to the survey of the caller organization and to an open survey (verified existing implementation)', () => {
    const text = read('app/api/communications/surveys/[surveyId]/responses/route.ts')
    expect(text).toContain('eq(surveys.organizationId, organizationId)')
    expect(text).toContain('Survey is not open')
    expect(text).toContain("createPathBinding: { paramName: 'surveyId', field: 'surveyId' }")
    expect(text).toContain('zUUID.safeParse(params.surveyId)')
  })
})