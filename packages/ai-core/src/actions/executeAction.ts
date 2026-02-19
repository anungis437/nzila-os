/**
 * @nzila/ai-core — Action Execution Engine (Phase C core)
 *
 * Orchestrates the full execution lifecycle:
 * load action → assert approved → create run → execute → attest → finalize.
 */
import { db } from '@nzila/db'
import { aiActions, aiActionRuns } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { appendAiAuditEvent } from '../logging'
import { ACTION_TYPES, FinanceStripeMonthlyReportsProposalSchema, AiIngestKnowledgeSourceProposalSchema } from '../schemas'
import type { FinanceStripeMonthlyReportsProposal, AiIngestKnowledgeSourceProposal } from '../schemas'
import { createActionAttestation, storeAttestation } from './attestation'
import {
  generateMonthlyReports,
  ingestKnowledgeSource,
  type ToolCallEntry,
} from '@nzila/tools-runtime'

// ── Types ───────────────────────────────────────────────────────────────────

export interface ExecuteActionResult {
  runId: string
  status: 'success' | 'failed'
  outputArtifacts: Record<string, unknown>
  attestationDocumentId: string | null
  error?: string
}

// ── Execute Action ──────────────────────────────────────────────────────────

/**
 * Execute an approved action: creates a run, dispatches to the correct
 * tool, generates attestation, and finalizes everything.
 */
export async function executeAction(
  actionId: string,
  actorClerkUserId: string,
): Promise<ExecuteActionResult> {
  // 1. Load action
  const [action] = await db
    .select()
    .from(aiActions)
    .where(eq(aiActions.id, actionId))
    .limit(1)

  if (!action) {
    throw new Error(`Action not found: ${actionId}`)
  }

  if (action.status !== 'approved') {
    throw new Error(`Action ${actionId} is in "${action.status}" status, must be "approved" to execute`)
  }

  // 2. Create action run
  const [run] = await db
    .insert(aiActionRuns)
    .values({
      actionId: action.id,
      entityId: action.entityId,
      status: 'started',
    })
    .returning()

  // 3. Move action to executing
  await db
    .update(aiActions)
    .set({ status: 'executing', updatedAt: new Date() })
    .where(eq(aiActions.id, actionId))

  await appendAiAuditEvent({
    entityId: action.entityId,
    actorClerkUserId,
    action: 'ai.action_executing',
    targetType: 'ai_action',
    targetId: actionId,
    afterJson: {
      actionType: action.actionType,
      runId: run.id,
    },
  })

  try {
    let outputArtifacts: Record<string, unknown> = {}
    let toolCalls: ToolCallEntry[] = []

    // 4. Dispatch by action type
    switch (action.actionType) {
      case ACTION_TYPES.FINANCE_STRIPE_MONTHLY_REPORTS: {
        const proposal = FinanceStripeMonthlyReportsProposalSchema.parse(action.proposalJson)
        const result = await generateMonthlyReports(proposal, actorClerkUserId)

        outputArtifacts = {
          documentIds: result.artifacts.map((a) => a.documentId),
          reportIds: result.artifacts.map((a) => a.reportId),
          reportTypes: result.artifacts.map((a) => a.reportType),
          wasIdempotent: result.wasIdempotent,
          idempotencyKey: result.idempotencyKey,
        }
        toolCalls = result.toolCalls

        // Store evidence manifest if requested
        if (proposal.evidence.storeUnderEvidencePack) {
          const manifestJson = {
            type: 'evidence_manifest',
            actionId: action.id,
            runId: run.id,
            periodLabel: proposal.period.periodLabel,
            artifacts: result.artifacts.map((a) => ({
              reportType: a.reportType,
              blobPath: a.blobPath,
              sha256: a.sha256,
              documentId: a.documentId,
            })),
            generatedAt: new Date().toISOString(),
          }

          const { uploadWithLogging, buildEvidencePath } = await import('@nzila/tools-runtime')
          const manifestPath = buildEvidencePath({
            entityId: action.entityId,
            periodLabel: proposal.period.periodLabel,
            subPath: `payments/stripe/manifest.json`,
          })

          const manifestBuffer = Buffer.from(JSON.stringify(manifestJson, null, 2), 'utf-8')
          const manifestUpload = await uploadWithLogging({
            container: 'evidence',
            blobPath: manifestPath,
            buffer: manifestBuffer,
            contentType: 'application/json',
          })
          toolCalls.push(manifestUpload.toolCall)
        }
        break
      }

      case ACTION_TYPES.AI_INGEST_KNOWLEDGE_SOURCE: {
        const proposal = AiIngestKnowledgeSourceProposalSchema.parse(action.proposalJson)
        const result = await ingestKnowledgeSource(proposal, actorClerkUserId)

        outputArtifacts = {
          sourceId: result.sourceId,
          ingestionRunId: result.ingestionRunId,
          chunkCount: result.chunkCount,
          embeddingCount: result.embeddingCount,
          reportDocumentId: result.reportDocumentId,
        }
        toolCalls = result.toolCalls
        break
      }

      default:
        throw new Error(`Unknown action type: ${action.actionType}`)
    }

    // 5. Generate and store attestation
    const attestation = createActionAttestation({
      action,
      run,
      policyDecision: action.policyDecisionJson as Record<string, unknown>,
      toolCalls,
      artifacts: outputArtifacts,
    })

    const attestationDoc = await storeAttestation(attestation, actorClerkUserId)

    // 6. Finalize run
    await db
      .update(aiActionRuns)
      .set({
        status: 'success',
        finishedAt: new Date(),
        toolCallsJson: toolCalls,
        outputArtifactsJson: outputArtifacts,
        attestationDocumentId: attestationDoc.documentId,
        updatedAt: new Date(),
      })
      .where(eq(aiActionRuns.id, run.id))

    // 7. Finalize action
    await db
      .update(aiActions)
      .set({ status: 'executed', updatedAt: new Date() })
      .where(eq(aiActions.id, actionId))

    // 8. Audit events
    await appendAiAuditEvent({
      entityId: action.entityId,
      actorClerkUserId,
      action: 'ai.action_executed',
      targetType: 'ai_action',
      targetId: actionId,
      afterJson: {
        actionType: action.actionType,
        runId: run.id,
        attestationDocumentId: attestationDoc.documentId,
      },
    })

    await appendAiAuditEvent({
      entityId: action.entityId,
      actorClerkUserId,
      action: 'ai.attestation_stored',
      targetType: 'document',
      targetId: attestationDoc.documentId,
      afterJson: {
        actionId: action.id,
        runId: run.id,
        sha256: attestationDoc.sha256,
      },
    })

    return {
      runId: run.id,
      status: 'success',
      outputArtifacts,
      attestationDocumentId: attestationDoc.documentId,
    }
  } catch (err) {
    // Failure path
    const errorMessage = err instanceof Error ? err.message : String(err)

    await db
      .update(aiActionRuns)
      .set({
        status: 'failed',
        finishedAt: new Date(),
        error: errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(aiActionRuns.id, run.id))

    await db
      .update(aiActions)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(eq(aiActions.id, actionId))

    await appendAiAuditEvent({
      entityId: action.entityId,
      actorClerkUserId,
      action: 'ai.action_failed',
      targetType: 'ai_action',
      targetId: actionId,
      afterJson: {
        actionType: action.actionType,
        runId: run.id,
        error: errorMessage,
      },
    })

    return {
      runId: run.id,
      status: 'failed',
      outputArtifacts: {},
      attestationDocumentId: null,
      error: errorMessage,
    }
  }
}
