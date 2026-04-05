export const dynamic = 'force-dynamic'

import { SignUp } from '@nzila/platform-auth/entra/client'
import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'

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
      <SignUp
        forceRedirectUrl="/en-CA/dashboard"
        appearance={{
          elements: {
            rootBox: 'w-full',
            card: 'shadow-none border-0 w-full',
            headerTitle: 'text-2xl font-bold text-navy',
            headerSubtitle: 'text-gray-500',
            socialButtonsBlockButton: 'border border-gray-200 hover:bg-gray-50 transition-colors rounded-xl',
            formFieldInput: 'rounded-xl border-gray-200 focus:border-electric focus:ring-electric/20',
            formButtonPrimary: 'bg-electric hover:bg-blue-700 rounded-xl shadow-lg shadow-electric/25 transition-all',
            footerActionLink: 'text-electric hover:text-blue-700',
            dividerLine: 'bg-gray-200',
            dividerText: 'text-gray-400',
          },
        }}
      />
    </AuthPageLayout>
  )
}
