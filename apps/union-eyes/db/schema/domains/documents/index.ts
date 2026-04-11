/**
 * Documents Domain
 * 
 * Document storage and e-signature schemas.
 * 
 * This domain consolidates:
 * - documents-schema.ts
 * - member-documents-schema.ts
 * - e-signature-schema.ts
 * - signature-workflows-schema.ts
 * 
 * Priority: 7
 * 
 * Duplicates to resolve:
 * - signerStatusEnum (2 locations)
 * - signatureProviderEnum (2 locations)
 */

// Export all document-related schemas from consolidated domain location
export * from './documents';
export * from './member-documents';
export * from './signatures';
export * from './workflows';
export * from './correspondence';

// Explicit re-exports to resolve ambiguities
// signatureProviderEnum and signerStatusEnum exist in both signatures.ts and workflows.ts
// Use the main definitions from signatures.ts
export { signatureProviderEnum, signerStatusEnum } from './signatures';
