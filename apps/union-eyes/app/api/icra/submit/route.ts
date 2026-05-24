/**
 * ARTIFACT TYPE: API Route
 * DOCTRINE_VERSION: 1.0.0
 *
 * POST /api/icra/submit
 *
 * One-shot intake: accepts { consent, orgContext, answers, locale },
 * scores deterministically, persists the assessment + profile, returns { assessmentId }.
 *
 * No auth (pseudonymous). Rate limited per IP. No PII required.
 */

import { NextRequest, NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import type { Answer, ConsentRecord } from '@/lib/icra/types'
import { scoreAssessment } from '@/lib/icra/scoring'
import { rateLimit } from '@/lib/rate-limit'
import { fireAndForgetEvent, hashIp } from '@/lib/icra/observability'
import { verifyTurnstileToken } from '@/lib/icra/turnstile'
import { DOCTRINE_VERSION } from '@/lib/icra/copy'
import {
  ALL_QUESTIONS,
  QUESTION_BANK_VERSION,
  CTX_PRIMARY_CHALLENGE_MAX_LENGTH,
  CTX_SELECT_VALUE_MAX_LENGTH,
} from '@/lib/icra/questions'
import { withSystemContext } from '@/lib/db/with-rls-context'
import {
  icraAssessments,
  icraAssessmentAnswers,
  icraMaturityProfiles,
  icraContinuityScores,
  icraGovernanceFlags,
  icraFollowupRecommendations,
} from '@/db/schema/icra-schema'
import { logger } from '@/lib/logger'
import {
  classifyOrgContext,
  routeQuestionBank,
  buildPersistedAdaptiveContext,
  embedPersistedAdaptiveContext,
  embedPersistedAdaptiveReportAISlot,
  resolveAdaptiveReportAISlot,
  type RoutableQuestion,
} from '@/lib/icra/adaptation'

interface SubmitBody {
  consent: ConsentRecord
  orgContext?: Record<string, string>
  answers: Answer[]
  locale?: string
  turnstileToken?: string | null
}

function validateBody(body: unknown): body is SubmitBody {
  if (typeof body !== 'object' || body === null) return false
  const b = body as Record<string, unknown>
  if (!b.consent || typeof b.consent !== 'object') return false
  const c = b.consent as Record<string, unknown>
  if (
    c.acknowledgedAntiSurveillance !== true ||
    c.acknowledgedDataHandling !== true ||
    c.acknowledgedExplainability !== true
  ) {
    return false
  }
  if (!Array.isArray(b.answers) || b.answers.length === 0) return false
  return true
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null
  const ipHash = hashIp(ip)

  const rl = rateLimit(req, { maxRequests: 3, windowSeconds: 60 * 60 })
  if (!rl.success) {
    return NextResponse.json(
      { error: 'Too many submissions. Please try again later.' },
      { status: 429 },
    )
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
  }

  if (!validateBody(body)) {
    return NextResponse.json(
      { error: 'Missing or invalid required fields (consent + answers).' },
      { status: 400 },
    )
  }

  const { consent, orgContext, answers, locale = 'en-CA', turnstileToken } = body

  // Turnstile verification — env-gated. Returns success=true when no secret
  // is configured so dev/private envs work without keys.
  const turnstile = await verifyTurnstileToken(turnstileToken ?? null, ip)
  if (!turnstile.success) {
    fireAndForgetEvent({
      kind: 'turnstile_failed',
      ipHash,
      metadata: { codes: (turnstile.errorCodes ?? []).join(',').slice(0, 64) },
    })
    return NextResponse.json(
      { error: 'Bot check failed. Please refresh and try again.' },
      { status: 403 },
    )
  }

  if (answers.length < 1 || answers.length > 64) {
    return NextResponse.json({ error: 'Invalid answer count.' }, { status: 400 })
  }

  // Bound the orgContext payload: select values are short ids; the optional
  // free-text challenge field is capped at CTX_PRIMARY_CHALLENGE_MAX_LENGTH.
  // Trim, drop empty strings, and reject anything that exceeds the cap.
  let normalizedOrgContext: Record<string, string> | null = null
  if (orgContext && typeof orgContext === 'object') {
    const entries: Array<[string, string]> = []
    for (const [k, v] of Object.entries(orgContext)) {
      if (typeof v !== 'string') continue
      const trimmed = v.trim()
      if (!trimmed) continue
      const cap =
        k === 'ctx_primary_challenge'
          ? CTX_PRIMARY_CHALLENGE_MAX_LENGTH
          : CTX_SELECT_VALUE_MAX_LENGTH
      if (trimmed.length > cap) {
        return NextResponse.json(
          { error: `Field ${k} exceeds maximum length of ${cap} characters.` },
          { status: 400 },
        )
      }
      entries.push([k, trimmed])
    }
    normalizedOrgContext = entries.length > 0 ? Object.fromEntries(entries) : null
  }

  try {
    return await withSystemContext(async (tx) => {
      // Derive adaptive context from declared org context (pure, deterministic).
      // Persisted under the reserved `_adaptive` namespace inside the existing
      // organizationContext jsonb so the result page + PDF can read it back
      // without a schema migration. Never includes raw answers / PII.
      let organizationContextForInsert: Record<string, unknown> | null = normalizedOrgContext
      try {
        const profileForRouting = classifyOrgContext({
          rawForm: normalizedOrgContext ?? {},
        })
        const routed = routeQuestionBank(
          ALL_QUESTIONS as unknown as RoutableQuestion[],
          profileForRouting,
        )
        const adaptive = buildPersistedAdaptiveContext(
          profileForRouting,
          routed,
          QUESTION_BANK_VERSION,
        )
        organizationContextForInsert = embedPersistedAdaptiveContext(
          normalizedOrgContext,
          adaptive,
        )
      } catch (adaptiveErr) {
        // Adaptive persistence is best-effort. Submission MUST succeed even if
        // the routing engine errors. Result page falls back to reconstruction.
        logger.warn('icra.assessment.adaptive_persist_skipped', {
          error: adaptiveErr instanceof Error ? adaptiveErr.message : 'unknown',
        })
      }

      const inserted = await tx
        .insert(icraAssessments)
        .values({
          status: 'submitted',
          questionBankVersion: QUESTION_BANK_VERSION,
          doctrineVersion: DOCTRINE_VERSION,
          consent,
          organizationContext: normalizedOrgContext,
          locale,
          submittedAt: new Date(),
        })
        .returning({ id: icraAssessments.id })

      const assessmentId = inserted[0]?.id
      if (!assessmentId) {
        throw new Error('Assessment insert returned no id')
      }

      const { profile } = scoreAssessment(assessmentId, answers, normalizedOrgContext)

      // Run all dependent inserts in parallel — they each only depend on
      // assessmentId, so this collapses ~5 sequential round-trips into one.
      const inserts: Array<Promise<unknown>> = []

      if (answers.length > 0) {
        inserts.push(
          tx.insert(icraAssessmentAnswers).values(
            answers.map((a) => ({
              assessmentId,
              questionId: a.questionId,
              questionVersion: a.questionVersion,
              rawValue: String(a.rawValue),
              normalizedScore: a.normalizedScore.toFixed(4),
              weightsSnapshot: a.weightsSnapshot,
              riskInverted: a.riskInverted,
              note: a.note ?? null,
              answeredAt: new Date(a.answeredAt),
            })),
          ),
        )
      }

      inserts.push(
        tx.insert(icraMaturityProfiles).values({
          assessmentId,
          maturityBandId: profile.maturityBand.id,
          composite: profile.composite.toFixed(2),
          profilePayload: profile,
        }),
      )

      if (profile.dimensions.length > 0) {
        inserts.push(
          tx.insert(icraContinuityScores).values(
            profile.dimensions.map((d) => ({
              assessmentId,
              dimensionId: d.dimension,
              score: d.score.toFixed(2),
              contributingQuestions: d.contributingQuestions,
              weightTotal: d.weightTotal.toFixed(3),
            })),
          ),
        )
      }

      if (profile.observations.length > 0) {
        inserts.push(
          tx.insert(icraGovernanceFlags).values(
            profile.observations.map((o) => ({
              assessmentId,
              flagId: o.id,
              severity: o.severity,
              category: o.category,
              statement: o.statement,
              evidence: o.evidence ?? null,
            })),
          ),
        )
      }

      if (profile.recommendations.length > 0) {
        inserts.push(
          tx.insert(icraFollowupRecommendations).values(
            profile.recommendations.map((r) => ({
              assessmentId,
              recommendationId: r.id,
              kind: r.kind,
              title: r.title,
              description: r.description,
              ctaLabel: r.ctaLabel,
              ctaHref: r.ctaHref,
            })),
          ),
        )
      }

      await Promise.all(inserts)

      fireAndForgetEvent({
        kind: 'assessment_submitted',
        assessmentId,
        ipHash: ipHash ?? undefined,
      })

      logger.info('icra.assessment.submitted', {
        assessmentId,
        maturityBand: profile.maturityBand.id,
        composite: profile.composite,
        answeredQuestionCount: profile.answeredQuestionCount,
      })

      return NextResponse.json({ assessmentId }, { status: 201 })
    })
  } catch (err) {
    const e = err as Error & { cause?: unknown; code?: string }
    const cause = e.cause as { message?: string; code?: string; detail?: string } | undefined
    logger.error('icra.assessment.submit_failed', {
      error: e.message,
      code: e.code,
      causeMessage: cause?.message,
      causeCode: cause?.code,
      causeDetail: cause?.detail,
    })
    fireAndForgetEvent({
      kind: 'submission_error',
      metadata: { error: String(err) },
    })
    return NextResponse.json({ error: 'Submission failed. Please try again.' }, { status: 500 })
  }
}
