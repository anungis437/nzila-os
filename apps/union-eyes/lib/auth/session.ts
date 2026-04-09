/**
 * Session Service — re-exports from shared @nzila/platform-auth package.
 * All Nzila apps share the same opaque session token implementation.
 */
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
  type CreateSessionOptions,
  type SessionData,
} from '@nzila/platform-auth/password'
