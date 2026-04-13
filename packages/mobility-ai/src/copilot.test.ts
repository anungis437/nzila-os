import { describe, it, expect, vi } from 'vitest'
import {
  AI_OUTPUT_TYPES,
  generateClientSummary,
  generateProgramComparison,
  generateCaseMemo,
  generateDocumentRequestList,
  explainRiskFlags,
} from './index'

describe('mobility-ai copilot', () => {
  it('exports all supported output types', () => {
    expect(AI_OUTPUT_TYPES).toEqual([
      'client_summary',
      'program_comparison',
      'case_memo',
      'document_request_list',
      'risk_flag_explanation',
    ])
  })

  it('builds rich prompt sections for program comparison and carries jurisdiction refs', async () => {
    const generateFn = vi.fn(async (prompt: string) => ({
      text: `generated:${prompt.length}`,
      confidence: 0.82,
    }))

    const response = await generateProgramComparison(
      {
        orgId: 'org-1',
        actorId: 'actor-1',
        outputType: 'program_comparison',
        context: {
          caseId: 'case-100',
          clientId: 'client-100',
          programIds: ['PT-GV', 'GR-GV'],
          eligibilityResults: [
            { programId: 'PT-GV', eligible: true, score: 92, reasons: ['meets criteria'], blockers: [] },
            { programId: 'GR-GV', eligible: false, score: 41, reasons: [], blockers: ['missing docs'] },
          ],
          additionalNotes: 'Prioritize timeline clarity.',
        },
      },
      generateFn,
    )

    expect(generateFn).toHaveBeenCalledTimes(1)
    const prompt = generateFn.mock.calls[0]?.[0] ?? ''
    expect(prompt).toContain('Output type: program_comparison')
    expect(prompt).toContain('Case ID: case-100')
    expect(prompt).toContain('Client ID: client-100')
    expect(prompt).toContain('Programs: PT-GV, GR-GV')
    expect(prompt).toContain('Program PT-GV: eligible=true, score=92')
    expect(prompt).toContain('Program GR-GV: eligible=false, score=41')
    expect(prompt).toContain('Notes: Prioritize timeline clarity.')

    expect(response.outputType).toBe('program_comparison')
    expect(response.jurisdictionRefs).toEqual(['PT-GV', 'GR-GV'])
    expect(response.reasoningTrace).toContain('Compared 2 programs')
    expect(response.disclaimer).toContain('does not constitute legal advice')
  })

  it('uses minimal prompt when optional context is absent', async () => {
    const generateFn = vi.fn(async (_prompt: string) => ({ text: 'ok', confidence: 0.6 }))

    const response = await generateCaseMemo(
      {
        orgId: 'org-2',
        actorId: 'actor-2',
        outputType: 'case_memo',
        context: {},
      },
      generateFn,
    )

    const prompt = generateFn.mock.calls[0]?.[0] ?? ''
    expect(prompt).toContain('Output type: case_memo')
    expect(prompt).not.toContain('Programs:')
    expect(prompt).not.toContain('Eligibility results:')
    expect(prompt).not.toContain('Notes:')
    expect(response.outputType).toBe('case_memo')
    expect(response.reasoningTrace).toContain('case undefined')
  })

  it('returns correct output types for remaining generators', async () => {
    const generateFn = vi.fn(async () => ({ text: 'generated', confidence: 0.73 }))

    const clientSummary = await generateClientSummary(
      {
        orgId: 'org-1',
        actorId: 'actor-1',
        outputType: 'client_summary',
        context: { clientId: 'client-a' },
      },
      generateFn,
    )

    const docList = await generateDocumentRequestList(
      {
        orgId: 'org-1',
        actorId: 'actor-1',
        outputType: 'document_request_list',
        context: { caseId: 'case-a' },
      },
      generateFn,
    )

    const risk = await explainRiskFlags(
      {
        orgId: 'org-1',
        actorId: 'actor-1',
        outputType: 'risk_flag_explanation',
        context: { caseId: 'case-b' },
      },
      generateFn,
    )

    expect(clientSummary.outputType).toBe('client_summary')
    expect(docList.outputType).toBe('document_request_list')
    expect(risk.outputType).toBe('risk_flag_explanation')
  })
})