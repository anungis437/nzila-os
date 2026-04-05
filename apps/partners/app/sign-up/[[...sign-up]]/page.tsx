import { SignUp } from '@nzila/platform-auth/entra/client'

export default function SignUpPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 to-blue-50">
      <SignUp
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
