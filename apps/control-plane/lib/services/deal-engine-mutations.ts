import {
  getDealAdapter,
  getPilotAdapter,
  getIngestionAdapter,
  getFollowUpAdapter,
} from '@/db/adapters'
import { emitDealEvent, DEAL_ENGINE_EVENTS } from './deal-engine-events'
import { recordDealAudit } from './deal-engine-audit'
import { logger } from '@/lib/telemetry'

type OperationResult = { status: number; body: Record<string, unknown> }
type PipelineInput = {
  dealId: string
  actor: string
  reason?: string
  toStage: Parameters<NonNullable<ReturnType<typeof getDealAdapter>['transitionStage']>>[1]
}
type PilotInput = { pilotId: string; actor: string } & (
  | {
      action: 'update_checklist'
      checklistKey:
        | 'dataReceived'
        | 'ingestionComplete'
        | 'demoDatasetReady'
        | 'userOnboardingComplete'
        | 'reviewMeetingScheduled'
        | 'conversionTriggered'
      checklistValue: boolean
    }
  | {
      action: 'update_status'
      status: Parameters<NonNullable<ReturnType<typeof getPilotAdapter>['updateStatus']>>[1]
    }
)
type FollowUpInput = { followUpId: string; actor: string } & (
  | { action: 'complete' }
  | { action: 'snooze'; newDueDate: string }
  | { action: 'reassign'; newOwner: string }
)

export async function transitionPipeline(
  input: PipelineInput,
  body: Record<string, unknown> = {},
): Promise<OperationResult> {
  const { dealId, toStage, actor, reason } = input

  const adapter = getDealAdapter()
  if (!adapter.transitionStage) {
    return {
      status: 501,
      body: { ok: false, error: 'Stage transitions not supported by current adapter' },
    }
  }

  const deal = await adapter.transitionStage(dealId, toStage, actor, reason)
  if (!deal) {
    return { status: 404, body: { ok: false, error: 'Deal not found or transition not allowed' } }
  }

  // Emit event + audit
  try {
    await emitDealEvent(
      DEAL_ENGINE_EVENTS.DEAL_STAGE_CHANGED,
      {
        dealId: deal.id,
        fromStage: body.fromStage,
        toStage: deal.stage,
        actor,
        reason,
      },
      { actorId: actor, tenantId: 'system' },
    )

    recordDealAudit({
      action: 'deal_stage_transition',
      actor,
      orgId: 'system',
      details: {
        dealId: deal.id,
        before: { stage: body.fromStage },
        after: { stage: deal.stage },
        reason,
      },
    })
  } catch (err) {
    logger.error('[ROUTE:pipeline] event/audit emission failed', { error: err })
  }

  return { status: 200, body: { ok: true, data: { deal } } }
}

export async function mutatePilot(
  input: PilotInput,
  body: Record<string, unknown> = {},
): Promise<OperationResult> {
  const adapter = getPilotAdapter()
  const data = input

  if (data.action === 'update_checklist') {
    if (!adapter.updateChecklist) {
      return { status: 501, body: { ok: false, error: 'Checklist updates not supported' } }
    }
    const pilot = await adapter.updateChecklist(
      data.pilotId,
      data.checklistKey,
      data.checklistValue,
      data.actor,
    )
    if (!pilot) {
      return { status: 404, body: { ok: false, error: 'Pilot not found or invalid checklist key' } }
    }

    try {
      await emitDealEvent(
        DEAL_ENGINE_EVENTS.PILOT_CHECKLIST_UPDATED,
        {
          pilotId: data.pilotId,
          checklistKey: data.checklistKey,
          checklistValue: data.checklistValue,
          actor: data.actor,
        },
        { actorId: data.actor, tenantId: 'system' },
      )
      recordDealAudit({
        action: 'pilot_checklist_update',
        actor: data.actor,
        orgId: 'system',
        details: {
          pilotId: data.pilotId,
          checklistKey: data.checklistKey,
          before: { [data.checklistKey]: !data.checklistValue },
          after: { [data.checklistKey]: data.checklistValue },
        },
      })
    } catch (err) {
      logger.error('[ROUTE:pilots] checklist event/audit failed', { error: err })
    }

    return { status: 200, body: { ok: true, data: { pilot } } }
  }

  if (data.action === 'update_status') {
    if (!adapter.updateStatus) {
      return { status: 501, body: { ok: false, error: 'Status updates not supported' } }
    }
    const pilot = await adapter.updateStatus(data.pilotId, data.status, data.actor)
    if (!pilot) {
      return {
        status: 404,
        body: { ok: false, error: 'Pilot not found or transition not allowed' },
      }
    }

    try {
      await emitDealEvent(
        DEAL_ENGINE_EVENTS.PILOT_STARTED,
        {
          pilotId: data.pilotId,
          status: data.status,
          actor: data.actor,
        },
        { actorId: data.actor, tenantId: 'system' },
      )
      recordDealAudit({
        action: 'pilot_status_change',
        actor: data.actor,
        orgId: 'system',
        details: {
          pilotId: data.pilotId,
          before: { status: body.previousStatus ?? 'unknown' },
          after: { status: data.status },
        },
      })
    } catch (err) {
      logger.error('[ROUTE:pilots] status event/audit failed', { error: err })
    }

    return { status: 200, body: { ok: true, data: { pilot } } }
  }

  return { status: 400, body: { ok: false, error: `Unknown action` } }
}

export async function mutateFollowUp(
  input: FollowUpInput,
  body: Record<string, unknown> = {},
): Promise<OperationResult> {
  const adapter = getFollowUpAdapter()
  const data = input

  if (data.action === 'complete') {
    if (!adapter.complete) {
      return { status: 501, body: { ok: false, error: 'Complete not supported' } }
    }
    const followUp = await adapter.complete(data.followUpId, data.actor)
    if (!followUp) {
      return { status: 404, body: { ok: false, error: 'Follow-up not found' } }
    }

    try {
      await emitDealEvent(
        DEAL_ENGINE_EVENTS.FOLLOWUP_COMPLETED,
        {
          followUpId: data.followUpId,
          actor: data.actor,
        },
        { actorId: data.actor, tenantId: 'system' },
      )
      recordDealAudit({
        action: 'followup_completed',
        actor: data.actor,
        orgId: 'system',
        details: {
          followUpId: data.followUpId,
          title: followUp.title,
          before: { completedAt: null },
          after: { completedAt: followUp.completedAt },
        },
      })
    } catch (err) {
      logger.error('[ROUTE:follow-ups] complete event/audit failed', { error: err })
    }

    return { status: 200, body: { ok: true, data: { followUp } } }
  }

  if (data.action === 'snooze') {
    if (!adapter.snooze) {
      return { status: 501, body: { ok: false, error: 'Snooze not supported' } }
    }
    const followUp = await adapter.snooze(data.followUpId, data.newDueDate, data.actor)
    if (!followUp) {
      return { status: 404, body: { ok: false, error: 'Follow-up not found' } }
    }

    try {
      recordDealAudit({
        action: 'followup_snoozed',
        actor: data.actor,
        orgId: 'system',
        details: {
          followUpId: data.followUpId,
          before: { dueDate: body.previousDueDate ?? 'unknown' },
          after: { dueDate: data.newDueDate },
        },
      })
    } catch (err) {
      logger.error('[ROUTE:follow-ups] snooze audit failed', { error: err })
    }

    return { status: 200, body: { ok: true, data: { followUp } } }
  }

  if (data.action === 'reassign') {
    if (!adapter.reassign) {
      return { status: 501, body: { ok: false, error: 'Reassign not supported' } }
    }
    const followUp = await adapter.reassign(data.followUpId, data.newOwner, data.actor)
    if (!followUp) {
      return { status: 404, body: { ok: false, error: 'Follow-up not found' } }
    }

    try {
      recordDealAudit({
        action: 'followup_reassigned',
        actor: data.actor,
        orgId: 'system',
        details: {
          followUpId: data.followUpId,
          before: { owner: body.previousOwner ?? 'unknown' },
          after: { owner: data.newOwner },
        },
      })
    } catch (err) {
      logger.error('[ROUTE:follow-ups] reassign audit failed', { error: err })
    }

    return { status: 200, body: { ok: true, data: { followUp } } }
  }

  return { status: 400, body: { ok: false, error: 'Unknown action' } }
}

export async function retryIngestion(
  input: { runId: string; actor: string },
  _body: Record<string, unknown> = {},
): Promise<OperationResult> {
  const { runId, actor } = input

  const adapter = getIngestionAdapter()
  if (!adapter.retry) {
    return { status: 501, body: { ok: false, error: 'Retry not supported by current adapter' } }
  }

  const run = await adapter.retry(runId, actor)
  if (!run) {
    return { status: 404, body: { ok: false, error: 'Ingestion run not found' } }
  }

  try {
    await emitDealEvent(
      DEAL_ENGINE_EVENTS.INGESTION_STARTED,
      {
        runId: run.id,
        actor,
        retried: true,
      },
      { actorId: actor, tenantId: 'system' },
    )
    recordDealAudit({
      action: 'ingestion_retry',
      actor,
      orgId: 'system',
      details: { runId: run.id, source: run.sourceSystem },
    })
  } catch {
    /* best-effort */
  }

  return { status: 200, body: { ok: true, data: { run } } }
}
