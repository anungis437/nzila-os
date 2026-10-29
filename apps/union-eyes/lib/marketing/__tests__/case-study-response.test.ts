import { describe, expect, it } from 'vitest'
import { caseStudyRows } from '../case-study-response'

describe('R-55: public case-study response contract', () => {
  const studies = [{ id: 'published', slug: 'case-study-one', visibility: 'public' }]

  it('extracts rows from the current withApi nested success envelope', () => {
    const payload = { success: true, data: { data: studies, pagination: { page: 1, total: 1 } }, timestamp: '2026-10-29' }
    expect(caseStudyRows(payload)).toEqual(studies)
  })

  it('accepts earlier flat data arrays and named caseStudies collections', () => {
    expect(caseStudyRows({ success: true, data: studies })).toEqual(studies)
    expect(caseStudyRows({ caseStudies: studies })).toEqual(studies)
  })

  it('never shows content from an error envelope even when it contains a data array', () => {
    expect(caseStudyRows({ success: false, data: { data: studies }, error: 'FORBIDDEN' })).toEqual([])
  })

  it('treats malformed, empty and non-array responses as no public records', () => {
    for (const payload of [null, undefined, false, 'error', [], {}, { data: { data: { id: 'private' } } }, { caseStudies: 'not-an-array' }]) {
      expect(caseStudyRows(payload)).toEqual([])
    }
  })

  it('does not fabricate records when the server returns an empty page', () => {
    expect(caseStudyRows({ success: true, data: { data: [], pagination: { page: 1, total: 0 } } })).toEqual([])
  })
})
