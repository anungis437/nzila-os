/**
 * Payment event handlers for webhook processing
 * Handles payment success and failure events
 * 
 * MIGRATION STATUS: Ã¢Å“â€¦ Migrated to use withSystemContext()
 * - System-wide webhook operations use withSystemContext() for unrestricted access
 * - Webhooks process payments across all organizations
 * 
 * Processes payment events by updating a user's profile with payment details - when a payment succeeds, it upgrades the 
 * user to PRO and gives them credits; when a payment fails, it marks their account with a payment_failed status.
 * 
 */

import { updateProfile, getProfileByWhopUserId } from "@/db/queries/profiles-queries";
import { PRO_TIER_CREDITS, CREDIT_RENEWAL_DAYS } from "./constants";
import { determinePlanType } from "./plan-utils";
import { extractUserId } from "./user-utils";
import { revalidateAfterPayment } from "./path-utils";
import { convertTimestampToDate } from "./plan-utils";
import { isFrictionlessPayment, handleFrictionlessPayment } from "./frictionless-payment-handlers";

/**
 * Handle payment success events
 * Updates user profile with Whop IDs, billing cycle information, membership status, and credits
 * Now delegates to frictionless-payment-handlers.ts for email-based purchases
 * 
 * @param data The webhook event data
 */
export async function handlePaymentSuccess(data: Record<string, unknown>) {
  const eventId = (data.id as string) || Date.now().toString();
try {
    // Debug the frictionless detection
if (data.membership_metadata) {
}
    
    // Test if this is a frictionless payment
    const isUnauthenticated = isFrictionlessPayment(data);
// First check if this is a frictionless payment (email-based, no Clerk ID)
    if (isUnauthenticated) {
await handleFrictionlessPayment(data, eventId);
      return;
    }
    
    // If not frictionless, proceed with the traditional authenticated flow
    
    // Extract user ID from metadata using the common utility
    const clerkUserId = extractUserId(data);
    
    if (!clerkUserId) {
return;
    }
// Calculate billing cycle details
    let billingCycleStart = new Date();
    let billingCycleEnd: Date | null = null;
    
    // Check if the webhook provides the cycle start/end dates
    if (data?.renewal_period_start) {
      // Convert timestamp to Date
      billingCycleStart = convertTimestampToDate(data.renewal_period_start as number);
}
    
    if (data?.renewal_period_end) {
      // Convert timestamp to Date
      billingCycleEnd = convertTimestampToDate(data.renewal_period_end as number);
} else {
      // Need to calculate it ourselves based on the plan type
      const planDuration = determinePlanType(data?.plan_id as string);
      
      if (planDuration === "yearly") {
        billingCycleEnd = new Date(billingCycleStart);
        billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
      } else {
        // Default to monthly (30 days)
        billingCycleEnd = new Date(billingCycleStart);
        billingCycleEnd.setDate(billingCycleEnd.getDate() + 30);
      }
}

    // Determine plan duration based on the plan ID
    const planDuration = determinePlanType(data?.plan_id as string);
// Calculate next credit renewal date (always 4 weeks from now)
    const nextCreditRenewal = new Date();
    nextCreditRenewal.setDate(nextCreditRenewal.getDate() + CREDIT_RENEWAL_DAYS);
// Prepare update data - we need to update all the important fields
    const updateData = {
      // Store Whop identifiers
      whopUserId: (data?.user_id as string) || null,
      whopMembershipId: (data?.membership_id as string) || (data?.id as string) || null,
      
      // Set payment provider
      paymentProvider: "whop" as const,
      
      // Set billing cycle information
      billingCycleStart: billingCycleStart,
      billingCycleEnd: billingCycleEnd,
      planDuration: planDuration,
      
      // Set membership status to pro
      membership: "pro" as const,
      
      // Set pro-level credits
      usageCredits: PRO_TIER_CREDITS,
      usedCredits: 0,
      
      // Set credit renewal date
      nextCreditRenewal: nextCreditRenewal,
      
      // Set status to active
      status: "active"
    };
// Add retry logic for the database update
    let retries = 0;
    const maxRetries = 3;
    let updateSuccess = false;
    
    while (retries < maxRetries && !updateSuccess) {
      try {
await updateProfile(clerkUserId, updateData);
updateSuccess = true;
      } catch (_error) {
        retries++;
if (retries < maxRetries) {
          // Wait before retrying (exponential backoff)
          const backoffMs = 1000 * Math.pow(2, retries);
await new Promise(resolve => setTimeout(resolve, backoffMs));
        }
      }
    }
    
    if (!updateSuccess) {
}

    // Revalidate paths to refresh data after payment
    try {
      revalidateAfterPayment();
} catch (_revalidateError) {
}
} catch (_error) {
}
}

/**
 * Helper function to prepare profile update data from webhook data
 * Extracts common fields needed for both authenticated and unauthenticated payments
 */
function _prepareProfileUpdateData(data: Record<string, unknown>) {
  // Calculate billing cycle details
  let billingCycleStart = new Date();
  let billingCycleEnd: Date | null = null;
  
  // Check if the webhook provides the cycle start/end dates
  if (data?.renewal_period_start) {
    billingCycleStart = convertTimestampToDate(data.renewal_period_start as number);
  }
  
  if (data?.renewal_period_end) {
    billingCycleEnd = convertTimestampToDate(data.renewal_period_end as number);
  } else {
    // Calculate based on plan type
    const planDuration = determinePlanType(data?.plan_id as string);
    billingCycleEnd = new Date(billingCycleStart);
    
    if (planDuration === "yearly") {
      billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
    } else {
      billingCycleEnd.setDate(billingCycleEnd.getDate() + 30); // 30 days for monthly
    }
  }
  
  // Calculate next credit renewal date (always 4 weeks from now)
  const nextCreditRenewal = new Date();
  nextCreditRenewal.setDate(nextCreditRenewal.getDate() + CREDIT_RENEWAL_DAYS);
  
  // Determine plan duration based on the plan ID
  const planDuration = determinePlanType(data?.plan_id as string);
  
  return {
    // Store Whop identifiers
    whopUserId: (data?.user_id as string) || null,
    whopMembershipId: (data?.membership_id as string) || (data?.id as string) || null,
    
    // Set payment provider
    paymentProvider: "whop" as const,
    
    // Set billing cycle information
    billingCycleStart: billingCycleStart,
    billingCycleEnd: billingCycleEnd,
    planDuration: planDuration,
    
    // Set membership status to pro
    membership: "pro" as const,
    
    // Set pro-level credits
    usageCredits: PRO_TIER_CREDITS,
    usedCredits: 0,
    
    // Set credit renewal date
    nextCreditRenewal: nextCreditRenewal,
    
    // Set status to active
    status: "active"
  };
}

/**
 * Handle payment failure events
 * Marks the user's payment as failed in the profile
 * 
 * @param data The webhook event data
 */
export async function handlePaymentFailed(data: Record<string, unknown>): Promise<void> {
  if (!data) {
return;
  }
// Try to get userId from metadata using the common utility
  const userId = extractUserId(data);
  
  if (userId) {
try {
      await updateProfile(userId, {
        status: "payment_failed"
      });
} catch (_error) {
}
    return;
  } 
// Fallback: try to find by Whop user ID (this should be rare)
  const whopUserId = data.user_id;
  if (whopUserId) {
try {
      const profile = await getProfileByWhopUserId(whopUserId as string);
      if (profile) {
await updateProfile(profile.userId, {
          status: "payment_failed"
        });
} else {
}
    } catch (_error) {
}
  } else {
}
} 
