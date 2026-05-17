import { describe, expect, it } from 'vitest'
import { recommendPilotWedge } from '../scoring/pilot-recommendation'

function response(
  overrides: Record<string, unknown>,
): { surveyId: string; answers: Record<string, unknown> } {
  return {
    surveyId: 'survey-1',
    answers: {
      q7: 3,
      q8: 3,
      q9: 3,
      q10: 3,
      q11: 3,
      q12: 3,
      q13: 'Schedule change tracking',
      q15: [],
      ...overrides,
    },
  }
}

describe('pilot recommendation', () => {
  it('recommends schedule change log when schedule change signal leads', () => {
    const rec = recommendPilotWedge(
      'survey-1',
      [response({ q7: 5, q13: 'Schedule change tracking' }), response({ q7: 5, q13: 'Schedule change tracking' })],
      { localName: 'UNA Local 115', unitName: 'Unit 92, Short Stay Cardiology' },
    )
    expect(rec.recommendedWedge).toBe('schedule_change_log')
    expect(rec.title).toContain('Schedule Change Log for Unit 92')
  })

  it('recommends open shift offer trace when open shift signal leads', () => {
    const rec = recommendPilotWedge(
      'survey-1',
      [response({ q8: 5, q13: 'Open shift offer transparency' }), response({ q8: 5, q13: 'Open shift offer transparency' })],
      { localName: 'UNA Local 115', unitName: 'Unit 92, Short Stay Cardiology' },
    )
    expect(rec.recommendedWedge).toBe('open_shift_offer_trace')
  })

  it('recommends scheduling event timeline when evidence timeline and packet are high', () => {
    const rec = recommendPilotWedge('survey-1', [response({ q11: 5, q12: 5 }), response({ q11: 4, q12: 4 })])
    expect(rec.recommendedWedge).toBe('scheduling_event_timeline')
  })

  it('adds governance warning on privacy concerns', () => {
    const rec = recommendPilotWedge('survey-1', [response({ q15: ['Privacy', 'Employer access'] }), response({ q15: ['Being identified'] })])
    expect(rec.adoptionRisks.join(' ')).toContain('Clarify data governance before any pilot.')
  })

  it('forces low confidence when fewer than 5 responses', () => {
    const rec = recommendPilotWedge('survey-1', [response({ q7: 5 }), response({ q7: 5 }), response({ q7: 5 }), response({ q7: 5 })])
    expect(rec.confidence).toBe('low')
  })
})
