"use server";

import { 
  getPendingProfileByEmail, 
  getUnclaimedPendingProfiles, 
  markPendingProfileAsClaimed,
  deletePendingProfile 
} from "@/db/queries/pending-profiles-queries";
import { requireAuth } from '@/lib/auth/rbac-server';
import { logger } from '@/lib/logger';

export async function getPendingProfileByEmailAction(email: string) {
  try {
    await requireAuth();
    const profile = await getPendingProfileByEmail(email);
    return { success: true, data: profile };
  } catch (error) {
    logger.error('Error getting pending profile by email', error as Error, { email });
    return { success: false, error: "Failed to get pending profile" };
  }
}

export async function getUnclaimedPendingProfilesAction() {
  try {
    await requireAuth();
    const profiles = await getUnclaimedPendingProfiles();
    return { success: true, data: profiles };
  } catch (error) {
    logger.error('Error getting unclaimed pending profiles', error as Error);
    return { success: false, error: "Failed to get unclaimed profiles" };
  }
}

export async function markPendingProfileAsClaimedAction(id: string, userId: string) {
  try {
    await requireAuth();
    const updated = await markPendingProfileAsClaimed(id, userId);
    return { success: true, data: updated };
  } catch (error) {
    logger.error('Error marking pending profile as claimed', error as Error, { profileId: id, userId });
    return { success: false, error: "Failed to mark profile as claimed" };
  }
}

export async function deletePendingProfileAction(id: string) {
  try {
    await requireAuth();
    const deleted = await deletePendingProfile(id);
    return { success: true, data: deleted };
  } catch (error) {
    logger.error('Error deleting pending profile', error as Error, { profileId: id });
    return { success: false, error: "Failed to delete pending profile" };
  }
} 
