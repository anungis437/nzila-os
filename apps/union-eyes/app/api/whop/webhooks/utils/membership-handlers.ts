/**
 * Membership cancellation handler for webhook processing
 * Handles membership.went_invalid events
 * 
 * Processes membership cancellation events by updating a user's profile in the database - 
 * it sets a user to FREE when they cancel (either immediately or after their billing period ends)
 * while preserving their credits.
 * 
 */

import { updateProfile, getProfileByWhopUserId } from "@/db/queries/profiles-queries";
import { extractUserId } from "./user-utils";
import { revalidateAfterCancellation } from "./path-utils";

/**
 * Handle membership status changes (cancellation only)
 * 
 * @param data The webhook event data from Whop
 * @param isValid Boolean indicating if membership is becoming valid (true) or invalid (false)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function handleMembershipChange(data: any | Record<string, unknown>, isValid: boolean) {
  // We only handle cancellations now
  if (isValid) {
return;
  }

  if (!data.id || !data.user_id) {
return;
  }
  
  const _eventId = data.id || Date.now().toString();
try {
    // Extract Clerk user ID from metadata
const clerkUserId = extractUserId(data);
    
    if (clerkUserId) {
await handleMembershipCancellation(data);
return;
    } else {
}
    
    // FALLBACK PATH: Try to find a profile with this Whop user ID when metadata doesn&apos;t have Clerk ID
    const whopUserId = data.user_id;
const existingProfile = await getProfileByWhopUserId(whopUserId);
    
    if (existingProfile) {
// For cancellation with the fallback path, we use a modified approach with the found clerk ID
      const cancellationData = { ...data, metadata: { ...data.metadata, clerkUserId: existingProfile.userId } };
      await handleMembershipCancellation(cancellationData);
    } else {
}
  } catch (_error) {
}
}

/**
 * Handle membership cancellation according to the PRD
 * Uses a completely isolated flow for cancellation logic to avoid overlap with payment logic
 * 
 * @param data The webhook event data from Whop
 */
async function handleMembershipCancellation(data: Record<string, unknown>) {
  const _eventId = data.id || Date.now().toString();
// Extract the clerk user ID
  const clerkUserId = extractUserId(data);
  if (!clerkUserId) {
return;
  }
// Skip profile fetching entirely - just update what we need directly
  
  // Prepare minimal update data - only what&apos;s absolutely necessary
const updateData = {
    membership: "free" as const,  // Explicitly type as the enum value
    status: "canceled",            // Mark as canceled
    planDuration: null,            // Clear plan duration 
    // We&apos;re not touching credits, keeping whatever they currently have
  };
// Update profile with retries and timeout
  let updateSuccess = false;
  let retries = 0;
  const maxRetries = 3;
while (retries < maxRetries && !updateSuccess) {
    try {
// Add explicit timeout to the update operation
      const updatePromise = Promise.race([
        updateProfile(clerkUserId, updateData),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Profile update timeout - 10 seconds")), 10000)
        )
      ]);
      
      await updatePromise;
updateSuccess = true;
    } catch (_error: unknown) {
      retries++;
if (retries < maxRetries) {
        const backoffMs = 1000 * Math.pow(2, retries);
await new Promise(resolve => setTimeout(resolve, backoffMs));
      } else {
}
    }
  }

  if (!updateSuccess) {
}

  // Always trigger revalidation, even if update failed
  try {
    revalidateAfterCancellation();
} catch (_error) {
}
} 
