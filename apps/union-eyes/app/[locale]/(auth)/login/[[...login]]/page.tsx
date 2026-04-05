import { SignIn } from '@nzila/platform-auth/entra/components/sign-in'

export default function LoginPage() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <SignIn redirectUrl="/en-CA/dashboard" />
    </div>
  )
}
