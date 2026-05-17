import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { auth } from '@nzila/platform-auth/entra/server'
import { Card } from '@nzila/ui'
import { requireRole } from '@/lib/rbac'
import { db } from '@/lib/db'
import { healthcareSurveys, healthcareSurveyResponses } from '@nzila/db/schema'
import {
  HEALTHCARE_AUDIT_ACTIONS,
  aggregateWorkflowScores,
} from '@nzila/healthcare-surveys'
import { buildSurveyResultArtifacts, recordHealthcareAuditEvent } from '@/lib/healthcare-discovery'
import { FreeTextReview } from './free-text-review'

export const dynamic = 'force-dynamic'

function averageRating(responses: Array<Record<string, unknown>>, key: string): number {
  const values = responses
    .map((r) => (typeof r[key] === 'number' ? (r[key] as number) : Number(r[key])))
    .filter((v) => Number.isFinite(v) && v >= 1 && v <= 5)
  if (!values.length) return 0
  return Number((values.reduce((a, b) => a + b, 0) / values.length).toFixed(2))
}

function topMultiSelect(responses: Array<Record<string, unknown>>, key: string): string {
  const counts = new Map<string, number>()
  for (const r of responses) {
    const list = Array.isArray(r[key]) ? (r[key] as string[]) : []
    for (const item of list) counts.set(item, (counts.get(item) ?? 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'No signal yet'
}

export default async function SurveyResultsPage({
  params,
}: {
  params: Promise<{ surveyId: string }>
}) {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { userId } = await auth()
  if (!userId) return notFound()

  const { surveyId } = await params
  const surveyRows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, surveyId))
    .limit(1)

  const survey = surveyRows[0]
  if (!survey) return notFound()

  const responseRows = await db
    .select()
    .from(healthcareSurveyResponses)
    .where(eq(healthcareSurveyResponses.surveyId, surveyId))

  const normalizedResponses = responseRows.map((r) => ({
    id: r.id,
    surveyId: r.surveyId,
    anonymousResponseId: r.anonymousResponseId,
    submittedAt: r.submittedAt.toISOString(),
    answers: (r.answers as Record<string, unknown>) ?? {},
    workflowScores: (r.workflowScores as Record<string, number>) ?? {},
    topPriority: r.topPriority,
    concernTags: (r.concernTags as string[]) ?? [],
    containsFreeText: r.containsFreeText,
    reviewStatus: r.reviewStatus,
    redactionNote: r.redactionNote,
    createdAt: r.createdAt.toISOString(),
  }))

  const { recommendation } = buildSurveyResultArtifacts({
    surveyId: survey.id,
    title: survey.title,
    localName: survey.localName,
    unitName: survey.unitName,
    championLabel: survey.championLabel,
    responses: normalizedResponses,
  })

  const answers = normalizedResponses.map((r) => r.answers)
  const workflowScores = aggregateWorkflowScores(
    normalizedResponses.map((r) => ({ answers: r.answers, workflowScores: r.workflowScores })),
  )
  const topWorkflowSignal = (Object.entries(workflowScores) as Array<[string, number]>).sort(
    (a, b) => b[1] - a[1],
  )[0]?.[0]

  const responseCount = normalizedResponses.length
  const lowResponseWarning = responseCount < 5

  await recordHealthcareAuditEvent({
    action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_SURVEY_RESULTS_VIEWED,
    actorId: userId,
    surveyId: survey.id,
    orgId: survey.orgId ?? undefined,
    localName: survey.localName,
    unitName: survey.unitName,
    championLabel: survey.championLabel,
    summary: 'Viewed healthcare survey results dashboard.',
  })

  await recordHealthcareAuditEvent({
    action: HEALTHCARE_AUDIT_ACTIONS.HEALTHCARE_PILOT_RECOMMENDATION_GENERATED,
    actorId: userId,
    surveyId: survey.id,
    orgId: survey.orgId ?? undefined,
    localName: survey.localName,
    unitName: survey.unitName,
    championLabel: survey.championLabel,
    summary: 'Generated healthcare pilot recommendation.',
    metadata: {
      recommended_wedge: recommendation.recommendedWedge,
      confidence: recommendation.confidence,
    },
  })

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-semibold">Survey Results</h1>
        <p className="text-sm text-gray-600 mt-2">{survey.title}</p>
      </div>

      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <Card><Card.Body><p className="text-xs text-gray-500">Target Local</p><p className="font-medium">{survey.localName}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Unit</p><p className="font-medium">{survey.unitName}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Champion</p><p className="font-medium">{survey.championLabel}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Survey status</p><p className="font-medium">{survey.status}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Response count</p><p className="font-medium">{responseCount}</p></Card.Body></Card>
      </div>

      {lowResponseWarning && (
        <Card variant="bordered">
          <Card.Body>
            <p className="text-sm text-amber-700">
              Low response count. Do not over-interpret results or share potentially identifiable patterns.
            </p>
          </Card.Body>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card><Card.Body><p className="text-xs text-gray-500">Average scheduling clarity</p><p className="text-2xl font-semibold">{averageRating(answers, 'q1')}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Average consistency confidence</p><p className="text-2xl font-semibold">{averageRating(answers, 'q2')}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Reconstruction difficulty</p><p className="text-2xl font-semibold">{averageRating(answers, 'q5')}</p></Card.Body></Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card><Card.Body><p className="text-xs text-gray-500">Top scheduling friction</p><p className="font-medium">{topMultiSelect(answers, 'q3')}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Top adoption concern</p><p className="font-medium">{topMultiSelect(answers, 'q15')}</p></Card.Body></Card>
      </div>

      <Card>
        <Card.Body className="space-y-2">
          <p className="text-xs text-gray-500">Strongest first workflow signal</p>
          <p className="font-medium">{topWorkflowSignal ?? 'No signal yet'}</p>
          <p className="text-xs text-gray-500">Recommended first wedge</p>
          <p className="font-semibold">{recommendation.title}</p>
          <p className="text-sm text-gray-600">{recommendation.rationale}</p>
          <p className="text-xs text-gray-500">Confidence level: {recommendation.confidence}</p>
          {!!recommendation.adoptionRisks.length && (
            <ul className="list-disc ml-5 text-sm text-gray-700">
              {recommendation.adoptionRisks.map((risk: string) => <li key={risk}>{risk}</li>)}
            </ul>
          )}
          <a className="inline-block text-sm text-blue-600 underline" href={`/api/healthcare/surveys/${survey.id}/export-summary`}>
            Export executive summary
          </a>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="space-y-3">
          <h2 className="text-lg font-semibold">Free-text review / redaction</h2>
          {normalizedResponses.filter((r) => r.containsFreeText).length === 0 && (
            <p className="text-sm text-gray-600">No free-text responses yet.</p>
          )}
          {normalizedResponses
            .filter((r) => r.containsFreeText)
            .map((r) => (
              <div key={r.id} className="rounded border p-3 space-y-2">
                <p className="text-xs text-gray-500">Response {r.id}</p>
                <p className="text-sm"><span className="font-medium">Q16:</span> {typeof r.answers.q16 === 'string' ? r.answers.q16 : '—'}</p>
                <p className="text-sm"><span className="font-medium">Q17:</span> {typeof r.answers.q17 === 'string' ? r.answers.q17 : '—'}</p>
                <FreeTextReview responseId={r.id} initialStatus={r.reviewStatus} initialNote={r.redactionNote} />
              </div>
            ))}
        </Card.Body>
      </Card>

      <div className="flex gap-3">
        <Link className="text-sm text-blue-600 underline" href={`/healthcare/discovery/surveys/${survey.id}`}>Survey detail</Link>
        <Link className="text-sm text-blue-600 underline" href="/healthcare/discovery/surveys">All surveys</Link>
        <Link className="text-sm text-blue-600 underline" href="/healthcare/discovery/pilot-readiness">Pilot readiness</Link>
      </div>
    </div>
  )
}

