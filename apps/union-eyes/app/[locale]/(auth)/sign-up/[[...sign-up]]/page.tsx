export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { SignupForm } from '@/components/auth/signup-form'

export const metadata: Metadata = {
  title: 'Sign Up | Union Eyes',
  description: 'Create your Union Eyes account — join the intelligent labour relations platform.',
}

const stats = [
  { value: '200+', label: 'Locals' },
  { value: '50K+', label: 'Members' },
  { value: '99.9%', label: 'Uptime' },
]

export default function SignUpPage() {
  return (
    <AuthPageLayout
      appName="Union Eyes"
      tagline="Labour Intelligence Made Simple"
      subtitle="Grievance tracking, arbitration management, collective bargaining analytics, and member services — purpose-built for unions."
      stats={stats}
      isSignUp
    >
      <SignupForm />
    </AuthPageLayout>
  )
}
