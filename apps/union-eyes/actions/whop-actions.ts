"use server"; // Ensure this only runs on the server

import { getProfileByUserId, updateProfile, updateProfileByWhopUserId, getProfileByEmail, createProfile, deleteProfileById } from "@/db/queries/profiles-queries";
import { auth } from '@/lib/api-auth-guard';
import { revalidatePath } from "next/cache";
import { getPendingProfileByEmail, markPendingProfileAsClaimed } from "@/db/queries/pending-profiles-queries";
import { logger } from '@/lib/logger';

// Convert Whop membership status to our app's membership status
const getMembershipStatus = (whopStatus: string): "free" | "pro" => {
  switch (whopStatus) {
    case "active":
      return "pro";
    default:
      return "free";
  }
};

// Update user profile with Whop customer data
// Follows same pattern as updateStripeCustomer for consistency
export const updateWhopCustomer = async (
  userId: string, 
  whopUserId: string, 
  whopMembershipId: string
): Promise<void> => {
  try {
    if (!userId || !whopUserId || !whopMembershipId) {
      throw new Error("Missing required parameters for updateWhopCustomer");
    }

    // Update profile with Whop information
    const updatedProfile = await updateProfile(userId, {
      whopUserId,
      whopMembershipId,
      paymentProvider: "whop",
      membership: "pro" // Set to pro immediately after successful payment
    });
    
    if (!updatedProfile) {
      throw new Error("Failed to update profile with Whop customer data");
    }
    
    logger.info(`Successfully updated profile ${userId} with Whop data`, { whopUserId, whopMembershipId });
    
    // Revalidate any cached data
    revalidatePath("/");
    revalidatePath("/notes");
  } catch (error) {
    logger.error('Error in updateWhopCustomer', error as Error, { userId, whopUserId });
    // Only log the error, don't throw it (same pattern as Stripe)
  }
};

// For compatibility with existing code
export const updateWhopUser = updateWhopCustomer;

// Handle membership status changes
export const manageWhopMembershipStatusChange = async (
  whopMembershipId: string,
  whopUserId: string,
  status: string
): Promise<void> => {
  try {
    // DEPRECATION WARNING
    logger.warn('manageWhopMembershipStatusChange is deprecated - use direct updateProfile with Clerk user ID from metadata instead');
    
    if (!whopMembershipId || !whopUserId) {
      throw new Error("Missing required parameters for manageWhopMembershipStatusChange");
    }

    const membershipStatus = getMembershipStatus(status);
    
    // Attempt to find and update the profile
    // This uses a special lookup function that maps Whop user IDs to Clerk user IDs
    const updatedProfile = await updateProfileByWhopUserId(whopUserId, {
      whopMembershipId,
      membership: membershipStatus
    });
    
    if (!updatedProfile) {
      logger.error('No profile found with Whop user ID - fallback method failed', undefined, { whopUserId });
    } else {
      logger.info(`Updated membership status to ${membershipStatus}`, { clerkUserId: updatedProfile.userId, whopUserId });
    }

    // Revalidate any cached data
    revalidatePath("/");
    revalidatePath("/notes");
  } catch (error) {
    logger.error('Error in manageWhopMembershipStatusChange', error as Error, { whopMembershipId, whopUserId });
    // Only log the error, don't throw it
  }
};

// Check if the current user can access a premium feature
export async function canAccessPremiumFeatures() {
  const { userId } = await auth();
  
  if (!userId) {
    return false;
  }
  
  try {
    const profile = await getProfileByUserId(userId);
    return profile?.membership === "pro";
  } catch (error) {
    logger.error('Error checking premium access', error as Error, { userId });
    return false;
  }
}

/**
 * FRICTIONLESS PAYMENT FLOW
 * 
 * The following functions support the "Pay First, Create Account Later" flow
 * where users can make a purchase with just their email address, then
 * later create an account and claim their purchase.
 */

/**
 * Claim a pending profile that was created during an unauthenticated checkout
 * This connects a paid profile to a user's account after they sign up
 * 
 * @param userId The Clerk user ID of the authenticated user
 * @param email The email address used during checkout
 * @param token Optional verification token from the checkout process
 * @returns Object with success status and error message if applicable
 */
export async function claimPendingProfile(
  userId: string, 
  email: string,
  token?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    if (!userId || !email) {
      logger.warn('Missing required parameters in claimPendingProfile', { hasUserId: !!userId, hasEmail: !!email });
      return { success: false, error: "Missing required parameters for claiming profile" };
    }

    // First, check if the user already has a profile
    const existingUserProfile = await getProfileByUserId(userId);
    
    if (existingUserProfile?.membership === "pro") {
      logger.info('User already has pro membership', { userId });
      return { success: true };
    }

    // Look for a pending profile with matching email from the new table
    const pendingProfile = await getPendingProfileByEmail(email);
    
    if (!pendingProfile) {
      // Fall back to checking the old system (temporary profiles in the profiles table)
      const oldPendingProfile = await getProfileByEmail(email);
      
      if (oldPendingProfile && oldPendingProfile.userId.startsWith('temp_')) {
        logger.info('Found old temporary profile, using legacy claim', { userId, email });
        return claimOldPendingProfile(userId, email, oldPendingProfile);
      }
      
      logger.warn('No pending profile found', { userId, email });
      return { success: false, error: "No pending profile found for this email. Your purchase may not have been processed yet." };
    }
    
    if (pendingProfile.claimed && pendingProfile.claimedByUserId !== userId) {
      logger.warn('Profile already claimed by another user', { email, claimedBy: pendingProfile.claimedByUserId });
      return { success: false, error: "This profile has already been claimed by another account" };
    }
    
    // Verify token if provided (optional additional security)
    if (token && pendingProfile.token && token !== pendingProfile.token) {
      logger.warn('Token mismatch during claim', { userId, email });
      return { success: false, error: "Invalid verification token" };
    }
    
    // If the user already has a profile, merge the pending profile's data into it
    if (existingUserProfile) {
      // Copy all pro-related data from pending profile to existing profile
      const updateData = {
        membership: pendingProfile.membership || "pro",
        whopUserId: pendingProfile.whopUserId,
        whopMembershipId: pendingProfile.whopMembershipId,
        paymentProvider: pendingProfile.paymentProvider || "whop",
        billingCycleStart: pendingProfile.billingCycleStart,
        billingCycleEnd: pendingProfile.billingCycleEnd,
        planDuration: pendingProfile.planDuration,
        nextCreditRenewal: pendingProfile.nextCreditRenewal,
        usageCredits: pendingProfile.usageCredits || 1000,
        usedCredits: pendingProfile.usedCredits || 0,
        status: "active",
        email: email
      };
      
      await updateProfile(userId, updateData);
      logger.info('Merged pending profile into existing profile', { userId, membership: updateData.membership });
    } else {
      // User doesn't have a profile yet, create a new one
      const profileData = {
        userId: userId,
        email: email,
        membership: pendingProfile.membership,
        paymentProvider: pendingProfile.paymentProvider,
        whopUserId: pendingProfile.whopUserId,
        whopMembershipId: pendingProfile.whopMembershipId,
        planDuration: pendingProfile.planDuration,
        billingCycleStart: pendingProfile.billingCycleStart,
        billingCycleEnd: pendingProfile.billingCycleEnd,
        nextCreditRenewal: pendingProfile.nextCreditRenewal,
        usageCredits: pendingProfile.usageCredits || 1000,
        usedCredits: pendingProfile.usedCredits || 0,
        status: "active"
      };
      
      await createProfile(profileData);
      logger.info('Created new profile from pending profile', { userId, membership: profileData.membership });
    }
    
    // Mark the pending profile as claimed (keep for analytics)
    await markPendingProfileAsClaimed(pendingProfile.id, userId);
    
    // Revalidate relevant paths
    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    
    logger.info('Successfully claimed profile', { userId, email });
    return { success: true };
  } catch (error) {
    logger.error('Error claiming pending profile', error as Error, { userId, email });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error claiming profile" 
    };
  }
}

/**
 * Legacy function to claim profiles using the old method (temporary profiles in profiles table)
 * This is for backward compatibility during migration
 */
async function claimOldPendingProfile(
  userId: string, 
  email: string, 
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  pendingProfile: any
): Promise<{ success: boolean; error?: string }> {
  try {
    if (pendingProfile.userId && pendingProfile.userId !== userId && !pendingProfile.userId.startsWith('temp_')) {
      logger.warn('Profile already claimed by another user (legacy)', { email, claimedBy: pendingProfile.userId });
      return { success: false, error: "This profile has already been claimed by another account" };
    }
    
    // If the user already has a profile, merge the pending profile's data into it
    const existingUserProfile = await getProfileByUserId(userId);
    
    if (existingUserProfile) {
      const updateData = {
        membership: pendingProfile.membership || "pro",
        whopUserId: pendingProfile.whopUserId,
        whopMembershipId: pendingProfile.whopMembershipId,
        paymentProvider: pendingProfile.paymentProvider || "whop",
        billingCycleStart: pendingProfile.billingCycleStart,
        billingCycleEnd: pendingProfile.billingCycleEnd,
        planDuration: pendingProfile.planDuration,
        nextCreditRenewal: pendingProfile.nextCreditRenewal,
        usageCredits: pendingProfile.usageCredits || 1000,
        usedCredits: pendingProfile.usedCredits || 0,
        status: "active",
        email: email
      };
      
      await updateProfile(userId, updateData);
      logger.info('Merged legacy temp profile into existing profile', { userId });
      
      // Clean up the temporary profile
      try {
        if (pendingProfile.userId && pendingProfile.userId.startsWith('temp_')) {
          await deleteProfileById(pendingProfile.userId);
        }
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp profile', { tempProfileId: pendingProfile.userId, error: String(cleanupError) });
      }
    } else {
      // Create a new profile based on the temporary one
      const profileData = {
        userId: userId,
        email: email,
        membership: pendingProfile.membership,
        paymentProvider: pendingProfile.paymentProvider,
        whopUserId: pendingProfile.whopUserId,
        whopMembershipId: pendingProfile.whopMembershipId,
        planDuration: pendingProfile.planDuration,
        billingCycleStart: pendingProfile.billingCycleStart,
        billingCycleEnd: pendingProfile.billingCycleEnd,
        nextCreditRenewal: pendingProfile.nextCreditRenewal,
        usageCredits: pendingProfile.usageCredits || 1000,
        usedCredits: pendingProfile.usedCredits || 0,
        status: "active"
      };
      
      await createProfile(profileData);
      logger.info('Created new profile from legacy temp profile', { userId });
      
      // Clean up the temporary profile
      try {
        await deleteProfileById(pendingProfile.userId);
      } catch (cleanupError) {
        logger.warn('Failed to cleanup temp profile', { tempProfileId: pendingProfile.userId, error: String(cleanupError) });
      }
    }
    
    // Revalidate paths
    revalidatePath("/");
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    
    logger.info('Successfully claimed profile through legacy flow', { userId });
    return { success: true };
  } catch (error) {
    logger.error('Error in legacy profile claiming', error as Error, { userId, email });
    return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error claiming profile" 
    };
  }
} 

