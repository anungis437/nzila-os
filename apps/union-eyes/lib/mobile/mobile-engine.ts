/**
 * UnionEyes Mobile Engine
 * 
 * Mobile-first architecture for iOS, Android, and PWA support
 * 
 * GAPS IDENTIFIED:
 * 1. No dedicated mobile service layer
 * 2. No push notification infrastructure for mobile
 * 3. No offline-first data synchronization
 * 4. No mobile-specific API endpoints
 * 5. No device management system
 * 
 * STUB IMPLEMENTATIONS FOR:
 * - MobileNotificationService
 * - MobileOfflineSyncEngine  
 * - MobileDeviceManager
 * - MobileAPIGateway
 * - MobileAnalyticsService
 */

import { db } from '@/db';
import { mobileAnalytics, mobileDevices, mobileNotifications, mobileSyncQueue } from '@/db/schema/mobile-devices-schema';
import { eq, and, desc, gt, sql } from 'drizzle-orm';
import { logger } from '@/lib/logger';
import { promisify } from 'util';
import { brotliCompress, deflate, gzip } from 'zlib';

let firebaseAdmin: typeof import('firebase-admin') | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let firebaseApp: any = null;

const gzipAsync = promisify(gzip);
const deflateAsync = promisify(deflate);
const brotliAsync = promisify(brotliCompress);

async function getFirebaseMessaging() {
  if (typeof window !== 'undefined') {
    return null;
  }

  if (!firebaseAdmin) {
    try {
      firebaseAdmin = await import('firebase-admin');
    } catch (_error) {
      logger.warn('firebase-admin not installed. Mobile push notifications will be disabled.');
      return null;
    }
  }

  if (!firebaseApp) {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccount) {
      return null;
    }

    const credentials = JSON.parse(serviceAccount);

    if (firebaseAdmin.apps?.length) {
      firebaseApp = firebaseAdmin.app();
    } else {
      firebaseApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(credentials),
      });
    }
  }

  return firebaseAdmin.messaging(firebaseApp);
}

// ============================================================================
// TYPES
// ============================================================================

/** Mobile platform types */
export type MobilePlatform = 'ios' | 'android' | 'pwa';

/** Device registration */
export interface MobileDevice {
  id: string;
  deviceId: string;
  userId: string;
  organizationId?: string | null;
  platform: MobilePlatform;
  deviceToken: string;
  deviceName?: string;
  deviceModel?: string;
  osVersion?: string;
  appVersion?: string;
  timezone: string;
  locale?: string;
  pushEnabled?: boolean;
  notificationSound?: boolean;
  notificationVibration?: boolean;
  isActive?: boolean;
  lastActiveAt: Date;
  createdAt: Date;
}

/** Push notification payload */
export interface PushNotificationPayload {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  priority?: 'high' | 'normal';
  badge?: number;
  sound?: string;
  actions?: NotificationAction[];
}

export interface NotificationAction {
  id: string;
  title: string;
  icon?: string;
}

/** Offline sync record */
export interface OfflineSyncRecord {
  id: string;
  deviceId: string;
  entityType: string;
  entityId: string;
  operation: 'create' | 'update' | 'delete';
  payload: Record<string, unknown>;
  timestamp: Date;
  clientTimestamp?: Date;
  syncedAt?: Date;
  status: 'pending' | 'processing' | 'synced' | 'failed' | 'conflict';
  errorMessage?: string;
  conflictType?: string;
  resolution?: 'client_wins' | 'server_wins' | 'merged';
}

/** Mobile analytics event */
export interface MobileAnalyticsEvent {
  eventName: string;
  eventType?: string;
  deviceId: string;
  userId: string;
  organizationId?: string | null;
  timestamp: Date;
  properties?: Record<string, unknown>;
  location?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  deviceContext?: {
    platform: string;
    osVersion: string;
    appVersion: string;
    networkType: string;
    locale: string;
  };
  sessionId: string;
}

// ============================================================================
// MOBILE NOTIFICATION SERVICE (STUB)
// ============================================================================

/**
 * Mobile Notification Service
 * 
 * Handles push notifications for iOS (APNs), Android (FCM), and Web (FCM)
 * 
 * EXISTING: app/api/notifications/device/route.ts has basic registration
 * MISSING: Full push notification orchestration, notification templates, etc.
 */
export class MobileNotificationService {
  private static instance: MobileNotificationService;
  private apnsConfigured: boolean = false;
  private fcmConfigured: boolean = false;

  private constructor() {
    this.initializeProviders();
  }

  static getInstance(): MobileNotificationService {
    if (!MobileNotificationService.instance) {
      MobileNotificationService.instance = new MobileNotificationService();
    }
    return MobileNotificationService.instance;
  }

  private initializeProviders(): void {
    // Check for APNs (iOS) configuration
    this.apnsConfigured = !!(
      process.env.APNS_KEY_ID &&
      process.env.APNS_TEAM_ID &&
      process.env.APNS_BUNDLE_ID &&
      process.env.APNS_PRIVATE_KEY
    );

    // Check for FCM (Android/Web) configuration  
    this.fcmConfigured = !!(process.env.FCM_SERVER_KEY || process.env.FIREBASE_SERVICE_ACCOUNT);
  }

  /**
   * Send push notification to a specific device
   */
  async sendToDevice(
    deviceId: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string }> {
    const device = await this.getDevice(deviceId);
    if (!device || device.isActive === false || device.pushEnabled === false) {
      return { success: false, error: 'Device not available for notifications' };
    }

    const [notification] = await db
      .insert(mobileNotifications)
      .values({
        deviceId: device.id,
        userId: device.userId,
        organizationId: device.organizationId || undefined,
        title: payload.title,
        body: payload.body,
        data: payload.data || {},
        priority: payload.priority || 'normal',
        badge: payload.badge ?? undefined,
        sound: payload.sound,
        status: 'pending',
        scheduledAt: new Date(),
        createdAt: new Date(),
      })
      .returning();

    let result: { success: boolean; error?: string; providerResponse?: Record<string, unknown> };
    switch (device.platform) {
      case 'ios':
        result = await this.sendViaAPNs(device.deviceToken, payload);
        break;
      case 'android':
        result = await this.sendViaFCM(device.deviceToken, payload);
        break;
      case 'pwa':
        result = await this.sendViaFCM(device.deviceToken, payload);
        break;
      default:
        result = { success: false, error: 'Unknown platform' };
    }

    await db
      .update(mobileNotifications)
      .set({
        status: result.success ? 'sent' : 'failed',
        sentAt: result.success ? new Date() : undefined,
        failedAt: result.success ? undefined : new Date(),
        providerResponse: result.providerResponse || (result.error ? { error: result.error } : {}),
      })
      .where(eq(mobileNotifications.id, notification.id));

    return { success: result.success, error: result.error };
  }

  /**
   * Send to multiple devices (bulk)
   */
  async sendToDevices(
    deviceIds: string[],
    payload: PushNotificationPayload
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const deviceId of deviceIds) {
      const result = await this.sendToDevice(deviceId, payload);
      if (result.success) sent++;
      else failed++;
    }

    return { sent, failed };
  }

  /**
   * Send to user across all their devices
   */
  async sendToUser(
    userId: string,
    payload: PushNotificationPayload
  ): Promise<{ sent: number }> {
    const devices = await this.getDevicesForUser(userId);
    const results = await this.sendToDevices(
      devices.map(d => d.id),
      payload
    );
    return { sent: results.sent };
  }

  /**
   * Send organization-wide notification
   */
  async sendToOrganization(
    organizationId: string,
    payload: PushNotificationPayload,
    options?: {
      excludeUserIds?: string[];
      includeRoles?: string[];
    }
  ): Promise<{ sent: number }> {
    if (options?.includeRoles?.length) {
      logger.warn('MobileNotificationService.sendToOrganization - role filtering not implemented');
    }

    const devices = await db
      .select()
      .from(mobileDevices)
      .where(
        and(
          eq(mobileDevices.organizationId, organizationId),
          eq(mobileDevices.isActive, true),
          eq(mobileDevices.pushEnabled, true)
        )
      );

    const filtered = options?.excludeUserIds?.length
      ? devices.filter(device => !options.excludeUserIds?.includes(device.userId))
      : devices;

    const results = await this.sendToDevices(filtered.map(device => device.id), payload);
    return { sent: results.sent };
  }

  // Provider-specific methods (STUB)
  private async sendViaAPNs(
    deviceToken: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string; providerResponse?: Record<string, unknown> }> {
    if (!this.apnsConfigured && this.fcmConfigured) {
      logger.warn('APNs not configured. Falling back to FCM for iOS notifications.');
      return this.sendViaFCM(deviceToken, payload);
    }

    if (!this.apnsConfigured) {
      return { success: false, error: 'APNs not configured' };
    }

    if (this.fcmConfigured) {
      logger.warn('APNs provider not implemented. Using FCM as fallback.');
      return this.sendViaFCM(deviceToken, payload);
    }

    return { success: false, error: 'APNs provider not implemented' };
  }

  private async sendViaFCM(
    deviceToken: string,
    payload: PushNotificationPayload
  ): Promise<{ success: boolean; error?: string; providerResponse?: Record<string, unknown> }> {
    if (!this.fcmConfigured) {
      return { success: false, error: 'FCM not configured' };
    }

    const data = payload.data
      ? Object.fromEntries(Object.entries(payload.data).map(([key, value]) => [key, String(value)]))
      : undefined;

    const messaging = await getFirebaseMessaging();
    if (messaging) {
      try {
        const responseId = await messaging.send({
          token: deviceToken,
          notification: {
            title: payload.title,
            body: payload.body,
          },
          data,
          android: payload.priority === 'high' ? { priority: 'high' } : undefined,
          apns: payload.badge
            ? {
                payload: {
                  aps: {
                    badge: payload.badge,
                    sound: payload.sound,
                  },
                },
              }
            : undefined,
        });

        return { success: true, providerResponse: { id: responseId } };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown FCM error';
        return { success: false, error: message };
      }
    }

    if (process.env.FCM_SERVER_KEY) {
      try {
        const response = await fetch('https://fcm.googleapis.com/fcm/send', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `key=${process.env.FCM_SERVER_KEY}`,
          },
          body: JSON.stringify({
            to: deviceToken,
            priority: payload.priority || 'normal',
            notification: {
              title: payload.title,
              body: payload.body,
              sound: payload.sound,
            },
            data,
          }),
        });

        const responseBody = await response.json().catch(() => null);
        if (!response.ok) {
          return {
            success: false,
            error: `FCM send failed (${response.status})`,
            providerResponse: responseBody ? { responseBody } : undefined,
          };
        }

        return { success: true, providerResponse: responseBody || {} };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown FCM error';
        return { success: false, error: message };
      }
    }

    return { success: false, error: 'FCM not configured' };
  }

  // Database helpers (STUB - would use actual schema)
  private async getDevice(deviceId: string): Promise<MobileDevice | null> {
    const [device] = await db
      .select()
      .from(mobileDevices)
      .where(eq(mobileDevices.id, deviceId))
      .limit(1);

    return device ? this.mapDevice(device) : null;
  }

  private async getDevicesForUser(userId: string): Promise<MobileDevice[]> {
    const devices = await db
      .select()
      .from(mobileDevices)
      .where(
        and(
          eq(mobileDevices.userId, userId),
          eq(mobileDevices.isActive, true),
          eq(mobileDevices.pushEnabled, true)
        )
      )
      .orderBy(desc(mobileDevices.lastActiveAt));

    return devices.map(device => this.mapDevice(device));
  }

  private mapDevice(device: typeof mobileDevices.$inferSelect): MobileDevice {
    return {
      id: device.id,
      deviceId: device.deviceId,
      userId: device.userId,
      organizationId: device.organizationId,
      platform: device.platform as MobilePlatform,
      deviceToken: device.deviceToken,
      deviceName: device.deviceName || undefined,
      deviceModel: device.deviceModel || undefined,
      osVersion: device.osVersion || undefined,
      appVersion: device.appVersion || undefined,
      timezone: device.timezone || 'UTC',
      locale: device.locale || undefined,
      pushEnabled: device.pushEnabled ?? undefined,
      notificationSound: device.notificationSound ?? undefined,
      notificationVibration: device.notificationVibration ?? undefined,
      isActive: device.isActive ?? undefined,
      lastActiveAt: device.lastActiveAt || device.registeredAt || new Date(),
      createdAt: device.registeredAt || new Date(),
    };
  }
}

// ============================================================================
// MOBILE OFFLINE SYNC ENGINE (STUB)
// ============================================================================

/**
 * Mobile Offline Sync Engine
 * 
 * Handles offline-first data synchronization for mobile devices
 * 
 * MISSING IN CURRENT CODEBASE:
 * - Offline queue management
 * - Conflict resolution strategies  
 * - Background sync scheduling
 * - Delta sync optimization
 */
export class MobileOfflineSyncEngine {
  private static instance: MobileOfflineSyncEngine;

  private constructor() {}

  static getInstance(): MobileOfflineSyncEngine {
    if (!MobileOfflineSyncEngine.instance) {
      MobileOfflineSyncEngine.instance = new MobileOfflineSyncEngine();
    }
    return MobileOfflineSyncEngine.instance;
  }

  /**
   * Queue an operation for offline sync
   */
  async queueOperation(
    deviceId: string,
    operation: Omit<OfflineSyncRecord, 'id' | 'timestamp' | 'status' | 'deviceId'>
  ): Promise<string> {
    const [record] = await db
      .insert(mobileSyncQueue)
      .values({
        deviceId,
        entityType: operation.entityType,
        entityId: operation.entityId,
        operation: operation.operation,
        payload: operation.payload,
        clientTimestamp: operation.clientTimestamp || new Date(),
        status: 'pending',
      })
      .returning();

    return record.id;
  }

  /**
   * Process pending sync queue for a device
   */
  async processQueue(deviceId: string): Promise<{
    processed: number;
    failed: number;
    conflicts: number;
  }> {
    const queue = await db
      .select()
      .from(mobileSyncQueue)
      .where(and(eq(mobileSyncQueue.deviceId, deviceId), eq(mobileSyncQueue.status, 'pending')))
      .orderBy(mobileSyncQueue.createdAt);

    let processed = 0;
    let failed = 0;
    let conflicts = 0;

    for (const record of queue) {
      // Check for conflicts
      const hasConflict = await this.checkConflict(record);
      if (hasConflict) {
        conflicts++;
        // Strategy: Queue for later resolution
        await db
          .update(mobileSyncQueue)
          .set({ status: 'conflict', conflictType: 'data' })
          .where(eq(mobileSyncQueue.id, record.id));
        continue;
      }

      // Execute sync
      try {
        await this.executeSync(record);
        await db
          .update(mobileSyncQueue)
          .set({ status: 'synced', processedAt: new Date() })
          .where(eq(mobileSyncQueue.id, record.id));
        processed++;
      } catch (error) {
        await db
          .update(mobileSyncQueue)
          .set({
            status: 'failed',
            errorMessage: error instanceof Error ? error.message : 'Sync failed',
            processedAt: new Date(),
          })
          .where(eq(mobileSyncQueue.id, record.id));
        failed++;
      }
    }

    return { processed, failed, conflicts };
  }

  /**
   * Check for conflicts with server data
   */
  private async checkConflict(_record: typeof mobileSyncQueue.$inferSelect): Promise<boolean> {
    // STUB: Would compare timestamps or version vectors
    return false;
  }

  /**
   * Execute sync operation
   */
  private async executeSync(record: typeof mobileSyncQueue.$inferSelect): Promise<void> {
    switch (record.operation) {
      case 'create':
        logger.info('MobileOfflineSyncEngine.applyCreate', { entityType: record.entityType, entityId: record.entityId });
        break;
      case 'update':
        logger.info('MobileOfflineSyncEngine.applyUpdate', { entityType: record.entityType, entityId: record.entityId });
        break;
      case 'delete':
        logger.info('MobileOfflineSyncEngine.applyDelete', { entityType: record.entityType, entityId: record.entityId });
        break;
    }
  }

  /**
   * Get sync status for device
   */
  async getSyncStatus(deviceId: string): Promise<{
    pending: number;
    failed: number;
    lastSyncedAt: Date | null;
  }> {
    const [pendingResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mobileSyncQueue)
      .where(and(eq(mobileSyncQueue.deviceId, deviceId), eq(mobileSyncQueue.status, 'pending')));

    const [failedResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(mobileSyncQueue)
      .where(and(eq(mobileSyncQueue.deviceId, deviceId), eq(mobileSyncQueue.status, 'failed')));

    const [lastSyncedResult] = await db
      .select({ lastSyncedAt: sql<Date | null>`max(${mobileSyncQueue.processedAt})` })
      .from(mobileSyncQueue)
      .where(and(eq(mobileSyncQueue.deviceId, deviceId), eq(mobileSyncQueue.status, 'synced')));

    return {
      pending: Number(pendingResult?.count || 0),
      failed: Number(failedResult?.count || 0),
      lastSyncedAt: lastSyncedResult?.lastSyncedAt || null,
    };
  }

  /**
   * Resolve conflict using strategy
   */
  async resolveConflict(
    recordId: string,
    strategy: 'client_wins' | 'server_wins' | 'merge'
  ): Promise<void> {
    const resolution = strategy === 'merge' ? 'merged' : strategy;
    const status = strategy === 'server_wins' ? 'synced' : 'pending';

    await db
      .update(mobileSyncQueue)
      .set({
        status,
        resolution,
        processedAt: strategy === 'server_wins' ? new Date() : undefined,
      })
      .where(eq(mobileSyncQueue.id, recordId));
  }

  /**
   * Trigger background sync
   */
  async triggerBackgroundSync(deviceId: string): Promise<void> {
    await this.processQueue(deviceId);
  }
}

// ============================================================================
// MOBILE DEVICE MANAGER (STUB)
// ============================================================================

/**
 * Mobile Device Manager
 * 
 * Manages device registration, authentication, and lifecycle
 * 
 * EXISTING: Basic device registration in app/api/notifications/device/route.ts
 * MISSING: Device lifecycle, security, compliance
 */
export class MobileDeviceManager {
  private static instance: MobileDeviceManager;

  private constructor() {}

  static getInstance(): MobileDeviceManager {
    if (!MobileDeviceManager.instance) {
      MobileDeviceManager.instance = new MobileDeviceManager();
    }
    return MobileDeviceManager.instance;
  }

  /**
   * Register a new device
   */
  async registerDevice(data: {
    userId: string;
    organizationId: string;
    platform: MobilePlatform;
    deviceToken: string;
    deviceId: string;
    deviceName?: string;
    deviceModel?: string;
    osVersion?: string;
    appVersion?: string;
    timezone: string;
    locale?: string;
  }): Promise<MobileDevice> {
    const [existing] = await db
      .select()
      .from(mobileDevices)
      .where(eq(mobileDevices.deviceId, data.deviceId))
      .limit(1);

    if (existing) {
      const [updated] = await db
        .update(mobileDevices)
        .set({
          deviceToken: data.deviceToken,
          deviceName: data.deviceName,
          deviceModel: data.deviceModel,
          osVersion: data.osVersion,
          appVersion: data.appVersion,
          timezone: data.timezone,
          locale: data.locale,
          platform: data.platform,
          isActive: true,
          lastActiveAt: new Date(),
        })
        .where(eq(mobileDevices.id, existing.id))
        .returning();

      return {
        id: updated.id,
        deviceId: updated.deviceId,
        userId: updated.userId,
        organizationId: updated.organizationId,
        platform: updated.platform as MobilePlatform,
        deviceToken: updated.deviceToken,
        deviceName: updated.deviceName || undefined,
        deviceModel: updated.deviceModel || undefined,
        osVersion: updated.osVersion || undefined,
        appVersion: updated.appVersion || undefined,
        timezone: updated.timezone || 'UTC',
        locale: updated.locale || undefined,
        pushEnabled: updated.pushEnabled ?? undefined,
        notificationSound: updated.notificationSound ?? undefined,
        notificationVibration: updated.notificationVibration ?? undefined,
        isActive: updated.isActive ?? undefined,
        lastActiveAt: updated.lastActiveAt || updated.registeredAt || new Date(),
        createdAt: updated.registeredAt || new Date(),
      };
    }

    const [device] = await db
      .insert(mobileDevices)
      .values({
        deviceId: data.deviceId,
        deviceToken: data.deviceToken,
        userId: data.userId,
        organizationId: data.organizationId,
        platform: data.platform,
        deviceName: data.deviceName,
        deviceModel: data.deviceModel,
        osVersion: data.osVersion,
        appVersion: data.appVersion,
        timezone: data.timezone,
        locale: data.locale,
        pushEnabled: true,
        notificationSound: true,
        notificationVibration: true,
        isCompliant: true,
        isActive: true,
        registeredAt: new Date(),
        lastActiveAt: new Date(),
      })
      .returning();

    return {
      id: device.id,
      deviceId: device.deviceId,
      userId: device.userId,
      organizationId: device.organizationId,
      platform: device.platform as MobilePlatform,
      deviceToken: device.deviceToken,
      deviceName: device.deviceName || undefined,
      deviceModel: device.deviceModel || undefined,
      osVersion: device.osVersion || undefined,
      appVersion: device.appVersion || undefined,
      timezone: device.timezone || 'UTC',
      locale: device.locale || undefined,
      pushEnabled: device.pushEnabled ?? undefined,
      notificationSound: device.notificationSound ?? undefined,
      notificationVibration: device.notificationVibration ?? undefined,
      isActive: device.isActive ?? undefined,
      lastActiveAt: device.lastActiveAt || device.registeredAt || new Date(),
      createdAt: device.registeredAt || new Date(),
    };
  }

  /**
   * Update device registration
   */
  async updateDevice(
    deviceId: string,
    updates: Partial<Pick<MobileDevice, 'deviceName' | 'osVersion' | 'appVersion' | 'timezone'>>
  ): Promise<void> {
    await db
      .update(mobileDevices)
      .set({
        ...updates,
        lastActiveAt: new Date(),
      })
      .where(eq(mobileDevices.id, deviceId));
  }

  /**
   * Deactivate device (logout/wipe)
   */
  async deactivateDevice(deviceId: string, reason: string): Promise<void> {
    await db
      .update(mobileDevices)
      .set({
        isActive: false,
        isArchived: true,
        archivedAt: new Date(),
        metadata: { reason, deactivatedAt: new Date().toISOString() },
      })
      .where(eq(mobileDevices.id, deviceId));
  }

  /**
   * Get devices for organization
   */
  async getOrganizationDevices(
    organizationId: string,
    options?: { activeOnly?: boolean; platform?: MobilePlatform }
  ): Promise<MobileDevice[]> {
    const conditions = [eq(mobileDevices.organizationId, organizationId)];

    if (options?.activeOnly) {
      conditions.push(eq(mobileDevices.isActive, true));
    }

    if (options?.platform) {
      conditions.push(eq(mobileDevices.platform, options.platform));
    }

    const devices = await db
      .select()
      .from(mobileDevices)
      .where(and(...conditions))
      .orderBy(desc(mobileDevices.lastActiveAt));

    return devices.map(device => ({
      id: device.id,
      deviceId: device.deviceId,
      userId: device.userId,
      organizationId: device.organizationId,
      platform: device.platform as MobilePlatform,
      deviceToken: device.deviceToken,
      deviceName: device.deviceName || undefined,
      deviceModel: device.deviceModel || undefined,
      osVersion: device.osVersion || undefined,
      appVersion: device.appVersion || undefined,
      timezone: device.timezone || 'UTC',
      locale: device.locale || undefined,
      pushEnabled: device.pushEnabled ?? undefined,
      notificationSound: device.notificationSound ?? undefined,
      notificationVibration: device.notificationVibration ?? undefined,
      isActive: device.isActive ?? undefined,
      lastActiveAt: device.lastActiveAt || device.registeredAt || new Date(),
      createdAt: device.registeredAt || new Date(),
    }));
  }

  /**
   * Check device compliance
   */
  async checkDeviceCompliance(deviceId: string): Promise<{
    compliant: boolean;
    issues: string[];
  }> {
    const [device] = await db
      .select()
      .from(mobileDevices)
      .where(eq(mobileDevices.id, deviceId))
      .limit(1);

    if (!device) {
      return { compliant: false, issues: ['Device not found'] };
    }

    const issues = device.complianceIssues || [];
    const compliant = device.isCompliant ?? issues.length === 0;

    return { compliant, issues };
  }

  /**
   * Send remote wipe command
   */
  async remoteWipe(deviceId: string): Promise<void> {
    await db
      .update(mobileDevices)
      .set({
        isActive: false,
        isArchived: true,
        archivedAt: new Date(),
        metadata: { remoteWipeRequestedAt: new Date().toISOString() },
      })
      .where(eq(mobileDevices.id, deviceId));
  }
}

// ============================================================================
// MOBILE API GATEWAY (STUB)
// ============================================================================

/**
 * Mobile API Gateway
 * 
 * Optimized API endpoints for mobile clients
 * 
 * MISSING IN CURRENT CODEBASE:
 * - Delta sync endpoints
 * - Compression/encoding optimization
 * - Request batching
 * - GraphQL for mobile
 */
export class MobileAPIGateway {
  private static instance: MobileAPIGateway;

  private constructor() {}

  static getInstance(): MobileAPIGateway {
    if (!MobileAPIGateway.instance) {
      MobileAPIGateway.instance = new MobileAPIGateway();
    }
    return MobileAPIGateway.instance;
  }

  /**
   * Get delta sync for entities
   */
  async getDeltaSync(params: {
    entityType: string;
    since: Date;
    organizationId: string;
  }): Promise<{
    created: unknown[];
    updated: unknown[];
    deleted: string[];
    serverTimestamp: Date;
  }> {
    const records = await db
      .select({
        operation: mobileSyncQueue.operation,
        entityId: mobileSyncQueue.entityId,
        payload: mobileSyncQueue.payload,
      })
      .from(mobileSyncQueue)
      .leftJoin(mobileDevices, eq(mobileSyncQueue.deviceId, mobileDevices.id))
      .where(
        and(
          eq(mobileSyncQueue.entityType, params.entityType),
          gt(mobileSyncQueue.processedAt, params.since),
          eq(mobileDevices.organizationId, params.organizationId)
        )
      );

    const created = records.filter(record => record.operation === 'create').map(record => record.payload);
    const updated = records.filter(record => record.operation === 'update').map(record => record.payload);
    const deleted = records.filter(record => record.operation === 'delete').map(record => record.entityId);

    return {
      created,
      updated,
      deleted,
      serverTimestamp: new Date()
    };
  }

  /**
   * Batch request handler
   */
  async handleBatchRequest(requests: Array<{
    endpoint: string;
    method: string;
    body?: unknown;
  }>): Promise<Array<{ status: number; body: unknown }>> {
    const responses = await Promise.all(
      requests.map(async (request) => {
        try {
          const response = await fetch(request.endpoint, {
            method: request.method,
            headers: {
              'Content-Type': 'application/json',
            },
            body: request.body ? JSON.stringify(request.body) : undefined,
          });

          const body = await response.json().catch(() => null);
          return { status: response.status, body: body ?? {} };
        } catch (error) {
          return {
            status: 500,
            body: { error: error instanceof Error ? error.message : 'Batch request failed' },
          };
        }
      })
    );

    return responses;
  }

  /**
   * Compress response for bandwidth optimization
   */
  async compressResponse(data: unknown, encoding: 'gzip' | 'br' | 'deflate'): Promise<Buffer> {
    const payload = Buffer.from(JSON.stringify(data));

    switch (encoding) {
      case 'gzip':
        return gzipAsync(payload);
      case 'deflate':
        return deflateAsync(payload);
      case 'br':
        return brotliAsync(payload);
      default:
        return payload;
    }
  }

  /**
   * Handle offline-friendly POST
   */
  async handleOfflineRequest(request: {
    deviceId: string;
    operation: 'create' | 'update' | 'delete';
    entityType: string;
    entityId?: string;
    payload: unknown;
    clientTimestamp: Date;
  }): Promise<{ accepted: boolean; entityId?: string }> {
    const syncId = await mobileOfflineSyncEngine.queueOperation(request.deviceId, {
      entityType: request.entityType,
      entityId: request.entityId || syncIdFallback(request),
      operation: request.operation,
      payload: request.payload as Record<string, unknown>,
      clientTimestamp: request.clientTimestamp,
    });

    return { accepted: true, entityId: request.entityId || syncId };
  }
}

// ============================================================================
// MOBILE ANALYTICS SERVICE (STUB)
// ============================================================================

/**
 * Mobile Analytics Service
 * 
 * Track mobile-specific events and metrics
 * 
 * MISSING IN CURRENT CODEBASE:
 * - Mobile session tracking
 * - Crash reporting
 * - Performance metrics
 * - User flow analytics
 */
export class MobileAnalyticsService {
  private static instance: MobileAnalyticsService;
  private sessionId: string | null = null;
  private sessionStartedAt: Date | null = null;
  private events: MobileAnalyticsEvent[] = [];

  private constructor() {}

  static getInstance(): MobileAnalyticsService {
    if (!MobileAnalyticsService.instance) {
      MobileAnalyticsService.instance = new MobileAnalyticsService();
    }
    return MobileAnalyticsService.instance;
  }

  /**
   * Start a new session
   */
  startSession(userId: string, deviceId: string): string {
    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.sessionStartedAt = new Date();
    
    this.trackEvent({
      eventName: 'session_start',
      eventType: 'session',
      deviceId,
      userId,
      timestamp: new Date(),
      sessionId: this.sessionId
    });

    return this.sessionId;
  }

  /**
   * End current session
   */
  endSession(userId: string, deviceId: string): void {
    if (!this.sessionId) return;

    this.trackEvent({
      eventName: 'session_end',
      eventType: 'session',
      deviceId,
      userId,
      timestamp: new Date(),
      sessionId: this.sessionId
    });

    // Flush events to backend
    void this.flushEvents();
    this.sessionId = null;
    this.sessionStartedAt = null;
  }

  /**
   * Track an event
   */
  trackEvent(event: MobileAnalyticsEvent): void {
    const sessionId = event.sessionId || this.sessionId || 'session_unknown';
    const eventType = event.eventType || this.deriveEventType(event.eventName);
    this.events.push({ ...event, sessionId, eventType });
    
    // Flush if buffer is full
    if (this.events.length >= 50) {
      void this.flushEvents();
    }
  }

  /**
   * Track screen view
   */
  trackScreenView(
    screenName: string,
    userId: string,
    deviceId: string,
    properties?: Record<string, unknown>
  ): void {
    this.trackEvent({
      eventName: `screen_${screenName}`,
      eventType: 'screen',
      deviceId,
      userId,
      timestamp: new Date(),
      properties: { ...properties, screenName },
      sessionId: this.sessionId || ''
    });
  }

  /**
   * Track error/crash
   */
  trackError(
    error: Error,
    userId: string,
    deviceId: string,
    context?: Record<string, unknown>
  ): void {
    this.trackEvent({
      eventName: 'error',
      eventType: 'error',
      deviceId,
      userId,
      timestamp: new Date(),
      properties: {
        errorMessage: error.message,
        errorStack: error.stack,
        ...context
      },
      sessionId: this.sessionId || ''
    });
  }

  /**
   * Flush events to backend
   */
  private async flushEvents(): Promise<void> {
    if (this.events.length === 0) return;

    const batch = this.events;
    this.events = [];

    try {
      await db.insert(mobileAnalytics).values(
        batch.map(event => ({
          sessionId: event.sessionId,
          deviceId: event.deviceId,
          userId: event.userId,
          organizationId: event.organizationId || undefined,
          eventName: event.eventName,
          eventType: event.eventType || this.deriveEventType(event.eventName),
          properties: event.properties || {},
          location: event.location,
          deviceContext: event.deviceContext,
          timestamp: event.timestamp,
        }))
      );
    } catch (error) {
      logger.error('MobileAnalyticsService.flushEvents failed', { error });
    }
  }

  /**
   * Get session duration
   */
  getSessionDuration(): number {
    if (!this.sessionStartedAt) return 0;
    return Math.max(0, Date.now() - this.sessionStartedAt.getTime());
  }

  private deriveEventType(eventName: string): string {
    if (eventName.startsWith('screen_')) return 'screen';
    if (eventName.startsWith('session_')) return 'session';
    if (eventName === 'error') return 'error';
    return 'action';
  }
}

function syncIdFallback(request: { entityType: string; clientTimestamp: Date }): string {
  return `${request.entityType}_${request.clientTimestamp.getTime()}`;
}

// ============================================================================
// EXPORTS
// ============================================================================

export const mobileNotificationService = MobileNotificationService.getInstance();
export const mobileOfflineSyncEngine = MobileOfflineSyncEngine.getInstance();
export const mobileDeviceManager = MobileDeviceManager.getInstance();
export const mobileAPIGateway = MobileAPIGateway.getInstance();
export const mobileAnalyticsService = MobileAnalyticsService.getInstance();
