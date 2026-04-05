import { SignUp } from '@nzila/platform-auth/entra/client'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignUp fallbackRedirectUrl="/my-cases" />
    </div>
  )
}
