export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { LoginForm } from '@/components/auth/login-form'

export const metadata: Metadata = {
  title: 'Sign In | Union Eyes',
  description: 'Sign in to Union Eyes — a decision system for labour leadership.',
}

const stats = [
  { value: '200+', label: 'Locals' },
  { value: '50K+', label: 'Members' },
  { value: '99.9%', label: 'Uptime' },
]

export default function SignInPage() {
  return (
    <AuthPageLayout
      appName="Union Eyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="From intake to outcome — casework, intelligence, and member services in one system."
      stats={stats}
    >
      <LoginForm />
    </AuthPageLayout>
  )
}
