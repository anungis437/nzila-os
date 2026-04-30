import { createKpiEvent, listKpiEvents } from '@/lib/maestria-persistence'

export function recordOperationalEvent(input: {
  eventName: string
  value: number
  unit: string
  source: string
  dimensions?: Record<string, unknown>
}) {
  return createKpiEvent(input)
}

export function getKpiWarehouseSummary() {
  const events = listKpiEvents(500)

  const grouped = events.reduce<Record<string, { count: number; total: number; unit: string }>>((acc, event) => {
    if (!acc[event.eventName]) {
      acc[event.eventName] = { count: 0, total: 0, unit: event.unit }
    }
    acc[event.eventName].count += 1
    acc[event.eventName].total += event.value
    return acc
  }, {})

  const kpis = Object.entries(grouped).map(([eventName, bucket]) => ({
    eventName,
    count: bucket.count,
    total: Number(bucket.total.toFixed(2)),
    average: Number((bucket.total / Math.max(bucket.count, 1)).toFixed(2)),
    unit: bucket.unit,
  }))

  return {
    generatedAt: new Date().toISOString(),
    totalEvents: events.length,
    kpis,
    sourceBreakdown: events.reduce<Record<string, number>>((acc, event) => {
      acc[event.source] = (acc[event.source] ?? 0) + 1
      return acc
    }, {}),
  }
}
