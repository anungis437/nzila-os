import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center mb-8">
        <h1 className="text-2xl font-bold text-[var(--primary)] mb-2">Global Mobility OS</h1>
        <p className="text-gray-500">Client Portal</p>
      </div>
      <SignIn fallbackRedirectUrl="/my-cases" />
    </div>
  )
}
