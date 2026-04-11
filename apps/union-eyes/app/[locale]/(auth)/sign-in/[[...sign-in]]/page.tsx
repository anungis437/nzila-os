export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign In | UnionEyes',
  description: 'Sign in to UnionEyes — the intelligent labour relations platform for unions, locals, and federations.',
}

const stats = [
  { value: '200+', label: 'Locals' },
  { value: '50K+', label: 'Members' },
  { value: '99.9%', label: 'Uptime' },
]

export default function SignInPage() {
  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="Labour Intelligence Made Simple"
      subtitle="Grievance tracking, arbitration management, collective bargaining analytics, and member services — purpose-built for unions."
      stats={stats}
    >
      <LoginForm />
    </AuthPageLayout>
  )
}
