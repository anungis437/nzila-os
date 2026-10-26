import { describe, expect, it } from 'vitest';
import { classifySignatureEvidence, projectSignaturePayload } from './signature-projection';

describe('signature response projection', () => {
  it('removes storage locations and keeps signature status', () => {
    const projected = projectSignaturePayload({
      sent: [{
        id: 'sig-1',
        title: 'Contract',
        status: 'completed',
        fileUrl: 'https://storage.example/signed.pdf',
        contentText: 'signed body',
      }],
      toSign: [{
        document: { id: 'sig-2', title: 'Waiver', file_url: 'https://storage.example/waiver.pdf', status: 'sent' },
        signer: { id: 'signer-1', status: 'sent', email: 'member@example.test' },
      }],
    });

    expect(projected.sent[0]).toEqual({
      id: 'sig-1',
      title: 'Contract',
      status: 'completed',
      evidenceClass: 'historical_evidence',
    });
    expect(projected.toSign[0].document).toEqual({
      id: 'sig-2',
      title: 'Waiver',
      status: 'sent',
      evidenceClass: 'signature_request',
    });
    expect(projected.toSign[0].signer).toEqual({ id: 'signer-1', status: 'sent', email: 'member@example.test' });
    expect(JSON.stringify(projected)).not.toContain('storage.example');
    expect(JSON.stringify(projected)).not.toContain('signed body');
  });

  it('keeps provider completion distinct from a stored status', () => {
    expect(classifySignatureEvidence({ kind: 'internal_review', status: 'approved' })).toBe('internal_review');
    expect(classifySignatureEvidence({ title: 'Draft', status: 'draft', provider: 'internal' })).toBe('signature_request');
    expect(classifySignatureEvidence({
      title: 'Packet',
      status: 'sent',
      provider: 'docusign',
      providerEnvelopeId: 'env-1',
    })).toBe('provider_issued');
    expect(classifySignatureEvidence({
      title: 'Packet',
      status: 'completed',
      provider: 'docusign',
      providerEnvelopeId: 'env-1',
      completedAt: '2026-10-25T00:00:00.000Z',
    })).toBe('historical_evidence');
    expect(classifySignatureEvidence({
      title: 'Packet',
      status: 'completed',
      provider: 'hellosign',
      providerEnvelopeId: 'env-2',
      providerAcknowledgedAt: '2026-10-25T00:00:00.000Z',
    })).toBe('verified_completed');
  });
});
