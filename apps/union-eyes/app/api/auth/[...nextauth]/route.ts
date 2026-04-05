/**
 * NextAuth.js Catch-All API Route for Union-Eyes
 *
 * Handles /api/auth/* routes (signin, signout, callback, session).
 */
import { handlers } from '@nzila/platform-auth/entra/config'
export const { GET, POST } = handlers
