/**
 * Shared API Route Handlers for Password Auth
 *
 * Usage in any Nzila app:
 *
 *   // app/api/auth/signup/route.ts
 *   export { handleSignup as POST } from '@nzila/platform-auth/password/handlers'
 *
 *   // app/api/auth/login/route.ts
 *   export { handleLogin as POST } from '@nzila/platform-auth/password/handlers'
 *
 *   // app/api/auth/logout/route.ts
 *   export { handleLogout as POST } from '@nzila/platform-auth/password/handlers'
 *
 *   // app/api/auth/forgot-password/route.ts
 *   export { handleForgotPassword as POST } from '@nzila/platform-auth/password/handlers'
 *
 *   // app/api/auth/reset-password/route.ts
 *   export { handleResetPassword as POST } from '@nzila/platform-auth/password/handlers'
 *
 *   // app/api/auth/me/route.ts
 *   export { handleMe as GET } from '@nzila/platform-auth/password/handlers'
 */
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getAuthUser,
} from './auth-service'

// ─── Helpers ────────────────────────────────────────────────────────────────

function extractIp(request: NextRequest): string | undefined {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    request.headers.get('x-real-ip') ??
    undefined
  )
}

function extractUserAgent(request: NextRequest): string | undefined {
  return request.headers.get('user-agent') ?? undefined
}

// ─── Schemas ────────────────────────────────────────────────────────────────

const signupSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
})

const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
})

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  newPassword: z.string().min(1, 'New password is required'),
})

// ─── Route Handlers ─────────────────────────────────────────────────────────

export async function handleSignup(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = signupSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }

    const result = await signup({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json(
      { user: result.user, message: 'Account created successfully' },
      { status: 201 },
    )
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function handleLogin(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = loginSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }

    const result = await login({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 401 })
    }

    return NextResponse.json({ user: result.user })
  } catch (error) {
    console.error('[handleLogin] Error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function handleLogout() {
  try {
    await logout()
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ success: true })
  }
}

export async function handleForgotPassword(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = forgotPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }

    const result = await forgotPassword({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })

    return NextResponse.json({
      message:
        'If an account exists with that email, a password reset link will be sent.',
      // Dev only: expose reset token for testing
      ...(process.env.NODE_ENV === 'development' && result.token
        ? { token: result.token }
        : {}),
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function handleResetPassword(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = resetPasswordSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0].message },
        { status: 400 },
      )
    }

    const result = await resetPassword({
      ...parsed.data,
      ipAddress: extractIp(request),
      userAgent: extractUserAgent(request),
    })

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 })
    }

    return NextResponse.json({
      message: 'Password has been reset. Please sign in.',
    })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function handleMe() {
  try {
    const user = await getAuthUser()
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }
    return NextResponse.json({ user })
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }
}
