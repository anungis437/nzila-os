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
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { sealToken, sealOptionalToken } from '@/lib/social-media/token-vault';
import { validateOAuthCallbackContext } from '@/lib/social-media/oauth-callback-state';
import { parseOAuthCallbackParameters, selectUniquePublishingOrganization } from '@/lib/social-media/oauth-callback-safety';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';

type CookieStore = Awaited<ReturnType<typeof cookies>>;

// Consume temporary OAuth cookies only after state, session, organization and provider validation.
// Forged or malformed requests must not cancel the legitimate pending connection.
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

export const GET = withRoleAuth('admin', async (request: NextRequest, context: BaseAuthContext) => {
  const cookieStore = await cookies();
  const { userId, organizationId } = context;

  try {
    if (!organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'No organization found');
    }

    // Reject ambiguous provider redirects before consuming the legitimate pending OAuth state.
    // Duplicate parameters and simultaneous code/error values cannot be given an authority interpretation.
    const callbackParameters = parseOAuthCallbackParameters(request.nextUrl.searchParams);
    if (!callbackParameters.ok) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Ambiguous OAuth callback parameters');
    }
    const { code, state, providerError } = callbackParameters;

    const storedState = cookieStore.get('oauth_state')?.value ?? null;
    const storedPlatform = cookieStore.get('oauth_platform')?.value ?? null;
    const storedOrganizationId = cookieStore.get('oauth_organization_id')?.value ?? null;
    const storedUserId = cookieStore.get('oauth_user_id')?.value ?? null;
    const codeVerifier = cookieStore.get('twitter_code_verifier')?.value ?? null;

    // A malformed or forged callback does not consume the genuine pending connection.
    const checked = validateOAuthCallbackContext({
      state, code, providerError, userId, organizationId,
      storedState, storedPlatform, storedOrganizationId, storedUserId, codeVerifier,
    });
    if (!checked.ok) {
      switch (checked.reason) {
        case 'state_mismatch':
          return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state mismatch');
        case 'session_mismatch':
          return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state does not match the authenticated session');
        case 'organization_mismatch':
          return standardErrorResponse(ErrorCode.FORBIDDEN, 'OAuth state does not match the authenticated organization');
        case 'unsupported_platform':
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Unknown or expired OAuth platform context');
        case 'missing_pkce_verifier':
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing PKCE verifier for Twitter OAuth');
        case 'missing_authorization_code':
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Missing OAuth authorization code');
      }
    }

    // Consume only an authenticated, fully validated callback, before contacting the provider.
    clearOAuthCookies(cookieStore);
    if (providerError) {
      return standardErrorResponse(ErrorCode.VALIDATION_ERROR, `Provider denied authorization: ${providerError}`);
    }
    const platform = checked.platform;
    const authorizedCode = code!; // The successful validation guarantees a code absent provider error.

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
        const shortLived = await metaClient.getAccessToken(authorizedCode, redirectUri);
        const longLived = await metaClient.getLongLivedToken(shortLived.access_token);
        const pages = await metaClient.getUserPages();
        // The authorizing user may manage several Pages. Picking the first would publish as an arbitrary one, and there is no
        // selection step yet, so a connection is made only when exactly one Page is available.
        if (pages.length > 1) {
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'This account manages more than one Page. Connect an account that manages exactly the Page to publish as.'
          );
        }
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
        const tokenData = await twitterClient.getAccessToken(authorizedCode, redirectUri, codeVerifier);
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
        const tokenData = await linkedInClient.getAccessToken(authorizedCode, redirectUri);
        const orgs = await createLinkedInClient(tokenData.access_token).getOrganizations();
        // A provider may return several administered organizations. Never silently bind
        // the first one as this union's publishing identity without an explicit selection.
        const org = selectUniquePublishingOrganization(orgs);
        if (!org) {
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            orgs.length > 1
              ? 'Multiple LinkedIn Organization Pages found. Explicit Page selection is required before connecting.'
              : 'No LinkedIn Organization Page found. You must administer a Company Page to connect.'
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
    // Provider tokens are stored sealed, never as plaintext.
    const sealedAccessToken = await sealToken(accessToken);
    const sealedRefreshToken = await sealOptionalToken(refreshToken);
    const [account] = await withRLSContext({ organizationId }, async (tx) => {
      const rows = await tx
        .insert(socialAccounts)
        .values({
          organizationId,
          platform,
          platformUserId,
          username,
          displayName,
          accessToken: sealedAccessToken,
          refreshToken: sealedRefreshToken,
          tokenExpiresAt,
          status: 'active',
          connectedBy: userId,
        })
        .onConflictDoUpdate({
          target: [socialAccounts.organizationId, socialAccounts.platform, socialAccounts.platformUserId],
          set: {
            username,
            displayName,
            accessToken: sealedAccessToken,
            refreshToken: sealedRefreshToken,
            tokenExpiresAt,
            status: 'active',
            updatedAt: new Date(),
          },
        })
        .returning({ id: socialAccounts.id, platform: socialAccounts.platform, username: socialAccounts.username });

      // The credential and its audit record commit together: a connection with no record is not kept.
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'social_account.connected',
        resourceType: 'social_accounts',
        resourceId: rows[0]?.id,
        details: { platform },
      });
      return rows;
    });

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

