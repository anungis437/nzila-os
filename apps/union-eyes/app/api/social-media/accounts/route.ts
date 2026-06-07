import { logApiAuditEvent } from "@/lib/middleware/api-security";
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Accounts API Routes - Phase 10
 * 
 * Endpoints for managing social media account connections.
 * Supports OAuth flows, token refresh, and account management.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createMetaClient } from '@/lib/social-media/meta-api-client';
import { createTwitterClient, generatePKCE } from '@/lib/social-media/twitter-api-client';
import { createLinkedInClient } from '@/lib/social-media/linkedin-api-client';
import { cookies } from 'next/headers';
import { db } from '@/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { socialAccounts } from '@/db/schema/social-media-schema';
import { eq, and, desc } from 'drizzle-orm';
import { z } from "zod";
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

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
        .where(eq(socialAccounts.organizationId, organizationId))
        .orderBy(desc(socialAccounts.connectedAt));

      // Audit log
      await logApiAuditEvent({
        userId,
        organizationId,
        action: 'LIST_SOCIAL_ACCOUNTS',
        dataType: 'SOCIAL_MEDIA',
        success: true,
        metadata: { count: accounts.length },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return NextResponse.json({ accounts });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
    }
});


const socialMediaAccountsSchema = z.object({
  platform: z.string().min(1, 'platform is required'),
  account_id: z.string().uuid('Invalid account_id'),
});

export const POST = withRoleAuth('steward', async (request: NextRequest, context) => {
  try {
      const { userId, organizationId } = context;
      const body = await request.json();
    // Validate request body
    const validation = socialMediaAccountsSchema.safeParse(body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.errors
      );
    }
    
    const { platform, account_id: _account_id } = validation.data;

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

      // Generate OAuth state
      const state = `${userId}:${platform}:${Date.now()}`;
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
            'business_management',
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
            'rw_organization_admin',
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

      // Store OAuth state in cookie
      cookieStore.set('oauth_state', state, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 600, // 10 minutes
      });

      // Audit log
      await logApiAuditEvent({
        userId,
        organizationId,
        action: 'INITIATE_SOCIAL_CONNECT',
        dataType: 'SOCIAL_MEDIA',
        success: true,
        metadata: { platform },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return NextResponse.json({ auth_url: authUrl });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to initiate OAuth flow',
        },
        { status: 500 }
      );
    }
});

export const DELETE = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

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

      // Verify user has access to this account
      const [account] = await db
        .select()
        .from(socialAccounts)
        .where(eq(socialAccounts.id, accountId))
        .limit(1);

      if (!account) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Account not found'
    );
      }

      if (organizationId !== account.organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
        );
      }

      // Revoke tokens on the platform (if supported)
      try {
        switch (account.platform) {
          case 'twitter': {
            const twitterClient = createTwitterClient(
              account.accessToken,
              account.refreshToken || undefined
            );
            await twitterClient.revokeToken();
            break;
          }
          // Meta and LinkedIn don&apos;t require explicit revocation
        }
      } catch (_revokeError) {
// Continue with deletion even if revocation fails
      }

      // Delete account from database
      await withRLSContext(async () =>
        db.delete(socialAccounts).where(eq(socialAccounts.id, accountId))
      );

      // Audit log
      await logApiAuditEvent({
        userId,
        organizationId,
        action: 'DISCONNECT_SOCIAL_ACCOUNT',
        dataType: 'SOCIAL_MEDIA',
        recordId: accountId,
        success: true,
        metadata: { platform: account.platform },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any);

      return NextResponse.json({
        message: 'Account disconnected successfully',
        account_id: accountId,
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to disconnect account',
        },
        { status: 500 }
      );
    }
});

export const PUT = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { _userId, organizationId } = context;
      
      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      const body = await request.json();
      const { account_id } = body;

      if (!account_id) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Account ID required'
    );
      }

      // Verify user has access to this account
      const [account] = await db
        .select()
        .from(socialAccounts)
        .where(and(eq(socialAccounts.id, account_id), eq(socialAccounts.organizationId, organizationId)))
        .limit(1);

      if (!account) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Account not found'
    );
      }

      // Refresh token based on platform
      let newAccessToken: string;
      let newRefreshToken: string | null = null;
      let expiresIn: number;

      try {
        switch (account.platform) {
          case 'facebook':
          case 'instagram': {
            const metaClient = createMetaClient(account.accessToken);
            const tokenData = await metaClient.getLongLivedToken(account.accessToken);
            newAccessToken = tokenData.access_token;
            expiresIn = tokenData.expires_in;
            break;
          }

          case 'twitter': {
            if (!account.refreshToken) {
              throw new Error('No refresh token available');
            }
            const twitterClient = createTwitterClient(
              account.accessToken,
              account.refreshToken
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
            const linkedInClient = createLinkedInClient(account.accessToken);
            const tokenData = await linkedInClient.refreshAccessToken(account.refreshToken);
            newAccessToken = tokenData.access_token;
            newRefreshToken = tokenData.refresh_token || null;
            expiresIn = tokenData.expires_in;
            break;
          }

          default:
            throw new Error('Unsupported platform');
        }

        // Update account with new tokens
        const expiresAt = new Date(Date.now() + expiresIn * 1000);
        await withRLSContext(async () =>
          db.update(socialAccounts).set({
            accessToken: newAccessToken,
            tokenExpiresAt: expiresAt,
            status: 'active',
            updatedAt: new Date(),
            ...(newRefreshToken ? { refreshToken: newRefreshToken } : {}),
          }).where(eq(socialAccounts.id, account_id))
        );

        return NextResponse.json({
          message: 'Token refreshed successfully',
          expires_at: expiresAt.toISOString(),
        });
      } catch (error) {
        // Update account status to error
        await withRLSContext(async () =>
          db.update(socialAccounts).set({
            status: 'expired',
            updatedAt: new Date(),
          }).where(eq(socialAccounts.id, account_id))
        );

        throw error;
      }
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to refresh token',
        },
        { status: 500 }
      );
    }
});
