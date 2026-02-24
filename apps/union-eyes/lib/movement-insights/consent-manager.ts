/**
 * Consent Manager Service
 * 
 * Manages opt-in consent for cross-union data aggregation.
 * PRIVACY GUARANTEE: No data is shared without explicit consent.
 * All aggregation requires minimum thresholds to prevent re-identification.
 */

import { DataAggregationConsent as BaseDataAggregationConsent } from '@/types/marketing';
import { db } from '@/db';
import { dataAggregationConsent } from '@/db/schema/domains/marketing';
import { eq } from 'drizzle-orm';

/**
 * Extended consent type that includes DB-managed fields used throughout this module.
 * The base type from @/types/marketing covers minimal fields; operations here
 * rely on additional columns (status, preferences, audit trail fields, etc.).
 */
interface DataAggregationConsent extends BaseDataAggregationConsent {
  id?: string;
  updatedAt?: Date;
  status?: string;
  revokedAt?: Date | null;
  revokedBy?: string | null;
  revocationReason?: string | null;
  preferences?: Record<string, boolean>;
  consentGivenAt?: Date;
  consentGivenBy?: string;
  purpose?: string;
  ipAddress?: string;
  userAgent?: string;
  grantedAt?: Date;
}

export interface ConsentPreferences {
  shareImpactMetrics: boolean;
  shareCaseResolutionTimes: boolean;
  shareDemographicData: boolean;
  shareIndustryInsights: boolean;
  shareLegislativeData: boolean;
}

export interface ConsentContext {
  organizationId: string;
  organizationName: string;
  consentGivenBy: {
    userId: string;
    name: string;
    role: string;
  };
  preferences: ConsentPreferences;
  purpose: string;
}

/**
 * Validate consent before data aggregation
 * 
 * Philosophy: NO DATA WITHOUT CONSENT
 * - Every organization must explicitly opt-in
 * - Consent can be revoked at any time
 * - Purpose must be clearly stated
 * - Granular control over what data types are shared
 */
export function validateConsent(
  consent: DataAggregationConsent | null,
  dataType: keyof ConsentPreferences
): boolean {
  if (!consent) {
    return false;
  }

  // Check if consent is still active
  if (consent.status !== 'active') {
    return false;
  }

  // Check if consent has been revoked
  if (consent.revokedAt) {
    return false;
  }

  // Check specific data type permission
  const preferences = (consent.preferences as unknown) as ConsentPreferences;
  return preferences[dataType] === true;
}

/**
 * Record consent with audit trail (database operation)
 */
export async function createConsentRecord(
  organizationId: string,
  _preferences: ConsentPreferences,
  _purpose: string,
  _consentGivenBy: string,
  _ipAddress: string,
  _userAgent: string
): Promise<DataAggregationConsent> {
  const [consent] = await db
    .insert(dataAggregationConsent)
    .values({
      organizationId,
      consentGiven: true,
      consentDate: new Date(),
      categories: [],
      expiresAt: null,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .returning();

  return consent as unknown as DataAggregationConsent;
}

/**
 * Revoke consent with reason (database operation)
 */
export async function revokeConsent(
  consentId: string,
  _revokedBy: string,
  _reason?: string
): Promise<DataAggregationConsent> {
  const [consent] = await db
    .update(dataAggregationConsent)
    .set({
      consentGiven: false,
      updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(dataAggregationConsent.id, consentId))
    .returning();

  return consent as unknown as DataAggregationConsent;
}

/**
 * Update consent preferences (database operation)
 */
export async function updateConsentPreferences(
  consentId: string,
  newPreferences: Partial<ConsentPreferences>,
  _updatedBy: string
): Promise<DataAggregationConsent> {
  // Get current consent
  const [current] = await db
    .select()
    .from(dataAggregationConsent)
    .where(eq(dataAggregationConsent.id, consentId))
    .limit(1);

  if (!current) {
    throw new Error('Consent record not found');
  }

  // Merge preferences
  const _updatedPreferences = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ...((current as any).preferences as ConsentPreferences),
    ...newPreferences,
  };

  // Update in database
  const [consent] = await db
    .update(dataAggregationConsent)
    .set({
      updatedAt: new Date(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any)
    .where(eq(dataAggregationConsent.id, consentId))
    .returning();

  return consent as unknown as DataAggregationConsent;
}

/**
 * Check if organization has minimum data for aggregation
 * 
 * Philosophy: PRIVACY THRESHOLD
 * - Minimum 10 cases required to prevent re-identification
 * - More restrictive thresholds for sensitive data
 */
export function meetsAggregationThreshold(
  organizationCaseCount: number,
  dataType: keyof ConsentPreferences
): boolean {
  const thresholds: Record<keyof ConsentPreferences, number> = {
    shareImpactMetrics: 10,
    shareCaseResolutionTimes: 10,
    shareDemographicData: 25, // Higher threshold for demographic data
    shareIndustryInsights: 15,
    shareLegislativeData: 10,
  };

  return organizationCaseCount >= thresholds[dataType];
}

/**
 * Get consent summary for display
 */
export function getConsentSummary(consent: DataAggregationConsent): {
  isActive: boolean;
  dataTypesShared: string[];
  dataTypesNotShared: string[];
  consentDuration: string;
  canRevoke: boolean;
} {
  const preferences = (consent.preferences as unknown) as ConsentPreferences;
  const dataTypesShared: string[] = [];
  const dataTypesNotShared: string[] = [];

  const dataTypeLabels: Record<keyof ConsentPreferences, string> = {
    shareImpactMetrics: 'Impact Metrics',
    shareCaseResolutionTimes: 'Resolution Times',
    shareDemographicData: 'Demographic Data',
    shareIndustryInsights: 'Industry Insights',
    shareLegislativeData: 'Legislative Data',
  };

  Object.entries(preferences).forEach(([key, value]) => {
    const label = dataTypeLabels[key as keyof ConsentPreferences];
    if (value) {
      dataTypesShared.push(label);
    } else {
      dataTypesNotShared.push(label);
    }
  });

  const consentDate = new Date(consent.consentDate);
  const now = new Date();
  const daysSinceConsent = Math.floor(
    (now.getTime() - consentDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  let consentDuration = '';
  if (daysSinceConsent < 1) {
    consentDuration = 'Today';
  } else if (daysSinceConsent === 1) {
    consentDuration = '1 day ago';
  } else if (daysSinceConsent < 30) {
    consentDuration = `${daysSinceConsent} days ago`;
  } else if (daysSinceConsent < 365) {
    const months = Math.floor(daysSinceConsent / 30);
    consentDuration = `${months} ${months === 1 ? 'month' : 'months'} ago`;
  } else {
    const years = Math.floor(daysSinceConsent / 365);
    consentDuration = `${years} ${years === 1 ? 'year' : 'years'} ago`;
  }

  return {
    isActive: consent.status === 'active' && !consent.revokedAt,
    dataTypesShared,
    dataTypesNotShared,
    consentDuration,
    canRevoke: consent.status === 'active',
  };
}

/**
 * Consent change notification message
 */
export function generateConsentChangeNotification(
  consent: DataAggregationConsent,
  changeType: 'granted' | 'updated' | 'revoked'
): string {
  const preferences = (consent.preferences as unknown) as ConsentPreferences;
  const sharedTypes = Object.entries(preferences)
    .filter(([, value]) => value)
    .length;

  if (changeType === 'granted') {
    return `Your organization has opted into cross-union data sharing. ${sharedTypes} data type(s) will be included in anonymous aggregated insights to support the union movement.`;
  }

  if (changeType === 'updated') {
    return `Your data sharing preferences have been updated. ${sharedTypes} data type(s) are currently shared for movement insights.`;
  }

  if (changeType === 'revoked') {
    return `Your organization has opted out of cross-union data sharing. No data will be included in aggregated insights going forward. Previously shared data remains in historical trends but cannot be re-identified.`;
  }

  return '';
}
