import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { LoginForm } from '@/components/auth/login-form'

export default async function SignInPage() {
  const { userId } = await auth()
  if (userId) redirect('/workspace/overview')

  return (
    <AuthPageLayout
      appName="Nzila Console"
      tagline="Run Every Product From One Console"
      subtitle="Portfolio oversight, financial controls, AI operations, and platform reliability in one secure command surface."
      stats={[
        { value: '13+', label: 'Products' },
        { value: '25+', label: 'Data Sources' },
        { value: '99.9%', label: 'Uptime' },
      ]}
      heroImage="https://images.unsplash.com/photo-1526628953301-3e589a6a8b74?w=2200&q=80&auto=format&fit=crop"
      heroAlt="Operations team collaborating in a data-driven control room"
    >
      <LoginForm />
    </AuthPageLayout>
  )
}
