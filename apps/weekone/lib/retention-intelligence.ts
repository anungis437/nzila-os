export interface WeeklyScoreInput {
  weekStartDate: string | Date
  score: number
}

export function computeRetentionInsights(weeks: WeeklyScoreInput[]): {
  weeksCompleted: number
  averageScore: number
  consistency: number
  churnRisk: 'low' | 'medium' | 'high'
} {
  if (weeks.length === 0) {
    return {
      weeksCompleted: 0,
      averageScore: 0,
      consistency: 0,
      churnRisk: 'high',
    }
  }

  const sorted = [...weeks].sort((a, b) =>
    new Date(a.weekStartDate).getTime() - new Date(b.weekStartDate).getTime(),
  )

  const totalScore = sorted.reduce((sum, week) => sum + week.score, 0)
  const averageScore = totalScore / sorted.length

  const maxGapDays = sorted.reduce((max, week, index) => {
    if (index === 0) return max
    const prev = new Date(sorted[index - 1].weekStartDate).getTime()
    const current = new Date(week.weekStartDate).getTime()
    const gap = Math.round((current - prev) / 86_400_000)
    return Math.max(max, gap)
  }, 0)

  const consistency = Math.max(0, 100 - Math.max(0, maxGapDays - 7) * 5)

  const churnRisk: 'low' | 'medium' | 'high' =
    averageScore >= 75 && consistency >= 80
      ? 'low'
      : averageScore >= 55 && consistency >= 60
      ? 'medium'
      : 'high'

  return {
    weeksCompleted: sorted.length,
    averageScore: Math.round(averageScore),
    consistency: Math.round(consistency),
    churnRisk,
  }
}
