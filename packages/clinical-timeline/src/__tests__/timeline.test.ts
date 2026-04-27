import { describe, it, expect } from 'vitest'
import { mergeTimelineEvents, buildTimeline, addFlag } from '../timeline.js'
import { TimelineEventSource, TimelineEventCategory, TimelineFlag } from '../types.js'
import type { TimelineEvent } from '../types.js'

function makeEvent(id: string, date: string, rawSourceId?: string): TimelineEvent {
  return {
    id,
    patientId: 'patient-001',
    organizationId: 'org-001',
    siteId: 'site-001',
    date,
    category: TimelineEventCategory.ENCOUNTER,
    source: TimelineEventSource.FHIR,
    title: `Event ${id}`,
    flags: [],
    rawSourceId,
  }
}

describe('mergeTimelineEvents', () => {
  it('sorts events by date descending', () => {
    const events = [
      makeEvent('e1', '2024-01-01'),
      makeEvent('e3', '2024-03-01'),
      makeEvent('e2', '2024-02-01'),
    ]
    const merged = mergeTimelineEvents(events)
    expect(merged[0].date).toBe('2024-03-01')
    expect(merged[1].date).toBe('2024-02-01')
    expect(merged[2].date).toBe('2024-01-01')
  })

  it('deduplicates events with the same rawSourceId and source', () => {
    const events = [
      makeEvent('e1', '2024-01-01', 'src-001'),
      makeEvent('e2', '2024-01-02', 'src-001'),
    ]
    const merged = mergeTimelineEvents(events)
    expect(merged.length).toBe(1)
    expect(merged[0].id).toBe('e1')
  })

  it('keeps events without rawSourceId as distinct by id', () => {
    const events = [
      makeEvent('e1', '2024-01-01'),
      makeEvent('e2', '2024-02-01'),
    ]
    const merged = mergeTimelineEvents(events)
    expect(merged.length).toBe(2)
  })
})

describe('buildTimeline', () => {
  it('flattens and merges events from multiple sources', () => {
    const result = buildTimeline([
      { source: TimelineEventSource.FHIR, events: [makeEvent('e1', '2024-01-01')] },
      { source: TimelineEventSource.HL7V2, events: [makeEvent('e2', '2024-02-01')] },
    ])
    expect(result.length).toBe(2)
  })

  it('returns empty array for empty input', () => {
    expect(buildTimeline([])).toEqual([])
  })
})

describe('addFlag', () => {
  it('adds a flag to an event', () => {
    const event = makeEvent('e1', '2024-01-01')
    const updated = addFlag(event, TimelineFlag.DUPLICATE_SUSPECTED)
    expect(updated.flags).toContain(TimelineFlag.DUPLICATE_SUSPECTED)
  })

  it('does not duplicate an already-present flag', () => {
    const event = makeEvent('e1', '2024-01-01')
    const once = addFlag(event, TimelineFlag.INCOMPLETE_RECORD)
    const twice = addFlag(once, TimelineFlag.INCOMPLETE_RECORD)
    const count = twice.flags.filter((f) => f === TimelineFlag.INCOMPLETE_RECORD).length
    expect(count).toBe(1)
  })

  it('does not mutate the original event', () => {
    const event = makeEvent('e1', '2024-01-01')
    addFlag(event, TimelineFlag.CONSENT_RESTRICTED)
    expect(event.flags).toHaveLength(0)
  })
})
