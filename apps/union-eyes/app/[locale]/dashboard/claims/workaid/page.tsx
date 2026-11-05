export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getTranslations } from 'next-intl/server'
import { requireUser } from '@/lib/api-auth-guard'
import { WorkAidJourney } from '@/components/workaid/workaid-journey'

type PageProps = { params: Promise<{ locale: string }> }

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'workAidPage' })
  return { title: t('metaTitle'), description: t('metaDescription') }
}

export default async function MemberWorkAidPage() {
  try {
    await requireUser()
  } catch {
    redirect('/login')
  }
  return <WorkAidJourney audience="member" />
}
