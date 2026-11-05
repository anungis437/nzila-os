'use server';

/**
 * Recognition & Rewards Server Actions
 * Server-side actions for recognition and reward operations
 *
 * Every rewards table is a tenant table: outside the organization's own transaction the database handle has no organization set and
 * row-level security shows each of them as empty. So every database read or write below runs in withRLSContext({ organizationId }),
 * the organization comes from the verified membership of the signed-in user (never from the form), and a write is audited on the same
 * transaction. The Shopify calls are HTTP and stay outside any transaction.
 */

import { auth } from '@nzila/platform-auth/entra/server';
import { and, eq, isNull } from 'drizzle-orm';
import { organizationMembers } from '@/db/schema';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { getOrganizationIdForUser } from '@/lib/organization-utils';
import { isUuid } from '@/lib/page-data/uuid';
import { logger } from '@/lib/logger';
import { safeActionMessage } from '@/lib/actions/safe-action-error';
import { UserFacingError } from '@/lib/errors/user-facing-error';
import * as rewardsService from '@/lib/services/rewards';
import { auditRewards } from '@/lib/services/rewards/audit';
import {
  createProgramSchema,
  updateProgramSchema,
  createAwardTypeSchema,
  createAwardSchema,
  nominatePeerSchema,
  approveAwardSchema,
  issueAwardSchema,
  revokeAwardSchema,
  rejectAwardSchema,
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

// IMPORTANT: does NOT trust auth()'s `orgId` — for Entra-backed sessions
// that value is the Azure AD security-group GUID (activeOrgId), not the
// app-level organizations.id UUID. getOrganizationIdForUser() always
// resolves via a verified organization_members row instead.
async function getCurrentUserOrgId(): Promise<string> {
  const userId = await requireUserId();

  return getOrganizationIdForUser(userId);
}

/** The signed-in user. A caller with no session is told so; nothing else about why. */
async function requireUserId(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new UserFacingError('Unauthorized');
  return userId;
}

async function checkAdminRole(): Promise<{ userId: string; orgId: string }> {
  const userId = await requireUserId();

  const resolvedOrgId = await getCurrentUserOrgId();

  const member = await withRLSContext({ organizationId: resolvedOrgId }, async (rlsDb) =>
    rlsDb.query.organizationMembers.findFirst({
      where: (members, { eq, and }) => and(
        eq(members.userId, userId),
        eq(members.organizationId, resolvedOrgId),
      ),
    })
  );

  if (!member) throw new UserFacingError('User not associated with any organization');
  const adminRoles = ['admin', 'owner', 'platform_admin', 'local_admin', 'president', 'federation_exec', 'national_officer', 'app_owner', 'system_admin'];
  if (!adminRoles.includes(member.role)) {
    throw new UserFacingError('Insufficient permissions');
  }

  return { userId, orgId: resolvedOrgId };
}

/** Run rewards statements in the organization's own transaction. The services take the transaction from the context (savepoints nest in it). */
function inOrganization<T>(orgId: string, work: (tx: RLSTx) => Promise<T>): Promise<T> {
  return withRLSContext({ organizationId: orgId }, work);
}

/** What an action returns for a failure: its own words for a domain or validation error, a generic message and a logged reference for anything else. */
function failure(error: unknown, action: string): { success: false; error: string } {
  return { success: false, error: safeActionMessage(error, { action: `rewards.${action}` }) };
}

/** A program or award id the form sends that is not even a uuid names nothing of this organization's. */
function requireUuid(value: string, what: string): void {
  if (!isUuid(value)) throw new UserFacingError(`${what} not found`);
}

/** An award goes to a current member of the organization that issues it: the ledger and the wallet are the organization's own. */
async function requireActiveMember(tx: RLSTx, orgId: string, memberUserId: string): Promise<void> {
  const member = await tx.query.organizationMembers.findFirst({
    columns: { id: true },
    where: and(
      eq(organizationMembers.organizationId, orgId),
      eq(organizationMembers.userId, memberUserId),
      eq(organizationMembers.status, 'active'),
      isNull(organizationMembers.deletedAt),
    ),
  });
  if (!member) throw new UserFacingError('Recipient is not an active member of this organization');
}

// =====================================================
// Program Actions
// =====================================================

export async function createRecognitionProgram(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = createProgramSchema.parse(input);

    const program = await inOrganization(orgId, async (tx) => {
      const created = await rewardsService.createProgram({
        orgId,
        ...validated,
      });
      await auditRewards(tx, {
        organizationId: orgId,
        userId,
        action: 'rewards.program.create',
        resourceType: 'recognition_programs',
        resourceId: created.id,
        details: { name: created.name, status: created.status },
      });
      return created;
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: program };
  } catch (error) {
    return failure(error, 'createRecognitionProgram');
  }
}

export async function updateRecognitionProgram(programId: string, input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    requireUuid(programId, 'Program');
    const validated = updateProgramSchema.parse(input);

    const program = await inOrganization(orgId, async (tx) => {
      const updated = await rewardsService.updateProgram(programId, orgId, validated);
      // An update that matched no row is a program of another organization or none at all, never a success.
      if (!updated) throw new UserFacingError('Program not found');
      await auditRewards(tx, {
        organizationId: orgId,
        userId,
        action: 'rewards.program.update',
        resourceType: 'recognition_programs',
        resourceId: programId,
        details: { changed: Object.keys(validated) },
      });
      return updated;
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: program };
  } catch (error) {
    return failure(error, 'updateRecognitionProgram');
  }
}

export async function listRecognitionPrograms() {
  try {
    const orgId = await getCurrentUserOrgId();
    const programs = await inOrganization(orgId, () => rewardsService.listPrograms(orgId));

    return { success: true, data: programs };
  } catch (error) {
    return failure(error, 'listRecognitionPrograms');
  }
}

// =====================================================
// Award Type Actions
// =====================================================

export async function createRecognitionAwardType(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = createAwardTypeSchema.parse(input);

    const awardType = await inOrganization(orgId, async (tx) => {
      // The program id comes from the form and the foreign key only proves that some program has it: it must be this organization's.
      const program = await rewardsService.getProgramById(validated.programId, orgId);
      if (!program) throw new UserFacingError('Program not found');

      const created = await rewardsService.createAwardType({
        orgId,
        ...validated,
      });
      await auditRewards(tx, {
        organizationId: orgId,
        userId,
        action: 'rewards.award_type.create',
        resourceType: 'recognition_award_types',
        resourceId: created.id,
        details: {
          programId: validated.programId,
          name: validated.name,
          kind: validated.kind,
          defaultCreditAmount: validated.defaultCreditAmount,
          requiresApproval: validated.requiresApproval,
        },
      });
      return created;
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: awardType };
  } catch (error) {
    return failure(error, 'createRecognitionAwardType');
  }
}

export async function listAwardTypes(programId: string) {
  try {
    const orgId = await getCurrentUserOrgId();
    requireUuid(programId, 'Program');
    const awardTypes = await inOrganization(orgId, () => rewardsService.listAwardTypes(programId, orgId));

    return { success: true, data: awardTypes };
  } catch (error) {
    return failure(error, 'listAwardTypes');
  }
}

// =====================================================
// Award Actions
// =====================================================

export async function createAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = createAwardSchema.parse(input);

    const award = await inOrganization(orgId, async (tx) => {
      await requireActiveMember(tx, orgId, validated.recipientUserId);
      return rewardsService.createAwardRequest({
        orgId,
        issuerUserId: userId,
        ...validated,
      });
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: award };
  } catch (error) {
    return failure(error, 'createAward');
  }
}

/**
 * A member nominates a colleague for a peer award. Any signed-in member of an organization may: the organization is the one they belong to, the
 * recipient must be a current member of it, and the nomination is stored as a pending award for an administrator to approve or reject. The
 * caller gets back the row's id and status, and a success only when that row was written.
 */
export async function nominatePeer(input: unknown) {
  try {
    const userId = await requireUserId();
    const orgId = await getCurrentUserOrgId();
    const validated = nominatePeerSchema.parse(input);

    const nomination = await inOrganization(orgId, async (tx) => {
      await requireActiveMember(tx, orgId, validated.recipientUserId);
      return rewardsService.createPeerNomination({
        orgId,
        nominatorUserId: userId,
        awardTypeId: validated.awardTypeId,
        recipientUserId: validated.recipientUserId,
        reason: validated.reason,
      });
    });

    // A success is a stored row: no row, no success.
    if (!nomination?.id) throw new Error('The nomination was not stored');

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: { id: nomination.id, status: nomination.status } };
  } catch (error) {
    return failure(error, 'nominatePeer');
  }
}

export async function approveAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = approveAwardSchema.parse(input);

    const award = await inOrganization(orgId, () =>
      rewardsService.approveAward({
        ...validated,
        orgId,
        approvedByUserId: userId,
      }),
    );

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: award };
  } catch (error) {
    return failure(error, 'approveAward');
  }
}

export async function issueAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = issueAwardSchema.parse(input);

    // The issuing administrator is the audited actor; without it the issuance is recorded as the rewards automation's.
    const result = await inOrganization(orgId, () =>
      rewardsService.issueAward({
        ...validated,
        orgId,
        approvedByUserId: userId,
      }),
    );

    revalidatePath('/[locale]/dashboard/admin/rewards');
    revalidatePath('/[locale]/dashboard/rewards'); // Member wallet view
    return { success: true, data: result };
  } catch (error) {
    return failure(error, 'issueAward');
  }
}

export async function revokeAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = revokeAwardSchema.parse(input);

    const result = await inOrganization(orgId, () =>
      rewardsService.revokeAward({
        ...validated,
        orgId,
        revokedByUserId: userId,
      }),
    );

    revalidatePath('/[locale]/dashboard/admin/rewards');
    revalidatePath('/[locale]/dashboard/rewards');
    return { success: true, data: result };
  } catch (error) {
    return failure(error, 'revokeAward');
  }
}

export async function rejectAward(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = rejectAwardSchema.parse(input);

    const result = await inOrganization(orgId, () =>
      rewardsService.rejectAward(validated.awardId, orgId, userId, validated.reason),
    );

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: result };
  } catch (error) {
    return failure(error, 'rejectAward');
  }
}

export async function listAwardsByStatus(input: unknown) {
  try {
    const { orgId } = await checkAdminRole();
    const validated = awardStatusQuerySchema.parse(input);

    const awards = await inOrganization(orgId, () =>
      rewardsService.listAwardsByStatus(
        orgId,
        validated.statuses,
        validated.limit,
        validated.offset
      ),
    );

    return { success: true, data: awards };
  } catch (error) {
    return failure(error, 'listAwardsByStatus');
  }
}

export async function listMyAwards(input?: unknown) {
  try {
    const userId = await requireUserId();

    const orgId = await getCurrentUserOrgId();
    const validated = paginationSchema.parse(input || {});

    const awards = await inOrganization(orgId, () =>
      rewardsService.listUserAwards(
        orgId,
        userId,
        validated.limit,
        validated.offset
      ),
    );

    return { success: true, data: awards };
  } catch (error) {
    return failure(error, 'listMyAwards');
  }
}

// =====================================================
// Budget Actions
// =====================================================

export async function createBudgetEnvelope(input: unknown) {
  try {
    const { userId, orgId } = await checkAdminRole();
    const validated = createBudgetEnvelopeSchema.parse(input);

    const envelope = await inOrganization(orgId, async (tx) => {
      const created = await rewardsService.createBudgetEnvelope({
        orgId,
        ...validated,
        startsAt: new Date(validated.startsAt),
        endsAt: new Date(validated.endsAt),
      });
      await auditRewards(tx, {
        organizationId: orgId,
        userId,
        action: 'rewards.budget_envelope.create',
        resourceType: 'reward_budget_envelopes',
        resourceId: created.id,
        details: {
          programId: validated.programId,
          name: validated.name,
          period: validated.period,
          amountLimit: validated.amountLimit,
        },
      });
      return created;
    });

    revalidatePath('/[locale]/dashboard/admin/rewards');
    return { success: true, data: envelope };
  } catch (error) {
    return failure(error, 'createBudgetEnvelope');
  }
}

export async function listBudgetEnvelopes(programId: string, activeOnly = false) {
  try {
    const { orgId } = await checkAdminRole();
    requireUuid(programId, 'Program');
    const envelopes = await inOrganization(orgId, () =>
      rewardsService.listBudgetEnvelopes(programId, orgId, activeOnly),
    );

    return { success: true, data: envelopes };
  } catch (error) {
    return failure(error, 'listBudgetEnvelopes');
  }
}

export async function getBudgetUsageSummary(programId?: string) {
  try {
    const { orgId } = await checkAdminRole();
    if (programId !== undefined) requireUuid(programId, 'Program');
    const summary = await inOrganization(orgId, () => rewardsService.getBudgetUsageSummary(orgId, programId));

    return { success: true, data: summary };
  } catch (error) {
    return failure(error, 'getBudgetUsageSummary');
  }
}

// =====================================================
// Wallet Actions
// =====================================================

export async function getMyWalletBalance() {
  try {
    const userId = await requireUserId();

    const orgId = await getCurrentUserOrgId();
    const balance = await inOrganization(orgId, () => rewardsService.getBalance(orgId, userId));

    return { success: true, data: { balance } };
  } catch (error) {
    return failure(error, 'getMyWalletBalance');
  }
}

export async function getMyWalletLedger(input?: unknown) {
  try {
    const userId = await requireUserId();

    const orgId = await getCurrentUserOrgId();
    const validated = paginationSchema.parse(input || {});

    const result = await inOrganization(orgId, () =>
      rewardsService.listLedger(
        orgId,
        userId,
        validated.limit,
        validated.offset
      ),
    );

    return { success: true, data: result };
  } catch (error) {
    return failure(error, 'getMyWalletLedger');
  }
}

// =====================================================
// Redemption Actions
// =====================================================

export async function initiateRedemption(input: unknown) {
  try {
    const userId = await requireUserId();

    const orgId = await getCurrentUserOrgId();
    const validated = initiateRedemptionSchema.parse(input);

    // Initiate redemption (deducts credits). The program id comes from the form: it must be one of this organization's programs.
    const redemption = await inOrganization(orgId, async () => {
      const program = await rewardsService.getProgramById(validated.programId, orgId);
      if (!program) throw new UserFacingError('Program not found');

      return rewardsService.initiateRedemption({
        orgId,
        userId,
        ...validated,
        provider: 'shopify' as const,
      });
    });

    // If Shopify is enabled, create discount code and checkout URL
    let checkoutUrl: string | undefined;
    let discountCode: string | undefined;
    if (process.env.SHOPIFY_ENABLED === 'true') {
      try {
        const { createDiscountCode, createCheckoutSession, isStoreCheckoutUrl } = await import(
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
        if (!isStoreCheckoutUrl(session.checkoutUrl)) {
          throw new Error('The checkout address is not on the configured store');
        }
        checkoutUrl = session.checkoutUrl;

        // Update redemption with checkout details
        await inOrganization(orgId, () =>
          rewardsService.updateRedemptionCheckout(
            redemption.id,
            orgId,
            discount.code,
            checkoutUrl || '',
            userId
          ),
        );
      } catch (shopifyError) {
        logger.error('Shopify integration error during redemption', shopifyError as Error, {
          discountCode: discountCode ?? 'unknown',
          redemptionId: redemption.id,
        });
        // Credits were already deducted and the member has no checkout to spend them in: give them back instead of reporting a redemption that cannot be used.
        try {
          await inOrganization(orgId, () =>
            rewardsService.cancelRedemption(redemption.id, orgId, 'The store could not create the checkout', { userId, mustOwn: true }),
          );
        } catch (refundError) {
          logger.error('Redemption refund failed after a Shopify error', refundError as Error, { redemptionId: redemption.id });
          throw new UserFacingError(
            `The store could not be reached and your credits could not be returned automatically. Contact an administrator and quote redemption ${redemption.id}.`,
          );
        }
        throw new UserFacingError('The store could not be reached, so nothing was redeemed and your credits were not spent. Please try again later.');
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
    return failure(error, 'initiateRedemption');
  }
}

export async function cancelRedemption(input: unknown) {
  try {
    const userId = await requireUserId();

    const orgId = await getCurrentUserOrgId();
    const validated = cancelRedemptionSchema.parse(input);

    // A member cancels (and is refunded for) their own redemption only; anyone else's is "not found".
    const result = await inOrganization(orgId, () =>
      rewardsService.cancelRedemption(
        validated.redemptionId,
        orgId,
        validated.reason,
        { userId, mustOwn: true }
      ),
    );

    revalidatePath('/[locale]/dashboard/rewards');
    return { success: true, data: result };
  } catch (error) {
    return failure(error, 'cancelRedemption');
  }
}

export async function listMyRedemptions(input?: unknown) {
  try {
    const userId = await requireUserId();

    const orgId = await getCurrentUserOrgId();
    const validated = paginationSchema.parse(input || {});

    const result = await inOrganization(orgId, () =>
      rewardsService.listUserRedemptions(
        orgId,
        userId,
        validated.limit,
        validated.offset
      ),
    );

    return { success: true, data: result };
  } catch (error) {
    return failure(error, 'listMyRedemptions');
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

    // The figures are put together inside the organization's transaction, so the four reads are one snapshot and nothing is read off their results outside it.
    const data = await inOrganization(orgId, async () => {
      const ledgerSummary = await rewardsService.getLedgerSummary(orgId, startDate, endDate);
      const budgetUsage = await rewardsService.getBudgetUsageSummary(orgId, validated.programId);
      // Active programs and pending awards for the dashboard
      const programs = await rewardsService.listPrograms(orgId);
      const pendingAwards = await rewardsService.listAwardsByStatus(orgId, ['pending']);
      return {
        active_programs_count: programs.filter((p) => p.status === 'active').length,
        pending_awards_count: pendingAwards.length,
        total_credits_issued: ledgerSummary.totalCreditsIssued,
        total_credits_redeemed: ledgerSummary.totalCreditsSpent,
        total_credits_outstanding: ledgerSummary.totalCreditsOutstanding,
        active_members: ledgerSummary.activeMembers,
        budgetUsage,
      };
    });

    return { success: true, data };
  } catch (error) {
    return failure(error, 'getRewardsSummary');
  }
}
