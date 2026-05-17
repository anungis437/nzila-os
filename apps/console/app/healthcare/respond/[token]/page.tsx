import { notFound } from 'next/navigation'
import { eq } from 'drizzle-orm'
import { db } from '@nzila/db/client'
import { healthcareSurveys } from '@nzila/db/schema'
import { RespondForm } from './respond-form'

export const dynamic = 'force-dynamic'

export default async function PublicRespondPage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  const rows = await db
    .select()
    .from(healthcareSurveys)
    .where(eq(healthcareSurveys.shareToken, token))
    .limit(1)

  const survey = rows[0]
  if (!survey || survey.status !== 'active') {
    return notFound()
  }

  return (
    <RespondForm
      token={token}
      title={survey.title}
      introText={
        'Thank you for taking a few minutes to complete this short survey.\n\nThis is early discovery only. It is not a grievance form, not an employer audit, and not intended to collect patient information or confidential case details.'
      }
      questions={(survey.questions as Array<{
        id: string
        text: string
        helperText?: string
        type: 'single_choice' | 'multiple_choice' | 'rating_1_5' | 'free_text' | 'yes_no_unsure'
        required: boolean
        options?: string[]
        maxSelections?: number
        warningText?: string
      }>) ?? []}
    />
  )
}
