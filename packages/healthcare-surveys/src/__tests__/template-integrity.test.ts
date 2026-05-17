import { describe, expect, it } from 'vitest'
import { UNIT_SCHEDULING_TEMPLATE } from '../templates/unit-scheduling'

describe('Unit scheduling template integrity', () => {
  it('contains the expected core and optional questions', () => {
    expect(UNIT_SCHEDULING_TEMPLATE.questions.length).toBe(17)
    const ids = UNIT_SCHEDULING_TEMPLATE.questions.map((q) => q.id)
    expect(ids).toContain('q15')
    expect(ids).toContain('q16')
    expect(ids).toContain('q17')
  })

  it('does not ask for names, email, patient details, manager names, or grievance details', () => {
    const prompt = UNIT_SCHEDULING_TEMPLATE.questions.map((q) => q.text.toLowerCase()).join(' ')
    expect(prompt).not.toContain('patient name')
    expect(prompt).not.toContain('employee name')
    expect(prompt).not.toContain('manager name')
    expect(prompt).not.toContain('email')
    expect(prompt).not.toContain('grievance details')
  })

  it('maps Q7-Q12 to workflow signals', () => {
    const workflow = Object.fromEntries(
      UNIT_SCHEDULING_TEMPLATE.questions.map((q) => [q.id, q.mapsToWorkflow]),
    )
    expect(workflow.q7).toBe('schedule_change_tracking')
    expect(workflow.q8).toBe('open_shift_transparency')
    expect(workflow.q9).toBe('shift_exchange_clarity')
    expect(workflow.q10).toBe('agreement_review_prompts')
    expect(workflow.q11).toBe('evidence_timeline')
    expect(workflow.q12).toBe('evidence_packet')
  })
})
