/**
 * Apple Push Notification Service (APNs) Provider
 * 
 * Handles iOS push notifications using Apple HTTP/2 API
 */

import { logger } from '@/lib/logger';

interface APNsConfig {
  keyId: string;
  teamId: string;
  bundleId: string;
  privateKey: string;
  production?: boolean;
}

interface APNsPayload {
  title: string;
  body?: string;
  badge?: number;
  sound?: string;
  category?: string;
  data?: Record<string, unknown>;
  actions?: Array<{
    id: string;
    title: string;
    icon?: string;
  }>;
}

interface APNsResponse {
  success: boolean;
  apnsId?: string;
  error?: string;
}

/**
 * APNs Provider for iOS Push Notifications
 */
export class APNsProvider {
  private config: APNsConfig;
  private token: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(config: APNsConfig) {
    this.config = {
      production: false,
      ...config
    };
  }

  /**
   * Get authentication token using JWT
   */
  private async getToken(): Promise<string> {
    // Check if we have a valid token
    if (this.token && this.tokenExpiry && new Date() < this.tokenExpiry) {
      return this.token;
    }

    // Generate JWT token
    // In production, use proper JWT library
    // APNs requires ES256 signatures over the JWT header/payload using the
    // team's .p8 private key. We do not perform that signing here. Apple will
    // reject every token with SIGNATURE_PLACEHOLDER, so any caller that
    // proceeds is guaranteed silent push failure. Fail loudly instead.
    logger.error('apns-provider: getToken() cannot sign JWT — ES256 signing with .p8 private key is not implemented. APNs will reject every push.', undefined, { keyId: this.config.keyId, teamId: this.config.teamId });
    throw new Error('APNs JWT signing is not implemented — refusing to emit an unsignable token that Apple will reject');
  }

  /**
   * Send push notification to iOS device
   */
  async send(deviceToken: string, payload: APNsPayload): Promise<APNsResponse> {
    try {
      const token = await this.getToken();
      
      const endpoint = this.config.production
        ? 'https://api.push.apple.com/3/device/'
        : 'https://api.sandbox.push.apple.com/3/device/';

      const apsPayload = this.buildPayload(payload);

      const response = await fetch(`${endpoint}${deviceToken}`, {
        method: 'POST',
        headers: {
          'apns-topic': this.config.bundleId,
          'apns-priority': payload.badge ? '10' : '5',
          'apns-expiration': '0',
          'authorization': `bearer ${token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify(apsPayload),
      });

      if (response.ok) {
        const apnsId = response.headers.get('apns-id');
        logger.info('APNs notification sent', { apnsId, deviceToken: deviceToken.slice(0, 8) });
        
        return {
          success: true,
          apnsId: apnsId || undefined
        };
      } else {
        const error = await response.text();
        logger.error('APNs notification failed', { status: response.status, error });
        
        return {
          success: false,
          error: `HTTP ${response.status}: ${error}`
        };
      }
    } catch (error) {
      logger.error('APNs send error', { error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Build APNs payload
   */
  private buildPayload(payload: APNsPayload): Record<string, unknown> {
    const aps: Record<string, unknown> = {
      alert: {
        title: payload.title,
        body: payload.body,
      },
    };

    if (payload.badge !== undefined) {
      aps.badge = payload.badge;
    }

    if (payload.sound) {
      aps.sound = payload.sound;
    } else {
      aps.sound = 'default';
    }

    if (payload.category) {
      aps.category = payload.category;
    }

    // Custom data
    const result: Record<string, unknown> = { aps };
    
    if (payload.data) {
      result.data = payload.data;
    }

    // Notification actions
    if (payload.actions && payload.actions.length > 0) {
      aps['mutable-content'] = 1;
      result['apns-collapse-id'] = payload.data?.['notificationId'] as string || undefined;
    }

    return result;
  }

  /**
   * Send multiple notifications (batch)
   */
  async sendBatch(
    devices: string[],
    payload: APNsPayload
  ): Promise<{ sent: number; failed: number; errors: string[] }> {
    const results = await Promise.allSettled(
      devices.map(token => this.send(token, payload))
    );

    let sent = 0;
    let failed = 0;
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled' && result.value.success) {
        sent++;
      } else {
        failed++;
        const error = result.status === 'rejected' 
          ? result.reason 
          : result.value.error;
        errors.push(`Device ${index}: ${error}`);
      }
    });

    return { sent, failed, errors };
  }

  /**
   * Validate device token format
   */
  isValidToken(token: string): boolean {
    // Device tokens are 64 characters (development) or variable length (production)
    return /^[a-f0-9]{64,}$/i.test(token);
  }

  /**
   * Check APNs connection status
   */
  async checkConnection(): Promise<boolean> {
    try {
      const token = await this.getToken();
      return !!token;
    } catch {
      return false;
    }
  }
}

/**
 * Create APNs provider from environment
 */
export function createAPNsProvider(): APNsProvider | null {
  const config: APNsConfig = {
    keyId: process.env.APNS_KEY_ID || '',
    teamId: process.env.APNS_TEAM_ID || '',
    bundleId: process.env.APNS_BUNDLE_ID || '',
    privateKey: process.env.APNS_PRIVATE_KEY || '',
    production: process.env.NODE_ENV === 'production',
  };

  if (!config.keyId || !config.teamId || !config.bundleId || !config.privateKey) {
    logger.warn('APNs not configured - missing environment variables');
    return null;
  }

  return new APNsProvider(config);
}
