import { db } from "@/db/db";
import { userUuidMapping } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get or create a UUID for an auth provider user ID.
 * Maps the provider's text-based ID (Entra OID or legacy Clerk ID) to an
 * internal UUID for use in foreign key relationships.
 *
 * @param userId - The auth provider user ID (Entra Object ID or legacy Clerk user_xxx)
 * @returns The internal UUID associated with this user ID
 */
export async function getOrCreateUserUuid(userId: string): Promise<string> {
  // Try to find existing mapping by clerk_user_id (handles both legacy Clerk and new Entra IDs stored here)
  const existing = await db.query.userUuidMapping.findFirst({
    where: eq(userUuidMapping.clerkUserId, userId),
  });

  if (existing) {
    return existing.userUuid;
  }

  // Create new mapping
  const [newMapping] = await db
    .insert(userUuidMapping)
    .values({
      clerkUserId: userId,
    })
    .returning();

  return newMapping.userUuid;
}

