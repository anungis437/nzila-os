/** Public metric values shared by the actual aggregate and rendering consumer. */
export const LEADERSHIP_EMPLOYER_TRENDS = ['up', 'down', 'stable'] as const
export type LeadershipEmployerTrend = typeof LEADERSHIP_EMPLOYER_TRENDS[number]

export function isLeadershipEmployerTrend(value: unknown): value is LeadershipEmployerTrend {
  return typeof value === 'string' && LEADERSHIP_EMPLOYER_TRENDS.some(trend => trend === value)
}
