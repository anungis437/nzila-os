import 'server-only'
import { logger } from '@/lib/telemetry'
import { db } from '@nzila/db'
import { dealEngineFollowUps } from './schemas'

export async function createAutomatedFollowUp(params: {
  dealId?: string
  pilotId?: string
  accountName: string
  title: string
  description: string
  owner: string
  priority: 'critical' | 'high' | 'medium' | 'low'
  daysUntilDue: number
  trigger: string
}): Promise<void> {
  try {
    const now = new Date()
    const due = new Date(now.getTime() + params.daysUntilDue * 86_400_000)
    await db.insert(dealEngineFollowUps).values({
      id: crypto.randomUUID(),
      dealId: params.dealId ?? null,
      pilotId: params.pilotId ?? null,
      accountName: params.accountName,
      title: params.title,
      description: params.description,
      owner: params.owner,
      priority: params.priority,
      dueDate: due,
      isOverdue: false,
      completedAt: null,
      trigger: params.trigger,
      createdAt: now,
    })
  } catch (err) {
    logger.error('[AUTOMATION] createAutomatedFollowUp failed', {
      trigger: params.trigger,
      error: err,
    })
  }
}
