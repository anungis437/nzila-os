/**
 * POST /api/auth/mfa/challenge
 *
 * Public route — the `challengeToken` issued by /api/auth/login (when it
 * returned `requiresMfa: true`) IS the credential. On success, a PG session
 * cookie is set and the user is signed in.
 */
export { handleChallenge as POST } from '@nzila/platform-auth/mfa/handlers'
export const runtime = 'nodejs'
