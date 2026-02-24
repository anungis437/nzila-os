import { pendingProfilesTable, InsertPendingProfile, SelectPendingProfile } from "@/db/schema/domains/member";
import { eq } from "drizzle-orm";
import { NodePgDatabase } from "drizzle-orm/node-postgres";
import { withRLSContext } from "@/lib/db/with-rls-context";

// Create a new pending profile
export const createPendingProfile = async (
  data: InsertPendingProfile,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<SelectPendingProfile> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    const [pendingProfile] = await dbOrTx.insert(pendingProfilesTable).values(data).returning();
    return pendingProfile;
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
};

// Get a pending profile by email
export const getPendingProfileByEmail = async (
  email: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<SelectPendingProfile | undefined> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    const results = await dbOrTx.select().from(pendingProfilesTable).where(eq(pendingProfilesTable.email, email));
    return results[0];
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
};

// Get unclaimed pending profiles
export const getUnclaimedPendingProfiles = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<SelectPendingProfile[]> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    return dbOrTx.select().from(pendingProfilesTable).where(eq(pendingProfilesTable.claimed, false));
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
};

// Mark a pending profile as claimed
export const markPendingProfileAsClaimed = async (
  id: string, 
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<SelectPendingProfile | undefined> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    const [updated] = await dbOrTx
      .update(pendingProfilesTable)
      .set({
        claimed: true,
        claimedByUserId: userId,
        claimedAt: new Date()
      })
      .where(eq(pendingProfilesTable.id, id))
      .returning();
    return updated;
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
};

// Delete a pending profile
export const deletePendingProfile = async (
  id: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx?: NodePgDatabase<any>
): Promise<boolean> => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const executeQuery = async (dbOrTx: NodePgDatabase<any>) => {
    const [deleted] = await dbOrTx
      .delete(pendingProfilesTable)
      .where(eq(pendingProfilesTable.id, id))
      .returning();
    return !!deleted;
  };

  if (tx) {
    return executeQuery(tx);
  } else {
    return withRLSContext(async (tx) => executeQuery(tx));
  }
}; 
