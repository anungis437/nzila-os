import { db } from "@/db";
import type { RLSTx } from "@/lib/db/with-rls-context";
import {
  memberLocationConsent,
  locationTracking,
  geofences,
  geofenceEvents,
  locationTrackingAudit,
  locationDeletionLog,
  locationTrackingConfig,
} from "@/db/schema/geofence-privacy-schema";
import { eq, and, lte, ne, or } from "drizzle-orm";

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
}

export class LocationConsentConflictError extends Error {
  constructor(message = "User already has active location consent") {
    super(message);
    this.name = "LocationConsentConflictError";
  }
}

export class LocationConsentNotFoundError extends Error {
  constructor(message = "No active location consent") {
    super(message);
    this.name = "LocationConsentNotFoundError";
  }
}

export class GeofencePrivacyService {
  private static readonly MAX_RETENTION_HOURS = 24;
  private static readonly CONSENT_VERSION = "1.0";

  /**
   * Request explicit location tracking consent from user.
   * Pass the caller's transaction so the consent, its privacy audit row and the platform audit commit together.
   */
  static async requestLocationConsent(request: LocationConsentRequest, tx: RLSTx = db) {
    // Check if user already has active consent
    const existing = await tx
      .select()
      .from(memberLocationConsent)
      .where(eq(memberLocationConsent.userId, request.userId))
      .limit(1);

    if (existing.length > 0 && existing[0].consentStatus === "opted_in") {
      if (!existing[0].expiresAt || new Date() <= existing[0].expiresAt) {
        throw new LocationConsentConflictError();
      }
    }

    // Create new consent (6-month expiry for Quebec Law 25 compliance)
    const expiresAt = new Date();
    expiresAt.setMonth(expiresAt.getMonth() + 6);

    const grant = {
      userId: request.userId,
      consentStatus: "opted_in",
      optedInAt: new Date(),
      optedOutAt: null,
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
    };

    // user_id is unique, so a returning member's withdrawn or expired consent row is renewed in place by the upsert.
    // Its predicate keeps a concurrent grant from being overwritten: if the consent is active, nothing is returned.
    const [consent] = await tx
      .insert(memberLocationConsent)
      .values(grant)
      .onConflictDoUpdate({
        target: memberLocationConsent.userId,
        set: { ...grant, updatedAt: new Date() },
        setWhere: or(ne(memberLocationConsent.consentStatus, "opted_in"), lte(memberLocationConsent.expiresAt, new Date())),
      })
      .returning();
    if (!consent) throw new LocationConsentConflictError();

    // Audit log
    await this.logAuditAction(
      {
        userId: request.userId,
        actionType: "consent_granted",
        actionDescription: `Location tracking consent granted for: ${request.purpose}`,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
      },
      tx,
    );

    return consent;
  }

  /**
   * Revoke location tracking consent and delete the member's location data in the same transaction.
   * Throws LocationConsentNotFoundError when there is no consent to revoke.
   */
  static async revokeLocationConsent(userId: string, reason?: string, tx: RLSTx = db) {
    const revoked = await tx
      .update(memberLocationConsent)
      .set({
        consentStatus: "opted_out",
        optedOutAt: new Date(),
      })
      .where(and(eq(memberLocationConsent.userId, userId), ne(memberLocationConsent.consentStatus, "opted_out")))
      .returning({ id: memberLocationConsent.id });
    if (revoked.length === 0) throw new LocationConsentNotFoundError();

    // Delete all existing location data immediately
    const deleted = await this.deleteAllUserLocationData(userId, "consent_revoked", tx);

    // Audit log
    await this.logAuditAction(
      {
        userId,
        actionType: "consent_revoked",
        actionDescription: `Location tracking consent revoked. Reason: ${reason || "User request"}`,
      },
      tx,
    );
    return { consentId: revoked[0].id, ...deleted };
  }

  /**
   * Erase every location record of a member without requiring an active consent. Consent can already be opted out, expired or
   * never recorded while rows remain (a retention sweep that failed, rows written before consent was tracked), and the right to
   * have them removed does not depend on a consent row. Returns how many records were removed.
   */
  static async eraseLocationData(userId: string, tx: RLSTx = db) {
    const deleted = await this.deleteAllUserLocationData(userId, "erasure_requested", tx);
    return { ...deleted, total: deleted.trackingRecordsDeleted + deleted.eventRecordsDeleted };
  }

  /**
   * Check if user has valid location tracking consent
   */
  static async hasValidConsent(userId: string, context?: "strike" | "event", tx: RLSTx = db): Promise<boolean> {
    const consent = await tx
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

    // An expired consent is simply not valid, whatever its stored status. Checking consent is a read and writes nothing.
    if (userConsent.expiresAt && new Date() > userConsent.expiresAt) {
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
  static async trackLocation(tracking: LocationTrackingRequest, tx: RLSTx = db) {
    // Verify consent, including the strike/event permission the member granted
    const consentContext =
      tracking.purpose === "strike" || tracking.purpose === "picket"
        ? "strike"
        : tracking.purpose === "event"
          ? "event"
          : undefined;
    const hasConsent = await this.hasValidConsent(tracking.userId, consentContext, tx);
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
    const [location] = await tx
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
  static async createGeofence(geofence: GeofenceDefinition, trustedUnionLocalId: string, tx: RLSTx = db) {
    const [created] = await tx
      .insert(geofences)
      .values({
        name: geofence.name,
        description: geofence.description,
        geofenceType: geofence.geofenceType,
        centerLatitude: geofence.centerLatitude.toFixed(8),
        centerLongitude: geofence.centerLongitude.toFixed(8),
        radiusMeters: geofence.radiusMeters.toFixed(2),
        strikeId: geofence.strikeId,
        // round 52: unionLocalId is the tenant boundary for this table (no
        // organizationId column exists) — always the server-resolved caller
        // org, never the client-supplied GeofenceDefinition.unionLocalId.
        unionLocalId: trustedUnionLocalId,
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
    geofenceId: string,
    trustedUnionLocalId: string
  ): Promise<{ inside: boolean; distance: number; recorded: boolean }> {
    const geofence = await db
      .select()
      .from(geofences)
      .where(eq(geofences.id, geofenceId))
      .limit(1);

    if (geofence.length === 0) {
      throw new Error("Geofence not found");
    }

    const fence = geofence[0];

    // round 52: geofences are tenant-scoped by unionLocalId — a caller from
    // a different union local must not be able to probe another tenant's
    // geofence (existence, radius, or entry/exit status).
    if (fence.unionLocalId !== trustedUnionLocalId) {
      throw new Error("Geofence not found");
    }

    const distance = this.calculateDistance(
      latitude,
      longitude,
      parseFloat(fence.centerLatitude),
      parseFloat(fence.centerLongitude)
    );

    const inside = distance <= parseFloat(fence.radiusMeters);

    // The point is the caller's own and is only compared; a precise position is stored only for a member who opted in
    // (for the strike permission when the fence belongs to a strike) while tracking is enabled.
    let recorded = false;
    if (inside) {
      const consented = await this.hasValidConsent(userId, fence.strikeId ? "strike" : undefined);
      if (consented && (await this.getConfig()).locationTrackingEnabled) {
        await this.logGeofenceEvent(userId, geofenceId, "entry", latitude, longitude);
        recorded = true;
      }
    }

    return { inside, distance, recorded };
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
   * Record the lapse of consents whose expiry has passed. A consent is not valid after its expiry whatever its stored status (the check
   * is a read and writes nothing); this sweep makes the stored status say so, so a reader that looks at the status alone is not misled
   * and the lapse is evident in the record. It runs under the system role with the retention sweep, one member at a time, capped like it.
   */
  static async expireLapsedConsents(tx: RLSTx = db) {
    const now = new Date();
    const cap = GeofencePrivacyService.RETENTION_MAX_USERS_PER_RUN;
    const lapsed = await tx
      .selectDistinct({ userId: memberLocationConsent.userId })
      .from(memberLocationConsent)
      .where(and(eq(memberLocationConsent.consentStatus, "opted_in"), lte(memberLocationConsent.expiresAt, now)))
      .limit(cap + 1);
    const truncated = lapsed.length > cap;
    let expired = 0;
    for (const { userId } of lapsed.slice(0, cap)) {
      const rows = await tx
        .update(memberLocationConsent)
        .set({ consentStatus: "expired", updatedAt: now })
        .where(and(eq(memberLocationConsent.userId, userId), eq(memberLocationConsent.consentStatus, "opted_in"), lte(memberLocationConsent.expiresAt, now)))
        .returning({ id: memberLocationConsent.id });
      expired += rows.length;
    }
    return { consentsExpired: expired, consentsTruncated: truncated };
  }

  /**
   * Delete expired location data (auto-cleanup job).
   * Runs hourly from app/api/cron/location-retention under the system role: the 24-hour retention covers every
   * member's rows, which an ordinary user-scoped session cannot see. Deletion and its evidence commit together.
   */
  // One run reads and deletes at most this many members' expired rows: a backlog (for example after the job did not run) is worked off over
  // several runs instead of one long system transaction. `truncated` tells the caller that more expired rows remain.
  static readonly RETENTION_MAX_USERS_PER_RUN = 500;

  static async deleteExpiredLocationData(tx: RLSTx = db) {
    const now = new Date();
    const cap = GeofencePrivacyService.RETENTION_MAX_USERS_PER_RUN;
    const expiredTracking = await tx
      .selectDistinct({ userId: locationTracking.userId })
      .from(locationTracking)
      .where(lte(locationTracking.expiresAt, now))
      .limit(cap + 1);
    const expiredEvents = await tx
      .selectDistinct({ userId: geofenceEvents.userId })
      .from(geofenceEvents)
      .where(lte(geofenceEvents.expiresAt, now))
      .limit(cap + 1);
    const everyUserId = [...new Set([...expiredTracking, ...expiredEvents].map((row) => row.userId))];
    const truncated = everyUserId.length > cap;
    const userIds = everyUserId.slice(0, cap);

    let trackingRecordsDeleted = 0;
    let eventRecordsDeleted = 0;
    // The log records the real span of what was deleted, not the time of the run.
    let oldest: Date | null = null;
    let newest: Date | null = null;
    const widen = (at: Date | string | null | undefined) => {
      if (!at) return;
      const when = at instanceof Date ? at : new Date(at);
      if (Number.isNaN(when.getTime())) return;
      if (!oldest || when < oldest) oldest = when;
      if (!newest || when > newest) newest = when;
    };
    for (const userId of userIds) {
      const deletedTracking = await tx
        .delete(locationTracking)
        .where(and(eq(locationTracking.userId, userId), lte(locationTracking.expiresAt, now)))
        .returning({ id: locationTracking.id, at: locationTracking.recordedAt });
      const deletedEvents = await tx
        .delete(geofenceEvents)
        .where(and(eq(geofenceEvents.userId, userId), lte(geofenceEvents.expiresAt, now)))
        .returning({ id: geofenceEvents.id, at: geofenceEvents.eventTime });
      trackingRecordsDeleted += deletedTracking.length;
      eventRecordsDeleted += deletedEvents.length;
      for (const row of deletedTracking) widen((row as { at?: Date | string | null }).at);
      for (const row of deletedEvents) widen((row as { at?: Date | string | null }).at);
    }

    // The caller passes the system transaction. Every per-user delete and this log commit or roll back together.
    if (trackingRecordsDeleted > 0 || eventRecordsDeleted > 0) {
      await tx.insert(locationDeletionLog).values({
        deletionType: "auto_24hr",
        deletionReason: "24-hour retention policy (automatic cleanup)",
        recordCount: (trackingRecordsDeleted + eventRecordsDeleted).toString(),
        oldestRecordDate: oldest ?? now,
        newestRecordDate: newest ?? now,
      });
    }

    return { trackingRecordsDeleted, eventRecordsDeleted, truncated };
  }

  /**
   * Delete all location data for a specific user
   */
  private static async deleteAllUserLocationData(userId: string, reason: string, tx: RLSTx = db) {
    // Delete tracking records
    const deletedTracking = await tx
      .delete(locationTracking)
      .where(eq(locationTracking.userId, userId))
      .returning({ id: locationTracking.id });

    // Delete geofence events
    const deletedEvents = await tx
      .delete(geofenceEvents)
      .where(eq(geofenceEvents.userId, userId))
      .returning({ id: geofenceEvents.id });

    // Log deletion
    await tx.insert(locationDeletionLog).values({
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
   * Log audit action
   */
  private static async logAuditAction(
    params: {
      userId: string;
      actionType: string;
      actionDescription: string;
      performedBy?: string;
      performedByRole?: string;
      ipAddress?: string;
      userAgent?: string;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      metadata?: any;
    },
    tx: RLSTx = db,
  ) {
    await tx.insert(locationTrackingAudit).values({
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
