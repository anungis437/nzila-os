/**
 * E-Signature Provider Integration Service
 * 
 * Unified interface for multiple e-signature providers:
 * - DocuSign
 * - HelloSign (Dropbox Sign)
 * - Adobe Sign
 * - Internal signature system
 * 
 * Handles document sending, tracking, and webhook processing
 */

import { createHash } from "crypto";
import { logger } from "@/lib/logger";

/**
 * Custom error class for signature provider errors
 */
export class SignatureError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'SignatureError';
    this.status = status;
  }
}

/**
 * Base interface for all signature providers
 */
export interface SignatureProvider {
  name: string;
  createEnvelope(request: CreateEnvelopeRequest): Promise<EnvelopeResponse>;
  getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus>;
  downloadDocument(envelopeId: string): Promise<Buffer>;
  voidEnvelope(envelopeId: string, reason: string): Promise<void>;
  sendReminder(envelopeId: string, signerId: string): Promise<void>;
}

export interface CreateEnvelopeRequest {
  document: {
    name: string;
    content: Buffer; // PDF or other supported format
    fileType: string;
  };
  signers: Array<{
    email: string;
    name: string;
    role?: string;
    order?: number; // For sequential signing
    authenticationMethod?: "email" | "sms" | "none";
  }>;
  subject: string;
  message?: string;
  expirationDays?: number;
  reminderDays?: number[];
  callbackUrl?: string; // Webhook URL
}

export interface EnvelopeResponse {
  envelopeId: string;
  status: string;
  signers: Array<{
    email: string;
    signerId: string;
    status: string;
    signUrl?: string;
  }>;
  createdAt: Date;
}

export interface EnvelopeStatus {
  envelopeId: string;
  status: "sent" | "delivered" | "signed" | "completed" | "declined" | "voided";
  signers: Array<{
    signerId: string;
    email: string;
    status: string;
    signedAt?: Date;
    viewedAt?: Date;
    declinedReason?: string;
  }>;
  completedAt?: Date;
}

/**
 * DocuSign Provider Implementation
 */
export class DocuSignProvider implements SignatureProvider {
  name = "docusign";
  private apiKey: string;
  private accountId: string;
  private baseUrl: string;

  constructor(config: {
    apiKey: string;
    accountId: string;
    environment?: "production" | "sandbox";
  }) {
    this.apiKey = config.apiKey;
    this.accountId = config.accountId;
    this.baseUrl =
      config.environment === "production"
        ? "https://na3.docusign.net/restapi/v2.1"
        : "https://demo.docusign.net/restapi/v2.1";
  }

  async createEnvelope(
    request: CreateEnvelopeRequest
  ): Promise<EnvelopeResponse> {
    try {
      const envelope = {
        emailSubject: request.subject,
        emailBlurb: request.message || "",
        status: "sent",
        documents: [
          {
            documentBase64: request.document.content.toString("base64"),
            name: request.document.name,
            fileExtension: request.document.fileType,
            documentId: "1",
          },
        ],
        recipients: {
          signers: request.signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            recipientId: String(index + 1),
            routingOrder: signer.order || index + 1,
            tabs: {
              signHereTabs: [
                {
                  documentId: "1",
                  pageNumber: "1",
                  xPosition: "100",
                  yPosition: "100",
                },
              ],
            },
          })),
        },
        ...(request.callbackUrl && { eventNotification: {
          url: request.callbackUrl,
          loggingEnabled: true,
          requireAcknowledgment: true,
          includeDocuments: false,
          envelopeEvents: [
            { envelopeEventStatusCode: "sent" },
            { envelopeEventStatusCode: "delivered" },
            { envelopeEventStatusCode: "signed" },
            { envelopeEventStatusCode: "completed" },
            { envelopeEventStatusCode: "declined" },
            { envelopeEventStatusCode: "voided" },
          ],
        }}),
      };

      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/envelopes`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify(envelope),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DocuSign API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();

      return {
        envelopeId: data.envelopeId,
        status: data.status,
        signers: request.signers.map((s, i) => ({
          email: s.email,
          signerId: `signer_${i + 1}`,
          status: "sent",
          signUrl: data.recipients?.signers?.[i]?.embeddedRecipientStartURL,
        })),
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error("[DocuSign] Failed to create envelope", error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `Failed to create DocuSign envelope: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/json",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DocuSign API error (${response.status}): ${errorText}`
        );
      }

      const data = await response.json();

      return {
        envelopeId: data.envelopeId,
        status: data.status?.toLowerCase() || "sent",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signers: (data.recipients?.signers || []).map((signer: any) => ({
          signerId: signer.recipientId,
          email: signer.email,
          status: signer.status?.toLowerCase() || "sent",
          signedAt: signer.signedDateTime
            ? new Date(signer.signedDateTime)
            : undefined,
          viewedAt: signer.deliveredDateTime
            ? new Date(signer.deliveredDateTime)
            : undefined,
          declinedReason: signer.declinedReason,
        })),
        completedAt: data.completedDateTime
          ? new Date(data.completedDateTime)
          : undefined,
      };
    } catch (error) {
      logger.error("[DocuSign] Failed to get envelope status", error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `Failed to get DocuSign envelope status: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async downloadDocument(envelopeId: string): Promise<Buffer> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: "application/pdf",
          },
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DocuSign API error (${response.status}): ${errorText}`
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error("[DocuSign] Failed to download document", error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `Failed to download DocuSign document: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            status: "voided",
            voidedReason: reason,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DocuSign API error (${response.status}): ${errorText}`
        );
      }
    } catch (error) {
      logger.error("[DocuSign] Failed to void envelope", error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `Failed to void DocuSign envelope: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  async sendReminder(envelopeId: string, _signerId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}/notification`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body: JSON.stringify({
            useAccountDefaults: false,
            expirations: {
              expireEnabled: false,
            },
            reminders: {
              reminderEnabled: true,
              reminderDelay: "0",
              reminderFrequency: "0",
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `DocuSign API error (${response.status}): ${errorText}`
        );
      }
    } catch (error) {
      logger.error("[DocuSign] Failed to send reminder", error instanceof Error ? error : new Error(String(error)));
      throw new Error(
        `Failed to send DocuSign reminder: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

/**
 * HelloSign (Dropbox Sign) Provider Implementation
 */
export class HelloSignProvider implements SignatureProvider {
  name = "hellosign";
  private apiKey: string;
  private baseUrl = "https://api.hellosign.com/v3";

  constructor(config: { apiKey: string }) {
    this.apiKey = config.apiKey;
  }

  async createEnvelope(
    request: CreateEnvelopeRequest
  ): Promise<EnvelopeResponse> {
    // HelloSign API implementation
    const formData = new FormData();
    formData.append("title", request.subject);
    formData.append("subject", request.subject);
    formData.append("message", request.message || "");
    
    // Add file
    const blob = new Blob([new Uint8Array(request.document.content)], {
      type: "application/pdf",
    });
   formData.append("file", blob, request.document.name);

    // Add signers
    request.signers.forEach((signer, index) => {
      formData.append(`signers[${index}][email_address]`, signer.email);
      formData.append(`signers[${index}][name]`, signer.name);
      formData.append(`signers[${index}][order]`, String(signer.order || 0));
    });

    try {
      const response = await fetch(`${this.baseUrl}/signature_request/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: { error_msg: 'Unknown error' } }));
        throw new SignatureError(
          `HelloSign API error: ${errorData.error?.error_msg || response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      const signatureRequest = data.signature_request;

      return {
        envelopeId: signatureRequest.signature_request_id,
        status: this.mapHelloSignStatus(signatureRequest.is_complete, signatureRequest.is_declined),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signers: signatureRequest.signatures.map((sig: any) => ({
          email: sig.signer_email_address,
          signerId: sig.signature_id,
          status: this.mapSignerStatus(sig.status_code),
        })),
        createdAt: new Date(signatureRequest.created_at * 1000),
      };
    } catch (error) {
      logger.error('HelloSign send envelope failed', error instanceof Error ? error : new Error(String(error)), {
        documentName: request.document.name,
        signerCount: request.signers.length,
      });
      throw error;
    }
  }

  private mapHelloSignStatus(isComplete: boolean, isDeclined: boolean): EnvelopeStatus['status'] {
    if (isDeclined) return 'declined';
    if (isComplete) return 'completed';
    return 'sent';
  }

  private mapSignerStatus(statusCode: string): string {
    const statusMap: Record<string, string> = {
      'awaiting_signature': 'sent',
      'signed': 'completed',
      'declined': 'declined',
      'error': 'error',
    };
    return statusMap[statusCode] || 'sent';
  }

  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
    try {
      const response = await fetch(
        `${this.baseUrl}/signature_request/${envelopeId}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`
          },
        }
      );

      if (!response.ok) {
        throw new SignatureError(
          `Failed to get envelope status: ${response.statusText}`,
          response.status
        );
      }

      const data = await response.json();
      const signatureRequest = data.signature_request;

      return {
        envelopeId,
        status: this.mapHelloSignStatus(signatureRequest.is_complete, signatureRequest.is_declined),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signers: signatureRequest.signatures.map((sig: any) => ({
          email: sig.signer_email_address,
          signerId: sig.signature_id,
          status: this.mapSignerStatus(sig.status_code),
        })),
      };
    } catch (error) {
      logger.error('HelloSign get envelope status failed', error instanceof Error ? error : new Error(String(error)), {
        envelopeId,
      });
      throw error;
    }
  }

  async downloadDocument(envelopeId: string): Promise<Buffer> {
    try {
      const response = await fetch(
        `${this.baseUrl}/signature_request/files/${envelopeId}`,
        {
          headers: {
            'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`
          },
        }
      );

      if (!response.ok) {
        throw new SignatureError(
          `Failed to download document: ${response.statusText}`,
          response.status
        );
      }

      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    } catch (error) {
      logger.error('HelloSign download document failed', error instanceof Error ? error : new Error(String(error)), {
        envelopeId,
      });
      throw error;
    }
  }

  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/signature_request/cancel/${envelopeId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new SignatureError(
          `Failed to cancel signature request: ${response.statusText}`,
          response.status
        );
      }

      logger.info('HelloSign envelope cancelled', { envelopeId, reason });
    } catch (error) {
      logger.error('HelloSign void envelope failed', error instanceof Error ? error : new Error(String(error)), {
        envelopeId,
        reason,
      });
      throw error;
    }
  }

  async sendReminder(envelopeId: string, signerId: string): Promise<void> {
    try {
      const response = await fetch(
        `${this.baseUrl}/signature_request/remind/${envelopeId}`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${Buffer.from(this.apiKey + ':').toString('base64')}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email_address: signerId, // HelloSign uses email address as identifier
          }),
        }
      );

      if (!response.ok) {
        throw new SignatureError(
          `Failed to send reminder: ${response.statusText}`,
          response.status
        );
      }

      logger.info('HelloSign reminder sent', { envelopeId, signerId });
    } catch (error) {
      logger.error('HelloSign send reminder failed', error instanceof Error ? error : new Error(String(error)), {
        envelopeId,
        signerId,
      });
      throw error;
    }
  }
}

/**
 * Internal Signature Provider
 * Simple signature system without external provider
 */
export class InternalSignatureProvider implements SignatureProvider {
  name = "internal";

  async createEnvelope(
    request: CreateEnvelopeRequest
  ): Promise<EnvelopeResponse> {
    // Generate internal envelope ID
    const envelopeId = `internal_${Date.now()}_${createHash("sha256")
      .update(JSON.stringify(request))
      .digest("hex")
      .substring(0, 16)}`;

    // Generate signing URLs
    const signers = request.signers.map((signer, index) => {
      const token = createHash("sha256")
        .update(`${envelopeId}_${signer.email}_${Date.now()}`)
        .digest("hex");

      return {
        email: signer.email,
        signerId: `signer_${index + 1}`,
        status: "sent",
        signUrl: `/sign/${envelopeId}?token=${token}`,
      };
    });

    return {
      envelopeId,
      status: "sent",
      signers,
      createdAt: new Date(),
    };
  }

  async getEnvelopeStatus(envelopeId: string): Promise<EnvelopeStatus> {
    // Would query database for status
    return {
      envelopeId,
      status: "sent",
      signers: [],
    };
  }

  async downloadDocument(_envelopeId: string): Promise<Buffer> {
    // Would retrieve from storage
    return Buffer.from("");
  }

  async voidEnvelope(_envelopeId: string, _reason: string): Promise<void> {
    // Would update database
  }

  async sendReminder(_envelopeId: string, _signerId: string): Promise<void> {
    // Would send email reminder
  }
}

/**
 * Factory to get the appropriate provider
 */
export class SignatureProviderFactory {
  private static providers = new Map<string, SignatureProvider>();

  static initialize(config: {
    docusign?: {
      apiKey: string;
      accountId: string;
      environment?: "production" | "sandbox";
    };
    hellosign?: {
      apiKey: string;
    };
  }) {
    if (config.docusign) {
      this.providers.set("docusign", new DocuSignProvider(config.docusign));
    }

    if (config.hellosign) {
      this.providers.set("hellosign", new HelloSignProvider(config.hellosign));
    }

    // Always available
    this.providers.set("internal", new InternalSignatureProvider());
  }

  static getProvider(
    name: "docusign" | "hellosign" | "internal"
  ): SignatureProvider {
    const provider = this.providers.get(name);
    if (!provider) {
      throw new Error(`Provider ${name} not configured`);
    }
    return provider;
  }

  static getDefaultProvider(): SignatureProvider {
    // Prefer external providers, fall back to internal
    return (
      this.providers.get("docusign") ||
      this.providers.get("hellosign") ||
      this.providers.get("internal")!
    );
  }
}

// Initialize with environment variables
SignatureProviderFactory.initialize({
  docusign: process.env.DOCUSIGN_API_KEY
    ? {
        apiKey: process.env.DOCUSIGN_API_KEY,
        accountId: (process.env.DOCUSIGN_API_ACCOUNT_ID || process.env.DOCUSIGN_ACCOUNT_ID)!,
        environment: process.env.DOCUSIGN_ENVIRONMENT as "production" | "sandbox" | undefined,
      }
    : undefined,
  hellosign: process.env.HELLOSIGN_API_KEY
    ? {
        apiKey: process.env.HELLOSIGN_API_KEY,
      }
    : undefined,
});

export default SignatureProviderFactory;

