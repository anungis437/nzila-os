import { auth } from '@nzila/platform-auth/entra/server'
import { redirect } from 'next/navigation'
import { SignIn } from '@nzila/platform-auth/entra/client'

export default async function SignInPage() {
  const { userId } = await auth()
  if (userId) redirect('/portal')

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-blue-50">
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl border border-slate-200',
          },
        }}
      />
    </div>
  )
}
