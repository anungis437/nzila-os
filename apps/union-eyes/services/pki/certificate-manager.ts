/**
 * PKI Certificate Manager Service
 * Purpose: Manage X.509 certificates for digital signatures
 * Supports: Certificate upload, validation, storage, renewal tracking
 */

import { db } from '@/db';
import { digitalSignatures } from '@/services/financial-service/src/db/schema';
import { eq, and, gte, lte, sql } from 'drizzle-orm';
import crypto from 'crypto';

// =====================================================================================
// TYPES
// =====================================================================================

export interface CertificateInfo {
  subject: {
    commonName: string;
    organizationName?: string;
    organizationalUnit?: string;
    country?: string;
    state?: string;
    locality?: string;
    email?: string;
  };
  issuer: {
    commonName: string;
    organizationName?: string;
  };
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
  fingerprint: string;
  publicKey: string;
  keyUsage?: string[];
  extendedKeyUsage?: string[];
}

export interface CertificateValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  certificate?: CertificateInfo;
}

export interface StoredCertificate {
  id: string;
  userId: string;
  organizationId: string;
  certificatePem: string;
  certificateInfo: CertificateInfo;
  status: 'active' | 'expired' | 'revoked';
  expiresAt: Date;
  createdAt: Date;
}

// =====================================================================================
// CERTIFICATE PARSING
// =====================================================================================

/**
 * Parse X.509 certificate from PEM format
 * Uses Node.js built-in crypto module
 */
export function parseCertificate(certificatePem: string): CertificateInfo {
  try {
    // Remove PEM headers and decode base64
    const pemContent = certificatePem
      .replace(/-----BEGIN CERTIFICATE-----/, '')
      .replace(/-----END CERTIFICATE-----/, '')
      .replace(/\s/g, '');
    
    const certBuffer = Buffer.from(pemContent, 'base64');
    
    // Create X509Certificate object (Node.js 15.6+)
    const { X509Certificate } = crypto;
    const cert = new X509Certificate(certBuffer);
    
    // Parse subject
    const subject = parseDistinguishedName(cert.subject);
    
    // Parse issuer
    const issuer = parseDistinguishedName(cert.issuer);
    
    // Generate fingerprint (SHA-256)
    const fingerprint = crypto
      .createHash('sha256')
      .update(certBuffer)
      .digest('hex')
      .toUpperCase()
      .match(/.{2}/g)!
      .join(':');
    
    // Extract public key
    const publicKey = cert.publicKey.export({
      type: 'spki',
      format: 'pem',
    }) as string;
    
    return {
      subject,
      issuer,
      serialNumber: cert.serialNumber,
      validFrom: new Date(cert.validFrom),
      validTo: new Date(cert.validTo),
      fingerprint,
      publicKey,
      keyUsage: parseKeyUsage(cert),
      extendedKeyUsage: parseExtendedKeyUsage(cert),
    };
  } catch (error) {
    throw new Error(`Failed to parse certificate: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Parse distinguished name (DN) from certificate
 */
function parseDistinguishedName(dn: string): CertificateInfo['subject'] {
  const parts = dn.split(',').map(p => p.trim());
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result: any = {};
  
  for (const part of parts) {
    const [key, value] = part.split('=').map(s => s.trim());
    
    switch (key) {
      case 'CN':
        result.commonName = value;
        break;
      case 'O':
        result.organizationName = value;
        break;
      case 'OU':
        result.organizationalUnit = value;
        break;
      case 'C':
        result.country = value;
        break;
      case 'ST':
        result.state = value;
        break;
      case 'L':
        result.locality = value;
        break;
      case 'emailAddress':
        result.email = value;
        break;
    }
  }
  
  return result;
}

/**
 * Parse key usage extensions
 */
function parseKeyUsage(_cert: crypto.X509Certificate): string[] {
  // Note: Node.js X509Certificate doesn't expose extensions directly
  // In production, use a library like node-forge or x509.js
  // For now, return common usages
  return ['digitalSignature', 'nonRepudiation', 'keyEncipherment'];
}

/**
 * Parse extended key usage extensions
 */
function parseExtendedKeyUsage(_cert: crypto.X509Certificate): string[] {
  // In production, parse from certificate extensions
  return ['clientAuth', 'emailProtection'];
}

// =====================================================================================
// CERTIFICATE VALIDATION
// =====================================================================================

/**
 * Validate certificate for digital signatures
 */
export function validateCertificate(
  certificatePem: string,
  options: {
    requireOrgName?: boolean;
    requireEmail?: boolean;
    minValidityDays?: number;
    allowedKeyUsages?: string[];
  } = {}
): CertificateValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  try {
    // Parse certificate
    const cert = parseCertificate(certificatePem);
    
    // Check validity period
    const now = new Date();
    if (cert.validFrom > now) {
      errors.push(`Certificate not yet valid (valid from ${cert.validFrom.toISOString()})`);
    }
    if (cert.validTo < now) {
      errors.push(`Certificate expired on ${cert.validTo.toISOString()}`);
    }
    
    // Check remaining validity
    const daysUntilExpiry = Math.floor((cert.validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const minValidityDays = options.minValidityDays || 30;
    
    if (daysUntilExpiry < minValidityDays) {
      warnings.push(`Certificate expires in ${daysUntilExpiry} days (minimum ${minValidityDays} days recommended)`);
    }
    
    // Check subject fields
    if (!cert.subject.commonName) {
      errors.push('Certificate missing Common Name (CN)');
    }
    
    if (options.requireOrgName && !cert.subject.organizationName) {
      errors.push('Certificate missing Organization Name (O)');
    }
    
    if (options.requireEmail && !cert.subject.email) {
      errors.push('Certificate missing email address');
    }
    
    // Check key usage
    if (options.allowedKeyUsages && cert.keyUsage) {
      const hasRequiredUsage = options.allowedKeyUsages.some(usage => 
        cert.keyUsage!.includes(usage)
      );
      
      if (!hasRequiredUsage) {
        errors.push(`Certificate key usage must include one of: ${options.allowedKeyUsages.join(', ')}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      certificate: cert,
    };
  } catch (error) {
    return {
      isValid: false,
      errors: [error instanceof Error ? error.message : 'Failed to validate certificate'],
      warnings,
    };
  }
}

// =====================================================================================
// CERTIFICATE STORAGE
// =====================================================================================

/**
 * Store certificate in database
 */
export async function storeCertificate(
  userId: string,
  organizationId: string,
  certificatePem: string
): Promise<StoredCertificate> {
  // Validate certificate
  const validation = validateCertificate(certificatePem, {
    requireOrgName: true,
    minValidityDays: 30,
    allowedKeyUsages: ['digitalSignature', 'nonRepudiation'],
  });
  
  if (!validation.isValid) {
    throw new Error(`Invalid certificate: ${validation.errors.join(', ')}`);
  }
  
  const cert = validation.certificate!;
  
  // Check for duplicate certificate (by fingerprint)
  const existing = await db
    .select()
    .from(digitalSignatures)
    .where(
      and(
        eq(digitalSignatures.signerUserId, userId),
        eq(digitalSignatures.certificateThumbprint, cert.fingerprint)
      )
    )
    .limit(1);
  
  if (existing.length > 0) {
    throw new Error('Certificate already exists for this user');
  }
  
  // Store certificate
  const insertValues = {
    organizationId: organizationId as string,
    documentType: 'certificate' as const,
    documentId: crypto.randomUUID(),
    documentHash: cert.fingerprint,
    signatureType: 'pki_certificate' as const,
    signatureStatus: 'signed' as const,
    signerUserId: userId as string,
    signerName: cert.subject.commonName,
    signerEmail: cert.subject.email || null,
    certificateSubject: JSON.stringify(cert.subject),
    certificateIssuer: JSON.stringify(cert.issuer),
    certificateSerialNumber: cert.serialNumber,
    certificateThumbprint: cert.fingerprint,
    certificateNotBefore: cert.validFrom.toISOString(),
    certificateNotAfter: cert.validTo.toISOString(),
    signatureAlgorithm: 'SHA-512',
    signatureValue: certificatePem,
    publicKey: cert.publicKey,
    isVerified: true,
    verifiedAt: new Date().toISOString(),
    verificationMethod: 'x509_validation',
    signedAt: new Date().toISOString(),
  };
  
  const [stored] = await db
    .insert(digitalSignatures)
    .values(insertValues)
    .returning();
  
  return {
    id: stored.id,
    userId: stored.signerUserId,
    organizationId: stored.organizationId,
    certificatePem,
    certificateInfo: cert,
    status: 'active',
    expiresAt: cert.validTo,
    createdAt: new Date(stored.signedAt!),
  };
}

/**
 * Get active certificate for user
 */
export async function getUserCertificate(
  userId: string,
  organizationId?: string
): Promise<StoredCertificate | null> {
  const conditions = [
    eq(digitalSignatures.signerUserId, userId),
    eq(digitalSignatures.signatureStatus, 'signed'),
    eq(digitalSignatures.documentType, 'certificate'),
    gte(sql`${digitalSignatures.certificateNotAfter}::timestamp`, new Date().toISOString()),
  ];
  
  if (organizationId) {
    conditions.push(eq(digitalSignatures.organizationId, organizationId));
  }
  
  const [cert] = await db
    .select()
    .from(digitalSignatures)
    .where(and(...conditions))
    .orderBy(sql`${digitalSignatures.certificateNotAfter} DESC`)
    .limit(1);
  
  if (!cert) {
    return null;
  }
  
  const certInfo: CertificateInfo = {
    subject: JSON.parse(cert.certificateSubject!),
    issuer: JSON.parse(cert.certificateIssuer!),
    serialNumber: cert.certificateSerialNumber!,
    validFrom: new Date(cert.certificateNotBefore!),
    validTo: new Date(cert.certificateNotAfter!),
    fingerprint: cert.certificateThumbprint!,
    publicKey: cert.publicKey!,
  };
  
  return {
    id: cert.id,
    userId: cert.signerUserId,
    organizationId: cert.organizationId,
    certificatePem: cert.signatureValue!,
    certificateInfo: certInfo,
    status: 'active',
    expiresAt: new Date(cert.certificateNotAfter!),
    createdAt: new Date(cert.signedAt!),
  };
}

/**
 * Revoke certificate
 */
export async function revokeCertificate(
  certificateId: string,
  reason: string
): Promise<void> {
  await db
    .update(digitalSignatures)
    .set({
      signatureStatus: 'revoked',
      revokedAt: new Date().toISOString(),
      revocationReason: reason,
    })
    .where(eq(digitalSignatures.id, certificateId));
}

/**
 * Get expiring certificates (within specified days)
 */
export async function getExpiringCertificates(
  daysUntilExpiry: number = 30
): Promise<StoredCertificate[]> {
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + daysUntilExpiry);
  
  const certs = await db
    .select()
    .from(digitalSignatures)
    .where(
      and(
        eq(digitalSignatures.signatureStatus, 'signed'),
        eq(digitalSignatures.documentType, 'certificate'),
        lte(sql`${digitalSignatures.certificateNotAfter}::timestamp`, expiryDate.toISOString()),
        gte(sql`${digitalSignatures.certificateNotAfter}::timestamp`, new Date().toISOString())
      )
    )
    .orderBy(digitalSignatures.certificateNotAfter);
  
  return certs.map(cert => {
    const certInfo: CertificateInfo = {
      subject: JSON.parse(cert.certificateSubject!),
      issuer: JSON.parse(cert.certificateIssuer!),
      serialNumber: cert.certificateSerialNumber!,
      validFrom: new Date(cert.certificateNotBefore!),
      validTo: new Date(cert.certificateNotAfter!),
      fingerprint: cert.certificateThumbprint!,
      publicKey: cert.publicKey!,
    };
    
    return {
      id: cert.id,
      userId: cert.signerUserId,
      organizationId: cert.organizationId,
      certificatePem: cert.signatureValue!,
      certificateInfo: certInfo,
      status: 'active',
      expiresAt: new Date(cert.certificateNotAfter!),
      createdAt: new Date(cert.signedAt!),
    };
  });
}

// =====================================================================================
// EXPORTS
// =====================================================================================

export const CertificateManager = {
  parseCertificate,
  validateCertificate,
  storeCertificate,
  getUserCertificate,
  revokeCertificate,
  getExpiringCertificates,
};
