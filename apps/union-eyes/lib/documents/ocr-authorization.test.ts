import { describe, expect, it } from 'vitest';
import {
  authorizeEvidencePublication,
  authorizeOcrExtraction,
  authorizeTranscriptCorrection,
  ocrRelationshipFromKernel,
  type OcrAuthorizationInput,
} from './ocr-authorization';

function input(overrides: Partial<OcrAuthorizationInput> = {}): OcrAuthorizationInput {
  return {
    privacyLabel: 'team_confidential',
    relationship: 'active',
    canViewPrivateDocuments: false,
    canUploadDocuments: true,
    hasExplicitViewGrant: false,
    isUploader: false,
    ...overrides,
  };
}

describe('OCR extraction authorization', () => {
  it('denies unassigned, revoked, expired, and recused actors before classification', () => {
    expect(authorizeOcrExtraction(input({ relationship: 'unassigned' }))).toEqual({ allowed: false, reason: 'unassigned' });
    expect(authorizeOcrExtraction(input({ relationship: 'revoked', canUploadDocuments: true }))).toEqual({ allowed: false, reason: 'revoked' });
    expect(authorizeOcrExtraction(input({ relationship: 'expired', canViewPrivateDocuments: true }))).toEqual({ allowed: false, reason: 'expired' });
    expect(authorizeOcrExtraction(input({
      relationship: 'recused',
      canUploadDocuments: true,
      canViewPrivateDocuments: true,
      privacyLabel: 'privileged',
    }))).toEqual({ allowed: false, reason: 'recused' });
  });

  it('treats recusal as stronger than primary ownership', () => {
    expect(ocrRelationshipFromKernel({
      linked: true,
      isPrimaryOwner: true,
      canViewCase: true,
      recused: true,
    })).toBe('recused');
  });

  it('denies a view-only assignment and a view grant without processing authority', () => {
    expect(authorizeOcrExtraction(input({ canUploadDocuments: false }))).toEqual({ allowed: false, reason: 'view_only' });
    expect(authorizeOcrExtraction(input({
      privacyLabel: 'privileged',
      canUploadDocuments: false,
      hasExplicitViewGrant: true,
    }))).toEqual({ allowed: false, reason: 'view_only' });
  });

  it('denies an unknown classification instead of treating it as visible', () => {
    expect(authorizeOcrExtraction(input({ privacyLabel: 'internal' }))).toEqual({ allowed: false, reason: 'classification' });
    expect(authorizeOcrExtraction(input({ privacyLabel: null, relationship: 'unlinked', isUploader: true }))).toEqual({
      allowed: false,
      reason: 'classification',
    });
  });

  it('denies privileged and restricted labels without classification authority', () => {
    expect(authorizeOcrExtraction(input({ privacyLabel: 'privileged' }))).toEqual({ allowed: false, reason: 'classification' });
    expect(authorizeOcrExtraction(input({ privacyLabel: 'highly_sensitive' }))).toEqual({ allowed: false, reason: 'classification' });
    expect(authorizeOcrExtraction(input({ privacyLabel: 'lro_confidential' }))).toEqual({ allowed: false, reason: 'classification' });
  });

  it('allows the uploader of an unlinked visible document and denies another user in the same organization', () => {
    expect(authorizeOcrExtraction(input({
      relationship: 'unlinked',
      canUploadDocuments: false,
      isUploader: true,
    }))).toEqual({ allowed: true });
    expect(authorizeOcrExtraction(input({
      relationship: 'unlinked',
      canUploadDocuments: true,
      isUploader: false,
    }))).toEqual({ allowed: false, reason: 'view_only' });
  });

  it('allows a primary owner and an active assignment with document upload authority', () => {
    expect(authorizeOcrExtraction(input({
      relationship: 'primary_owner',
      privacyLabel: 'privileged',
      canUploadDocuments: false,
      canViewPrivateDocuments: false,
      hasExplicitViewGrant: false,
    }))).toEqual({ allowed: true });
    expect(authorizeOcrExtraction(input({
      relationship: 'active',
      privacyLabel: 'lro_confidential',
      canViewPrivateDocuments: true,
      canUploadDocuments: true,
    }))).toEqual({ allowed: true });
  });

  it('keeps transcript correction and evidence publication closed', () => {
    expect(authorizeTranscriptCorrection()).toEqual({ allowed: false, reason: 'ocr-transcript-persistence' });
    expect(authorizeEvidencePublication()).toEqual({ allowed: false, reason: 'ocr-transcript-persistence' });
  });
});
