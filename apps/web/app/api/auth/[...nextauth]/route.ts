/**
 * NextAuth API Route Handler
 *
 * Handles /api/auth/* routes (signin, signout, callback, session).
 * Uses the centralised Entra config from @nzila/platform-auth.
 */
import { handlers } from '@nzila/platform-auth/entra/config'

export const { GET, POST } = handlers
