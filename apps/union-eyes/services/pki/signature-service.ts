// =====================================================================================
// PKI Signature Service
// =====================================================================================
// Purpose: Handle document signing operations with digital signatures
// Features:
// - Document hash generation (SHA-512)
// - Digital signature creation with private keys
// - Signature request workflow management
// - Multi-party signing support
// - Audit trail logging
// =====================================================================================

import { db } from '@/db';
import { digitalSignatures } from '@/services/financial-service/src/db/schema';
import { eq, and, lte } from 'drizzle-orm';
import crypto from 'crypto';
import { getUserCertificate } from './certificate-manager';
import { signatureWorkflows, signers } from '@/db/schema/domains/documents';
import { logger } from '@/lib/logger';

// =====================================================================================
// TYPES
// =====================================================================================

export interface SignatureRequest {
  id: string;
  documentId: string;
  documentType: string;
  requesterId: string;
  requesterName: string;
  organizationId: string;
  requiredSigners: SignerRequirement[];
  dueDate?: Date;
  status: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
  createdAt: Date;
  completedAt?: Date;
}

export interface SignerRequirement {
  userId: string;
  userName: string;
  order: number; // For sequential signing
  role?: string;
  required: boolean;
  signedAt?: Date;
  signatureId?: string;
}

export interface SignDocumentParams {
  documentId: string;
  documentType: string;
  documentUrl?: string;
  userId: string;
  userName: string;
  userTitle?: string;
  userEmail?: string;
  organizationId: string;
  privateKeyPem?: string; // Optional: for actual signing
  password?: string; // For encrypted private keys
  ipAddress?: string;
  userAgent?: string;
  geolocation?: string;
}

export interface SignatureResult {
  signatureId: string;
  documentHash: string;
  signedAt: Date;
  certificateThumbprint: string;
}

// =====================================================================================
// DOCUMENT HASHING
// =====================================================================================

/**
 * Generate SHA-512 hash of document content
 * For file documents, caller should read file content first
 */
export function hashDocument(content: Buffer | string): string {
  const hash = crypto.createHash('sha512');
  hash.update(content);
  return hash.digest('hex');
}

/**
 * Generate hash from document URL/ID (for database records)
 * Creates deterministic hash based on document identifier
 */
export function hashDocumentReference(
  documentType: string,
  documentId: string,
  organizationId: string
): string {
  const reference = `${documentType}:${documentId}:${organizationId}`;
  return hashDocument(reference);
}

// =====================================================================================
// SIGNING OPERATIONS
// =====================================================================================

/**
 * Sign a document with user's stored certificate
 * For actual digital signatures, use signDocumentWithKey instead
 */
export async function signDocument(
  params: SignDocumentParams
): Promise<SignatureResult> {
  // Get user's active certificate
  const cert = await getUserCertificate(params.userId, params.organizationId);
  if (!cert) {
    throw new Error('No active certificate found for user');
  }

  // Generate document hash
  const documentHash = hashDocumentReference(
    params.documentType,
    params.documentId,
    params.organizationId
  );

  // Check for duplicate signature
  const existing = await db
    .select()
    .from(digitalSignatures)
    .where(
      and(
        eq(digitalSignatures.documentId, params.documentId),
        eq(digitalSignatures.signerUserId, params.userId),
        eq(digitalSignatures.signatureStatus, 'signed')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Document already signed by this user');
  }

  // Create signature record
  const [signature] = await db
    .insert(digitalSignatures)
    .values({
      organizationId: params.organizationId,
      documentType: params.documentType,
      documentId: params.documentId,
      documentHash,
      documentUrl: params.documentUrl,
      signatureType: 'digital_signature',
      signatureStatus: 'signed',
      signerUserId: params.userId,
      signerName: params.userName,
      signerTitle: params.userTitle,
      signerEmail: params.userEmail,
      certificateSubject: JSON.stringify(cert.certificateInfo.subject),
      certificateIssuer: JSON.stringify(cert.certificateInfo.issuer),
      certificateSerialNumber: cert.certificateInfo.serialNumber,
      certificateThumbprint: cert.certificateInfo.fingerprint,
      certificateNotBefore: cert.certificateInfo.validFrom.toISOString(),
      certificateNotAfter: cert.certificateInfo.validTo.toISOString(),
      signatureAlgorithm: 'SHA-512',
      signatureValue: 'ATTESTATION', // Attestation signature (no cryptographic signature value)
      // Note: For full PKI signatures with private key signing, use signDocumentWithKey()
      // which generates actual cryptographic signature values using RSA/ECDSA algorithms
      publicKey: cert.certificateInfo.publicKey,
      signedAt: new Date().toISOString(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
    })
    .returning();

  return {
    signatureId: signature.id,
    documentHash,
    signedAt: new Date(signature.signedAt!),
    certificateThumbprint: signature.certificateThumbprint!,
  };
}

/**
 * Sign document with actual cryptographic signature using private key
 * For production use with real PKI infrastructure
 */
export async function signDocumentWithKey(
  params: SignDocumentParams & {
    documentContent: Buffer | string;
    privateKeyPem: string;
    password?: string;
  }
): Promise<SignatureResult> {
  // Get user's active certificate
  const cert = await getUserCertificate(params.userId, params.organizationId);
  if (!cert) {
    throw new Error('No active certificate found for user');
  }

  // Generate document hash
  const documentHash = hashDocument(params.documentContent);

  // Check for duplicate signature
  const existing = await db
    .select()
    .from(digitalSignatures)
    .where(
      and(
        eq(digitalSignatures.documentId, params.documentId),
        eq(digitalSignatures.signerUserId, params.userId),
        eq(digitalSignatures.signatureStatus, 'signed')
      )
    )
    .limit(1);

  if (existing.length > 0) {
    throw new Error('Document already signed by this user');
  }

  // Decrypt private key if password provided
  let privateKey: crypto.KeyObject;
  try {
    if (params.password) {
      privateKey = crypto.createPrivateKey({
        key: params.privateKeyPem,
        format: 'pem',
        passphrase: params.password,
      });
    } else {
      privateKey = crypto.createPrivateKey({
        key: params.privateKeyPem,
        format: 'pem',
      });
    }
  } catch (error) {
    throw new Error('Failed to decrypt private key: ' + (error as Error).message);
  }

  // Generate cryptographic signature
  const sign = crypto.createSign('RSA-SHA512');
  sign.update(documentHash);
  sign.end();
  const signatureValue = sign.sign(privateKey, 'base64');

  // Create signature record
  const [signature] = await db
    .insert(digitalSignatures)
    .values({
      organizationId: params.organizationId,
      documentType: params.documentType,
      documentId: params.documentId,
      documentHash,
      documentUrl: params.documentUrl,
      signatureType: 'document_approval',
      signatureStatus: 'signed',
      signerUserId: params.userId,
      signerName: params.userName,
      signerTitle: params.userTitle,
      signerEmail: params.userEmail,
      certificateSubject: JSON.stringify(cert.certificateInfo.subject),
      certificateIssuer: JSON.stringify(cert.certificateInfo.issuer),
      certificateSerialNumber: cert.certificateInfo.serialNumber,
      certificateThumbprint: cert.certificateInfo.fingerprint,
      certificateNotBefore: cert.certificateInfo.validFrom.toISOString(),
      certificateNotAfter: cert.certificateInfo.validTo.toISOString(),
      signatureAlgorithm: 'RSA-SHA512',
      signatureValue,
      publicKey: cert.certificateInfo.publicKey,
      signedAt: new Date().toISOString(),
      ipAddress: params.ipAddress,
      userAgent: params.userAgent,
      geolocation: params.geolocation,
    })
    .returning();

  return {
    signatureId: signature.id,
    documentHash,
    signedAt: new Date(signature.signedAt!),
    certificateThumbprint: signature.certificateThumbprint!,
  };
}

/**
 * Get all signatures for a document
 */
export async function getDocumentSignatures(
  documentId: string,
  organizationId?: string
// eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any[]> {
  const conditions = [eq(digitalSignatures.documentId, documentId)];
  
  if (organizationId) {
    conditions.push(eq(digitalSignatures.organizationId, organizationId));
  }

  const signatures = await db
    .select()
    .from(digitalSignatures)
    .where(and(...conditions))
    .orderBy(digitalSignatures.signedAt);

  return signatures.map(sig => ({
    id: sig.id,
    signerUserId: sig.signerUserId,
    signerName: sig.signerName,
    signerTitle: sig.signerTitle,
    signerEmail: sig.signerEmail,
    signatureStatus: sig.signatureStatus,
    signedAt: sig.signedAt ? new Date(sig.signedAt) : null,
    certificateThumbprint: sig.certificateThumbprint,
    isVerified: sig.isVerified,
    verifiedAt: sig.verifiedAt ? new Date(sig.verifiedAt) : null,
  }));
}

/**
 * Reject a signature (for workflow approvals)
 */
export async function rejectSignature(
  signatureId: string,
  rejectionReason: string,
  _rejectedBy: string
): Promise<void> {
  await db
    .update(digitalSignatures)
    .set({
      signatureStatus: 'rejected',
      rejectedAt: new Date().toISOString(),
      rejectionReason,
    })
    .where(eq(digitalSignatures.id, signatureId));
}

// =====================================================================================
// SIGNATURE WORKFLOW MANAGEMENT
// =====================================================================================

/**
 * Create signature request workflow
 * For multi-party document signing (e.g., collective agreements, contracts)
 */
export async function createSignatureRequest(
  documentId: string,
  documentType: string,
  organizationId: string,
  requesterId: string,
  requesterName: string,
  requiredSigners: Omit<SignerRequirement, 'signedAt' | 'signatureId'>[],
  dueDate?: Date
): Promise<SignatureRequest> {
  try {
    // Sort signers by order for sequential signing
    const sortedSigners = [...requiredSigners].sort((a, b) => a.order - b.order);

    // Generate unique workflow ID
    const workflowId = crypto.randomUUID();

    // Create workflow in database
    const _newWorkflow = await db.insert(signatureWorkflows).values({
      id: workflowId,
      organizationId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      documentId: documentId as any,
      name: `Signature Request - ${documentType}`,
      description: `Multi-party signature workflow for ${documentType} document`,
      status: 'draft',
      provider: 'docusign', // Default provider
      externalEnvelopeId: `envelope-${workflowId}`,
      totalSigners: sortedSigners.length,
      completedSignatures: 0,
      expiresAt: dueDate,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      createdBy: requesterId as any,
      workflowData: {
        requesterName,
        signings: sortedSigners,
        documentType,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any,
    }).returning();

    // Create signer records with email lookup
    for (const signer of sortedSigners) {
      // Query signer email from users table
      let signerEmail = `signer-${signer.order}@example.com`; // Fallback
      
      try {
        const userQuery = await db.query.users.findFirst({
          where: (users, { eq }) => eq(users.userId, signer.userId),
          columns: { email: true },
        });
        
        if (userQuery?.email) {
          signerEmail = userQuery.email;
        } else {
          logger.warn('PKI signature workflow: User email not found', {
            workflowId,
            userId: signer.userId,
            userName: signer.userName,
            usingFallback: signerEmail
          });
        }
      } catch (error) {
        logger.error('PKI signature workflow: Failed to query user email', {
          workflowId,
          userId: signer.userId,
          error
        });
      }
      
      await db.insert(signers).values({
        workflowId,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        memberId: signer.userId as any,
        email: signerEmail,
        name: signer.userName,
        signerOrder: signer.order,
        status: 'pending',
        externalSignerId: `signer-${signer.order}`,
      });
    }

    return {
      id: workflowId,
      documentId,
      documentType,
      requesterId,
      requesterName,
      organizationId,
      requiredSigners: sortedSigners,
      dueDate,
      status: 'pending',
      createdAt: new Date(),
    };
  } catch (error) {
    logger.error('Failed to create signature request', { error, documentId, organizationId });
    throw error;
  }
}

/**
 * Get signature requests for user (pending signatures)
 */
export async function getUserSignatureRequests(
  userId: string,
  organizationId?: string,
  status?: 'pending' | 'in_progress' | 'completed' | 'expired'
): Promise<SignatureRequest[]> {
  try {
    // Query workflows where user is a signer
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const conditions = [eq(signers.memberId, userId as any)];

    if (organizationId) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(signatureWorkflows.organizationId, organizationId as any));
    }

    if (status) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      conditions.push(eq(signatureWorkflows.status, status as any));
    }

    const results = await db
      .select({
        workflow: signatureWorkflows,
        signer: signers,
      })
      .from(signatureWorkflows)
      .innerJoin(signers, eq(signers.workflowId, signatureWorkflows.id))
      .where(and(...conditions));

    // Group by workflow and reconstruct SignatureRequest objects
    const workflowMap = new Map<string, SignatureRequest>();
    
    for (const result of results) {
      const workflowId = result.workflow.id;
      
      if (!workflowMap.has(workflowId)) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const workflowData = result.workflow.workflowData as any;
        workflowMap.set(workflowId, {
          id: workflowId,
          documentId: result.workflow.documentId,
          documentType: workflowData?.documentType || 'unknown',
          requesterId: result.workflow.createdBy || '',
          requesterName: workflowData?.requesterName || 'Unknown',
          organizationId: result.workflow.organizationId,
          requiredSigners: workflowData?.signings || [],
          dueDate: result.workflow.expiresAt || undefined,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          status: result.workflow.status as any,
          createdAt: result.workflow.createdAt,
          completedAt: result.workflow.completedAt || undefined,
        });
      }
    }

    return Array.from(workflowMap.values());
  } catch (error) {
    logger.error('Failed to get user signature requests', { error, userId, organizationId });
    throw error;
  }
}

/**
 * Complete signature request step
 * Updates workflow when signer completes their signature
 */
export async function completeSignatureRequestStep(
  workflowId: string,
  userId: string,
  signatureId: string
): Promise<SignatureRequest> {
  try {
    // Find the signer in this workflow
    const [signer] = await db
      .select()
      .from(signers)
      .where(
        and(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(signers.workflowId, workflowId as any),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(signers.memberId, userId as any)
        )
      );

    if (!signer) {
      throw new Error(`Signer not found in workflow ${workflowId}`);
    }

    // Update signer status to signed
    await db
      .update(signers)
      .set({
        status: 'signed',
        signedAt: new Date(),
        externalSignerId: signatureId,
        updatedAt: new Date(),
      })
      .where(eq(signers.id, signer.id));

    // Check if all signers are now signed
    const pendingSigners = await db
      .select()
      .from(signers)
      .where(
        and(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(signers.workflowId, workflowId as any),
          eq(signers.status, 'pending')
        )
      );

    // If no pending signers, mark workflow as completed
    if (pendingSigners.length === 0) {
      await db
        .update(signatureWorkflows)
        .set({
          status: 'completed',
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .where(eq(signatureWorkflows.id, workflowId as any));
    }

    // Fetch and return updated workflow
    const [workflow] = await db
      .select()
      .from(signatureWorkflows)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(signatureWorkflows.id, workflowId as any));

    const workflowSigners = await db
      .select()
      .from(signers)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(signers.workflowId, workflowId as any));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const workflowData = workflow.workflowData as any;

    return {
      id: workflowId,
      documentId: workflow.documentId,
      documentType: workflowData?.documentType || 'unknown',
      requesterId: workflow.createdBy || '',
      requesterName: workflowData?.requesterName || 'Unknown',
      organizationId: workflow.organizationId,
      requiredSigners: workflowSigners.map(s => ({
        userId: s.memberId || '',
        userName: s.name,
        order: s.signerOrder,
        role: 'signer',
        required: true,
        signedAt: s.signedAt || undefined,
        signatureId: s.externalSignerId || undefined,
      })),
      dueDate: workflow.expiresAt || undefined,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      status: workflow.status as any,
      createdAt: workflow.createdAt,
      completedAt: workflow.completedAt || undefined,
    };
  } catch (error) {
    logger.error('Failed to complete signature request step', { error, workflowId, userId });
    throw error;
  }
}

/**
 * Cancel signature request
 */
export async function cancelSignatureRequest(
  workflowId: string,
  cancelledBy: string,
  cancellationReason: string
): Promise<void> {
  try {
    await db
      .update(signatureWorkflows)
      .set({
        status: 'cancelled',
        voidedAt: new Date(),
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        voidedBy: cancelledBy as any,
        voidReason: cancellationReason,
        updatedAt: new Date(),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .where(eq(signatureWorkflows.id, workflowId as any));

    // Update all pending signers to skipped status
    await db
      .update(signers)
      .set({
        status: 'skipped',
        updatedAt: new Date(),
      })
      .where(
        and(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(signers.workflowId, workflowId as any),
          eq(signers.status, 'pending')
        )
      );

    logger.info('Signature request cancelled', { workflowId, cancelledBy, reason: cancellationReason });
  } catch (error) {
    logger.error('Failed to cancel signature request', { error, workflowId, cancelledBy });
    throw error;
  }
}

/**
 * Expire signature requests past due date
 * Should be called by cron job
 */
export async function expireOverdueSignatureRequests(): Promise<number> {
  try {
    // Find all workflows that haven't been completed and are past their expiration date
    const overdueWorkflows = await db
      .select()
      .from(signatureWorkflows)
      .where(
        and(
          lte(signatureWorkflows.expiresAt, new Date()),
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          eq(signatureWorkflows.status, 'in_progress' as any)
        )
      );

    if (overdueWorkflows.length === 0) {
      logger.info('No overdue signature workflows to expire');
      return 0;
    }

    // Update each workflow to expired status
    for (const workflow of overdueWorkflows) {
      await db
        .update(signatureWorkflows)
        .set({
          status: 'expired',
          updatedAt: new Date(),
        })
        .where(eq(signatureWorkflows.id, workflow.id));

      // Update pending signers to skipped
      await db
        .update(signers)
        .set({
          status: 'skipped',
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(signers.workflowId, workflow.id),
            eq(signers.status, 'pending')
          )
        );
    }

    logger.info('Expired overdue signature workflows', { count: overdueWorkflows.length });
    return overdueWorkflows.length;
  } catch (error) {
    logger.error('Failed to expire overdue signature requests', { error });
    throw error;
  }
}

// =====================================================================================
// EXPORTS
// =====================================================================================

export const SignatureService = {
  hashDocument,
  hashDocumentReference,
  signDocument,
  signDocumentWithKey,
  getDocumentSignatures,
  rejectSignature,
  createSignatureRequest,
  getUserSignatureRequests,
  completeSignatureRequestStep,
  cancelSignatureRequest,
  expireOverdueSignatureRequests,
};
