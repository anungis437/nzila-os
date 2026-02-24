/**
 * E-Signature Providers
 * 
 * Integration implementations for DocuSign, HelloSign (Dropbox Sign), and Adobe Sign
 * Provides unified interface for creating envelopes, tracking signatures, and downloading documents
 */

import { createSign } from "crypto";
import { logger } from "@/lib/logger";
import { createAuditLog } from "./audit-service";

// ============================================================================
// TYPES
// ============================================================================

export type SignatureProviderType = "docusign" | "hellosign" | "adobe_sign";
export type SignatureStatus = "pending" | "sent" | "opened" | "signed" | "completed" | "declined" | "voided" | "expired";

export interface SignerInfo {
  name: string;
  email: string;
  role: string;
  order?: number; // For sequential signing
  accessCode?: string; // Optional PIN
  phone?: string; // For SMS authentication
}

export interface SignatureEnvelope {
  id: string;
  status: SignatureStatus;
  subject: string;
  message: string;
  signers: SignerInfo[];
  documentUrl: string;
  expiresAt?: Date;
  createdAt: Date;
  completedAt?: Date;
}

export interface CreateEnvelopeRequest {
  documentId: string;
  documentName: string;
  documentBuffer: Buffer;
  subject: string;
  message: string;
  signers: SignerInfo[];
  expiresInDays?: number;
  organizationId: string;
  userId: string;
}

export interface SignatureProvider {
  name: SignatureProviderType;
  createEnvelope(request: CreateEnvelopeRequest): Promise<SignatureEnvelope>;
  getEnvelopeStatus(envelopeId: string): Promise<SignatureEnvelope>;
  voidEnvelope(envelopeId: string, reason: string): Promise<void>;
  downloadSignedDocument(envelopeId: string): Promise<Buffer>;
  sendReminder(envelopeId: string, signerEmail: string): Promise<void>;
}

// ============================================================================
// DOCUSIGN PROVIDER
// ============================================================================

export class DocuSignProvider implements SignatureProvider {
  name: SignatureProviderType = "docusign";
  private accountId: string;
  private integrationKey: string;
  private userId: string;
  private privateKey: string;
  private baseUrl: string;
  private oauthBaseUrl: string;

  private static base64UrlEncode(value: Buffer | string): string {
    const buffer = typeof value === 'string' ? Buffer.from(value) : value;
    return buffer
      .toString('base64')
      .replace(/=/g, '')
      .replace(/\+/g, '-')
      .replace(/\//g, '_');
  }

  private static resolveOAuthBaseUrl(rawBaseUrl: string): string {
    const lower = rawBaseUrl.toLowerCase();

    if (lower.includes('demo.docusign.net') || lower.includes('account-d.docusign.com')) {
      return 'https://account-d.docusign.com';
    }

    return 'https://account.docusign.com';
  }

  private static normalizeBaseUrls(rawBaseUrl: string): { apiBaseUrl: string; oauthBaseUrl: string } {
    const trimmed = rawBaseUrl.replace(/\/+$/, '');
    const withoutRestApi = trimmed.replace(/\/restapi$/, '');
    const apiBaseUrl = trimmed.endsWith('/restapi') ? trimmed : `${trimmed}/restapi`;
    const oauthBaseUrl = DocuSignProvider.resolveOAuthBaseUrl(withoutRestApi);

    return {
      apiBaseUrl,
      oauthBaseUrl,
    };
  }

  constructor(
    accountId: string = process.env.DOCUSIGN_API_ACCOUNT_ID || process.env.DOCUSIGN_ACCOUNT_ID || "",
    integrationKey: string = process.env.DOCUSIGN_INTEGRATION_KEY || "",
    userId: string = process.env.DOCUSIGN_USER_ID || "",
    privateKey: string = process.env.DOCUSIGN_PRIVATE_KEY || "",
    baseUrl: string = process.env.DOCUSIGN_BASE_URL || "https://demo.docusign.net"
  ) {
    if (!accountId || !integrationKey || !userId) {
      throw new Error("DocuSign credentials not configured");
    }
    this.accountId = accountId;
    this.integrationKey = integrationKey;
    this.userId = userId;
    this.privateKey = privateKey;
    const { apiBaseUrl, oauthBaseUrl } = DocuSignProvider.normalizeBaseUrls(baseUrl);
    this.baseUrl = apiBaseUrl;
    this.oauthBaseUrl = oauthBaseUrl;
  }

  private buildJwtAssertion(): string {
    if (!this.privateKey) {
      throw new Error("DOCUSIGN_PRIVATE_KEY not configured");
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: this.integrationKey,
      sub: this.userId,
      aud: this.oauthBaseUrl,
      iat: now - 30,
      exp: now + 60 * 60,
      scope: 'signature impersonation',
    };

    const header = {
      alg: 'RS256',
      typ: 'JWT',
    };

    const encodedHeader = DocuSignProvider.base64UrlEncode(JSON.stringify(header));
    const encodedPayload = DocuSignProvider.base64UrlEncode(JSON.stringify(payload));
    const signingInput = `${encodedHeader}.${encodedPayload}`;

    const normalizedKey = this.privateKey.replace(/\\n/g, '\n');
    const signer = createSign('RSA-SHA256');
    signer.update(signingInput);
    signer.end();

    const signature = signer.sign(normalizedKey);
    const encodedSignature = DocuSignProvider.base64UrlEncode(signature);

    return `${signingInput}.${encodedSignature}`;
  }

  /**
   * Get OAuth2 JWT token for DocuSign API
   */
  private async getAccessToken(): Promise<string> {
    try {
      const tokenUrl = `${this.oauthBaseUrl.replace('/v2.1', '')}/oauth/token`;
      const assertion = this.buildJwtAssertion();

      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
          assertion,
        }).toString(),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DocuSign auth error: ${response.status} - ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;
      if (!data.access_token) {
        throw new Error('DocuSign auth response missing access_token');
      }

      return data.access_token;
    } catch (error) {
      logger.error("Failed to get DocuSign access token", { error });
      throw error;
    }
  }

  /**
   * Create a new signature envelope
   */
  async createEnvelope(request: CreateEnvelopeRequest): Promise<SignatureEnvelope> {
    try {
      logger.info("Creating DocuSign envelope", {
        documentName: request.documentName,
        signerCount: request.signers.length,
      });

      const accessToken = await this.getAccessToken();

      // Prepare envelope definition
      const envelopeDefinition = {
        emailSubject: request.subject,
        emailBlurb: request.message,
        status: 'sent',
        documents: [{
          documentBase64: request.documentBuffer.toString('base64'),
          name: request.documentName,
          fileExtension: 'pdf',
          documentId: '1',
        }],
        recipients: {
          signers: request.signers.map((signer, index) => ({
            email: signer.email,
            name: signer.name,
            recipientId: String(index + 1),
            routingOrder: String(signer.order || index + 1),
            accessCode: signer.accessCode,
            tabs: {
              signHereTabs: [{
                documentId: '1',
                pageNumber: '1',
                recipientId: String(index + 1),
                xPosition: '100',
                yPosition: '100',
              }],
            },
          })),
        },
      };

      // Create envelope via DocuSign API
      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/envelopes`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelopeDefinition),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`DocuSign API error: ${response.status} - ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;
      const envelopeId = data.envelopeId || `docusign-${Date.now()}`;

      logger.info("DocuSign envelope created", { envelopeId, signerCount: request.signers.length });

      // Create audit log
      await createAuditLog({
        organizationId: request.organizationId,
        userId: request.userId,
        action: "SIGNATURE_ENVELOPE_CREATED",
        resourceType: "signature_envelope",
        resourceId: envelopeId,
        description: `Created DocuSign envelope for ${request.documentName}`,
        metadata: {
          provider: "docusign",
          signerCount: request.signers.length,
        },
      });

      return {
        id: envelopeId,
        status: "sent",
        subject: request.subject,
        message: request.message,
        signers: request.signers,
        documentUrl: `https://app.docusign.com/documents/details/${envelopeId}`,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to create DocuSign envelope", { error });
      throw error;
    }
  }

  /**
   * Get envelope status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<SignatureEnvelope> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`DocuSign API error: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;

      logger.info("Fetched DocuSign envelope status", { envelopeId, status: data.status });

      return {
        id: envelopeId,
        status: (data.status || 'pending') as SignatureStatus,
        subject: data.emailSubject || "Document Signing",
        message: data.emailBlurb || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signers: data.recipients?.signers?.map((s: any) => ({
          name: s.name,
          email: s.email,
          role: 'signer',
        })) || [],
        documentUrl: `https://app.docusign.com/documents/details/${envelopeId}`,
        createdAt: new Date(data.createdDateTime || new Date()),
      };
    } catch (error) {
      logger.error("Failed to get DocuSign envelope status", { error, envelopeId });
      throw error;
    }
  }

  /**
   * Void an envelope
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'voided',
          voidedReason: reason,
        }),
      });

      if (!response.ok) {
        throw new Error(`DocuSign API error: ${response.status}`);
      }

      logger.info("DocuSign envelope voided", { envelopeId, reason });
    } catch (error) {
      logger.error("Failed to void DocuSign envelope", { error });
      throw error;
    }
  }

  /**
   * Download signed document
   */
  async downloadSignedDocument(envelopeId: string): Promise<Buffer> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}/documents/combined`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(`DocuSign API error: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      logger.info("Downloaded DocuSign signed document", { envelopeId, size: buffer.byteLength });
      return Buffer.from(buffer);
    } catch (error) {
      logger.error("Failed to download DocuSign document", { error });
      throw error;
    }
  }

  /**
   * Send reminder to signer
   */
  async sendReminder(envelopeId: string, signerEmail: string): Promise<void> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${this.baseUrl}/accounts/${this.accountId}/envelopes/${envelopeId}/reminders/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reminderMessage: `Please sign the document: ${signerEmail}`,
        }),
      });

      if (!response.ok) {
        throw new Error(`DocuSign API error: ${response.status}`);
      }

      logger.info("DocuSign reminder sent", { envelopeId, signerEmail });
    } catch (error) {
      logger.error("Failed to send DocuSign reminder", { error });
      throw error;
    }
  }
}

// ============================================================================
// HELLOSIGN (DROPBOX SIGN) PROVIDER
// ============================================================================

export class HelloSignProvider implements SignatureProvider {
  name: SignatureProviderType = "hellosign";
  private apiKey: string;
  private clientId: string;
  private baseUrl: string = "https://api.hellosign.com/v3";

  constructor(
    apiKey: string = process.env.HELLOSIGN_API_KEY || "",
    clientId: string = process.env.HELLOSIGN_CLIENT_ID || ""
  ) {
    if (!apiKey) {
      throw new Error("HelloSign API key not configured");
    }
    this.apiKey = apiKey;
    this.clientId = clientId;
  }

  /**
   * Create signature request
   */
  async createEnvelope(request: CreateEnvelopeRequest): Promise<SignatureEnvelope> {
    try {
      logger.info("Creating HelloSign signature request", {
        documentName: request.documentName,
        signerCount: request.signers.length,
      });

      // Create multipart form data for HelloSign API
      const formData = new FormData();
      formData.append('test_mode', process.env.NODE_ENV === 'production' ? '0' : '1');
      formData.append('title', request.subject);
      formData.append('subject', request.subject);
      formData.append('message', request.message);
      
      // Add document
      const bufferData = request.documentBuffer instanceof Buffer
        ? new Uint8Array(request.documentBuffer).buffer
        : request.documentBuffer;
      const blob = new Blob([new Uint8Array(bufferData)], { type: 'application/pdf' });
      formData.append('file', blob, request.documentName);
      
      // Add signers
      request.signers.forEach((signer, index) => {
        formData.append(`signers[${index}][email_address]`, signer.email);
        formData.append(`signers[${index}][name]`, signer.name);
        formData.append(`signers[${index}][order]`, String(signer.order || index));
      });

      // Send to HelloSign API
      const response = await fetch(`${this.baseUrl}/signature_request/send`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HelloSign API error: ${response.status} - ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;
      const requestId = data.signature_request?.signature_request_id || `hellosign-${Date.now()}`;

      logger.info("HelloSign signature request created", { requestId, signerCount: request.signers.length });

      // Create audit log
      await createAuditLog({
        organizationId: request.organizationId,
        userId: request.userId,
        action: "SIGNATURE_ENVELOPE_CREATED",
        resourceType: "signature_envelope",
        resourceId: requestId,
        description: `Created HelloSign request for ${request.documentName}`,
        metadata: {
          provider: "hellosign",
          signerCount: request.signers.length,
        },
      });

      return {
        id: requestId,
        status: "sent",
        subject: request.subject,
        message: request.message,
        signers: request.signers,
        documentUrl: `https://app.hellosign.com/sign/${requestId}`,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to create HelloSign request", { error });
      throw error;
    }
  }

  /**
   * Get signature request status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<SignatureEnvelope> {
    try {
      const response = await fetch(`${this.baseUrl}/signature_request/${envelopeId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HelloSign API error: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;
      const request = data.signature_request;

      logger.info("Fetched HelloSign request status", { envelopeId, status: request.status });

      return {
        id: envelopeId,
        status: (request.status || 'pending') as SignatureStatus,
        subject: request.title || "Document Signing",
        message: request.message || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signers: request.signatures?.map((s: any) => ({
          name: s.signer_name,
          email: s.signer_email_address,
          role: 'signer',
        })) || [],
        documentUrl: `https://app.hellosign.com/sign/${envelopeId}`,
        createdAt: new Date(request.created_at * 1000 || new Date()),
      };
    } catch (error) {
      logger.error("Failed to get HelloSign request status", { error, envelopeId });
      throw error;
    }
  }

  /**
   * Cancel signature request
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/signature_request/cancel/${envelopeId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HelloSign API error: ${response.status}`);
      }

      logger.info("HelloSign request cancelled", { envelopeId, reason });
    } catch (error) {
      logger.error("Failed to cancel HelloSign request", { error });
      throw error;
    }
  }

  /**
   * Download final signed document
   */
  async downloadSignedDocument(envelopeId: string): Promise<Buffer> {
    try {
      const response = await fetch(`${this.baseUrl}/signature_request/download_files/${envelopeId}?file_type=pdf`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HelloSign API error: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      logger.info("Downloaded HelloSign signed document", { envelopeId, size: buffer.byteLength });
      return Buffer.from(buffer);
    } catch (error) {
      logger.error("Failed to download HelloSign document", { error });
      throw error;
    }
  }

  /**
   * Send reminder to signer
   */
  async sendReminder(envelopeId: string, signerEmail: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/signature_request/remind`, {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from(`${this.apiKey}:`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          signature_request_id: envelopeId,
          email_address: signerEmail,
        }).toString(),
      });

      if (!response.ok) {
        throw new Error(`HelloSign API error: ${response.status}`);
      }

      logger.info("HelloSign reminder sent", { envelopeId, signerEmail });
    } catch (error) {
      logger.error("Failed to send HelloSign reminder", { error });
      throw error;
    }
  }
}

// ============================================================================
// ADOBE SIGN PROVIDER
// ============================================================================

export class AdobeSignProvider implements SignatureProvider {
  name: SignatureProviderType = "adobe_sign";
  private apiKey: string;
  private baseUrl: string;

  constructor(
    apiKey: string = process.env.ADOBE_SIGN_API_KEY || "",
    baseUrl: string = process.env.ADOBE_SIGN_BASE_URL || "https://api.na1.adobesign.com/api/rest/v6"
  ) {
    if (!apiKey) {
      throw new Error("Adobe Sign API key not configured");
    }
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
  }

  /**
   * Create Adobe Sign agreement
   */
  async createEnvelope(request: CreateEnvelopeRequest): Promise<SignatureEnvelope> {
    try {
      logger.info("Creating Adobe Sign agreement", {
        documentName: request.documentName,
        signerCount: request.signers.length,
      });

      // Step 1: Upload document as transient document
      const uploadFormData = new FormData();
      const bufferData = request.documentBuffer instanceof Buffer
        ? new Uint8Array(request.documentBuffer).buffer
        : request.documentBuffer;
      const blob = new Blob([new Uint8Array(bufferData)], { type: 'application/pdf' });
      uploadFormData.append('File', blob, request.documentName);

      const uploadResponse = await fetch(`${this.baseUrl}/transientDocuments`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: uploadFormData,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Adobe Sign upload error: ${uploadResponse.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const uploadData = await uploadResponse.json() as any;
      const transientDocumentId = uploadData.transientDocumentId;

      // Step 2: Create agreement from transient document
      const agreementData = {
        fileInfos: [{
          transientDocumentId,
        }],
        name: request.subject,
        participantSetsInfo: [{
          order: 1,
          role: 'SIGNER',
          memberInfos: request.signers.map(s => ({
            email: s.email,
            name: s.name,
          })),
        }],
        signatureType: 'ESIGN',
        state: 'IN_PROCESS',
        message: request.message,
      };

      const createResponse = await fetch(`${this.baseUrl}/agreements`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(agreementData),
      });

      if (!createResponse.ok) {
        const errorText = await createResponse.text();
        throw new Error(`Adobe Sign API error: ${createResponse.status} - ${errorText}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await createResponse.json() as any;
      const agreementId = data.id || `adobe-sign-${Date.now()}`;

      logger.info("Adobe Sign agreement created", { agreementId, signerCount: request.signers.length });

      // Create audit log
      await createAuditLog({
        organizationId: request.organizationId,
        userId: request.userId,
        action: "SIGNATURE_ENVELOPE_CREATED",
        resourceType: "signature_envelope",
        resourceId: agreementId,
        description: `Created Adobe Sign agreement for ${request.documentName}`,
        metadata: {
          provider: "adobe_sign",
          signerCount: request.signers.length,
        },
      });

      return {
        id: agreementId,
        status: "sent",
        subject: request.subject,
        message: request.message,
        signers: request.signers,
        documentUrl: `https://secure.na1.adobesign.com/agreements/${agreementId}`,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error("Failed to create Adobe Sign agreement", { error });
      throw error;
    }
  }

  /**
   * Get agreement status
   */
  async getEnvelopeStatus(envelopeId: string): Promise<SignatureEnvelope> {
    try {
      const response = await fetch(`${this.baseUrl}/agreements/${envelopeId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Adobe Sign API error: ${response.status}`);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data = await response.json() as any;

      logger.info("Fetched Adobe Sign agreement status", { envelopeId, status: data.status });

      return {
        id: envelopeId,
        status: (data.status || 'pending') as SignatureStatus,
        subject: data.name || "Document Signing",
        message: data.message || "",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        signers: data.participantSetsInfo?.[0]?.memberInfos?.map((m: any) => ({
          name: m.name,
          email: m.email,
          role: 'signer',
        })) || [],
        documentUrl: `https://secure.na1.adobesign.com/agreements/${envelopeId}`,
        createdAt: new Date(data.createdDate || new Date()),
      };
    } catch (error) {
      logger.error("Failed to get Adobe Sign agreement status", { error, envelopeId });
      throw error;
    }
  }

  /**
   * Cancel agreement
   */
  async voidEnvelope(envelopeId: string, reason: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/agreements/${envelopeId}/state`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          state: 'CANCELLED',
          redirectUrl: null,
        }),
      });

      if (!response.ok) {
        throw new Error(`Adobe Sign API error: ${response.status}`);
      }

      logger.info("Adobe Sign agreement cancelled", { envelopeId, reason });
    } catch (error) {
      logger.error("Failed to cancel Adobe Sign agreement", { error });
      throw error;
    }
  }

  /**
   * Download signed document
   */
  async downloadSignedDocument(envelopeId: string): Promise<Buffer> {
    try {
      const response = await fetch(`${this.baseUrl}/agreements/${envelopeId}/combinedDocument`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Adobe Sign API error: ${response.status}`);
      }

      const buffer = await response.arrayBuffer();
      logger.info("Downloaded Adobe Sign signed document", { envelopeId, size: buffer.byteLength });
      return Buffer.from(buffer);
    } catch (error) {
      logger.error("Failed to download Adobe Sign document", { error });
      throw error;
    }
  }

  /**
   * Send reminder to participant
   */
  async sendReminder(envelopeId: string, signerEmail: string): Promise<void> {
    try {
      const response = await fetch(`${this.baseUrl}/agreements/${envelopeId}/reminders`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          reminderFrequency: 'DAILY_UNTIL_SIGNED',
          reminderDaysBeforeSigningDeadline: 1,
          firstReminderDelay: 1,
        }),
      });

      if (!response.ok) {
        throw new Error(`Adobe Sign API error: ${response.status}`);
      }

      logger.info("Adobe Sign reminder sent", { envelopeId, signerEmail });
    } catch (error) {
      logger.error("Failed to send Adobe Sign reminder", { error });
      throw error;
    }
  }
}

// ============================================================================
// PROVIDER FACTORY
// ============================================================================

/**
 * Get signature provider by type
 */
export function getSignatureProvider(
  providerType: SignatureProviderType = "docusign"
): SignatureProvider {
  switch (providerType) {
    case "docusign":
      return new DocuSignProvider();
    case "hellosign":
      return new HelloSignProvider();
    case "adobe_sign":
      return new AdobeSignProvider();
    default:
      throw new Error(`Unknown signature provider: ${providerType}`);
  }
}

// eslint-disable-next-line import/no-anonymous-default-export
export default {
  DocuSignProvider,
  HelloSignProvider,
  AdobeSignProvider,
  getSignatureProvider,
};

