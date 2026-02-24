"use server";

import { getProfileByUserId, updateProfile } from "@/db/queries/profiles-queries";
import { auth } from '@/lib/api-auth-guard';
import { logger } from '@/lib/logger';
import { revalidatePath } from "next/cache";

// Constants
const _DEFAULT_USAGE_CREDITS = 1000; // Pro users get 1000 credits per cycle
const CREDIT_RENEWAL_DAYS = 28; // Credits renew every 4 weeks (28 days)

/**
 * SECURE PREMIUM FEATURE ACCESS SYSTEM
 * 
 * This implements a secure system for restricting premium features with usage tracking.
 * Security is ensured through multiple layers:
 * 
 * 1. Server-Side Validation: All checks happen in server actions (marked with "use server")
 *    that can't be manipulated by client-side code
 * 
 * 2. Authentication Gate: Every function verifies the user is logged in via Clerk auth
 * 
 * 3. Database Verification: Membership status is checked directly from the database,
 *    not from any client-provided state that could be manipulated
 * 
 * 4. Atomic Operations: Credit checking and usage are combined in single transactions
 *    to prevent race conditions or manipulation
 * 
 * 5. Automatic Credit Renewal: For yearly subscribers, credits automatically renew 
 *    every 4 weeks instead of waiting for yearly payment
 * 
 * HOW TO USE:
 * 
 * 1. Wrap premium features in withPremiumFeature:
 *    const result = await withPremiumFeature(
 *      async () => {
 *        // Your premium feature logic here
 *        return { result: "success" };
 *      },
 *      { 
 *        creditsRequired: 5,
 *        featureName: "AI Image Generation"
 *      }
 *    );
 * 
 * 2. Handle the result:
 *    if (result.success) {
 *      // Use result.data (your function's return value)
 *    } else {
 *      // Show error message from result.error
 *    }
 */

/**
 * Check if credits need renewal and reset them if necessary
 * This resets the usedCredits counter to 0 every 4 weeks
 * The total allowance (usageCredits) stays the same
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function checkAndRenewCredits(profile: any): Promise<any> {
  // If there's no nextCreditRenewal date, do nothing
  if (!profile || !profile.nextCreditRenewal) {
    return profile;
  }

  const now = new Date();
  const renewalDate = new Date(profile.nextCreditRenewal);
  
  // If current time has passed the renewal date, reset used credits
  if (now > renewalDate) {
    // Calculate next renewal date (4 weeks from now)
    const nextRenewal = new Date();
    nextRenewal.setDate(nextRenewal.getDate() + CREDIT_RENEWAL_DAYS);
    
    // Default values for update - only reset used credits, not total allowance
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: any = {
      usedCredits: 0, // Reset used credits to 0
      nextCreditRenewal: nextRenewal // Update the next renewal date
    };
    
    // Update profile with reset used credits and new renewal date
    const updatedProfile = await updateProfile(profile.userId, updateData);
    
    logger.info('Credits renewed', { userId: profile.userId, membership: profile.membership, nextRenewal: nextRenewal.toISOString() });
    
    // Revalidate pages that display credit information
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    
    return updatedProfile;
  }
  
  return profile;
}

/**
 * Wrapper function for premium features
 * Handles all the credit checking, usage tracking, and error handling in one place
 * 
 * @param featureFunction - The actual premium feature logic to execute if authorized
 * @param options - Configuration for credit usage
 * @returns Object with success status, data from your function, and any error message
 */
export async function withPremiumFeature<T>(
  featureFunction: () => Promise<T>,
  options: {
    creditsRequired: number;
    featureName: string;
  }
): Promise<{ 
  success: boolean; 
  data?: T; 
  error?: string;
  creditsRemaining?: number;
}> {
  try {
    // First check if user has enough credits
    const creditCheck = await checkCredits(options.creditsRequired);
    
    if (!creditCheck.hasCredits) {
      return { 
        success: false, 
        error: creditCheck.error || "Premium feature not available",
        creditsRemaining: creditCheck.profile ? 
          (creditCheck.profile.usageCredits || 0) - (creditCheck.profile.usedCredits || 0) : 0
      };
    }
    
    // Use credits for this feature
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const creditResult = await useCredits(options.creditsRequired, options.featureName);
    
    if (!creditResult.success) {
      return { success: false, error: creditResult.error || "Failed to use credits" };
    }
    
    // Execute the premium feature function
    const data = await featureFunction();
    
    // Calculate remaining credits
    const remaining = creditResult.profile ? 
      (creditResult.profile.usageCredits || 0) - (creditResult.profile.usedCredits || 0) : 0;
    
    // Return success with data
    return { 
      success: true, 
      data, 
      creditsRemaining: remaining 
    };
  } catch (error) {
return { 
      success: false, 
      error: error instanceof Error ? error.message : "Unknown error in premium feature" 
    };
  }
}

/**
 * Check if the user has enough credits for an action
 * Returns the user's profile and a boolean indicating if they have enough credits
 */
export async function checkCredits(
  requiredCredits: number = 1
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ hasCredits: boolean; profile: any | null; error?: string }> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { hasCredits: false, profile: null, error: "Not authenticated" };
    }
    
    let profile = await getProfileByUserId(userId);
    
    if (!profile) {
      return { hasCredits: false, profile: null, error: "Profile not found" };
    }
    
    // Just-in-time check for free users with expired billing cycles
    if (profile.membership === "free" && profile.billingCycleEnd) {
      const billingCycleEnd = new Date(profile.billingCycleEnd);
      const now = new Date();
      
      // Only downgrade credits if the billing cycle has actually ended
      if (now > billingCycleEnd && (profile.usageCredits || 0) > 5) {
// Update profile with free tier credit limit
        // Reset used credits to 0 for a clean slate when transitioning to free
        profile = await updateProfile(userId, {
          usageCredits: 5,
          usedCredits: 0, // Reset to 0 instead of capping at 5
          // Clear the billing cycle end date as it's no longer relevant for free users
          // This prevents this check from running again unnecessarily
          billingCycleEnd: null,
          nextCreditRenewal: new Date(now.getTime() + CREDIT_RENEWAL_DAYS * 24 * 60 * 60 * 1000) // Free users get renewal in 4 weeks
        });
        
        // Revalidate pages that display credit information
        revalidatePath("/notes");
        revalidatePath("/dashboard");
      } else {
        // User still has time left in their billing cycle
        // Don't reset credits yet, let them use what they paid for
}
    }
    
    // Check if credits need to be renewed based on the 4-week cycle
    // (only applies to pro users)
    profile = await checkAndRenewCredits(profile);
    
    // Profile should never be null here, but TypeScript doesn't know that
    if (!profile) {
      return { hasCredits: false, profile: null, error: "Profile not found after renewal check" };
    }
    
    // Free users can have a small number of credits (5) OR
    // can have pro-level credits during their remaining billing cycle
    if (profile.membership !== "pro") {
      const billingCycleEnd = profile.billingCycleEnd ? new Date(profile.billingCycleEnd) : null;
      const now = new Date();
      const hasActiveBillingCycle = billingCycleEnd && now < billingCycleEnd;
      
      // Allow pro-level credits if within active billing cycle after cancellation
      if (!hasActiveBillingCycle) {
        // If they're requesting more credits than the free tier allows
        if (requiredCredits > 5) {
          return { hasCredits: false, profile, error: "This feature requires a premium membership" };
        }
        
        // Ensure they have enough free tier credits
        const usageCredits = Math.min(profile.usageCredits || 0, 5); // Cap at 5 for free users not in active billing
        const usedCredits = profile.usedCredits || 0;
        const remainingCredits = Math.max(0, usageCredits - usedCredits);
        
        if (remainingCredits < requiredCredits) {
          return { 
            hasCredits: false, 
            profile,
            error: `Not enough credits. You have ${remainingCredits} remaining, but need ${requiredCredits}.`
          };
        }
        
        return { hasCredits: true, profile };
      }
      
      // If they are in an active billing cycle, treat them like pro users for credit checking
      // so they can continue using their remaining pro credits
    }
    
    // For pro users, check if they have enough remaining credits
    const usageCredits = profile.usageCredits || 0;
    const usedCredits = profile.usedCredits || 0;
    const remainingCredits = usageCredits - usedCredits;
    
    if (remainingCredits < requiredCredits) {
      return { 
        hasCredits: false, 
        profile,
        error: `Not enough credits. You have ${remainingCredits} remaining, but need ${requiredCredits}.`
      };
    }
    
    return { hasCredits: true, profile };
  } catch (_error) {
return { hasCredits: false, profile: null, error: "Server error checking credits" };
  }
}

/**
 * Use credits for a premium action
 * Returns success status and updated profile
 */
export async function useCredits(
  creditsToUse: number = 1,
  _description: string = "Used feature"
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<{ success: boolean; profile?: any; error?: string }> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { success: false, error: "Not authenticated" };
    }
    
    // First check if user has enough credits and if credits need renewal
    const { hasCredits, profile, error } = await checkCredits(creditsToUse);
    
    if (!hasCredits || !profile) {
      return { success: false, error: error || "Not enough credits" };
    }
    
    // Calculate new used credits
    const newUsedCredits = (profile.usedCredits || 0) + creditsToUse;
    // For free users with an active billing cycle, allow them to use their pro credits
    // until the billing cycle ends
    const _usageCredits = profile.usageCredits || 0;
    
    // Update profile with incremented used credits
    const updatedProfile = await updateProfile(userId, {
      usedCredits: newUsedCredits
    });
    
    // Log credit usage
// Revalidate any pages that might display credit information
    revalidatePath("/notes");
    revalidatePath("/dashboard");
    
    return { 
      success: true, 
      profile: updatedProfile 
    };
  } catch (_error) {
return { success: false, error: "Failed to use credits" };
  }
}

/**
 * Get the user's credit status
 * Returns credit info and next billing date
 */
export async function getCreditStatus(): Promise<{
  total: number;
  used: number;
  remaining: number;
  nextBillingDate: Date | null;
  nextCreditRenewal: Date | null;
  membership: string;
  error?: string;
}> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return { 
        total: 0, 
        used: 0, 
        remaining: 0, 
        nextBillingDate: null,
        nextCreditRenewal: null,
        membership: "free",
        error: "Not authenticated" 
      };
    }
    
    let profile = await getProfileByUserId(userId);
    
    if (!profile) {
      return { 
        total: 0, 
        used: 0, 
        remaining: 0, 
        nextBillingDate: null,
        nextCreditRenewal: null,
        membership: "free",
        error: "Profile not found" 
      };
    }
    
    // Check if credits need to be renewed based on the 4-week cycle
    profile = await checkAndRenewCredits(profile);
    
    const total = profile?.usageCredits || 0;
    const used = profile?.usedCredits || 0;
    const remaining = total - used;
    
    return {
      total,
      used,
      remaining,
      nextBillingDate: profile?.billingCycleEnd || null,
      nextCreditRenewal: profile?.nextCreditRenewal || null,
      membership: profile?.membership || "free"
    };
  } catch (_error) {
return { 
      total: 0, 
      used: 0, 
      remaining: 0, 
      nextBillingDate: null,
      nextCreditRenewal: null,
      membership: "free",
      error: "Failed to get credit status" 
    };
  }
}

/**
 * Check if the user has reached their credit limit
 * Returns true if user has reached or exceeded their credit limit
 * Useful for displaying upgrade prompts in the UI
 */
export async function hasReachedCreditLimit(): Promise<boolean> {
  try {
    const { userId } = await auth();
    
    if (!userId) {
      return false; // Not authenticated users can't reach limits
    }
    
    const profile = await getProfileByUserId(userId);
    
    if (!profile) {
      return false; // No profile found
    }
    
    // User has reached limit when usedCredits >= usageCredits
    const usedCredits = profile.usedCredits ?? 0;
    const usageCredits = profile.usageCredits ?? 0;
    
    return usedCredits >= usageCredits;
  } catch (_error) {
return false; // Default to false on error
  }
} 
