export const dynamic = 'force-dynamic'

import type { Metadata } from 'next'
import AuthPageLayout from '@/components/auth/auth-page-layout'
import { LoginForm } from '@/components/auth/login-form'
import { isCupe4373DemoRuntime } from '@/lib/dashboard/role-experience'

export const metadata: Metadata = {
  title: 'Sign In | UnionEyes',
  description: 'Sign in to UnionEyes — a decision system for labour leadership.',
}

const defaultStats = [
  { value: '35+', label: 'Union roles' },
  { value: '6', label: 'Languages' },
  { value: '99.9%', label: 'Uptime' },
]

const cupeStats = [
  { value: '4,200+', label: 'Members represented' },
  { value: '100%',   label: 'Case traceability'   },
  { value: '99.9%',  label: 'Platform uptime'     },
]

export default function SignInPage() {
  const isCupeDemo = isCupe4373DemoRuntime()
  const postLoginPath = isCupeDemo ? '/en-CA/dashboard' : undefined
  const stats = isCupeDemo ? cupeStats : defaultStats
  const tagline = isCupeDemo
    ? 'Operational Continuity for Organized Labour'
    : 'A Decision System for Labour Leadership'
  const subtitle = isCupeDemo
    ? 'Casework, collective agreement management, grievance tracking, and member representation — purpose-built for CUPE Local 4373.'
    : 'From intake to outcome — casework, intelligence, and member services in one system.'

  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline={tagline}
      subtitle={subtitle}
      stats={stats}
    >
      <LoginForm postLoginPath={postLoginPath} />
    </AuthPageLayout>
  )
}
