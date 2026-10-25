// Governed OCR authority (Contract 3): a pure decision over verified facts. Viewing never implies processing, and
// neither role seniority nor the legacy unionRepId column is an input to it.
import { describe, expect, it } from 'vitest';
import { decideOcrProcessing, ocrFactsFrom, type OcrAuthorityFacts, type DocumentAuthorityContext } from './ocr-authority';
import { decideTranscriptAccess } from './transcripts';

const kernel = (over: Partial<NonNullable<OcrAuthorityFacts['linkedCase']>> = {}) => ({
  canViewCase: true,
  canProcessOcr: false,
  canViewPrivateDocuments: true,
  isPrimaryOwner: false,
  ...over,
});

const facts = (over: Partial<OcrAuthorityFacts> = {}): OcrAuthorityFacts => ({
  privacyLabel: 'team_confidential',
  isUploader: false,
  linkedCase: null,
  grant: null,
  memberPolicy: { adopted: false },
  ...over,
});

describe('decideOcrProcessing — linked documents', () => {
  it('allows kernel case:process_ocr on a live case relationship', () => {
    expect(decideOcrProcessing(facts({ linkedCase: kernel({ canProcessOcr: true }) }))).toEqual({ allowed: true, basis: 'kernel_case_authority' });
  });

  it('refuses a case participant who may view but not process', () => {
    expect(decideOcrProcessing(facts({ linkedCase: kernel() }))).toEqual({ allowed: false, reason: 'no_processing_authority' });
  });

  it('refuses a view-only grant even on a case the principal can see', () => {
    expect(decideOcrProcessing(facts({ linkedCase: kernel(), grant: { canView: true, canProcessOcr: false } }))).toEqual({ allowed: false, reason: 'no_processing_authority' });
  });

  it('allows an explicit processing grant, but only on top of a live case relationship', () => {
    expect(decideOcrProcessing(facts({ linkedCase: kernel(), grant: { canView: true, canProcessOcr: true } }))).toEqual({ allowed: true, basis: 'explicit_processing_grant' });
    expect(decideOcrProcessing(facts({ linkedCase: kernel({ canViewCase: false }), grant: { canView: true, canProcessOcr: true } }))).toEqual({ allowed: false, reason: 'no_case_authority' });
  });

  it('removes processing with the case relationship (recusal, revocation or expiry), whatever the kernel says about processing', () => {
    expect(decideOcrProcessing(facts({ linkedCase: kernel({ canViewCase: false, canProcessOcr: true }) }))).toEqual({ allowed: false, reason: 'no_case_authority' });
  });

  it('never widens visibility: a restricted label still has to pass the classification policy', () => {
    const decision = decideOcrProcessing(facts({ privacyLabel: 'highly_sensitive', linkedCase: kernel({ canProcessOcr: true, canViewPrivateDocuments: false }) }));
    expect(decision).toEqual({ allowed: false, reason: 'classification' });
  });

  it('refuses an unknown or missing classification', () => {
    expect(decideOcrProcessing(facts({ privacyLabel: null, linkedCase: kernel({ canProcessOcr: true }) }))).toEqual({ allowed: false, reason: 'classification' });
    expect(decideOcrProcessing(facts({ privacyLabel: 'secret', linkedCase: kernel({ canProcessOcr: true }) }))).toEqual({ allowed: false, reason: 'classification' });
  });
});

describe('decideOcrProcessing — unlinked documents', () => {
  it('denies the uploader until the institution adopts a member processing policy', () => {
    expect(decideOcrProcessing(facts({ isUploader: true }))).toEqual({ allowed: false, reason: 'member_policy_not_adopted' });
  });

  it('allows the uploader under an adopted policy, within its classification ceiling', () => {
    const policy = { adopted: true, ownUploadCeiling: 'lro_confidential' as const };
    expect(decideOcrProcessing(facts({ isUploader: true, memberPolicy: policy }))).toEqual({ allowed: true, basis: 'adopted_member_policy' });
    // The ceiling is a limit, not a grant: a label the classification policy hides from a case-less member stays hidden.
    expect(decideOcrProcessing(facts({ isUploader: true, memberPolicy: policy, privacyLabel: 'lro_confidential' }))).toEqual({ allowed: false, reason: 'classification' });
    expect(decideOcrProcessing(facts({ isUploader: true, memberPolicy: policy, privacyLabel: 'privileged' }))).toEqual({ allowed: false, reason: 'policy_ceiling' });
  });

  it('defaults an adopted policy’s ceiling to team_confidential', () => {
    expect(decideOcrProcessing(facts({ isUploader: true, memberPolicy: { adopted: true }, privacyLabel: 'lro_confidential' }))).toEqual({ allowed: false, reason: 'policy_ceiling' });
  });

  it('gives no processing authority to someone who is neither the uploader nor a grantee', () => {
    expect(decideOcrProcessing(facts({ memberPolicy: { adopted: true } }))).toEqual({ allowed: false, reason: 'no_processing_authority' });
    expect(decideOcrProcessing(facts({ grant: { canView: true, canProcessOcr: false } }))).toEqual({ allowed: false, reason: 'no_processing_authority' });
  });

  it('allows an explicit processing grant', () => {
    expect(decideOcrProcessing(facts({ grant: { canView: true, canProcessOcr: true } }))).toEqual({ allowed: true, basis: 'explicit_processing_grant' });
  });
});

describe('facts are derived from verified context only', () => {
  const ctx = (over: Partial<DocumentAuthorityContext> = {}): DocumentAuthorityContext => ({
    documentId: 'd', privacyLabel: 'team_confidential', uploadedBy: 'u1', linkedEntityType: null, linkedCaseId: null, grant: null, kernel: null, ...over,
  });

  it('judges a document linked to a non-case entity as unlinked', () => {
    expect(ocrFactsFrom(ctx({ linkedEntityType: 'member' }), 'u1').linkedCase).toBeNull();
  });

  it('reads the uploader from the document, and the policy defaults to not adopted', () => {
    expect(ocrFactsFrom(ctx(), 'u1')).toMatchObject({ isUploader: true, memberPolicy: { adopted: false } });
    expect(ocrFactsFrom(ctx(), 'u2').isUploader).toBe(false);
  });
});

describe('decideTranscriptAccess — read, write and publish are separate', () => {
  const linked = (over: Record<string, boolean> = {}): DocumentAuthorityContext => ({
    documentId: 'd', privacyLabel: 'team_confidential', uploadedBy: 'u1', linkedEntityType: 'grievance', linkedCaseId: 'c1', grant: null,
    kernel: { isPrimaryOwner: false, canViewCase: true, canViewPrivateDocuments: true, canModifyDocuments: false, canUploadDocuments: false, ...over } as never,
  });

  it('lets a case viewer read but not write or publish', () => {
    expect(decideTranscriptAccess(linked(), 'u2')).toEqual({ canRead: true, canWrite: false, canPublish: false });
  });

  it('lets kernel document modification write, and only kernel evidence authority publish', () => {
    expect(decideTranscriptAccess(linked({ canModifyDocuments: true }), 'u2')).toEqual({ canRead: true, canWrite: true, canPublish: false });
    expect(decideTranscriptAccess(linked({ canUploadDocuments: true }), 'u2')).toEqual({ canRead: true, canWrite: false, canPublish: true });
  });

  it('removes write and publish when the case relationship is gone', () => {
    expect(decideTranscriptAccess(linked({ canViewCase: false, canModifyDocuments: true, canUploadDocuments: true }), 'u2')).toMatchObject({ canWrite: false, canPublish: false });
  });

  it('lets an unlinked document’s uploader write, and never publish it as case evidence', () => {
    const unlinked: DocumentAuthorityContext = { documentId: 'd', privacyLabel: 'team_confidential', uploadedBy: 'u1', linkedEntityType: null, linkedCaseId: null, grant: null, kernel: null };
    expect(decideTranscriptAccess(unlinked, 'u1')).toEqual({ canRead: true, canWrite: true, canPublish: false });
    expect(decideTranscriptAccess(unlinked, 'u2').canWrite).toBe(false);
  });

  it('denies everything for an unknown classification', () => {
    expect(decideTranscriptAccess({ ...linked({ canModifyDocuments: true }), privacyLabel: 'nope' }, 'u2')).toEqual({ canRead: false, canWrite: false, canPublish: false });
  });
});
