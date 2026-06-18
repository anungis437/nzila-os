import { NextResponse } from 'next/server'
import { auth } from '@nzila/platform-auth/entra/server'

export async function GET() {
  const { userId, orgId } = await auth()

  if (!userId) {
    return NextResponse.json({ authenticated: false }, { status: 401 })
  }

  return NextResponse.json(
    {
      authenticated: true,
      userId,
      orgId: orgId ?? null,
    },
    { status: 200 },
  )
}
