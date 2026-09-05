/**
 * Social Media OAuth Callback - Phase 10
 *
 * Terminal leg of the OAuth authorization-code flow initiated by
 * POST /api/social-media/accounts. Providers redirect the browser here with
 * ?code=...&state=...; this route validates state, exchanges the code for
 * provider tokens, resolves the connected platform identity, and persists
 * the account under the caller's own authenticated organization.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { socialAccounts } from '@/db/schema/social-media-schema';
import { createMetaClient } from '@/lib/social-media/meta-api-client';
import { createTwitterClient } from '@/lib/social-media/twitter-api-client';
import { createLinkedInClient } from '@/lib/social-media/linkedin-api-client';
import { withRoleAuth, BaseAuthContext } from '@/lib/api-auth-guard';
import { logApiAuditEvent } from '@/lib/middleware/api-security';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

const SUPPORTED_PLATFORMS = ['facebook', 'instagram', 'twitter', 'linkedin'] as const;
type SupportedPlatform = (typeof SUPPORTED_PLATFORMS)[number];

function isSupportedPlatform(value: string | undefined): value is SupportedPlatform {
  return !!value && (SUPPORTED_PLATFORMS as readonly string[]).includes(value);
}

type CookieStore = Awaited<ReturnType<typeof cookies>>;

// Expires all temporary OAuth cookies immediately so a replayed callback
// request (same code/state, second delivery) always finds them gone.
function clearOAuthCookies(cookieStore: CookieStore) {
  const expired = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 0,
  };
  cookieStore.set('oauth_state', '', expired);
  cookieStore.set('oauth_platform', '', expired);
  cookieStore.set('oauth_organization_id', '', expired);
  cookieStore.set('oauth_user_id', '', expired);
  cookieStore.set('twitter_code_verifier', '', expired);
}

export const GET = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  const cookieStore = await cookies();
  const { userId, organizationId } = context;

  try {
    if (!organizationId) {
      clearOAuthCookies(cookieStore);
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No organization found');
    }

    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const providerError = searchParams.get('error');

    const storedState = cookieStore.get('oauth_state')?.value;
    const storedPlatform = cookieStore.get('oauth_platform')?.value;
    const storedOrganizationId = cookieStore.get('oauth_organization_id')?.value;
    const storedUserId = cookieStore.get('oauth_user_id')?.value;
    const codeVerifier = cookieStore.get('twitter_code_verifier')?.value;

    // Single-use: clear cookies before any further processing so a replay of
    // this exact request (same query string) can never validate twice.
    clearOAuthCookies(cookieStore);

    if (providerError) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, `Provider denied authorization: ${providerError}`);
    }

    if (!code || !state) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing OAuth authorization code or state');
    }

    // CSRF/replay defense: state must match the httpOnly cookie set at
    // connect-initiation time byte-for-byte. Neither the provider nor a
    // third party can forge this without also controlling the victim's
    // cookie jar (the cookie is never exposed to client-side script). State
    // itself is an opaque random nonce — it carries no identity claims.
    if (!storedState || storedState !== state) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state mismatch');
    }

    // Bind the flow to the session AND the organization that initiated it —
    // both compared against separate httpOnly cookies, never trusted from
    // query params or the state value. This stops a user who belongs to
    // multiple organizations from starting the flow under one org and
    // completing it into another by switching active context mid-flow.
    // The actual account write below still derives org/user only from the
    // authenticated server context, never from these cookies directly.
    if (!storedUserId || storedUserId !== userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state does not match the authenticated session');
    }
    if (!storedOrganizationId || storedOrganizationId !== organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state does not match the authenticated organization');
    }

    if (!isSupportedPlatform(storedPlatform)) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Unknown or expired OAuth platform context');
    }
    const platform = storedPlatform;

    const redirectUri = `${process.env.NEXT_PUBLIC_APP_URL}/api/social-media/accounts/callback`;

    let platformUserId: string;
    let username: string;
    let displayName: string;
    let accessToken: string;
    let refreshToken: string | null = null;
    let tokenExpiresAt: Date | null = null;

    switch (platform) {
      case 'facebook':
      case 'instagram': {
        const metaClient = createMetaClient();
        const shortLived = await metaClient.getAccessToken(code, redirectUri);
        const longLived = await metaClient.getLongLivedToken(shortLived.access_token);
        const pages = await metaClient.getUserPages();
        const page = pages[0];
        if (!page) {
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'No Facebook Page found for this account. Connect a Page to continue.'
          );
        }

        if (platform === 'instagram') {
          const igAccount = await metaClient.getInstagramAccount(page.id);
          if (!igAccount) {
            return standardErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              'No Instagram Business Account is linked to your Facebook Page.'
            );
          }
          platformUserId = igAccount.id;
          username = igAccount.username;
          displayName = igAccount.name;
        } else {
          platformUserId = page.id;
          username = page.id;
          displayName = page.name;
        }

        // Publishing uses the Page's own token, not the short-lived user token.
        accessToken = page.access_token;
        tokenExpiresAt = new Date(Date.now() + longLived.expires_in * 1000);
        break;
      }

      case 'twitter': {
        if (!codeVerifier) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing PKCE verifier for Twitter OAuth');
        }
        const twitterClient = createTwitterClient();
        const tokenData = await twitterClient.getAccessToken(code, redirectUri, codeVerifier);
        const me = await createTwitterClient(tokenData.access_token).getMe();

        platformUserId = me.id;
        username = me.username;
        displayName = me.name;
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token || null;
        tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        break;
      }

      case 'linkedin': {
        const linkedInClient = createLinkedInClient();
        const tokenData = await linkedInClient.getAccessToken(code, redirectUri);
        const orgs = await createLinkedInClient(tokenData.access_token).getOrganizations();
        const org = orgs[0];
        if (!org) {
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'No LinkedIn Organization Page found. You must administer a Company Page to connect.'
          );
        }

        platformUserId = org.id;
        username = org.vanityName || org.id;
        displayName = org.localizedName;
        accessToken = tokenData.access_token;
        refreshToken = tokenData.refresh_token || null;
        tokenExpiresAt = new Date(Date.now() + tokenData.expires_in * 1000);
        break;
      }

      default:
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Unsupported platform');
    }

    // organizationId/userId come only from the trusted, authenticated server
    // context (withRoleAuth) — never from query params, provider payload, or state.
    const [account] = await withRLSContext({ organizationId }, async (tx) =>
      tx
        .insert(socialAccounts)
        .values({
          organizationId,
          platform,
          platformUserId,
          username,
          displayName,
          accessToken,
          refreshToken,
          tokenExpiresAt,
          status: 'active',
          connectedBy: userId,
        })
        .onConflictDoUpdate({
          target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.platformUserId],
          set: {
            username,
            displayName,
            accessToken,
            refreshToken,
            tokenExpiresAt,
            status: 'active',
            updatedAt: new Date(),
          },
        })
        .returning({ id: socialAccounts.id, platform: socialAccounts.platform, username: socialAccounts.username })
    );

    await logApiAuditEvent({
      userId,
      organizationId,
      action: 'COMPLETE_SOCIAL_CONNECT',
      dataType: 'SOCIAL_MEDIA',
      recordId: account?.id,
      success: true,
      metadata: { platform },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as any);

    return NextResponse.json({
      message: 'Account connected successfully',
      account_id: account?.id,
      platform,
      username: account?.username,
    });
  } catch (_error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Failed to complete OAuth connection');
  }
});

