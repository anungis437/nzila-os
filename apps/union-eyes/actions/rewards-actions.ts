'use server';

/**
 * Recognition & Rewards Server Actions
 * Server-side actions for recognition and reward operations
 */

import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';
import { logger } from '@/lib/logger';
import * as rewardsService from '@/lib/services/rewards';
import {
  createProgramSchema,
  updateProgramSchema,
  createAwardTypeSchema,
  createAwardSchema,
  approveAwardSchema,
  issueAwardSchema,
  revokeAwardSchema,
  createBudgetEnvelopeSchema,
  initiateRedemptionSchema,
  cancelRedemptionSchema,
  paginationSchema,
  awardStatusQuerySchema,
  reportQuerySchema,
} from '@/lib/validation/rewards-schemas';
import { revalidatePath } from 'next/cache';

// =====================================================
// Helper: Get Current User's Organization ID
// =====================================================

async function getCurrentUserOrgId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Note: This is a lookup query to get org context, not tenant-scoped data
  // organizationMembers table maps users to orgs, so no RLS wrapper needed here
  const result = await db.query.organizationMembers.findFirst({
    where: (members, { eq }) => eq(members.userId, userId),
  });

  if (!result) throw new Error('User not associated with any organization');

  return result.organizationId;
}

async function checkAdminRole(): Promise<{ userId: string; orgId: string }> {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');

  // Note: This is a lookup query to get org context, not tenant-scoped data
  // organizationMembers table maps users to orgs, so no RLS wrapper needed here
  const member = await db.query.organizationMembers.findFirst({
    where: (members, { eq }) => eq(members.userId, userId),
  });

  if (!member) throw new Error('User not associated with any organization');
  if (!['admin', 'owner'].includes(member.role)) {
    throw new Error('Insufficient permissions');
  }

  return { userId, orgId: member.organizationId };
}

// =====================================================
// Program Actions
// =====================================================

export async function createRecognitionProgram(input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = createProgramSchema.parse(input);

    const program = await rewardsService.createProgram({
      orgId,
      ...validated,
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: program };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function updateRecognitionProgram(programId: string, input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = updateProgramSchema.parse(input);

    const program = await rewardsService.updateProgram(programId, orgId, validated);

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: program };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listRecognitionPrograms() {
  try {
    const orgId = await getCurrentUserOrgId();
    const programs = await rewardsService.listPrograms(orgId);

    return { success: true, data: programs };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =====================================================
// Award Type Actions
// =====================================================

export async function createRecognitionAwardType(input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = createAwardTypeSchema.parse(input);

    const awardType = await rewardsService.createAwardType({
      orgId,
      ...validated,
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: awardType };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listAwardTypes(programId: string) {
  try {
    const orgId = await getCurrentUserOrgId();
    const awardTypes = await rewardsService.listAwardTypes(programId, orgId);

    return { success: true, data: awardTypes };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =====================================================
// Award Actions
// =====================================================

export async function createAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = createAwardSchema.parse(input);

    const award = await rewardsService.createAwardRequest({
      orgId,
      issuerUserId: userId,
      ...validated,
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: award };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function approveAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = approveAwardSchema.parse(input);

    const award = await rewardsService.approveAward({
      ...validated,
      orgId,
      approvedByUserId: userId,
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: award };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function issueAward(input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = issueAwardSchema.parse(input);

    const result = await rewardsService.issueAward({
      ...validated,
      orgId,
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    revalidatePath('/[locale]/dashboard/rewards'); // Member wallet view
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function revokeAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = revokeAwardSchema.parse(input);

    const result = await rewardsService.revokeAward({
      ...validated,
      orgId,
      revokedByUserId: userId,
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    revalidatePath('/[locale]/dashboard/rewards');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listAwardsByStatus(input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = awardStatusQuerySchema.parse(input);

    const awards = await rewardsService.listAwardsByStatus(
      orgId,
      validated.statuses,
      validated.limit,
      validated.offset
    );

    return { success: true, data: awards };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listMyAwards(input?: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const orgId = await getCurrentUserOrgId();
    const validated = paginationSchema.parse(input || {});

    const awards = await rewardsService.listUserAwards(
      orgId,
      userId,
      validated.limit,
      validated.offset
    );

    return { success: true, data: awards };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =====================================================
// Budget Actions
// =====================================================

export async function createBudgetEnvelope(input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = createBudgetEnvelopeSchema.parse(input);

    const envelope = await rewardsService.createBudgetEnvelope({
      orgId,
      ...validated,
      startsAt: new Date(validated.startsAt),
      endsAt: new Date(validated.endsAt),
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: envelope };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listBudgetEnvelopes(programId: string, activeOnly = false) {
  try {
    const { orgId } = await checkAdminRole();
    const envelopes = await rewardsService.listBudgetEnvelopes(programId, orgId, activeOnly);

    return { success: true, data: envelopes };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getBudgetUsageSummary(programId?: string) {
  try {
    const { orgId } = await checkAdminRole();
    const summary = await rewardsService.getBudgetUsageSummary(orgId, programId);

    return { success: true, data: summary };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =====================================================
// Wallet Actions
// =====================================================

export async function getMyWalletBalance() {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const orgId = await getCurrentUserOrgId();
    const balance = await rewardsService.getBalance(orgId, userId);

    return { success: true, data: { balance } };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function getMyWalletLedger(input?: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const orgId = await getCurrentUserOrgId();
    const validated = paginationSchema.parse(input || {});

    const result = await rewardsService.listLedger(
      orgId,
      userId,
      validated.limit,
      validated.offset
    );

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =====================================================
// Redemption Actions
// =====================================================

export async function initiateRedemption(input: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const orgId = await getCurrentUserOrgId();
    const validated = initiateRedemptionSchema.parse(input);

    // Initiate redemption (deducts credits)
    const redemption = await rewardsService.initiateRedemption({
      orgId,
      userId,
      ...validated,
      provider: 'shopify' as const,
    });

    // If Shopify is enabled, create discount code and checkout URL
    let checkoutUrl: string | undefined;
    let discountCode: string | undefined;
    if (process.env.SHOPIFY_ENABLED === 'true') {
      try {
        const { createDiscountCode, createCheckoutSession } = await import(
          '@/lib/services/rewards/shopify-service'
        );

        // Create discount code for the redemption amount
        const discount = await createDiscountCode(
          redemption.id,
          validated.creditsToSpend,
          'CAD'
        );
        discountCode = discount.code;

        // Generate checkout URL with pre-applied discount
        const session = await createCheckoutSession(discount.code);
        checkoutUrl = session.checkoutUrl;

        // Update redemption with checkout details
        await rewardsService.updateRedemptionCheckout(
          redemption.id,
          orgId,
          discount.code,
          checkoutUrl || ''
        );
      } catch (shopifyError) {
        logger.error('Shopify integration error during redemption', shopifyError as Error, {
          discountCode: discountCode ?? 'unknown',
          redemptionId: redemption.id,
        });
        // Continue without Shopify - redemption is still valid
      }
    }

    revalidatePath('/[locale]/dashboard/rewards');
    return { 
      success: true, 
      data: { 
        ...redemption, 
        checkout_url: checkoutUrl 
      } 
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function cancelRedemption(input: unknown) {
  try {
    const orgId = await getCurrentUserOrgId();
    const validated = cancelRedemptionSchema.parse(input);

    const result = await rewardsService.cancelRedemption(
      validated.redemptionId,
      orgId,
      validated.reason
    );

    revalidatePath('/[locale]/dashboard/rewards');
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

export async function listMyRedemptions(input?: unknown) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error('Unauthorized');

    const orgId = await getCurrentUserOrgId();
    const validated = paginationSchema.parse(input || {});

    const result = await rewardsService.listUserRedemptions(
      orgId,
      userId,
      validated.limit,
      validated.offset
    );

    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

// =====================================================
// Reporting Actions (Admin)
// =====================================================

export async function getRewardsSummary(input?: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = reportQuerySchema.parse(input || {});

    const startDate = validated.startDate ? new Date(validated.startDate) : undefined;
    const endDate = validated.endDate ? new Date(validated.endDate) : undefined;

    const ledgerSummary = await rewardsService.getLedgerSummary(orgId, startDate, endDate);
    const budgetSummary = await rewardsService.getBudgetUsageSummary(orgId, validated.programId);

    return {
      success: true,
      data: {
        ...ledgerSummary,
        budgetUsage: budgetSummary,
      },
    };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}

