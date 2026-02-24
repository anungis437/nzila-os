/**
 * Member Data Utilities
 * Helper functions for fetching member/profile information
 * 
 * Part of Week 2 P1 Implementation - Dashboard Data Loading Fixes
 */

import { db } from '@/db/db';
import { profilesTable } from '@/db/schema/domains/member';
import { eq } from 'drizzle-orm';

export interface MemberDetails {
  userId: string;
  name: string;
  email: string;
  phone: string | null;
  memberNumber: string | null;
  status: string;
}

/**
 * Get member details by user ID
 */
export async function getMemberDetailsByUserId(userId: string): Promise<MemberDetails | null> {
  try {
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userId))
      .limit(1);

    if (profiles.length === 0) {
      return null;
    }

    const profile = profiles[0];
    
    return {
      userId: profile.userId,
      name: profile.email || 'Unknown Member', // Profile table doesn&apos;t have displayName
      email: profile.email || '',
      phone: null, // Profile table doesn&apos;t have phoneNumber - use users table for phone
      memberNumber: null, // Profile table doesn&apos;t have memberNumber
      status: profile.status || 'active', // This is payment status, not member status
    };
  } catch (_error) {
return null;
  }
}

/**
 * Get member details by member ID (UUID)
 */
export async function getMemberDetailsById(memberId: string): Promise<MemberDetails | null> {
  try {
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, memberId)) // Profile table doesn&apos;t have 'id', uses 'userId'
      .limit(1);

    if (profiles.length === 0) {
      return null;
    }

    const profile = profiles[0];
    
    return {
      userId: profile.userId,
      name: profile.email || 'Unknown Member', // Profile table doesn&apos;t have displayName
      email: profile.email || '',
      phone: null, // Profile table doesn&apos;t have phoneNumber - use users table for phone
      memberNumber: null, // Profile table doesn&apos;t have memberNumber
      status: profile.status || 'active', // This is payment status, not member status
    };
  } catch (_error) {
return null;
  }
}

/**
 * Get basic member info for display (name only)
 */
export async function getMemberName(userId: string): Promise<string> {
  const details = await getMemberDetailsByUserId(userId);
  return details?.name || 'Unknown Member';
}

/**
 * Batch fetch member details for multiple user IDs
 */
export async function batchGetMemberDetails(userIds: string[]): Promise<Map<string, MemberDetails>> {
  const memberMap = new Map<string, MemberDetails>();
  
  if (userIds.length === 0) {
    return memberMap;
  }

  try {
    // Fetch all profiles in one query
    const profiles = await db
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.userId, userIds[0])); // Will need to use `inArray` for multiple

    profiles.forEach(profile => {
      memberMap.set(profile.userId, {
        userId: profile.userId,
        name: profile.email || 'Unknown Member', // Profile table doesn&apos;t have displayName
        email: profile.email || '',
        phone: null, // Profile table doesn&apos;t have phoneNumber - use users table for phone
        memberNumber: null, // Profile table doesn&apos;t have memberNumber
        status: profile.status || 'active', // This is payment status, not member status
      });
    });
  } catch (_error) {
}

  return memberMap;
}
