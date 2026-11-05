import { db } from "@/db/db";
import { userUuidMapping } from "@/db/schema";
import { eq } from "drizzle-orm";

/**
 * Get or create a UUID for an auth provider user ID.
 * Maps the provider's text-based ID (Entra OID or legacy provider user ID) to an
 * internal UUID for use in foreign key relationships.
 *
 * @param userId - The auth provider user ID (Entra Object ID or legacy user_xxx ID)
 * @returns The internal UUID associated with this user ID
 */
export async function getOrCreateUserUuid(userId: string): Promise<string> {
  // Try to find an existing mapping by provider user ID (physical column: clerk_user_id; stores the current Entra user ID)
  const existing = await db.query.userUuidMapping.findFirst({
    where: eq(userUuidMapping.authUserId, userId),
  });

  if (existing) {
    return existing.userUuid;
  }

  // Create new mapping
  const [newMapping] = await db
    .insert(userUuidMapping)
    .values({
      authUserId: userId,
    })
    .returning();

  return newMapping.userUuid;
}

