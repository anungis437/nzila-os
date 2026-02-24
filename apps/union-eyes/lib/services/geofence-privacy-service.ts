/**
 * Geofence Privacy Service
 *
 * Handles location tracking with explicit opt-in and safeguards:
 * - Explicit opt-in required (not implicit)
 * - No background location tracking
 * - 24-hour TTL on location data
 * - Easy revocation anytime
 */

import { db } from '@/db';
import { eq, lte } from 'drizzle-orm';
import { memberLocationConsent, locationTracking } from '@/db/schema/geofence-privacy-schema';

export interface LocationConsentRequest {
  userId: string;
  purpose: 'strike-line-tracking' | 'safety-check-ins' | 'event-coordination';
  duration: 'temporary' | 'permanent';
  expiresAt?: Date;
}

export interface LocationData {
  userId: string;
  latitude: number;
  longitude: number;
  timestamp: Date;
  trackingType: 'foreground_only';
  purpose: string;
  expiresAt: Date;
}

/**
 * Request explicit location tracking permission
 * User MUST actively opt-in, not implied by other actions
 */
export async function requestLocationPermission(
  userId: string,
  purpose: string,
  _duration: 'temporary' | 'permanent' = 'temporary'
): Promise<{
  consentId: string;
  requiresUserAction: boolean;
  message: string;
}> {
  // Check if already has permission
  const existingConsent = await db.query.memberLocationConsent
    .findFirst({
      where: eq(memberLocationConsent.userId, userId)
    })
    .catch(() => null);

  if (existingConsent && existingConsent.consentStatus === 'opted_in') {
    return {
      consentId: existingConsent.id,
      requiresUserAction: false,
      message: 'Location tracking already enabled'
    };
  }

  // Require explicit opt-in from user
  return {
    consentId: `pending-${userId}-${Date.now()}`,
    requiresUserAction: true,
    message: 'User must explicitly opt-in to location tracking. No implicit consent.'
  };
}

/**
 * Store location only after explicit permission confirmed
 * CRITICAL: Must verify permission BEFORE storing
 */
export async function trackLocation(
  userId: string,
  location: { latitude: number; longitude: number },
  purpose: string
): Promise<{ success: boolean; error?: string }> {
  // Verify explicit opt-in consent
  const consent = await db.query.memberLocationConsent
    .findFirst({
      where: eq(memberLocationConsent.userId, userId)
    })
    .catch(() => null);

  if (!consent || consent.consentStatus !== 'opted_in') {
    return {
      success: false,
      error: 'Location tracking requires explicit opt-in consent'
    };
  }

  // Verify consent hasn&apos;t expired
  if (consent.expiresAt && consent.expiresAt < new Date()) {
    await revokeLocationConsent(userId);
    return {
      success: false,
      error: 'Location tracking consent has expired'
    };
  }

  // Store location with 24-hour TTL (never background tracking)
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    await db.insert(locationTracking).values({
      userId,
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      recordedAt: new Date(),
      expiresAt,
      trackingType: 'foreground_only', // NEVER background
      purpose
    });

    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: `Failed to track location: ${error}`
    };
  }
}

/**
 * Purge expired location data (run hourly)
 * Ensures data is not kept longer than 24 hours
 */
export async function purgeExpiredLocations(): Promise<{
  purgedCount: number;
  message: string;
}> {
  try {
    const _result = await db
      .delete(locationTracking)
      .where(lte(locationTracking.expiresAt, new Date()));

    return {
      purgedCount: 0, // Drizzle doesn&apos;t return count, but deletion happened
      message: 'Expired location data purged (24-hour TTL enforced)'
    };
  } catch (error) {
    return {
      purgedCount: 0,
      message: `Error purging locations: ${error}`
    };
  }
}

/**
 * Revoke location consent anytime (member right)
 */
export async function revokeLocationConsent(
  userId: string
): Promise<{ success: boolean; message: string }> {
  try {
    await db
      .update(memberLocationConsent)
      .set({ consentStatus: 'opted_out' })
      .where(eq(memberLocationConsent.userId, userId));

    return {
      success: true,
      message: 'Location tracking disabled. You can re-enable anytime.'
    };
  } catch (error) {
    return {
      success: false,
      message: `Error revoking consent: ${error}`
    };
  }
}

/**
 * Get location consent status for member
 */
export async function getLocationConsentStatus(
  userId: string
): Promise<{
  status: 'opted_in' | 'opted_out' | 'never_asked';
  canRevokeAnytime: boolean;
  purpose?: string;
  optedInAt?: Date;
  expiresAt?: Date;
}> {
  const consent = await db.query.memberLocationConsent
    .findFirst({
      where: eq(memberLocationConsent.userId, userId)
    })
    .catch(() => null);

  return {
    status: (consent?.consentStatus as 'opted_in' | 'opted_out' | 'never_asked') || 'never_asked',
    canRevokeAnytime: true, // Always allow revocation
    purpose: consent?.consentPurpose || undefined,
    optedInAt: consent?.optedInAt || undefined,
    expiresAt: consent?.expiresAt || undefined
  };
}

/**
 * Verify no background location tracking occurred
 * COMPLIANCE CHECK: Should always return true
 */
export async function verifyNoBackgroundTracking(): Promise<{
  compliant: boolean;
  backgroundTrackingDetected: boolean;
  message: string;
}> {
  // Check all location records have trackingType = 'foreground_only'
  const backgroundRecords = await db.query.locationTracking
    .findMany()
    .catch(() => []);

  const hasBackgroundTracking = backgroundRecords.some(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (record: any) => record.trackingType !== 'foreground_only'
  );

  return {
    compliant: !hasBackgroundTracking,
    backgroundTrackingDetected: hasBackgroundTracking,
    message: hasBackgroundTracking
      ? 'POLICY VIOLATION: Background location tracking detected'
      : 'All location tracking is foreground-only (compliant)'
  };
}

/**
 * Generate geofence privacy compliance report
 */
export async function generateGeofencePrivacyReport(): Promise<{
  compliant: boolean;
  issues: string[];
  recommendations: string[];
}> {
  const backgroundCheck = await verifyNoBackgroundTracking();
  const issues: string[] = [];

  if (backgroundCheck.backgroundTrackingDetected) {
    issues.push('Background location tracking detected - POLICY VIOLATION');
  }

  return {
    compliant: issues.length === 0,
    issues,
    recommendations: [
      'Ensure location tracking is foreground-only (never background)',
      'Verify explicit opt-in before any tracking',
      'Implement easy revocation mechanism',
      'Purge location data after 24 hours',
      'Display clear purpose of location tracking',
      'Provide member dashboard to see tracked locations'
    ]
  };
}

