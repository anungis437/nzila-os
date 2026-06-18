/**
 * Typed DTOs for Union-Eyes actions layer
 *
 * All action return types and input shapes are defined here so that
 * server actions never use `any` for their public API surface.
 */

import { z } from 'zod';

// ---------------------------------------------------------------------------
// 1. Shared primitives
// ---------------------------------------------------------------------------

export type UserRole = 'member' | 'steward' | 'officer' | 'admin';

export const UserRoleSchema = z.enum(['member', 'steward', 'officer', 'admin']);

// ---------------------------------------------------------------------------
// 2. Admin action DTOs
// ---------------------------------------------------------------------------

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  organizationId: string;
  orgName: string;
  status: 'active' | 'inactive';
  lastLogin: string | null;
  joinedAt: string | null;
}

export interface OrgWithStats {
  id: string;
  slug: string;
  name: string;
  status: string;
  subscriptionTier: string;
  totalUsers: number;
  activeUsers: number;
  storageUsed: string;
  createdAt: string;
  contactEmail: string | null;
  phone: string | null;
}

export interface SystemStats {
  totalMembers: number;
  totalOrgs: number;
  activeOrgs: number;
  totalStorage: number;
  activeToday: number;
}

export interface SystemConfig {
  category: string;
  key: string;
  value: any;
  description: string | null;
}

export interface ActivityLogEntry {
  action: string;
  user: string;
  org: string;
  role: string;
  timestamp: string | undefined;
}

export const CreateOrgInputSchema = z.object({
  slug: z.string().min(1).max(100),
  name: z.string().min(1).max(255),
  email: z.string().email(),
  phone: z.string().optional(),
  subscriptionTier: z.string().optional(),
});
export type CreateOrgInput = z.infer<typeof CreateOrgInputSchema>;

export const UpdateOrgInputSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  status: z.string().optional(),
  subscriptionTier: z.string().optional(),
});
export type UpdateOrgInput = z.infer<typeof UpdateOrgInputSchema>;

export const UpdateRoleInputSchema = z.object({
  userId: z.string().min(1),
  organizationId: z.string().uuid(),
  newRole: UserRoleSchema,
});

export const UpdateConfigInputSchema = z.object({
  organizationId: z.string().uuid(),
  category: z.string().min(1),
  key: z.string().min(1),
  value: z.unknown(),
});

// ---------------------------------------------------------------------------
// 3. Credits action DTOs
// ---------------------------------------------------------------------------

export interface UserProfile {
  userId: string;
  membership: 'free' | 'pro';
  usageCredits: number | null;
  usedCredits: number | null;
  nextCreditRenewal: Date | string | null;
  billingCycleEnd: Date | string | null;
  /** Allow extra DB columns to pass through without type errors */
  [key: string]: any;
}

export interface CreditCheckResult {
  hasCredits: boolean;
  profile: UserProfile | null;
  error?: string;
}

export interface CreditUseResult {
  success: boolean;
  profile?: UserProfile;
  error?: string;
}

export interface CreditStatus {
  total: number;
  used: number;
  remaining: number;
  nextBillingDate: Date | null;
  nextCreditRenewal: Date | null;
  membership: string;
  error?: string;
}

export interface PremiumFeatureResult<T> {
  success: boolean;
  data?: T;
  error?: string;
  creditsRemaining?: number;
}

export const PremiumFeatureOptionsSchema = z.object({
  creditsRequired: z.number().int().min(1),
  featureName: z.string().min(1),
});

// ---------------------------------------------------------------------------
// 4. Analytics action DTOs
// ---------------------------------------------------------------------------

export interface AnalyticsMetric {
  id: string;
  organizationId: string;
  metricName: string;
  metricValue: number;
  metricUnit: string | null;
  category: string | null;
  recordedAt: Date | string;
  metadata: Record<string, unknown> | null;
}

export const RecordMetricInputSchema = z.object({
  metricName: z.string().min(1),
  metricValue: z.number(),
  metricUnit: z.string().optional(),
  category: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const DateRangeSchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  category: z.string().optional(),
});

// ---------------------------------------------------------------------------
// 5. Member segment DTOs
// ---------------------------------------------------------------------------

export interface MemberSegment {
  id: string;
  name: string;
  description: string | null;
  criteria: Record<string, unknown>;
  memberCount: number;
  createdAt: string;
}

export interface SegmentMember {
  id: string;
  name: string;
  email: string;
  role: string;
  joinedAt: string | null;
}

export const CreateSegmentInputSchema = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  criteria: z.record(z.unknown()),
});

// ---------------------------------------------------------------------------
// 6. Whop action DTOs
// ---------------------------------------------------------------------------

export interface PendingProfile {
  id: string;
  userId: string;
  email: string;
  displayName: string | null;
  status: string;
  createdAt: string;
}

export const WhopWebhookPayloadSchema = z.object({
  event: z.string(),
  data: z.record(z.unknown()),
});

// ---------------------------------------------------------------------------
// 7. Generic action result (re-export from types/)
// ---------------------------------------------------------------------------

export type { ActionResult } from '@/types';
