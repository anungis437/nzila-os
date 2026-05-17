import Link from 'next/link'
import { eq } from 'drizzle-orm'
import { notFound } from 'next/navigation'
import { Card } from '@nzila/ui'
import { requireRole } from '@/lib/rbac'
import { db } from '@nzila/db/client'
import { healthcareSurveys } from '@nzila/db/schema'
import { SurveyControls } from './survey-controls'

export const dynamic = 'force-dynamic'

export default async function SurveyDetailPage({
  params,
}: {
  params: Promise<{ surveyId: string }>
}) {
  await requireRole('platform_admin', 'studio_admin', 'ops')

  const { surveyId } = await params
  const rows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.id, surveyId))
    .limit(1)

  const survey = rows[0]
  if (!survey) return notFound()

  const shareLink = survey.shareToken
    ? `/healthcare/respond/${survey.shareToken}`
    : 'Launch survey to generate response link.'

  return (
    <div className="mx-auto max-w-5xl p-6 space-y-4">
      <div>
        <p className="text-sm text-gray-500">{survey.localName} - {survey.unitName}</p>
        <h1 className="text-3xl font-semibold">{survey.title}</h1>
      </div>

      <Card>
        <Card.Body className="space-y-2">
          <p className="text-sm">Status: <span className="font-medium">{survey.status}</span></p>
          <p className="text-sm">Audience: {survey.audience ?? 'Not specified'}</p>
          <p className="text-sm">Purpose: {survey.purposeStatement}</p>
          <p className="text-sm">Privacy notice: {survey.privacyNotice}</p>
          <p className="text-sm">Share link: <span className="font-mono text-xs">{shareLink}</span></p>
          <SurveyControls surveyId={survey.id} currentStatus={survey.status} />
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="space-y-2">
          <h2 className="text-lg font-semibold">Internal campaign notes</h2>
          <p className="text-sm text-gray-700">Champion (internal): {survey.championLabel}</p>
          <p className="text-sm text-gray-700">Campaign: {survey.campaignName ?? 'Custom campaign'}</p>
          <p className="text-sm text-gray-700">{survey.internalNotes ?? 'No internal notes recorded.'}</p>
          <p className="text-xs text-gray-500">
            Champion label is internal-only and is not shown on the respondent page.
          </p>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body className="space-y-2">
          <h2 className="text-lg font-semibold">Distribution message</h2>
          <pre className="text-xs whitespace-pre-wrap rounded border bg-gray-50 p-3">{survey.distributionMessage ?? 'Not set'}</pre>
        </Card.Body>
      </Card>

      <div className="flex gap-2">
        <Link className="text-sm text-blue-600 underline" href={`/healthcare/discovery/surveys/${survey.id}/results`}>
          View results
        </Link>
        <Link className="text-sm text-blue-600 underline" href="/healthcare/discovery/surveys">
          Back to surveys
        </Link>
      </div>
    </div>
  )
}
