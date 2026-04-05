import { SignUp } from '@nzila/platform-auth/entra/components/sign-up'

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignUp redirectUrl="/en-CA/dashboard" />
    </div>
  )
}
