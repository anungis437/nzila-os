"use server";

import { createProfile, deleteProfile, getAllProfiles, getProfileByUserId, updateProfile, getUserPlanInfo } from "@/db/queries/profiles-queries";
import { InsertProfile, SelectProfile } from "@/db/schema/domains/member";
import { ActionResult } from "@/types/actions/actions-types";
import { revalidatePath } from "next/cache";
import { auth } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';

export async function createProfileAction(data: InsertProfile): Promise<ActionResult<SelectProfile>> {
  try {
    const newProfile = await createProfile(data);
    revalidatePath("/");
    return { isSuccess: true, message: "Profile created successfully", data: newProfile };
  } catch (_error) {
    return { isSuccess: false, message: "Failed to create profile" };
  }
}

export async function getProfileByUserIdAction(userId: string): Promise<ActionResult<SelectProfile | null>> {
  try {
    const profile = await getProfileByUserId(userId);
    return { isSuccess: true, message: "Profile retrieved successfully", data: profile };
  } catch (_error) {
    return { isSuccess: false, message: "Failed to get profiles" };
  }
}

export async function getAllProfilesAction(): Promise<ActionResult<SelectProfile[]>> {
  try {
    const profiles = await getAllProfiles();
    return { isSuccess: true, message: "Profiles retrieved successfully", data: profiles };
  } catch (_error) {
    return { isSuccess: false, message: "Failed to get profiles" };
  }
}

export async function updateProfileAction(userId: string, data: Partial<InsertProfile>): Promise<ActionResult<SelectProfile>> {
  try {
    const updatedProfile = await updateProfile(userId, data);
    revalidatePath("/");
    return { isSuccess: true, message: "Profile updated successfully", data: updatedProfile };
  } catch (_error) {
    return { isSuccess: false, message: "Failed to update profile" };
  }
}

export async function deleteProfileAction(userId: string): Promise<ActionResult<void>> {
  try {
    await deleteProfile(userId);
    revalidatePath("/");
    return { isSuccess: true, message: "Profile deleted successfully" };
  } catch (_error) {
    return { isSuccess: false, message: "Failed to delete profile" };
  }
}

/**
 * Check if the current user's payment has failed
 * This is used by the PaymentStatusAlert component
 * Efficient: Only returns the boolean flag, not the entire profile
 */
export async function checkPaymentFailedAction(): Promise<{ paymentFailed: boolean }> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { paymentFailed: false };
    }
    
    const profile = await getProfileByUserId(userId);
    return { paymentFailed: profile?.status === "payment_failed" || false };
  } catch (error) {
    logger.error('Error checking payment status', error as Error, { userId: undefined });
    return { paymentFailed: false };
  }
}

/**
 * Get the current user's plan information including membership type and duration
 * This is used to display subscription details in the UI
 */
export async function getUserPlanInfoAction(): Promise<ActionResult<{
  membership: string;
  planDuration: string | null;
  status: string | null;
  usageCredits: number | null;
  usedCredits: number | null;
  billingCycleStart: Date | null;
  billingCycleEnd: Date | null;
  nextCreditRenewal: Date | null;
} | null>> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { 
        isSuccess: false, 
        message: "User not authenticated" 
      };
    }
    
    const planInfo = await getUserPlanInfo(userId);
    
    if (!planInfo) {
      return { 
        isSuccess: false, 
        message: "No plan information found" 
      };
    }
    
    return { 
      isSuccess: true, 
      message: "Plan information retrieved successfully", 
      data: planInfo 
    };
  } catch (error) {
    logger.error('Error getting user plan information', error as Error, { userId: undefined });
    return { 
      isSuccess: false, 
      message: "Failed to get plan information" 
    };
  }
}

