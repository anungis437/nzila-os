import type { TimelineEvent, TimelineFlag } from './types.js'
import { TimelineEventSource } from './types.js'

export function mergeTimelineEvents(events: TimelineEvent[]): TimelineEvent[] {
  const seen = new Map<string, TimelineEvent>()

  for (const event of events) {
    if (event.rawSourceId) {
      const key = `${event.rawSourceId}:${event.source}`
      if (!seen.has(key)) {
        seen.set(key, event)
      }
    } else {
      seen.set(event.id, event)
    }
  }

  return Array.from(seen.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
  )
}

export function buildTimeline(
  eventsBySource: { source: TimelineEventSource; events: TimelineEvent[] }[],
): TimelineEvent[] {
  const allEvents = eventsBySource.flatMap(({ events }) => events)
  return mergeTimelineEvents(allEvents)
}

export function addFlag(event: TimelineEvent, flag: TimelineFlag): TimelineEvent {
  if (event.flags.includes(flag)) {
    return event
  }
  return { ...event, flags: [...event.flags, flag] }
}
