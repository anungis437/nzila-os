import { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { getTranslations } from 'next-intl/server'
import { LoginForm } from '@/components/auth/login-form'

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'loginPage' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function LoginPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'loginPage' })

  return (
    <AuthPageLayout
      appName={t('appName')}
      tagline={t('tagline')}
      subtitle={t('subtitle')}
    >
      <LoginForm />
    </AuthPageLayout>
  )
}
