import Link from 'next/link'
import { desc, sql } from 'drizzle-orm'
import { Card, Button } from '@nzila/ui'
import { requireRole } from '@/lib/rbac'
import { db } from '@/lib/db'
import { healthcareSurveys, healthcareSurveyResponses } from '@nzila/db/schema'

export const dynamic = 'force-dynamic'

async function loadData() {
  const surveys = await db
    .select()
    .from(healthcareSurveys)
    .orderBy(desc(healthcareSurveys.createdAt))

  const responseAgg = await db
    .select({
      surveyId: healthcareSurveyResponses.surveyId,
      count: sql<number>`count(*)::int`,
    })
    .from(healthcareSurveyResponses)
    .groupBy(healthcareSurveyResponses.surveyId)

  const responseMap = new Map(responseAgg.map((row) => [row.surveyId, row.count]))

  const withCounts = surveys.map((survey) => ({
    ...survey,
    responseCount: responseMap.get(survey.id) ?? 0,
  }))

  const stats = {
    draft: withCounts.filter((s) => s.status === 'draft').length,
    active: withCounts.filter((s) => s.status === 'active').length,
    closed: withCounts.filter((s) => s.status === 'closed').length,
    responses: withCounts.reduce((sum, s) => sum + s.responseCount, 0),
  }

  return { withCounts, stats }
}

export default async function HealthcareDiscoverySurveysPage() {
  await requireRole('platform_admin', 'studio_admin', 'ops')
  const { withCounts, stats } = await loadData()

  return (
    <div className="mx-auto max-w-7xl p-6 space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Healthcare Discovery Surveys</h1>
          <p className="text-sm text-gray-600 mt-2">
            Run short, privacy-conscious unit-level surveys before choosing a healthcare pilot workflow.
          </p>
        </div>
        <div className="flex gap-3">
          <form action="/api/healthcare/surveys/seed-unit-92" method="post">
            <Button variant="secondary" type="submit">Seed Unit 92 Campaign</Button>
          </form>
          <Link href="/healthcare/discovery/surveys/new">
            <Button>Create Unit Survey</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        <Card><Card.Body><p className="text-xs text-gray-500">Draft surveys</p><p className="text-2xl font-semibold">{stats.draft}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Active surveys</p><p className="text-2xl font-semibold">{stats.active}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Closed surveys</p><p className="text-2xl font-semibold">{stats.closed}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Response count</p><p className="text-2xl font-semibold">{stats.responses}</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Top workflow signal</p><p className="text-sm font-medium">Computed per results</p></Card.Body></Card>
        <Card><Card.Body><p className="text-xs text-gray-500">Top adoption concern</p><p className="text-sm font-medium">Computed per results</p></Card.Body></Card>
      </div>

      <div className="space-y-3">
        {withCounts.map((survey) => (
          <Card key={survey.id}>
            <Card.Body className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm text-gray-500">{survey.localName} - {survey.unitName}</p>
                <h2 className="text-xl font-semibold">{survey.title}</h2>
                <p className="text-sm text-gray-600 mt-1">{survey.purposeStatement}</p>
                <p className="text-xs text-gray-500 mt-2">
                  Status: <span className="font-medium">{survey.status}</span> · Responses: {survey.responseCount}
                </p>
              </div>
              <div className="flex gap-2">
                <Link href={`/healthcare/discovery/surveys/${survey.id}`}><Button variant="secondary">Open</Button></Link>
                <Link href={`/healthcare/discovery/surveys/${survey.id}/results`}><Button variant="ghost">Results</Button></Link>
              </div>
            </Card.Body>
          </Card>
        ))}
      </div>
    </div>
  )
}
