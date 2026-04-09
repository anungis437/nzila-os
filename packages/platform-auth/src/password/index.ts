/**
 * @nzila/platform-auth — Password Auth Module
 *
 * PostgreSQL-backed email/password authentication for all Nzila apps.
 *
 * Usage:
 *   import { login, signup, getAuthUser } from '@nzila/platform-auth/password'
 *   import { SESSION_COOKIE_NAME } from '@nzila/platform-auth/password'
 */

// Auth service — core flows
export {
  signup,
  login,
  logout,
  forgotPassword,
  resetPassword,
  getAuthUser,
} from './auth-service'
export type {
  AuthResult,
  AuthUser,
  SignupInput,
  LoginInput,
  ForgotPasswordInput,
  ResetPasswordInput,
} from './auth-service'

// Password utilities
export {
  hashPassword,
  verifyPassword,
  needsRehash,
  validatePassword,
} from './password'
export type { PasswordValidationResult } from './password'

// Session management
export {
  SESSION_COOKIE_NAME,
  createSession,
  validateSession,
  revokeSession,
  revokeAllUserSessions,
  rotateSession,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromCookie,
  purgeExpiredSessions,
} from './session'
export type { CreateSessionOptions, SessionData } from './session'

// Shared API route handlers
export {
  handleSignup,
  handleLogin,
  handleLogout,
  handleForgotPassword,
  handleResetPassword,
  handleMe,
} from './handlers'
