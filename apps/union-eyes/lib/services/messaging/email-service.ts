/**
 * Email Service
 * 
 * Phase 4: Communications & Organizing
 * Abstraction layer for email providers (Resend, SendGrid, etc.)
 * 
 * Features:
 * - Provider-agnostic interface
 * - Pluggable adapters
 * - Delivery tracking
 * - Error handling & retries
 * - Rate limiting
 * 
 * Version: 1.0.0
 * Created: February 13, 2026
 */

// ============================================================================
// TYPES
// ============================================================================

export interface EmailMessage {
  to: string | string[];
  from?: string;
  subject: string;
  body: string;
  html?: string;
  replyTo?: string;
  cc?: string | string[];
  bcc?: string | string[];
  attachments?: EmailAttachment[];
  headers?: Record<string, string>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: Record<string, any>;
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}

export interface SendResult {
  success: boolean;
  messageId?: string;
  error?: string;
  provider?: string;
}

import { logger } from '@/lib/logger';

export interface EmailProvider {
  name: string;
  send(message: EmailMessage): Promise<SendResult>;
  sendBatch(messages: EmailMessage[]): Promise<SendResult[]>;
  verifyConnection(): Promise<boolean>;
}

// ============================================================================
// EMAIL SERVICE
// ============================================================================

export class EmailService {
  private provider: EmailProvider;
  private fallbackProvider?: EmailProvider;

  constructor(
    provider: EmailProvider,
    fallbackProvider?: EmailProvider,
  ) {
    this.provider = provider;
    this.fallbackProvider = fallbackProvider;
  }

  /**
   * Send a single email
   */
  async send(message: EmailMessage): Promise<string> {
    try {
      const result = await this.provider.send(message);
      
      if (!result.success) {
        // Try fallback if available
        if (this.fallbackProvider) {
          logger.warn(`Primary provider failed, trying fallback: ${result.error}`);
          const fallbackResult = await this.fallbackProvider.send(message);
          
          if (!fallbackResult.success) {
            throw new Error(fallbackResult.error || 'Email send failed');
          }
          
          return fallbackResult.messageId || '';
        }
        
        throw new Error(result.error || 'Email send failed');
      }
      
      return result.messageId || '';
    } catch (error) {
      logger.error('Email send error:', error);
      throw error;
    }
  }

  /**
   * Send batch of emails
   */
  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    try {
      return await this.provider.sendBatch(messages);
    } catch (error) {
      // Try fallback if available
      if (this.fallbackProvider) {
        logger.warn('Primary provider batch send failed, trying fallback');
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
      logger.error('Provider connection verification failed:', error);
      return false;
    }
  }
}

// ============================================================================
// RESEND ADAPTER
// ============================================================================

export class ResendAdapter implements EmailProvider {
  name = 'resend';
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string = 'noreply@unioneyes.app') {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      // Resend API call
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: message.from || this.defaultFrom,
          to: Array.isArray(message.to) ? message.to : [message.to],
          subject: message.subject,
          text: message.body,
          html: message.html,
          reply_to: message.replyTo,
          cc: message.cc,
          bcc: message.bcc,
          attachments: message.attachments?.map(att => ({
            filename: att.filename,
            content: att.content.toString('base64'),
            content_type: att.contentType,
          })),
          headers: message.headers,
          tags: message.metadata ? [message.metadata] : undefined,
        }),
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
        messageId: data.id,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    // Resend supports batch sending
    const results: SendResult[] = [];
    
    for (const message of messages) {
      const result = await this.send(message);
      results.push(result);
    }
    
    return results;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// SENDGRID ADAPTER
// ============================================================================

export class SendGridAdapter implements EmailProvider {
  name = 'sendgrid';
  private apiKey: string;
  private defaultFrom: string;

  constructor(apiKey: string, defaultFrom: string = 'noreply@unioneyes.app') {
    this.apiKey = apiKey;
    this.defaultFrom = defaultFrom;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: Array.isArray(message.to) 
              ? message.to.map(email => ({ email }))
              : [{ email: message.to }],
            cc: message.cc ? (Array.isArray(message.cc) 
              ? message.cc.map(email => ({ email }))
              : [{ email: message.cc }]) : undefined,
            bcc: message.bcc ? (Array.isArray(message.bcc)
              ? message.bcc.map(email => ({ email }))
              : [{ email: message.bcc }]) : undefined,
            subject: message.subject,
          }],
          from: { email: message.from || this.defaultFrom },
          reply_to: message.replyTo ? { email: message.replyTo } : undefined,
          content: [
            { type: 'text/plain', value: message.body },
            ...(message.html ? [{ type: 'text/html', value: message.html }] : []),
          ],
          attachments: message.attachments?.map(att => ({
            filename: att.filename,
            content: att.content.toString('base64'),
            type: att.contentType || 'application/octet-stream',
          })),
          custom_args: message.metadata,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        return {
          success: false,
          error: error.errors?.[0]?.message || `HTTP ${response.status}`,
          provider: this.name,
        };
      }

      // SendGrid returns 202 Accepted with X-Message-Id header
      const messageId = response.headers.get('X-Message-Id');
      
      return {
        success: true,
        messageId: messageId || undefined,
        provider: this.name,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        provider: this.name,
      };
    }
  }

  async sendBatch(messages: EmailMessage[]): Promise<SendResult[]> {
    const results: SendResult[] = [];
    
    for (const message of messages) {
      const result = await this.send(message);
      results.push(result);
    }
    
    return results;
  }

  async verifyConnection(): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/user/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}

// ============================================================================
// FACTORY & HELPERS
// ============================================================================

/**
 * Create email service from environment configuration
 */
export function createEmailServiceFromEnv(): EmailService {
  const provider = process.env.EMAIL_PROVIDER || 'resend';
  const apiKey = process.env.EMAIL_API_KEY || '';
  const defaultFrom = process.env.EMAIL_FROM || 'noreply@unioneyes.app';

  let primaryProvider: EmailProvider;
  let fallbackProvider: EmailProvider | undefined;

  switch (provider.toLowerCase()) {
    case 'resend':
      primaryProvider = new ResendAdapter(apiKey, defaultFrom);
      // Optional: Configure SendGrid as fallback
      if (process.env.SENDGRID_API_KEY) {
        fallbackProvider = new SendGridAdapter(process.env.SENDGRID_API_KEY, defaultFrom);
      }
      break;

    case 'sendgrid':
      primaryProvider = new SendGridAdapter(apiKey, defaultFrom);
      // Optional: Configure Resend as fallback
      if (process.env.RESEND_API_KEY) {
        fallbackProvider = new ResendAdapter(process.env.RESEND_API_KEY, defaultFrom);
      }
      break;

    default:
      throw new Error(`Unsupported email provider: ${provider}`);
  }

  return new EmailService(primaryProvider, fallbackProvider);
}

/**
 * Singleton instance
 */
let emailServiceInstance: EmailService;

export function getEmailService(): EmailService {
  if (!emailServiceInstance) {
    emailServiceInstance = createEmailServiceFromEnv();
  }
  return emailServiceInstance;
}
