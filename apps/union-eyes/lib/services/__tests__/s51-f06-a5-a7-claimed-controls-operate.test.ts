import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('F06 batch 5 (A5 + A7): controls that were claimed are the controls that operate', () => {
  it('chatbot moderation is an AI control-plane call, not a direct provider call', () => {
    const service = src('lib/ai/chatbot-service.ts')
    expect(service).not.toContain('api.openai.com')
    expect(service).not.toContain('OPENAI_API_KEY')
    expect(service).toContain('profileKey: UE_PROFILES.CHATBOT_MODERATION')
    expect(service).toContain("dataClass: toGatewayDataClass('member_personal')")
    expect(src('lib/ai/ai-client.ts')).toContain("CHATBOT_MODERATION: 'ue-chatbot-moderation'")
    expect(src('../../scripts/seed-ai-profiles-ue.sql')).toContain("'ue-chatbot-moderation'")
  })

  it('an external read is recorded with its decision on the same transaction, and the record gates the release', () => {
    const middleware = src('lib/external-resource-middleware.ts')
    expect(middleware).toContain("action: 'external.resource.read'")
    expect(middleware.indexOf('await handler(')).toBeLessThan(middleware.indexOf("action: 'external.resource.read'"))
    expect(middleware).toContain('{ recordAllowed: !middlewareRecordsRead }')
    expect(src('lib/services/external-resource-authorization-service.ts')).toContain('options.recordAllowed === false')
    expect(src('app/api/external/documents/[id]/download/route.ts')).toContain("readRecord: 'handler'")
  })

  it('report execution needs an administrator to list claim rows or touch member e-mail, and bounds an officer page', () => {
    const validation = src('lib/reports/report-config-validation.ts')
    expect(validation).toContain("organization_members: ['email']")
    expect(validation).toContain('OFFICER_REPORT_ROW_CAP = 500')
    const route = src('app/api/reports/execute/route.ts')
    expect(route).toContain("action: 'report.execute.denied'")
    expect(route.indexOf('adminOnlyReportSelections(config)')).toBeLessThan(route.indexOf('executor.execute(config)'))
  })

  it('an ICRA claim is the purchaser\'s: the account e-mail must be the one recorded at purchase', () => {
    const route = src('app/api/icra/[assessmentId]/claim/route.ts')
    expect(route).toContain('lower(${icraAssessments.claimEmail}) = ${claimantEmail}')
    expect(route).toContain('purchaserEmailMatched: true')
  })

  it('voice transcription applies the entitlement before it reads or sends the recording', () => {
    const route = src('app/api/voice/transcribe/route.ts')
    expect(route).toContain("checkEntitlement(organizationId, 'ai_search')")
    expect(route.indexOf("checkEntitlement(organizationId, 'ai_search')")).toBeLessThan(route.indexOf('request.formData()'))
  })

  it('a missed memory-holder write on a claimed workbook is recorded as an attempt', () => {
    const route = src('app/api/workbook/[id]/memory-holders/[holderId]/route.ts')
    expect(route).toContain("'workbook.memory_holder.update_not_found'")
    expect(route).toContain("'workbook.memory_holder.delete_not_found'")
  })
})
