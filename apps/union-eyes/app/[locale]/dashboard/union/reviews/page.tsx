export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ReviewIntake } from '@/components/reviews/review-intake'
import { requireMemberPage } from '@/lib/dashboard/require-member-page'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'reviewIntake' })
  return { title: t('memberTitle'), description: t('boundary') }
}

/** /dashboard/union/reviews — a member opens and follows their own review. */
export default async function MemberReviewIntakePage() {
  await requireMemberPage()
  return <ReviewIntake audience="member" />
}
