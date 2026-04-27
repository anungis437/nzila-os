export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from '@/components/auth/login-form'

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signInPage' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function SignInPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signInPage' })
  const stats = [
    { value: t('stats.rolesValue'), label: t('stats.rolesLabel') },
    { value: t('stats.languagesValue'), label: t('stats.languagesLabel') },
    { value: t('stats.uptimeValue'), label: t('stats.uptimeLabel') },
  ]

  return (
    <AuthPageLayout
      appName={t('appName')}
      tagline={t('tagline')}
      subtitle={t('subtitle')}
      stats={stats}
    >
      <LoginForm />
    </AuthPageLayout>
  )
}
