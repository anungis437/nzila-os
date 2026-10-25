import { describe, expect, it } from 'vitest';
import { projectSignaturePayload } from './signature-projection';

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

    expect(projected.sent[0]).toEqual({ id: 'sig-1', title: 'Contract', status: 'completed' });
    expect(projected.toSign[0].document).toEqual({ id: 'sig-2', title: 'Waiver', status: 'sent' });
    expect(projected.toSign[0].signer).toEqual({ id: 'signer-1', status: 'sent', email: 'member@example.test' });
    expect(JSON.stringify(projected)).not.toContain('storage.example');
    expect(JSON.stringify(projected)).not.toContain('signed body');
  });
});
