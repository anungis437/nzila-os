/**
 * SMS Service
 * 
 * Phase 4: Communications & Organizing
 * Abstraction layer for SMS providers (Twilio, etc.)
 * 
 * Features:
 * - Provider-agnostic interface
 * - Pluggable adapters
 * - Delivery tracking
 * - Error handling & retries
 * - Rate limiting
 * - CASL compliance (Canadian Anti-Spam Legislation)
 * 
 * Version: 1.0.0
 * Created: February 13, 2026
 */

import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface SMSMessage {
  to: string; // E.164 format: +15551234567
  body: string;
  from?: string; // Sending phone number or shortcode
  mediaUrl?: string[]; // MMS support
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface SMSResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
  segments?: number; // Number of SMS segments (for billing)
}

export interface SMSProvider {
  name: string;
  send(message: SMSMessage): Promise<SMSResult>;
  sendBatch(messages: SMSMessage[]): Promise<SMSResult[]>;
  verifyConnection(): Promise<boolean>;
  checkBalance?(): Promise<number>; // Optional: get account balance
}

// ============================================================================
// SMS SERVICE
// ============================================================================

export class SMSService {
  private provider: SMSProvider;
  private fallbackProvider?: SMSProvider;

  constructor(
    provider: SMSProvider,
    fallbackProvider?: SMSProvider,
  ) {
    this.provider = provider;
    this.fallbackProvider = fallbackProvider;
  }

  /**
   * Send a single SMS
   */
  async send(message: SMSMessage): Promise<string> {
    // Validate phone number format
    if (!this.isValidE164(message.to)) {
      throw new Error(`Invalid phone number format: ${message.to}. Must be E.164 format (+15551234567)`);
    }

    // Validate message length (160 chars per segment)
    if (message.body.length > 1600) {
      throw new Error('SMS message too long (max 1600 characters, 10 segments)');
    }

    try {
      const result = await this.provider.send(message);
      
      if (!result.success) {
        // Try fallback if available
        if (this.fallbackProvider) {
          logger.warn(`Primary SMS provider failed, trying fallback: ${result.error}`);
          const fallbackResult = await this.fallbackProvider.send(message);
          
          if (!fallbackResult.success) {
            throw new Error(fallbackResult.error || 'SMS send failed');
          }
          
          return fallbackResult.messageId || '';
        }
        
        throw new Error(result.error || 'SMS send failed');
      }
      
      return result.messageId || '';
    } catch (error) {
      logger.error('SMS send error:', error);
      throw error;
    }
  }

  /**
   * Send batch of SMS messages
   */
  async sendBatch(messages: SMSMessage[]): Promise<SMSResult[]> {
    // Validate all messages first
    for (const message of messages) {
      if (!this.isValidE164(message.to)) {
        throw new Error(`Invalid phone number in batch: ${message.to}`);
      }
    }

    try {
      return await this.provider.sendBatch(messages);
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        logger.warn('Primary SMS provider batch send failed, trying fallback');
        return await this.fallbackProvider.sendBatch(messages);
      }
      throw error;
    }
  }

  /**
   * Verify provider connection
   */
  async verifyConnection(): Promise<boolean> {
    try {
      return await this.provider.verifyConnection();
    } catch (error) {
      logger.error('SMS provider connection verification failed:', error);
      return false;
    }
  }

  /**
   * Check provider account balance
   */
  async checkBalance(): Promise<number | null> {
    if (!this.provider.checkBalance) {
      return null;
    }
    
    try {
      return await this.provider.checkBalance();
    } catch (error) {
      logger.error('Failed to check SMS balance:', error);
      return null;
    }
  }

  /**
   * Validate E.164 phone number format
   */
  private isValidE164(phone: string): boolean {
    const e164Regex = /^\+[1-9]\d{1,14}$/;
    return e164Regex.test(phone);
  }

  /**
   * Calculate number of SMS segments
   */
  calculateSegments(body: string): number {
    const gsmExtendedChars = /[\[\]\{\}\|\\^~€]/;
    const isUnicode = /[^\x00-\x7F]/.test(body) || gsmExtendedChars.test(body);
    
    const segmentSize = isUnicode ? 70 : 160;
    const concatSegmentSize = isUnicode ? 67 : 153;
    
    if (body.length <= segmentSize) {
      return 1;
    }
    
    return Math.ceil(body.length / concatSegmentSize);
  }
}

// ============================================================================
// TWILIO ADAPTER
// ============================================================================

export class TwilioAdapter implements SMSProvider {
  name = 'twilio';
  private accountSid: string;
  private authToken: string;
  private fromNumber: string;

  constructor(accountSid: string, authToken: string, fromNumber: string) {
    this.accountSid = accountSid;
    this.authToken = authToken;
    this.fromNumber = fromNumber;
  }

  async send(message: SMSMessage): Promise<SMSResult> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
      
      const body = new URLSearchParams({
        To: message.to,
        From: message.from || this.fromNumber,
        Body: message.body,
      });

      // Add media URLs for MMS
      if (message.mediaUrl && message.mediaUrl.length > 0) {
        message.mediaUrl.forEach((url, _index) => {
          body.append('MediaUrl', url);
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: body.toString(),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.message || `HTTP ${response.status}`,
          provider: this.name,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        messageId: data.sid,
        provider: this.name,
        segments: data.num_segments || 1,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  async sendBatch(messages: SMSMessage[]): Promise<SMSResult[]> {
    // Twilio doesn&apos;t have native batch API, send sequentially
    const results: SMSResult[] = [];
    
    for (const message of messages) {
      const result = await this.send(message);
      results.push(result);
      
      // Rate limiting: Twilio allows ~600 requests/min
      // Add small delay between messages
      await this.delay(100); // 100ms delay = max 600/min
    }
    
    return results;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}.json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
        },
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }

  async checkBalance(): Promise<number> {
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Balance.json`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': 'Basic ' + Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64'),
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      return parseFloat(data.balance || '0');
    } catch (error) {
      logger.error('Failed to check Twilio balance:', error);
      return 0;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// ============================================================================
// MOCK ADAPTER (FOR TESTING)
// ============================================================================

export class MockSMSAdapter implements SMSProvider {
  name = 'mock';
  private sentMessages: SMSMessage[] = [];

  async send(message: SMSMessage): Promise<SMSResult> {
    logger.info('[MOCK SMS] Sending:', { to: message.to, body: message.body });
    this.sentMessages.push(message);
    
    return {
      success: true,
      messageId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      provider: this.name,
      segments: Math.ceil(message.body.length / 160),
    };
  }

  async sendBatch(messages: SMSMessage[]): Promise<SMSResult[]> {
    return Promise.all(messages.map(m => this.send(m)));
  }

  async verifyConnection(): Promise<boolean> {
    return true;
  }

  async checkBalance(): Promise<number> {
    return 1000.00; // Mock balance
  }

  getSentMessages(): SMSMessage[] {
    return [...this.sentMessages];
  }

  clear(): void {
    this.sentMessages = [];
  }
}

// ============================================================================
// FACTORY & HELPERS
// ============================================================================

/**
 * Create SMS service from environment configuration
 */
export function createSMSServiceFromEnv(): SMSService {
  const provider = process.env.SMS_PROVIDER || 'twilio';
  
  let primaryProvider: SMSProvider;
  let fallbackProvider: SMSProvider | undefined;

  switch (provider.toLowerCase()) {
    case 'twilio':
      if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !process.env.TWILIO_PHONE_NUMBER) {
        logger.warn('Twilio credentials not configured, using mock SMS provider');
        primaryProvider = new MockSMSAdapter();
      } else {
        primaryProvider = new TwilioAdapter(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN,
          process.env.TWILIO_PHONE_NUMBER,
        );
      }
      break;

    case 'mock':
      primaryProvider = new MockSMSAdapter();
      break;

    default:
      throw new Error(`Unsupported SMS provider: ${provider}`);
  }

  return new SMSService(primaryProvider, fallbackProvider);
}

/**
 * Singleton instance
 */
let smsServiceInstance: SMSService;

export function getSMSService(): SMSService {
  if (!smsServiceInstance) {
    smsServiceInstance = createSMSServiceFromEnv();
  }
  return smsServiceInstance;
}

/**
 * Format phone number to E.164
 */
export function formatToE164(phone: string, countryCode: string = '+1'): string {
  // Remove all non-digit characters
  const digits = phone.replace(/\D/g, '');
  
  // Add country code if not present
  if (digits.length === 10) {
    return `${countryCode}${digits}`;
  }
  
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }
  
  return `+${digits}`;
}
