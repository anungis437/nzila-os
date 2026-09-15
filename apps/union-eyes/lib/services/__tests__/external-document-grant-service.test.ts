import { describe, expect, it } from 'vitest';
import { assertGrantorMayCreateDocumentGrant } from '../external-document-grant-service';

describe('external document grant service', () => {
  it('denies grant creation when the grantor cannot view the document', () => {
    expect(() => assertGrantorMayCreateDocumentGrant({
      grantorCanViewDocument: false,
      grantorCanShareDocument: true,
    })).toThrow('Grantor is not authorized to share this document');
  });

  it('denies grant creation when the grantor cannot share the document', () => {
    expect(() => assertGrantorMayCreateDocumentGrant({
      grantorCanViewDocument: true,
      grantorCanShareDocument: false,
    })).toThrow('Grantor is not authorized to share this document');
  });

  it('allows grant creation only when the grantor can both view and share', () => {
    expect(() => assertGrantorMayCreateDocumentGrant({
      grantorCanViewDocument: true,
      grantorCanShareDocument: true,
    })).not.toThrow();
  });
});
