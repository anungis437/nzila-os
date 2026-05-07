import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import type { TrustOpsMandateStage } from '@nzila/trustcore-contracts'
import { evaluateTransition } from '@nzila/trustcore-trustops/fsm'
import { PlatformEventBus, createPlatformEvent } from '@nzila/platform-events'
import { createNzilaSpan } from '@nzila/otel-core'
import {
  saveDecisionRecord,
  generateDecisionId,
  nowISO,
} from '@nzila/platform-decision-engine'
import { withOrgScope } from '../../../../../lib/api-guards'
import { getMandate, transitionStage } from '../../../../../lib/mandates-store'

interface Params {
  readonly params: Promise<{ readonly mandateId: string }>
}

export const dynamic = 'force-dynamic'

const bus = new PlatformEventBus()

export async function POST(req: NextRequest, { params }: Params) {
  const { mandateId } = await params

  return withOrgScope(req, async ({ userId, orgId }) =>
    createNzilaSpan(
      'trustcore.trustops.mandate.transition',
      {
        'nzila.org.id': orgId,
        'nzila.user.id': userId,
      },
      async (span) => {
        span.setAttribute('trustops.mandate.id', mandateId)

        const mandate = await getMandate(mandateId, orgId)
        if (!mandate) {
          span.setAttribute('trustops.transition.outcome', 'not_found')
          return NextResponse.json(
            { ok: false, reason: 'not_found' },
            { status: 404 },
          )
        }

        const form = await req.formData()
        const toStage = String(form.get('toStage') ?? '') as TrustOpsMandateStage

        span.setAttribute('trustops.from_stage', mandate.stage)
        span.setAttribute('trustops.to_stage', toStage)

        const result = evaluateTransition({ fromStage: mandate.stage, toStage })
        if (!result.ok) {
          span.setAttribute('trustops.transition.outcome', 'rejected')
          span.setAttribute('trustops.transition.reason', result.reason ?? 'unknown')
          return NextResponse.json(
            { ok: false, reason: result.reason },
            { status: 400 },
          )
        }

        await transitionStage(mandateId, toStage, userId, 'manual', orgId)
        span.setAttribute('trustops.transition.outcome', 'accepted')

        bus.emit(
          createPlatformEvent(
            'trustcore.trustops.mandate.stage_transitioned',
            {
              mandateId,
              fromStage: mandate.stage,
              toStage,
              trigger: 'manual',
            },
            {
              orgId,
              actorId: userId,
              correlationId: `mandate:${mandateId}:${Date.now()}`,
              source: 'trustcore-trustops',
            },
          ),
        )

        try {
          saveDecisionRecord({
            decision_id: generateDecisionId(),
            org_id: orgId,
            category: 'GOVERNANCE',
            type: 'RECOMMENDATION',
            severity: 'MEDIUM',
            title: `Mandate ${mandateId} transitioned to ${toStage}`,
            summary: `Stage transition ${mandate.stage} → ${toStage}`,
            explanation: `FSM-validated stage transition for trust-ops mandate ${mandateId}.`,
            confidence_score: 1.0,
            generated_by: {
              source: 'rules',
              engine_version: '0.1.0',
            },
            evidence_refs: [
              {
                type: 'artifact',
                ref_id: mandateId,
                summary: `mandate:${mandateId}`,
              },
            ],
            recommended_actions: [],
            required_approvals: [],
            review_required: false,
            policy_context: {
              execution_allowed: true,
              reasons: ['fsm_validated'],
            },
            environment_context: {
              environment:
                process.env.NODE_ENV === 'production' ? 'PRODUCTION' : 'LOCAL',
              protected_environment: false,
            },
            status: 'EXECUTED',
            outcome: {
              accepted: true,
              rejected: false,
              deferred: false,
              executed: true,
            },
            generated_at: nowISO(),
          })
        } catch {
          // saveDecisionRecord failure is non-fatal — continue
        }

        return NextResponse.redirect(
          new URL(`/mandates/${mandateId}`, req.url),
          303,
        )
      },
    ),
  )
}
