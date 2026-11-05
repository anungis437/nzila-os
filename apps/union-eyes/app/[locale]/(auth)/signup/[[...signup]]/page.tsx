import { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { getTranslations } from 'next-intl/server'
import { SignupForm } from '@/components/auth/signup-form'

type PageProps = {
  params: Promise<{ locale: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signUpPage' })
  return {
    title: t('metaTitle'),
    description: t('metaDescription'),
  }
}

export default async function SignUpPage({ params }: PageProps) {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'signUpPage' })

  return (
    <AuthPageLayout
      appName={t('appName')}
      tagline={t('tagline')}
      subtitle={t('subtitle')}
      isSignUp
    >
      <SignupForm />
    </AuthPageLayout>
  )
}
