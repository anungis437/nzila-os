import AuthPageLayout from '@/components/auth/auth-page-layout'
import { SignupForm } from '@/components/auth/signup-form'

const stats = [
  { value: '200+', label: 'Locals' },
  { value: '50K+', label: 'Members' },
  { value: '99.9%', label: 'Uptime' },
]

export default function SignUpPage() {
  return (
    <AuthPageLayout
      appName="UnionEyes"
      tagline="A Decision System for Labour Leadership"
      subtitle="From intake to outcome — casework, intelligence, and member services in one system."
      stats={stats}
      isSignUp
    >
      <SignupForm />
    </AuthPageLayout>
  )
}
