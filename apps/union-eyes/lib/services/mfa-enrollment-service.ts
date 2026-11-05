import { authDb } from '@nzila/platform-auth/auth-execution'
import { authUsers } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

/** Must run inside an authenticated auth context (withAuthenticatedAuthContext): the auth tables are self-only. */
export async function findMfaEnrollmentUser(userId: string) {
  const [user] = await authDb.select({ email: authUsers.email }).from(authUsers)
    .where(eq(authUsers.userId, userId)).limit(1)
  return user
}
