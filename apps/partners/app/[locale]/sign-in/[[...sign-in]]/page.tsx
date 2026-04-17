import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { LoginForm } from '@/components/auth/login-form'

export default async function SignInPage() {
  const { userId } = await auth()
  if (userId) redirect('/portal')

  return (
    <AuthPageLayout
      appName="Nzila Partners"
      tagline="Scale Trusted Partnerships"
      subtitle="Manage partner pipelines, deals, payouts, and collaboration from one secure workspace."
      stats={[
        { value: '100+', label: 'Partners' },
        { value: '24/7', label: 'Portal Access' },
        { value: '99.9%', label: 'Uptime' },
      ]}
      heroImage="https://images.unsplash.com/photo-1552664730-d307ca884978?w=2200&q=80&auto=format&fit=crop"
      heroAlt="Partnership and strategy session in progress"
    >
      <LoginForm />
    </AuthPageLayout>
  )
}
