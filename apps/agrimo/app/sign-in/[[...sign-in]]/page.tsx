import { SignIn } from '@nzila/platform-auth/entra/client'

export default function SignInPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn />
    </main>
  )
}
