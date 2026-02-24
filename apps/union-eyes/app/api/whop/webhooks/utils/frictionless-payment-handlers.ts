/**
 * Frictionless Payment Handlers
 * 
 * MIGRATION STATUS: ÃƒÂ¢Ã…â€œÃ¢â‚¬Â¦ Migrated to use withSystemContext()
 * - System-wide webhook operations use withSystemContext() for unrestricted access
 * - Webhooks process payments across all organizations
 * 
 * This file contains handlers specifically for the "Pay First, Create Account Later" flow.
 * These functions are used when a user makes a purchase with just their email address
 * without having a Clerk account yet.
 */

import { getProfileByEmail } from "@/db/queries/profiles-queries";
import { createPendingProfile, getPendingProfileByEmail } from "@/db/queries/pending-profiles-queries";
import { PRO_TIER_CREDITS, CREDIT_RENEWAL_DAYS } from "./constants";
import { determinePlanType } from "./plan-utils";
import { convertTimestampToDate } from "./plan-utils";
import { revalidateAfterPayment } from "./path-utils";
import { eq } from "drizzle-orm";
import { withSystemContext } from '@/lib/db/with-rls-context';
import { db } from '@/db';
import { profilesTable } from "@/db/schema/domains/member";
import { pendingProfilesTable } from "@/db/schema/domains/member";
import { v4 as uuidv4 } from "uuid";

/**
 * Determines if a webhook payload should be handled by the frictionless flow
 * 
 * @param data The webhook event data from Whop
 * @returns Boolean indicating if this is a frictionless payment
 */
export function isFrictionlessPayment(data: Record<string, unknown>): boolean {
  // Debug log the structure to make sure we know what we&apos;re working with
// For payment.succeeded events, we need to check membership_metadata
  if (data.membership_metadata) {
    const membershipMeta = data.membership_metadata as Record<string, unknown>;
    const hasEmail = !!membershipMeta.email;
    const isExplicitlyUnauthenticated = !!membershipMeta.isUnauthenticated;
if (hasEmail || isExplicitlyUnauthenticated) {
return true;
    }
  }
  
  // For other events, check regular metadata
  if (data.metadata) {
    const meta = data.metadata as Record<string, unknown>;
    const hasEmail = !!meta.email;
    const hasClerkUserId = !!meta.clerkUserId;
    const isExplicitlyUnauthenticated = !!meta.isUnauthenticated;
if ((hasEmail && !hasClerkUserId) || isExplicitlyUnauthenticated) {
return true;
    }
  }
  
  // Not a frictionless payment
return false;
}

/**
 * Handle frictionless payment success
 * This is for users who pay with email before creating an account
 * 
 * @param data The webhook event data
 * @param eventId The event ID for logging
 * @returns Boolean indicating success
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleFrictionlessPayment(data: any | Record<string, unknown>, eventId: string): Promise<boolean> {
  try {
// Extract email and token, checking both metadata and membership_metadata
    // Prioritize membership_metadata as it seems to be where Whop puts this info in the payment.succeeded event
    let email = null;
    let token = null;
    
    if (data.membership_metadata) {
      email = data.membership_metadata.email || null;
      token = data.membership_metadata.token || null;
}
    
    // Fall back to regular metadata if no email in membership_metadata
    if (!email && data.metadata) {
      email = data.metadata.email || null;
      token = data.metadata.token || null;
}
    
    // Try user_email as last resort
    if (!email && data.user_email) {
      email = data.user_email;
}
    
    if (!email) {
return false;
    }
// Check if a regular profile already exists with this email (user already has an account)
    const existingProfile = await getProfileByEmail(email);
    
    if (existingProfile && existingProfile.userId && !existingProfile.userId.startsWith('temp_')) {
// If profile exists with a userId, update it like a normal authenticated payment
      // This handles the case where someone uses the frictionless flow with an email that already has an account
      const updateData = prepareProfileUpdateData(data);
      await updateProfile(existingProfile.userId, updateData);
} else {
      // No existing regular profile - create a pending profile in the pending_profiles table
await createOrUpdatePendingProfile(data, email, token ?? undefined, eventId);
    }
    
    // Revalidate paths
    revalidateAfterPayment();
return true;
  } catch (_error) {
return false;
  }
}

/**
 * Create or update a pending profile for unauthenticated purchases
 * This is used when a user pays with just their email, before creating an account
 * 
 * @param data The webhook data from Whop
 * @param email The user's email address
 * @param token Optional token for purchase verification
 * @param eventId Event ID for logging
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function createOrUpdatePendingProfile(data: any | Record<string, unknown>, email: string, token?: string, eventId?: string) {
  const _logPrefix = eventId ? `[Event ${eventId}]` : '[Profile Creation]';
  
  try {
// Calculate billing cycle details
    let billingCycleStart = new Date();
    let billingCycleEnd: Date | null = null;
    
    // Check if the webhook provides the cycle start/end dates
    if (data?.renewal_period_start) {
      billingCycleStart = convertTimestampToDate(data.renewal_period_start);
    }
    
    if (data?.renewal_period_end) {
      billingCycleEnd = convertTimestampToDate(data.renewal_period_end);
    } else {
      // Calculate based on plan duration
      const planDuration = determinePlanType(data?.plan_id);
      billingCycleEnd = new Date(billingCycleStart);
      
      if (planDuration === "yearly") {
        billingCycleEnd.setFullYear(billingCycleEnd.getFullYear() + 1);
      } else {
        billingCycleEnd.setDate(billingCycleEnd.getDate() + 30); // 30 days for monthly
      }
    }
    
    // Calculate next credit renewal (4 weeks from now)
    const nextCreditRenewal = new Date();
    nextCreditRenewal.setDate(nextCreditRenewal.getDate() + CREDIT_RENEWAL_DAYS);
    
    // Prepare profile data
    const planDuration = determinePlanType(data?.plan_id);
    
    // First check if we already have a pending profile for this email
    const existingPendingProfile = await getPendingProfileByEmail(email);
    
    // Build the pending profile data
    const pendingProfileData = {
      id: existingPendingProfile?.id || uuidv4(), // Use existing ID or generate new one
      email: email,
      token: token || null,
      
      // Store Whop identifiers
      whopUserId: data?.user_id || null,
      whopMembershipId: data?.membership_id || data?.id || null,
      
      // Set payment provider and membership
      paymentProvider: "whop" as const,
      membership: "pro" as const,
      
      // Set billing cycle information
      billingCycleStart: billingCycleStart,
      billingCycleEnd: billingCycleEnd,
      planDuration: planDuration,
      
      // Set credit renewal date
      nextCreditRenewal: nextCreditRenewal,
      
      // Set pro-level credits
      usageCredits: PRO_TIER_CREDITS,
      usedCredits: 0,
      
      // Set claiming status
      claimed: false,
      claimedByUserId: null,
      claimedAt: null,
    };
// If there&apos;s an existing pending profile, update it, otherwise create a new one
    if (existingPendingProfile) {
      // Update existing pending profile using system context
      await withSystemContext(async () => {
        await db.update(pendingProfilesTable)
          .set(pendingProfileData)
          .where(eq(pendingProfilesTable.email, email))
          .returning();
      });
} else {
      // Create a new pending profile
      await createPendingProfile(pendingProfileData);
}
return true;
  } catch (_error) {
return false;
  }
}

/**
 * Update an existing profile for a user with Clerk ID
 * Used when a user with an existing account uses the frictionless flow
 * 
 * @param userId The Clerk user ID
 * @param data The webhook data
 */
async function updateProfile(userId: string, data: Record<string, unknown>) {
  await withSystemContext(async () => {
    await db.update(profilesTable).set(data).where(eq(profilesTable.userId, userId)).returning();
  });
}

/**
 * Helper function to prepare profile update data from webhook data
 * Extracts common fields needed for both authenticated and unauthenticated payments
 */
function prepareProfileUpdateData(data: Record<string, unknown>) {
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
    whopUserId: data?.user_id || null,
    whopMembershipId: data?.membership_id || data?.id || null,
    
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
