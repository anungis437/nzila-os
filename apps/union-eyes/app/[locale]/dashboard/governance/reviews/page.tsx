export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { getTranslations } from 'next-intl/server'
import { ReviewIntake } from '@/components/reviews/review-intake'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'reviewIntake' })
  return { title: t('oversightTitle'), description: t('boundary') }
}

/**
 * /dashboard/governance/reviews — intake plus the reviews a live monitor mandate names.
 * The governance layout admits the page. The list itself is a kernel decision.
 */
export default function GovernanceReviewIntakePage() {
  return <ReviewIntake audience="oversight" />
}
