export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from '@/components/auth/login-form'
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience'

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
  const isCupeDemo = isCupe4373DemoRuntime()
  const postLoginPath = isCupeDemo ? `/${locale}/dashboard` : undefined

  const stats = isCupeDemo
    ? [
        { value: '4,200+', label: 'Members represented' },
        { value: '100%',   label: 'Case traceability'   },
        { value: '99.9%',  label: 'Platform uptime'     },
      ]
    : [
        { value: t('stats.rolesValue'),     label: t('stats.rolesLabel')     },
        { value: t('stats.languagesValue'), label: t('stats.languagesLabel') },
        { value: t('stats.uptimeValue'),    label: t('stats.uptimeLabel')    },
      ]

  const tagline = isCupeDemo
    ? 'Operational Continuity for Organized Labour'
    : t('tagline')

  const subtitle = isCupeDemo
    ? 'Casework, collective agreement management, grievance tracking, and member representation — purpose-built for CUPE Local 4373.'
    : t('subtitle')

  return (
    <AuthPageLayout
      appName={t('appName')}
      tagline={tagline}
      subtitle={subtitle}
      stats={stats}
    >
      <LoginForm postLoginPath={postLoginPath} />
    </AuthPageLayout>
  )
}
