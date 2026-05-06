/**
 * TrustCore — Sign-In Page
 *
 * Delegates to the platform auth provider sign-in flow.
 */

import { SignIn } from '@nzila/platform-auth/entra/client'

export default function SignInPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-gray-900">TrustCore</h1>
          <p className="text-sm text-gray-500 mt-1">Privacy compliance platform</p>
        </div>
        <SignIn />
      </div>
    </div>
  )
}
