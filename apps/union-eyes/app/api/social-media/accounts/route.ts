import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Accounts API Routes - Phase 10
 * 
 * Endpoints for managing social media account connections.
 * Supports OAuth flows, token refresh, and account management.
 */

import { openToken, openOptionalToken, sealToken } from '@/lib/social-media/token-vault';
import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { createMetaClient } from '@/lib/social-media/meta-api-client';
import { createTwitterClient, generatePKCE } from '@/lib/social-media/twitter-api-client';
import { createLinkedInClient } from '@/lib/social-media/linkedin-api-client';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { socialAccounts } from '@/db/schema/social-media-schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// Reading the connected accounts is a member's act. The read and its audit record run in the caller organization's tenant transaction
// (`rlsOrgContext`), so row-level security shows the organization's own accounts and the audit commits with the read.
export const GET = withApi(
  {
    auth: { minRole: 'member' },
    rlsOrgContext: true,
    openapi: { tags: ['Social media'], summary: 'List the connected social media accounts of the organization' },
  },
  async ({ userId, organizationId }) => {
  try {
      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-accounts:${organizationId}`,
        RATE_LIMITS.SOCIAL_MEDIA_API
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      // Fetch accounts
      const accounts = await db
        .select({
          id: socialAccounts.id,
          platform: socialAccounts.platform,
          platformUserId: socialAccounts.platformUserId,
          username: socialAccounts.username,
          displayName: socialAccounts.displayName,
          profileImageUrl: socialAccounts.profileImageUrl,
          followerCount: socialAccounts.followerCount,
          engagementRate: socialAccounts.engagementRate,
          status: socialAccounts.status,
          connectedAt: socialAccounts.connectedAt,
          lastSyncedAt: socialAccounts.lastSyncedAt,
          rateLimitRemaining: socialAccounts.rateLimitRemaining,
          rateLimitResetAt: socialAccounts.rateLimitResetAt,
        })
        .from(socialAccounts)
        .where(eq(socialAccounts.organizationId, organizationId!))
        .orderBy(desc(socialAccounts.connectedAt));

      // Audit log
      // The canonical audit record: the earlier log line dropped the action, organization and platform the caller passed.
      await persistAtomicAudit(db, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'social_account.list',
        resourceType: 'social_accounts',
        details: { count: accounts.length },
      });

      return NextResponse.json({ accounts });
    } catch (error) {
      logger.error('Failed to list the social media accounts', { error });
      return standardErrorResponse(
        ErrorCode.INTERNAL_ERROR,
        'Internal server error',
        error
      );
    }
  },
);


const socialMediaAccountsSchema = z.object({
  platform: z.enum(['facebook', 'instagram', 'twitter', 'linkedin'], {
    error: 'Unsupported platform',
  }),
});

// Connecting or disconnecting the organization's publishing identity is an administrator's act, not a steward's. Starting the connection
// writes one audit record (no network call): it runs in the organization's tenant transaction.
export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    rlsOrgContext: true,
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Social media'], summary: 'Start connecting a social media account (OAuth)' },
  },
  async ({ request, userId, organizationId }) => {
  try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
    // Validate request body
    const validation = socialMediaAccountsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }
    
    const { platform } = validation.data;

      if (!platform) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Platform is required'
    );
      }

      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-connect:${userId}`,
        RATE_LIMITS.SOCIAL_MEDIA_API
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      // Cryptographically random, unguessable state — carries no semantic
      // content of its own; user/org/platform binding is enforced separately
      // via httpOnly cookies compared against the authenticated callback
      // context, never trusted from the state value itself.
      const state = randomBytes(32).toString('hex');
      const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social-media/accounts/callback`;

      let authUrl: string;
      const cookieStore = await cookies();

      switch (platform) {
        case 'facebook':
        case 'instagram': {
          const metaClient = createMetaClient();
          const scopes = [
            'pages_show_list',
            'pages_read_engagement',
            'pages_manage_posts',
            'pages_manage_engagement',
            'instagram_basic',
            'instagram_content_publish',
          ];
          authUrl = metaClient.getAuthorizationUrl(redirectUri, scopes, state);
          break;
        }

        case 'twitter': {
          const twitterClient = createTwitterClient();
          const { verifier, challenge } = generatePKCE();
          
          // Store code verifier in cookie for callback
          cookieStore.set('twitter_code_verifier', verifier, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 600, // 10 minutes
          });

          const scopes = [
            'tweet.read',
            'tweet.write',
            'users.read',
            'offline.access',
          ];
          authUrl = twitterClient.getAuthorizationUrl(redirectUri, scopes, state, challenge);
          break;
        }

        case 'linkedin': {
          const linkedInClient = createLinkedInClient();
          const scopes = [
            'r_organization_social',
            'w_organization_social',
            'r_basicprofile',
          ];
          authUrl = linkedInClient.getAuthorizationUrl(redirectUri, scopes, state);
          break;
        }

        default:
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Unsupported platform'
          );
      }

      // Store OAuth state + initiating platform/organization/user in cookies
      // (single-use, short-lived). Organization/user are bound here — not
      // trusted from query params or the state value — so a user who belongs
      // to multiple organizations cannot start the flow under one org and
      // finish it under another by switching active context mid-flow.
      const cookieOpts = {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 600, // 10 minutes
      };
      cookieStore.set('oauth_state', state, cookieOpts);
      cookieStore.set('oauth_platform', platform, cookieOpts);
      cookieStore.set('oauth_organization_id', organizationId!, cookieOpts);
      cookieStore.set('oauth_user_id', userId!, cookieOpts);

      // Audit log
      await persistAtomicAudit(db, {
        organizationId: organizationId!,
        userId: userId!,
        action: 'social_account.connect_initiated',
        resourceType: 'social_accounts',
        details: { platform },
      });

      return NextResponse.json({ auth_url: authUrl });
    } catch (error) {
      logger.error('Failed to initiate the social media OAuth flow', { error });
      return NextResponse.json(
        {
          error: 'Failed to initiate OAuth flow',
        },
        { status: 500 }
      );
    }
  },
);

// Disconnecting contacts the platform to revoke the token, so no transaction spans the handler: the lookup and the removal each run in
// the organization's own tenant transaction.
export const DELETE = withApi(
  {
    auth: { minRole: 'admin' },
    registry: { audience: 'admin', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Social media'], summary: 'Disconnect a social media account' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-disconnect:${userId}`,
        RATE_LIMITS.SOCIAL_MEDIA_API
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      // Get account ID from query params
      const searchParams = request.nextUrl.searchParams;
      const accountId = searchParams.get('id');

      if (!accountId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Account ID required'
    );
      }
      if (!z.guid().safeParse(accountId).success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Account ID must be a valid id');
      }

      // Verify user has access to this account — org-scoped at the query
      // itself so a foreign-org accountId never loads credential material
      // into memory at all, rather than being fetched and rejected after.
      const [account] = await withRLSContext({ organizationId }, (tx) =>
        tx
          .select()
          .from(socialAccounts)
          .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)))
          .limit(1),
      );

      if (!account) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Account not found'
    );
      }

      // Revoke tokens on the platform (if supported). The local credential is removed either way, but the outcome is recorded and
      // reported: a token the platform still honours is not described as disconnected.
      let platformTokenRevoked: 'revoked' | 'not_required' | 'failed' = 'not_required';
      try {
        switch (account.platform) {
          case 'twitter': {
            const twitterClient = createTwitterClient(
              (await openToken(account.accessToken)),
              (await openOptionalToken(account.refreshToken))
            );
            await twitterClient.revokeToken();
            platformTokenRevoked = 'revoked';
            break;
          }
          // Meta and LinkedIn don&apos;t require explicit revocation
        }
      } catch (revokeError) {
        logger.warn('The platform token could not be revoked while disconnecting a social media account', { error: revokeError, accountId, platform: account.platform });
        platformTokenRevoked = 'failed';
      }

      // Delete account and record the audit together — org predicate is defense-in-depth on top of
      // the ownership check above; trusted org is passed explicitly rather than
      // letting withRLSContext silently re-resolve org through an independent auth path.
      const removed = await withRLSContext({ organizationId }, async (tx) => {
        const rows = await tx
          .delete(socialAccounts)
          .where(and(eq(socialAccounts.id, accountId), eq(socialAccounts.organizationId, organizationId)))
          .returning({ id: socialAccounts.id });
        if (rows.length === 0) return false;
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'social.account.disconnect',
          resourceType: 'social_accounts',
          resourceId: accountId,
          details: { platform: account.platform, platformTokenRevoked },
        });
        return true;
      });
      if (!removed) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Account not found');
      }

      return NextResponse.json({
        message: platformTokenRevoked === 'failed'
          ? 'Account disconnected here, but the platform token could not be revoked and stays valid until it expires or is revoked at the platform'
          : 'Account disconnected successfully',
        account_id: accountId,
        platform_token_revoked: platformTokenRevoked,
      });
    } catch (error) {
      logger.error('Failed to disconnect the social media account', { error });
      return NextResponse.json(
        {
          error: 'Failed to disconnect account',
        },
        { status: 500 }
      );
    }
  },
);

// Refreshing a token contacts the platform, so no transaction spans the handler: the lookup and each write run in the organization's own
// tenant transaction.
export const PUT = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Social media'], summary: 'Refresh the access token of a connected social media account' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      let body: unknown;
      try {
        body = await request.json();
      } catch {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
      const account_id = (body as { account_id?: unknown } | null)?.account_id;

      if (!account_id) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Account ID required'
    );
      }
      if (typeof account_id !== 'string' || !z.guid().safeParse(account_id).success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Account ID must be a valid id');
      }

      // Verify user has access to this account
      const [account] = await withRLSContext({ organizationId }, (tx) =>
        tx
          .select()
          .from(socialAccounts)
          .where(and(eq(socialAccounts.id, account_id), eq(socialAccounts.organizationId, organizationId)))
          .limit(1),
      );

      if (!account) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Account not found'
    );
      }

      // A suspended or disconnected account is not brought back by a token refresh; it is reconnected on purpose.
      if (account.status === 'suspended' || account.status === 'disconnected') {
        return standardErrorResponse(ErrorCode.CONFLICT, `A ${account.status} account must be reconnected, not refreshed`);
      }

      // Refresh token based on platform
      let newAccessToken: string;
      let newRefreshToken: string | null = null;
      let expiresIn: number;

      try {
        switch (account.platform) {
          case 'facebook':
          case 'instagram': {
            const metaClient = createMetaClient((await openToken(account.accessToken)));
            const tokenData = await metaClient.getLongLivedToken((await openToken(account.accessToken)));
            newAccessToken = tokenData.access_token;
            expiresIn = tokenData.expires_in;
            break;
          }

          case 'twitter': {
            if (!account.refreshToken) {
              throw new Error('No refresh token available');
            }
            const twitterClient = createTwitterClient(
              (await openToken(account.accessToken)),
              (await openToken(account.refreshToken))
            );
            const tokenData = await twitterClient.refreshAccessToken();
            newAccessToken = tokenData.access_token;
            newRefreshToken = tokenData.refresh_token || null;
            expiresIn = tokenData.expires_in;
            break;
          }

          case 'linkedin': {
            if (!account.refreshToken) {
              throw new Error('No refresh token available');
            }
            const linkedInClient = createLinkedInClient((await openToken(account.accessToken)));
            const tokenData = await linkedInClient.refreshAccessToken(await openToken(account.refreshToken));
            newAccessToken = tokenData.access_token;
            newRefreshToken = tokenData.refresh_token || null;
            expiresIn = tokenData.expires_in;
            break;
          }

          default:
            throw new Error('Unsupported platform');
        }
      } catch (providerError) {
        // Only the platform refusing the refresh marks a connected account expired; a storage failure below does not.
        await withRLSContext({ organizationId }, async (tx) => {
          const rows = await tx
            .update(socialAccounts)
            .set({
              status: 'expired',
              updatedAt: new Date(),
            })
            .where(and(eq(socialAccounts.id, account_id), eq(socialAccounts.organizationId, organizationId), eq(socialAccounts.status, 'active')))
            .returning({ id: socialAccounts.id });
          await persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'social.account.token_refresh_failed',
            resourceType: 'social_accounts',
            resourceId: account_id,
            details: { platform: account.platform, markedExpired: rows.length > 0 },
          });
        });

        throw providerError;
      }

      // Update account with new tokens — org predicate is defense-in-depth on top of
      // the org-scoped SELECT above; trusted org is passed explicitly rather than
      // letting withRLSContext silently re-resolve org through an independent auth path.
      // The tokens are sealed with the Key Vault before the transaction opens: no transaction waits on a network call.
      const expiresAt = new Date(Date.now() + expiresIn * 1000);
      const sealedAccessToken = await sealToken(newAccessToken);
      const sealedRefreshToken = newRefreshToken ? await sealToken(newRefreshToken) : null;
      await withRLSContext({ organizationId }, async (tx) => {
        const rows = await tx
          .update(socialAccounts)
          .set({
            accessToken: sealedAccessToken,
            tokenExpiresAt: expiresAt,
            // An expired account is reconnected by a successful refresh; any other state is kept as it was.
            status: account.status === 'expired' ? 'active' : account.status,
            updatedAt: new Date(),
            ...(sealedRefreshToken ? { refreshToken: sealedRefreshToken } : {}),
          })
          .where(and(eq(socialAccounts.id, account_id), eq(socialAccounts.organizationId, organizationId)))
          .returning({ id: socialAccounts.id });
        if (rows.length === 0) throw new Error('Account no longer exists');
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'social.account.token_refresh',
          resourceType: 'social_accounts',
          resourceId: account_id,
          details: { platform: account.platform },
        });
      });

      return NextResponse.json({
        message: 'Token refreshed successfully',
        expires_at: expiresAt.toISOString(),
      });
    } catch (error) {
      logger.error('Failed to refresh the social media account token', { error });
      return NextResponse.json(
        {
          error: 'Failed to refresh token',
        },
        { status: 500 }
      );
    }
  },
);
