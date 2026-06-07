import { db } from "@/db";
import {
  memberLocationConsent,
  locationTracking,
  geofences,
  geofenceEvents,
  locationTrackingAudit,
  locationDeletionLog,
  locationTrackingConfig,
} from "@/db/schema/geofence-privacy-schema";
import { eq, and, lte } from "drizzle-orm";

/**
 * Geofence Privacy Service
 * Strict location tracking with privacy safeguards:
 * - Explicit opt-in required (no implied consent)
 * - Foreground only (NEVER background tracking)
 * - 24-hour maximum data retention
 * - Automatic deletion after expiry
 * - Full audit trail
 */

export interface LocationConsentRequest {
  userId: string;
  purpose: string;
  purposeDescription: string;
  consentText: string;
  allowedDuringStrike?: boolean;
  allowedDuringEvents?: boolean;
  ipAddress?: string;
  userAgent?: string;
}

export interface LocationTrackingRequest {
  userId: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  purpose: string;
  activityType?: string;
  strikeId?: string;
  eventId?: string;
}

export interface GeofenceDefinition {
  name: string;
  description?: string;
  geofenceType: string;
  centerLatitude: number;
  centerLongitude: number;
  radiusMeters: number;
  strikeId?: string;
  unionLocalId?: string;
}

export class GeofencePrivacyService {
  private static readonly MAX_RETENTION_HOURS = 24;
  private static readonly CONSENT_VERSION = "1.0";

  /**
   * Request explicit location tracking consent from user
   */
  static async requestLocationConsent(request: LocationConsentRequest) {
    // Check if user already has active consent
    const existing = await db
      .select()
      .from(memberLocationConsent)
      .where(eq(memberLocationConsent.userId, request.userId))
      .limit(1);

    if (existing.length > 0 && existing[0].consentStatus === "opted_in") {
      // Check if expired
      if (existing[0].expiresAt && new Date() > existing[0].expiresAt) {
        // Mark as expired
        await this.expireConsent(existing[0].id);
      } else {
        throw new Error("User already has active location consent");
      }
    }

    // Create new consent (6-month expiry for Quebec Law 25 compliance)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const [consent] = await db
      .insert(memberLocationConsent)
      .values({
        userId: request.userId,
        consentStatus: "opted_in",
        optedInAt: new Date(),
        consentPurpose: request.purpose,
        purposeDescription: request.purposeDescription,
        foregroundOnly: true, // ALWAYS true - no background tracking
        allowedDuringStrike: request.allowedDuringStrike || false,
        allowedDuringEvents: request.allowedDuringEvents || false,
        dataRetentionHours: this.MAX_RETENTION_HOURS.toString(),
        expiresAt,
        consentText: request.consentText,
        consentVersion: this.CONSENT_VERSION,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      })
      .returning();

    // Audit log
    await this.logAuditAction({
      userId: request.userId,
      actionType: "consent_granted",
      actionDescription: `Location tracking consent granted for: ${request.purpose}`,
      ipAddress: request.ipAddress,
      userAgent: request.userAgent,
    });

    return consent;
  }

  /**
   * Revoke location tracking consent
   */
  static async revokeLocationConsent(userId: string, reason?: string) {
    await db
      .update(memberLocationConsent)
      .set({
        consentStatus: "opted_out",
        optedOutAt: new Date(),
      })
      .where(eq(memberLocationConsent.userId, userId));

    // Delete all existing location data immediately
    await this.deleteAllUserLocationData(userId, "consent_revoked");

    // Audit log
    await this.logAuditAction({
      userId,
      actionType: "consent_revoked",
      actionDescription: `Location tracking consent revoked. Reason: ${reason || "User request"}`,
    });
  }

  /**
   * Check if user has valid location tracking consent
   */
  static async hasValidConsent(userId: string, context?: "strike" | "event"): Promise<boolean> {
    const consent = await db
      .select()
      .from(memberLocationConsent)
      .where(
        and(
          eq(memberLocationConsent.userId, userId),
          eq(memberLocationConsent.consentStatus, "opted_in")
        )
      )
      .limit(1);

    if (consent.length === 0) return false;

    const userConsent = consent[0];

    // Check expiry
    if (userConsent.expiresAt && new Date() > userConsent.expiresAt) {
      await this.expireConsent(userConsent.id);
      return false;
    }

    // Check context-specific permissions
    if (context === "strike" && !userConsent.allowedDuringStrike) {
      return false;
    }

    if (context === "event" && !userConsent.allowedDuringEvents) {
      return false;
    }

    return true;
  }

  /**
   * Track user location (foreground only, 24-hour retention)
   */
  static async trackLocation(tracking: LocationTrackingRequest) {
    // Verify consent
    const hasConsent = await this.hasValidConsent(tracking.userId);
    if (!hasConsent) {
      throw new Error("Location tracking requires explicit opt-in consent");
    }

    // Verify config allows tracking
    const config = await this.getConfig();
    if (!config.locationTrackingEnabled) {
      throw new Error("Location tracking is globally disabled");
    }

    // Calculate expiry (24 hours max)
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.MAX_RETENTION_HOURS);

    // Record location
    const [location] = await db
      .insert(locationTracking)
      .values({
        userId: tracking.userId,
        latitude: tracking.latitude.toFixed(8),
        longitude: tracking.longitude.toFixed(8),
        accuracy: tracking.accuracy?.toFixed(2),
        altitude: tracking.altitude?.toFixed(2),
        expiresAt,
        trackingType: "foreground_only", // NEVER background
        purpose: tracking.purpose,
        activityType: tracking.activityType,
        strikeId: tracking.strikeId,
        eventId: tracking.eventId,
        autoDeleteScheduled: true,
      })
      .returning();

    return location;
  }

  /**
   * Create geofence (strike line, union hall, etc.)
   */
  static async createGeofence(geofence: GeofenceDefinition) {
    const [created] = await db
      .insert(geofences)
      .values({
        name: geofence.name,
        description: geofence.description,
        geofenceType: geofence.geofenceType,
        centerLatitude: geofence.centerLatitude.toFixed(8),
        centerLongitude: geofence.centerLongitude.toFixed(8),
        radiusMeters: geofence.radiusMeters.toFixed(2),
        strikeId: geofence.strikeId,
        unionLocalId: geofence.unionLocalId,
        status: "active",
      })
      .returning();

    return created;
  }

  /**
   * Check if location is within geofence
   */
  static async checkGeofenceEntry(
    userId: string,
    latitude: number,
    longitude: number,
    geofenceId: string
  ): Promise<{ inside: boolean; distance: number }> {
    const geofence = await db
      .select()
      .from(geofences)
      .where(eq(geofences.id, geofenceId))
      .limit(1);

    if (geofence.length === 0) {
      throw new Error("Geofence not found");
    }

    const fence = geofence[0];
    const distance = this.calculateDistance(
      latitude,
      longitude,
      parseFloat(fence.centerLatitude),
      parseFloat(fence.centerLongitude)
    );

    const inside = distance <= parseFloat(fence.radiusMeters);

    // Log entry/exit event if state changed
    if (inside) {
      await this.logGeofenceEvent(userId, geofenceId, "entry", latitude, longitude);
    }

    return { inside, distance };
  }

  /**
   * Calculate distance between two points (Haversine formula)
   */
  private static calculateDistance(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const R = 6371000; // Earth's radius in meters
    const dLat = this.toRadians(lat2 - lat1);
    const dLon = this.toRadians(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRadians(lat1)) *
        Math.cos(this.toRadians(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private static toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  /**
   * Log geofence entry/exit event
   */
  private static async logGeofenceEvent(
    userId: string,
    geofenceId: string,
    eventType: "entry" | "exit",
    latitude: number,
    longitude: number
  ) {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + this.MAX_RETENTION_HOURS);

    await db.insert(geofenceEvents).values({
      userId,
      geofenceId,
      eventType,
      latitude: latitude.toFixed(8),
      longitude: longitude.toFixed(8),
      expiresAt,
    });
  }

  /**
   * Delete expired location data (auto-cleanup job)
   * Should run hourly via cron
   */
  static async deleteExpiredLocationData() {
    const now = new Date();

    // Delete expired location tracking records
    const deletedTracking = await db
      .delete(locationTracking)
      .where(lte(locationTracking.expiresAt, now))
      .returning({ id: locationTracking.id });

    // Delete expired geofence events
    const deletedEvents = await db
      .delete(geofenceEvents)
      .where(lte(geofenceEvents.expiresAt, now))
      .returning({ id: geofenceEvents.id });

    // Log deletion
    if (deletedTracking.length > 0 || deletedEvents.length > 0) {
      await db.insert(locationDeletionLog).values({
        deletionType: "auto_24hr",
        deletionReason: "24-hour retention policy (automatic cleanup)",
        recordCount: (deletedTracking.length + deletedEvents.length).toString(),
        oldestRecordDate: now,
        newestRecordDate: now,
      });
    }

    return {
      trackingRecordsDeleted: deletedTracking.length,
      eventRecordsDeleted: deletedEvents.length,
    };
  }

  /**
   * Delete all location data for a specific user
   */
  private static async deleteAllUserLocationData(userId: string, reason: string) {
    // Delete tracking records
    const deletedTracking = await db
      .delete(locationTracking)
      .where(eq(locationTracking.userId, userId))
      .returning({ id: locationTracking.id });

    // Delete geofence events
    const deletedEvents = await db
      .delete(geofenceEvents)
      .where(eq(geofenceEvents.userId, userId))
      .returning({ id: geofenceEvents.id });

    // Log deletion
    await db.insert(locationDeletionLog).values({
      deletionType: "user_request",
      deletionReason: reason,
      recordCount: (deletedTracking.length + deletedEvents.length).toString(),
    });

    return {
      trackingRecordsDeleted: deletedTracking.length,
      eventRecordsDeleted: deletedEvents.length,
    };
  }

  /**
   * Expire consent (after 6 months)
   */
  private static async expireConsent(consentId: string) {
    await db
      .update(memberLocationConsent)
      .set({
        consentStatus: "expired",
        updatedAt: new Date(),
      })
      .where(eq(memberLocationConsent.id, consentId));
  }

  /**
   * Log audit action
   */
  private static async logAuditAction(params: {
    userId: string;
    actionType: string;
    actionDescription: string;
    performedBy?: string;
    performedByRole?: string;
    ipAddress?: string;
    userAgent?: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    metadata?: any;
  }) {
    await db.insert(locationTrackingAudit).values({
      userId: params.userId,
      actionType: params.actionType,
      actionDescription: params.actionDescription,
      performedBy: params.performedBy,
      performedByRole: params.performedByRole,
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      metadata: params.metadata,
    });
  }

  /**
   * Get global location tracking configuration
   */
  private static async getConfig() {
    const configs = await db.select().from(locationTrackingConfig).limit(1);

    if (configs.length === 0) {
      // Create default config
      const [config] = await db
        .insert(locationTrackingConfig)
        .values({
          locationTrackingEnabled: true,
          maxRetentionHours: this.MAX_RETENTION_HOURS.toString(),
          backgroundTrackingAllowed: false, // ALWAYS false
          explicitOptInRequired: true,
          autoDeletionEnabled: true,
        })
        .returning();

      return config;
    }

    return configs[0];
  }

  /**
   * Verify no background tracking is enabled (compliance check)
   */
  static async verifyNoBackgroundTracking(): Promise<{
    compliant: boolean;
    violations: string[];
  }> {
    const violations: string[] = [];

    // Check config
    const config = await this.getConfig();
    if (config.backgroundTrackingAllowed) {
      violations.push("Global config allows background tracking (FORBIDDEN)");
    }

    // Check any consent records with background tracking
    const backgroundConsents = await db
      .select()
      .from(memberLocationConsent)
      .where(eq(memberLocationConsent.foregroundOnly, false));

    if (backgroundConsents.length > 0) {
      violations.push(
        `${backgroundConsents.length} users have background tracking consent (FORBIDDEN)`
      );
    }

    // Check any tracking records marked as background
    const backgroundTracking = await db
      .select()
      .from(locationTracking)
      .where(eq(locationTracking.trackingType, "background"))
      .limit(1);

    if (backgroundTracking.length > 0) {
      violations.push("Background tracking records found (FORBIDDEN)");
    }

    return {
      compliant: violations.length === 0,
      violations,
    };
  }

  /**
   * Get location data retention statistics
   */
  static async getRetentionStats() {
    const allRecords = await db.select().from(locationTracking);
    const now = new Date();

    const expiredRecords = allRecords.filter((r) => new Date(r.expiresAt) < now);
    const activeRecords = allRecords.filter((r) => new Date(r.expiresAt) >= now);

    return {
      totalRecords: allRecords.length,
      activeRecords: activeRecords.length,
      expiredRecords: expiredRecords.length,
      oldestRecord: allRecords.length > 0 ? allRecords[0].recordedAt : null,
      newestRecord:
        allRecords.length > 0 ? allRecords[allRecords.length - 1].recordedAt : null,
    };
  }
}
