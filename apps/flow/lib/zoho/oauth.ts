/**
 * Zoho OAuth Token Management
 *
 * Handles OAuth token refresh and storage for Zoho API access.
 * Tokens are stored encrypted in the commerce_zoho_credentials table.
 */

import { db } from '@nzila/db'
import { commerceZohoCredentials } from '@nzila/db'
import { eq } from 'drizzle-orm'
import { logger } from '../logger'
import type { ZohoCredentials, ZohoOAuthTokenResponse, ZohoOAuthConfig } from './types'

const ZOHO_TOKEN_URL = '/oauth/v2/token'
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000 // 5 minutes before actual expiry

export class ZohoOAuthClient {
  private config: ZohoOAuthConfig
  private orgId: string

  constructor(orgId: string, config: ZohoOAuthConfig) {
    this.orgId = orgId
    this.config = config
  }

  /**
   * Exchange authorization code for access/refresh tokens
   */
  async exchangeCodeForTokens(code: string): Promise<ZohoCredentials> {
    const params = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      redirect_uri: this.config.redirectUri,
      code,
    })

    const response = await fetch(`https://accounts.zoho.com${ZOHO_TOKEN_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Zoho token exchange failed', { error })
      throw new Error(`Zoho token exchange failed: ${error}`)
    }

    const tokenData: ZohoOAuthTokenResponse = await response.json()

    const credentials: ZohoCredentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? '',
      tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
      accountsServer: 'https://accounts.zoho.com',
      apiServer: tokenData.api_domain || 'https://www.zohoapis.com',
    }

    await this.storeCredentials(credentials)
    return credentials
  }

  /**
   * Get valid access token, refreshing if necessary
   */
  async getAccessToken(): Promise<string> {
    const credentials = await this.getStoredCredentials()
    if (!credentials) {
      throw new Error(`No Zoho credentials found for entity ${this.orgId}`)
    }

    // Check if token needs refresh
    const now = Date.now()
    const expiryTime = credentials.tokenExpiry.getTime()

    if (now >= expiryTime - TOKEN_EXPIRY_BUFFER_MS) {
      logger.info('Zoho access token expired, refreshing', { orgId: this.orgId })
      const refreshed = await this.refreshAccessToken(credentials)
      return refreshed.accessToken
    }

    return credentials.accessToken
  }

  /**
   * Refresh the access token using refresh token
   */
  private async refreshAccessToken(credentials: ZohoCredentials): Promise<ZohoCredentials> {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      refresh_token: credentials.refreshToken,
    })

    const response = await fetch(`${credentials.accountsServer}${ZOHO_TOKEN_URL}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })

    if (!response.ok) {
      const error = await response.text()
      logger.error('Zoho token refresh failed', { error, orgId: this.orgId })
      throw new Error(`Zoho token refresh failed: ${error}`)
    }

    const tokenData: ZohoOAuthTokenResponse = await response.json()

    const newCredentials: ZohoCredentials = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? credentials.refreshToken,
      tokenExpiry: new Date(Date.now() + tokenData.expires_in * 1000),
      accountsServer: credentials.accountsServer,
      apiServer: tokenData.api_domain || credentials.apiServer,
    }

    await this.storeCredentials(newCredentials)
    logger.info('Zoho access token refreshed', { orgId: this.orgId })
    return newCredentials
  }

  /**
   * Build OAuth authorization URL for initial consent
   */
  buildAuthorizationUrl(state: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      redirect_uri: this.config.redirectUri,
      scope: this.config.scope.join(','),
      response_type: 'code',
      access_type: 'offline',
      state,
      prompt: 'consent',
    })

    return `https://accounts.zoho.com/oauth/v2/auth?${params.toString()}`
  }

  /**
   * Revoke all tokens (disconnect integration)
   */
  async revokeTokens(): Promise<void> {
    const credentials = await this.getStoredCredentials()
    if (!credentials) return

    try {
      const params = new URLSearchParams({ token: credentials.refreshToken })
      await fetch(`${credentials.accountsServer}/oauth/v2/token/revoke?${params.toString()}`, {
        method: 'POST',
      })
    } catch (error) {
      logger.warn('Zoho token revocation failed', { error, orgId: this.orgId })
    }

    await db.delete(commerceZohoCredentials).where(eq(commerceZohoCredentials.orgId, this.orgId))
    logger.info('Zoho credentials revoked and deleted', { orgId: this.orgId })
  }

  /**
   * Check if credentials exist for this entity
   */
  async hasCredentials(): Promise<boolean> {
    const creds = await this.getStoredCredentials()
    return creds !== null
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Private: Credential Storage
  // ─────────────────────────────────────────────────────────────────────────

  private async getStoredCredentials(): Promise<ZohoCredentials | null> {
    const [row] = await db
      .select()
      .from(commerceZohoCredentials)
      .where(eq(commerceZohoCredentials.orgId, this.orgId))
      .limit(1)

    if (!row) return null

    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      tokenExpiry: row.tokenExpiry,
      accountsServer: row.accountsServer,
      apiServer: row.apiServer,
    }
  }

  private async storeCredentials(credentials: ZohoCredentials): Promise<void> {
    const existing = await this.getStoredCredentials()

    if (existing) {
      await db
        .update(commerceZohoCredentials)
        .set({
          accessToken: credentials.accessToken,
          refreshToken: credentials.refreshToken,
          tokenExpiry: credentials.tokenExpiry,
          accountsServer: credentials.accountsServer,
          apiServer: credentials.apiServer,
          updatedAt: new Date(),
        })
        .where(eq(commerceZohoCredentials.orgId, this.orgId))
    } else {
      await db.insert(commerceZohoCredentials).values({
        orgId: this.orgId,
        accessToken: credentials.accessToken,
        refreshToken: credentials.refreshToken,
        tokenExpiry: credentials.tokenExpiry,
        accountsServer: credentials.accountsServer,
        apiServer: credentials.apiServer,
      })
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// Factory function for creating OAuth client with env config
// ═══════════════════════════════════════════════════════════════════════════

export function createZohoOAuthClient(orgId: string): ZohoOAuthClient {
  const config: ZohoOAuthConfig = {
    clientId: process.env.ZOHO_CLIENT_ID ?? '',
    clientSecret: process.env.ZOHO_CLIENT_SECRET ?? '',
    redirectUri: process.env.ZOHO_REDIRECT_URI ?? '',
    scope: [
      'ZohoCRM.modules.ALL',
      'ZohoCRM.settings.ALL',
      'ZohoBooks.fullaccess.all',
      'ZohoInventory.fullaccess.all',
    ],
  }

  if (!config.clientId || !config.clientSecret) {
    throw new Error('Zoho OAuth credentials not configured (ZOHO_CLIENT_ID, ZOHO_CLIENT_SECRET)')
  }

  return new ZohoOAuthClient(orgId, config)
}
