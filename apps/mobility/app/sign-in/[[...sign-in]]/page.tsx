import { SignIn } from '@nzila/platform-auth/entra/client'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <SignIn fallbackRedirectUrl="/dashboard" />
    </div>
  )
}
