"use server";

import { eq } from "drizzle-orm";
import { users } from "@/db/schema";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { withRLSContext } from "@/lib/db/with-rls-context";
import { logger } from "@/lib/logger";

/**
 * Get database user ID by email
 * Used to map Clerk users to database users
 */
export const getUserByEmail = async (
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [user] = await dbOrTx
        .select()
        .from(users)
        .where(eq(users.email, email))
        .limit(1);
      
      return user || null;
    } catch (error) {
      logger.error("Error fetching user by email", { error, email });
      return null;
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
};

/**
 * Get database user ID by UUID
 */
export const getUserById = async (
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
) => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    try {
      const [user] = await dbOrTx
        .select()
        .from(users)
        .where(eq(users.userId, userId))
        .limit(1);
      
      return user || null;
    } catch (error) {
      logger.error("Error fetching user by ID", { error, userId });
      return null;
    }
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
};

