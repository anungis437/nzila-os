import { NextResponse } from 'next/server'
import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { db } from '@/db/db'
import { icraAssessments, icraOrganizations } from '@/db/schema/icra-schema'
import { logger } from '@/lib/logger'
import { DOCTRINE_VERSION } from '@/lib/icra/copy'
import { QUESTION_BANK_VERSION } from '@/lib/icra/questions'
import { withSystemContext } from '@/lib/db/with-rls-context'

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
        })
        .returning({ id: icraAssessments.id })

      logger.info('icra.assessment.started', {
        assessmentId: assessment.id,
        organizationId,
        questionBankVersion: QUESTION_BANK_VERSION,
      })

      return NextResponse.json({ assessmentId: assessment.id }, { status: 201 })
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
  const rows = await db.select().from(icraAssessments).where(eq(icraAssessments.id, id)).limit(1)
  if (rows.length === 0) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  return NextResponse.json({ assessment: rows[0] })
}
