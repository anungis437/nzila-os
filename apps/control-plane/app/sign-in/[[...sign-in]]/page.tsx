import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { SignIn } from '@nzila/platform-auth/entra/client'

export default async function SignInPage() {
  const { userId } = await auth()
  if (userId) redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignIn />
    </main>
  )
}
