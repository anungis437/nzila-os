/**
 * EC-007-01 — synthetic representation / matter / document grant fixture.
 *
 * Rows match the existing representation_authorities,
 * external_matter_access_grants, and external_document_access_grants
 * shapes. This module does not create a schema, tenant, or connector.
 * Calling buildSandboxSeed() is idempotent: identifiers and timestamps
 * are fixed.
 */

import { SANDBOX_PERSONAS, SANDBOX_USER_IDS, type SandboxPersona } from './personas';

export const SANDBOX_NOW = new Date('2026-09-25T16:00:00.000Z');

export const SANDBOX_IDS = {
  organizationId: '00700000-0000-4000-8000-000000000001',
  specialistOrganizationId: '00700000-0000-4000-8000-000000000002',
  matterId: '00700000-0000-4000-8000-000000000021',
  authorityId: '00700000-0000-4000-8000-000000000031',
  matterGrantId: '00700000-0000-4000-8000-000000000041',
  allowedDocumentId: '00700000-0000-4000-8000-000000000051',
  hiddenDocumentId: '00700000-0000-4000-8000-000000000052',
  documentGrantId: '00700000-0000-4000-8000-000000000061',
  handoffId: '00700000-0000-4000-8000-000000000071',
} as const;

const EFFECTIVE_AT = new Date('2026-01-01T00:00:00.000Z');
const EXPIRES_AT = new Date('2027-01-01T00:00:00.000Z');
const CREATED_AT = new Date('2026-09-01T00:00:00.000Z');

export interface SandboxAuthorityRow {
  id: string;
  organizationId: string;
  matterType: 'grievance';
  matterId: string;
  representedPersonId: string;
  representativeUserId: string;
  representativeOrganizationId: string;
  scope: string[];
  source: string;
  status: 'active';
  effectiveAt: Date;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  supersededByAuthorityId: string | null;
  evidenceDocumentId: string | null;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  metadata: Record<string, unknown>;
}

export interface SandboxMatterGrantRow {
  id: string;
  authorityId: string;
  organizationId: string;
  matterType: 'grievance';
  matterId: string;
  userId: string;
  representativeOrganizationId: string;
  status: 'active';
  canView: boolean;
  canComment: boolean;
  canUploadDocuments: boolean;
  canViewDocuments: boolean;
  canDownloadDocuments: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  grantedBy: string;
  grantedAt: Date;
  updatedAt: Date;
}

export interface SandboxDocumentGrantRow {
  id: string;
  authorityId: string;
  matterGrantId: string;
  organizationId: string;
  matterType: 'grievance';
  matterId: string;
  documentId: string;
  userId: string;
  representativeOrganizationId: string;
  status: 'active';
  canView: boolean;
  canDownload: boolean;
  canShare: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
  revokedBy: string | null;
  grantedBy: string;
  grantedAt: Date;
  updatedAt: Date;
}

export interface SandboxDocument {
  id: string;
  title: string;
  /** Institutional label. Specialist visibility is decided by the grant row. */
  grant: 'granted' | 'hidden';
}

export interface SandboxSeed {
  disposition: 'DEMO_CONFIGURED';
  organizationId: string;
  organizationLabel: string;
  specialistOrganizationId: string;
  specialistOrganizationLabel: string;
  matter: {
    id: string;
    matterType: 'grievance';
    title: string;
    label: 'Matter';
  };
  authority: SandboxAuthorityRow;
  matterGrant: SandboxMatterGrantRow;
  documentGrants: SandboxDocumentGrantRow[];
  documents: SandboxDocument[];
  personas: readonly SandboxPersona[];
}

export function buildSandboxSeed(): SandboxSeed {
  const authority: SandboxAuthorityRow = {
    id: SANDBOX_IDS.authorityId,
    organizationId: SANDBOX_IDS.organizationId,
    matterType: 'grievance',
    matterId: SANDBOX_IDS.matterId,
    representedPersonId: SANDBOX_USER_IDS.member,
    representativeUserId: SANDBOX_USER_IDS.externalSpecialist,
    representativeOrganizationId: SANDBOX_IDS.specialistOrganizationId,
    scope: ['view'],
    source: 'recorded_authority',
    status: 'active',
    effectiveAt: EFFECTIVE_AT,
    expiresAt: EXPIRES_AT,
    revokedAt: null,
    revokedBy: null,
    supersededByAuthorityId: null,
    evidenceDocumentId: null,
    createdBy: SANDBOX_USER_IDS.institutionalAdmin,
    createdAt: CREATED_AT,
    updatedAt: CREATED_AT,
    metadata: {
      sandbox: 'nz-007-demo',
      narrative: 'synthetic-referral',
      disposition: 'DEMO_CONFIGURED',
    },
  };

  const matterGrant: SandboxMatterGrantRow = {
    id: SANDBOX_IDS.matterGrantId,
    authorityId: authority.id,
    organizationId: authority.organizationId,
    matterType: 'grievance',
    matterId: authority.matterId,
    userId: SANDBOX_USER_IDS.externalSpecialist,
    representativeOrganizationId: authority.representativeOrganizationId,
    status: 'active',
    canView: true,
    canComment: false,
    canUploadDocuments: false,
    canViewDocuments: true,
    canDownloadDocuments: false,
    expiresAt: EXPIRES_AT,
    revokedAt: null,
    revokedBy: null,
    grantedBy: SANDBOX_USER_IDS.institutionalAdmin,
    grantedAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };

  const allowedGrant: SandboxDocumentGrantRow = {
    id: SANDBOX_IDS.documentGrantId,
    authorityId: authority.id,
    matterGrantId: matterGrant.id,
    organizationId: authority.organizationId,
    matterType: 'grievance',
    matterId: authority.matterId,
    documentId: SANDBOX_IDS.allowedDocumentId,
    userId: SANDBOX_USER_IDS.externalSpecialist,
    representativeOrganizationId: authority.representativeOrganizationId,
    status: 'active',
    canView: true,
    canDownload: false,
    canShare: false,
    expiresAt: EXPIRES_AT,
    revokedAt: null,
    revokedBy: null,
    grantedBy: SANDBOX_USER_IDS.institutionalAdmin,
    grantedAt: CREATED_AT,
    updatedAt: CREATED_AT,
  };

  return {
    disposition: 'DEMO_CONFIGURED',
    organizationId: SANDBOX_IDS.organizationId,
    organizationLabel: 'Synthetic institutional home',
    specialistOrganizationId: SANDBOX_IDS.specialistOrganizationId,
    specialistOrganizationLabel: 'Synthetic external practice',
    matter: {
      id: SANDBOX_IDS.matterId,
      matterType: 'grievance',
      title: 'Synthetic referral matter',
      label: 'Matter',
    },
    authority,
    matterGrant,
    documentGrants: [allowedGrant],
    documents: [
      {
        id: SANDBOX_IDS.allowedDocumentId,
        title: 'Synthetic intake summary',
        grant: 'granted',
      },
      {
        id: SANDBOX_IDS.hiddenDocumentId,
        title: 'Synthetic identity packet',
        grant: 'hidden',
      },
    ],
    personas: SANDBOX_PERSONAS,
  };
}

export function publicSeedSummary(seed: SandboxSeed = buildSandboxSeed()) {
  return {
    disposition: seed.disposition,
    organizationId: seed.organizationId,
    specialistOrganizationId: seed.specialistOrganizationId,
    matterId: seed.matter.id,
    matterType: seed.matter.matterType,
    authorityId: seed.authority.id,
    matterGrantId: seed.matterGrant.id,
    grantedDocumentId: SANDBOX_IDS.allowedDocumentId,
    hiddenDocumentId: SANDBOX_IDS.hiddenDocumentId,
    documentGrantCount: seed.documentGrants.length,
    personaUserIds: seed.personas.map((persona) => ({
      id: persona.id,
      userId: persona.userId,
      email: persona.email,
      passwordEnvVar: persona.passwordEnvVar,
    })),
  };
}
