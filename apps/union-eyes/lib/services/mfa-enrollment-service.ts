import { db } from '@/db/db'
import { authUsers } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'

export async function findMfaEnrollmentUser(userId: string) {
  const [user] = await db.select({ email: authUsers.email }).from(authUsers)
    .where(eq(authUsers.userId, userId)).limit(1)
  return user
}
