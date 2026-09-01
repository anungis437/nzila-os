import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { icraAssessments, icraOrganizations } from '@/db/schema/icra-schema'
import { logger } from '@/lib/logger'
import { DOCTRINE_VERSION } from '@/lib/icra/copy'
import { QUESTION_BANK_VERSION } from '@/lib/icra/questions'
import { withSystemContext } from '@/lib/db/with-rls-context'
import {
  generateCapabilityToken,
  hashCapabilityToken,
  computeCapabilityExpiry,
  extractCapabilityToken,
  checkCapability,
  capabilityDenialStatus,
  setCapabilityCookie,
} from '@/lib/icra/assessment-capability'

const startSchema = z.object({
  locale: z.string().min(2).max(16).optional(),
  organizationContext: z
    .object({
      name: z.string().max(255).optional(),
      sector: z.string().max(64).optional(),
      jurisdiction: z.string().max(64).optional(),
      workforceBand: z.string().max(32).optional(),
      governanceModel: z.string().max(32).optional(),
      federationAffiliation: z.string().max(255).optional(),
    })
    .optional(),
  consent: z
    .object({
      acknowledgedAntiSurveillance: z.boolean(),
      acknowledgedDataHandling: z.boolean(),
      acknowledgedExplainability: z.boolean(),
    })
    .optional(),
})

export async function POST(request: Request) {
  let payload: z.infer<typeof startSchema>
  try {
    const json = await request.json().catch(() => ({}))
    payload = startSchema.parse(json)
  } catch (err) {
    return NextResponse.json(
      { error: 'Invalid start payload', details: (err as Error).message },
      { status: 400 },
    )
  }

  const consentComplete =
    payload.consent?.acknowledgedAntiSurveillance === true &&
    payload.consent?.acknowledgedDataHandling === true &&
    payload.consent?.acknowledgedExplainability === true

  try {
    return await withSystemContext(async (tx) => {
      let organizationId: string | null = null
      const ctx = payload.organizationContext
      if (ctx && (ctx.name || ctx.sector || ctx.jurisdiction)) {
        const inserted = await tx
          .insert(icraOrganizations)
          .values({
            displayName: ctx.name,
            sector: ctx.sector,
            jurisdiction: ctx.jurisdiction,
            workforceBand: ctx.workforceBand,
            governanceModel: ctx.governanceModel,
            federationAffiliation: ctx.federationAffiliation,
          })
          .returning({ id: icraOrganizations.id })
        organizationId = inserted[0]?.id ?? null
      }

      const capabilityToken = generateCapabilityToken()
      const capabilityTokenExpiresAt = computeCapabilityExpiry()

      const [assessment] = await tx
        .insert(icraAssessments)
        .values({
          organizationId,
          status: 'in_progress',
          questionBankVersion: QUESTION_BANK_VERSION,
          doctrineVersion: DOCTRINE_VERSION,
          consent: consentComplete
            ? {
                ...payload.consent,
                acceptedAt: new Date().toISOString(),
                doctrineVersion: DOCTRINE_VERSION,
              }
            : null,
          organizationContext: ctx ?? null,
          locale: payload.locale ?? 'en-CA',
          capabilityTokenHash: hashCapabilityToken(capabilityToken),
          capabilityTokenExpiresAt,
        })
        .returning({ id: icraAssessments.id })

      logger.info('icra.assessment.started', {
        assessmentId: assessment.id,
        organizationId,
        questionBankVersion: QUESTION_BANK_VERSION,
      })

      const response = NextResponse.json(
        { assessmentId: assessment.id, capabilityToken },
        { status: 201 },
      )
      setCapabilityCookie(response, assessment.id, capabilityToken)
      return response
    })
  } catch (err) {
    logger.error('icra.assessment.start_failed', { error: (err as Error).message })
    return NextResponse.json({ error: 'Failed to start assessment' }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const id = url.searchParams.get('assessmentId')
  if (!id) {
    return NextResponse.json({ error: 'assessmentId required' }, { status: 400 })
  }

  return withSystemContext(async (tx) => {
    const rows = await tx
      .select({
        id: icraAssessments.id,
        status: icraAssessments.status,
        locale: icraAssessments.locale,
        organizationContext: icraAssessments.organizationContext,
        questionBankVersion: icraAssessments.questionBankVersion,
        doctrineVersion: icraAssessments.doctrineVersion,
        reportTierId: icraAssessments.reportTierId,
        createdAt: icraAssessments.createdAt,
        submittedAt: icraAssessments.submittedAt,
        capabilityTokenHash: icraAssessments.capabilityTokenHash,
        capabilityTokenExpiresAt: icraAssessments.capabilityTokenExpiresAt,
      })
      .from(icraAssessments)
      .where(eq(icraAssessments.id, id))
      .limit(1)
    const row = rows[0]

    const presented = extractCapabilityToken(request, id)
    const check = checkCapability(presented, row)
    if (!check.ok) {
      return NextResponse.json({ error: 'Not authorized to resume this assessment' }, { status: capabilityDenialStatus(check.reason) })
    }

    // Deliberately constructed resume DTO — never the raw row. Excludes
    // stripePaymentRef/claimEmail/claimToken*/claimedByUserId/claimedOrgId/
    // capabilityTokenHash/capabilityTokenExpiresAt.
    return NextResponse.json({
      assessment: {
        id: row!.id,
        status: row!.status,
        locale: row!.locale,
        organizationContext: row!.organizationContext,
        questionBankVersion: row!.questionBankVersion,
        doctrineVersion: row!.doctrineVersion,
        reportTierId: row!.reportTierId,
        createdAt: row!.createdAt,
        submittedAt: row!.submittedAt,
      },
    })
  })
}
