/**
 * CLC API Integration Layer
 * 
 * Integration service for connecting to Canadian Labour Congress (CLC) national APIs,
 * synchronizing organization data, handling webhooks, and managing data consistency
 * between local system and CLC national database.
 * 
 * Features:
 * - CLC API client with authentication
 * - Organization data synchronization
 * - Real-time webhook handlers
 * - Conflict resolution (CLC vs local data)
 * - Nightly sync jobs
 * - Audit logging for all sync operations
 * - Rate limiting and retry logic
 * - Error handling and notifications
 * 
 * Usage:
 * ```typescript
 * import { syncOrganization, syncAllOrganizations, handleWebhook } from '@/services/clc/clc-api-integration';
 * 
 * // Sync single organization
 * await syncOrganization('org-123');
 * 
 * // Sync all organizations (nightly job)
 * await syncAllOrganizations();
 * 
 * // Handle CLC webhook
 * await handleWebhook({ type: 'organization.updated', data: {...} });
 * ```
 */

import { db } from '@/db';
import { organizations } from '@/db/schema';
import { clcOrganizationSyncLog, clcWebhookLog } from '@/db/schema/clc-sync-audit-schema';
import { eq, isNotNull } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'crypto';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

interface CLCApiConfig {
  baseUrl: string;
  apiKey: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

interface CLCOrganization {
  affiliateCode: string;
  name: string;
  legalName: string;
  organizationType: string;
  status: 'active' | 'inactive' | 'suspended';
  province: string;
  city: string;
  postalCode: string;
  contactEmail: string;
  contactPhone: string;
  membershipCount: number;
  lastUpdated: string;
  perCapitaRate?: number;
}

interface CLCWebhookPayload {
  id: string;
  type: 'organization.created' | 'organization.updated' | 'organization.deleted' | 'membership.updated';
  timestamp: string;
  data: CLCOrganization;
  signature: string;
}

interface SyncResult {
  success: boolean;
  organizationId: string;
  affiliateCode: string;
  action: 'created' | 'updated' | 'skipped' | 'failed';
  changes?: string[];
  conflicts?: ConflictResolution[];
  error?: string;
}

interface ConflictResolution {
  field: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localValue: any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clcValue: any;
  resolution: 'clc_wins' | 'local_wins' | 'manual_review';
  reason: string;
}

interface SyncStatistics {
  totalOrganizations: number;
  synced: number;
  created: number;
  updated: number;
  skipped: number;
  failed: number;
  conflicts: number;
  duration: number;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CLC_API_CONFIG: CLCApiConfig = {
  baseUrl: process.env.CLC_API_BASE_URL || 'https://api.clc-ctc.ca/v1',
  apiKey: process.env.CLC_API_KEY || '',
  timeout: 30000, // 30 seconds
  retryAttempts: 3,
  retryDelay: 1000 // 1 second
};

const WEBHOOK_SECRET = process.env.CLC_WEBHOOK_SECRET || '';

// Conflict resolution rules
const CONFLICT_RULES: Record<string, 'clc_wins' | 'local_wins' | 'manual_review'> = {
  name: 'clc_wins', // CLC is source of truth for official names
  legalName: 'clc_wins',
  status: 'clc_wins',
  affiliateCode: 'clc_wins',
  contactEmail: 'local_wins', // Local contacts may be more up-to-date
  contactPhone: 'local_wins',
  membershipCount: 'clc_wins', // CLC has authoritative membership data
  perCapitaRate: 'manual_review' // Requires admin review
};

// ============================================================================
// MAIN SYNC FUNCTIONS
// ============================================================================

/**
 * Sync single organization from CLC API
 */
export async function syncOrganization(organizationId: string): Promise<SyncResult> {
  const startTime = Date.now();
  
  try {
    // Get local organization
    const localOrg = await db
      .select()
      .from(organizations)
      .where(eq(organizations.id, organizationId))
      .limit(1);

    if (localOrg.length === 0) {
      throw new Error(`Organization ${organizationId} not found locally`);
    }

    const affiliateCode = localOrg[0].charterNumber;
    if (!affiliateCode) {
      throw new Error(`Organization ${organizationId} has no CLC charter number`);
    }

    // Fetch from CLC API
    const clcOrg = await fetchCLCOrganization(affiliateCode);
    
    // Compare and resolve conflicts
    const { hasChanges, changes, conflicts } = compareOrganizations(localOrg[0], clcOrg);

    if (!hasChanges) {
      await logSync(organizationId, affiliateCode, 'skipped', null, null, Date.now() - startTime);
      return {
        success: true,
        organizationId,
        affiliateCode,
        action: 'skipped'
      };
    }

    // Apply changes
    const updateData = buildUpdateData(localOrg[0], clcOrg, conflicts);
    
    await db
      .update(organizations)
      .set({
        ...updateData,
        updatedAt: new Date()
      })
      .where(eq(organizations.id, organizationId));

    await logSync(
      organizationId,
      affiliateCode,
      'updated',
      changes,
      conflicts,
      Date.now() - startTime
    );

    return {
      success: true,
      organizationId,
      affiliateCode,
      action: 'updated',
      changes,
      conflicts
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logSync(
      organizationId,
      'unknown', // affiliateCode not available in catch scope
      'failed',
      null,
      null,
      Date.now() - startTime,
      errorMessage
    );

    return {
      success: false,
      organizationId,
      affiliateCode: 'unknown', // not available in catch scope
      action: 'failed',
      error: errorMessage
    };
  }
}

/**
 * Sync all organizations from CLC API (nightly job)
 */
export async function syncAllOrganizations(): Promise<SyncStatistics> {
  const startTime = Date.now();
  
  // Get all organizations with CLC affiliate codes
  const allOrgs = await db
    .select()
    .from(organizations)
    .where(isNotNull(organizations.charterNumber));

  const stats: SyncStatistics = {
    totalOrganizations: allOrgs.length,
    synced: 0,
    created: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    conflicts: 0,
    duration: 0
  };

  // Sync each organization
  for (const org of allOrgs) {
    const result = await syncOrganization(org.id);
    
    if (result.success) {
      stats.synced++;
      if (result.action === 'created') stats.created++;
      if (result.action === 'updated') stats.updated++;
      if (result.action === 'skipped') stats.skipped++;
      if (result.conflicts && result.conflicts.length > 0) {
        stats.conflicts += result.conflicts.length;
      }
    } else {
      stats.failed++;
    }

    // Rate limiting: 10 requests per second max
    await sleep(100);
  }

  stats.duration = Date.now() - startTime;

  // Log overall sync statistics
  logger.info('CLC Sync Completed', { stats });

  return stats;
}

/**
 * Create new organization from CLC data
 */
export async function createOrganizationFromCLC(
  affiliateCode: string
): Promise<SyncResult> {
  const startTime = Date.now();
  
  try {
    // Fetch from CLC API
    const clcOrg = await fetchCLCOrganization(affiliateCode);
    
    // Check if already exists
    const existing = await db
      .select()
      .from(organizations)
      .where(eq(organizations.charterNumber, affiliateCode))
      .limit(1);

    if (existing.length > 0) {
      return {
        success: false,
        organizationId: existing[0].id,
        affiliateCode,
        action: 'failed',
        error: 'Organization already exists'
      };
    }

    // Create organization
    const newOrg = await db
      .insert(organizations)
      .values({
        name: clcOrg.name,
        displayName: clcOrg.legalName, // Map legalName to displayName which exists in schema
        slug: clcOrg.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        organizationType: clcOrg.organizationType as any, // Type assertion for CLC data
        status: clcOrg.status,
        provinceTerritory: clcOrg.province,
        address: {
          city: clcOrg.city,
          postal_code: clcOrg.postalCode,
        },
        email: clcOrg.contactEmail,
        phone: clcOrg.contactPhone,
        charterNumber: clcOrg.affiliateCode,
        memberCount: clcOrg.membershipCount,
        hierarchyPath: [],
        hierarchyLevel: 0,
        clcAffiliated: true,
        updatedAt: new Date(),
      })
      .returning();

    await logSync(
      newOrg[0].id,
      affiliateCode,
      'created',
      ['Created from CLC data'],
      null,
      Date.now() - startTime
    );

    return {
      success: true,
      organizationId: newOrg[0].id,
      affiliateCode,
      action: 'created'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logSync(
      null,
      affiliateCode,
      'failed',
      null,
      null,
      Date.now() - startTime,
      errorMessage
    );

    return {
      success: false,
      organizationId: '',
      affiliateCode,
      action: 'failed',
      error: errorMessage
    };
  }
}

// ============================================================================
// WEBHOOK HANDLERS
// ============================================================================

/**
 * Handle incoming CLC webhook
 */
export async function handleWebhook(
  payload: CLCWebhookPayload
): Promise<{ success: boolean; message: string }> {
  // Verify webhook signature
  const isValid = verifyWebhookSignature(payload);
  if (!isValid) {
    await logWebhook(payload, 'rejected', 'Invalid signature');
    return { success: false, message: 'Invalid webhook signature' };
  }

  try {
    let result: SyncResult;

    switch (payload.type) {
      case 'organization.created':
        result = await handleOrganizationCreated(payload.data);
        break;
      
      case 'organization.updated':
        result = await handleOrganizationUpdated(payload.data);
        break;
      
      case 'organization.deleted':
        result = await handleOrganizationDeleted(payload.data);
        break;
      
      case 'membership.updated':
        result = await handleMembershipUpdated(payload.data);
        break;
      
      default:
        await logWebhook(payload, 'rejected', `Unknown webhook type: ${payload.type}`);
        return { success: false, message: 'Unknown webhook type' };
    }

    await logWebhook(payload, 'processed', result.success ? 'Success' : result.error || 'Failed');

    return {
      success: result.success,
      message: result.success ? `Webhook processed: ${result.action}` : result.error || 'Failed'
    };

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await logWebhook(payload, 'failed', errorMessage);
    return { success: false, message: errorMessage };
  }
}

async function handleOrganizationCreated(clcOrg: CLCOrganization): Promise<SyncResult> {
  return await createOrganizationFromCLC(clcOrg.affiliateCode);
}

async function handleOrganizationUpdated(clcOrg: CLCOrganization): Promise<SyncResult> {
  // Find local organization by affiliate code
  const localOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.charterNumber, clcOrg.affiliateCode))
    .limit(1);

  if (localOrg.length === 0) {
    // Create if doesn't exist
    return await createOrganizationFromCLC(clcOrg.affiliateCode);
  }

  // Sync existing organization
  return await syncOrganization(localOrg[0].id);
}

async function handleOrganizationDeleted(clcOrg: CLCOrganization): Promise<SyncResult> {
  const localOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.charterNumber, clcOrg.affiliateCode))
    .limit(1);

  if (localOrg.length === 0) {
    return {
      success: true,
      organizationId: '',
      affiliateCode: clcOrg.affiliateCode,
      action: 'skipped'
    };
  }

  // Soft delete: mark as inactive rather than hard delete
  await db
    .update(organizations)
    .set({
      status: 'inactive',
      updatedAt: new Date()
    })
    .where(eq(organizations.id, localOrg[0].id));

  return {
    success: true,
    organizationId: localOrg[0].id,
    affiliateCode: clcOrg.affiliateCode,
    action: 'updated',
    changes: ['Marked as inactive due to CLC deletion']
  };
}

async function handleMembershipUpdated(clcOrg: CLCOrganization): Promise<SyncResult> {
  const localOrg = await db
    .select()
    .from(organizations)
    .where(eq(organizations.charterNumber, clcOrg.affiliateCode))
    .limit(1);

  if (localOrg.length === 0) {
    return {
      success: false,
      organizationId: '',
      affiliateCode: clcOrg.affiliateCode,
      action: 'failed',
      error: 'Organization not found'
    };
  }

  // Update membership count
  await db
    .update(organizations)
    .set({
      memberCount: clcOrg.membershipCount,
      updatedAt: new Date()
    })
    .where(eq(organizations.id, localOrg[0].id));

  return {
    success: true,
    organizationId: localOrg[0].id,
    affiliateCode: clcOrg.affiliateCode,
    action: 'updated',
    changes: [`Updated membership count to ${clcOrg.membershipCount}`]
  };
}

// ============================================================================
// HELPER FUNCTIONS - CLC API
// ============================================================================

async function fetchCLCOrganization(affiliateCode: string): Promise<CLCOrganization> {
  const url = `${CLC_API_CONFIG.baseUrl}/organizations/${affiliateCode}`;
  
  const response = await fetchWithRetry(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CLC_API_CONFIG.apiKey}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`CLC API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  return data;
}

async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempts: number = 0
): Promise<Response> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), CLC_API_CONFIG.timeout);

    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    return response;

  } catch (error) {
    if (attempts < CLC_API_CONFIG.retryAttempts) {
      await sleep(CLC_API_CONFIG.retryDelay * Math.pow(2, attempts)); // Exponential backoff
      return fetchWithRetry(url, options, attempts + 1);
    }
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS - DATA COMPARISON
// ============================================================================

function compareOrganizations(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localOrg: any,
  clcOrg: CLCOrganization
): {
  hasChanges: boolean;
  changes: string[];
  conflicts: ConflictResolution[];
} {
  const changes: string[] = [];
  const conflicts: ConflictResolution[] = [];

  const fieldMap: Record<string, string> = {
    name: 'name',
    legalName: 'legalName',
    status: 'status',
    province: 'province',
    city: 'city',
    postalCode: 'postalCode',
    contactEmail: 'contactEmail',
    contactPhone: 'contactPhone',
    totalMembers: 'membershipCount'
  };

  for (const [localField, clcField] of Object.entries(fieldMap)) {
    const localValue = localOrg[localField];
    const clcValue = clcOrg[clcField as keyof CLCOrganization];

    if (localValue !== clcValue) {
      const resolution = CONFLICT_RULES[localField] || 'manual_review';
      
      conflicts.push({
        field: localField,
        localValue,
        clcValue,
        resolution,
        reason: getConflictReason(localField, resolution)
      });

      if (resolution === 'clc_wins') {
        changes.push(`${localField}: ${localValue} → ${clcValue}`);
      }
    }
  }

  return {
    hasChanges: changes.length > 0 || conflicts.some(c => c.resolution === 'manual_review'),
    changes,
    conflicts
  };
}

function buildUpdateData(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  localOrg: any,
  clcOrg: CLCOrganization,
  conflicts: ConflictResolution[]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Record<string, any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateData: Record<string, any> = {};

  for (const conflict of conflicts) {
    if (conflict.resolution === 'clc_wins') {
      updateData[conflict.field] = conflict.clcValue;
    }
    // 'local_wins' means keep current value (no update)
    // 'manual_review' means flag for admin review (no automatic update)
  }

  return updateData;
}

function getConflictReason(field: string, _resolution: string): string {
  const reasons: Record<string, string> = {
    name: 'CLC is authoritative source for official organization names',
    legalName: 'CLC is authoritative source for legal names',
    status: 'CLC controls organization status',
    affiliateCode: 'CLC is authoritative source for affiliate codes',
    contactEmail: 'Local contact information may be more current',
    contactPhone: 'Local contact information may be more current',
    totalMembers: 'CLC has authoritative membership data',
    perCapitaRate: 'Rate changes require manual administrative review'
  };

  return reasons[field] || 'Conflict requires manual review';
}

// ============================================================================
// HELPER FUNCTIONS - WEBHOOK VERIFICATION
// ============================================================================

/**
 * Verify webhook signature using HMAC
 * 
 * SECURITY: Protects against webhook spoofing attacks by verifying
 * that the webhook payload was signed by CLC using the shared secret.
 * Uses timing-safe comparison to prevent timing attacks.
 */
function verifyWebhookSignature(payload: CLCWebhookPayload): boolean {
  // Require webhook secret in production
  if (!WEBHOOK_SECRET) {
    logger.error('CLC_WEBHOOK_SECRET not configured - rejecting webhook');
    return false;
  }

  // Verify signature is present
  if (!payload.signature) {
    logger.error('Webhook payload missing signature');
    return false;
  }

  try {
    // Create payload copy without signature for verification
    const { signature, ...payloadWithoutSig } = payload;
    
    // Calculate expected signature
    const expectedSignature = createHmac('sha256', WEBHOOK_SECRET)
      .update(JSON.stringify(payloadWithoutSig))
      .digest('hex');
    
    // Use timing-safe comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    
    // Ensure both buffers are same length before comparison
    if (signatureBuffer.length !== expectedBuffer.length) {
      logger.error('Webhook signature length mismatch');
      return false;
    }
    
    const isValid = timingSafeEqual(signatureBuffer, expectedBuffer);
    
    if (!isValid) {
      logger.error('Webhook signature verification failed');
    }
    
    return isValid;
  } catch (error) {
    logger.error('Error verifying webhook signature', { error });
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS - LOGGING
// ============================================================================

async function logSync(
  organizationId: string | null,
  affiliateCode: string,
  action: string,
  changes: string[] | null,
  conflicts: ConflictResolution[] | null,
  duration: number,
  error?: string
): Promise<void> {
  try {
    await db.insert(clcOrganizationSyncLog).values({
      organizationId,
      affiliateCode,
      action,
      changes: changes ? changes.join('; ') : null,
      conflicts: conflicts || null,
      duration,
      error,
      syncedAt: new Date().toISOString(),
    });
    logger.info('Sync logged', { organizationId, affiliateCode, action });
  } catch (err) {
    logger.error('Failed to log sync', { error: err });
  }
}

async function logWebhook(
  payload: CLCWebhookPayload,
  status: 'processed' | 'rejected' | 'failed',
  message: string,
  processingDuration?: number
): Promise<void> {
  try {
    await db.insert(clcWebhookLog).values({
      webhookId: payload.id,
      type: payload.type,
      affiliateCode: payload.data.affiliateCode,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      payload: payload as any,
      status,
      message,
      processingDuration: processingDuration || null,
      receivedAt: payload.timestamp,
      processedAt: new Date().toISOString(),
    });
    logger.info('Webhook logged', { type: payload.type, status });
  } catch (err) {
    logger.error('Failed to log webhook', { error: err });
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// isNotNull is imported from drizzle-orm

// ============================================================================
// EXPORTS
// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  CLCOrganization,
  CLCWebhookPayload,
  SyncResult,
  ConflictResolution,
  SyncStatistics
};
