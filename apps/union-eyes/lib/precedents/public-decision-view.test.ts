import { describe, expect, it } from 'vitest';
import type { ArbitrationDecision } from '@/lib/services/precedent-service';
import { toPublicPrecedentSummary } from './public-decision-view';

describe('public arbitration-decision projection', () => {
  it('keeps the fields required to identify and evaluate a public decision', () => {
    const row = {
      id: 'decision-1',
      caseNumber: '2026-001',
      caseTitle: 'Public arbitration decision',
      tribunal: 'OLRB',
      decisionDate: new Date('2026-01-01'),
      summary: 'Public headnote',
      outcome: 'grievance_upheld',
    } as unknown as ArbitrationDecision;
    expect(toPublicPrecedentSummary(row)).toMatchObject({
      id: 'decision-1',
      caseNumber: '2026-001',
      caseTitle: 'Public arbitration decision',
      summary: 'Public headnote',
    });
  });

  it('never serializes grievor identity, private text, financial remedies, CBA references or internal metadata', () => {
    const row = {
      id: 'decision-1',
      grievor: 'CONFIDENTIAL MEMBER NAME',
      fullText: 'PRIVATE FULL TEXT',
      remedy: { monetaryAward: 98765 },
      panelMembers: ['Private contact'],
      cbaReferences: [{ cbaId: 'private' }],
      relatedDecisions: ['private-id'],
      embedding: 'private-vector',
      importedFrom: 'internal-provider',
      accessRestrictions: 'confidential',
      isPublic: false,
    } as unknown as ArbitrationDecision;
    const output = JSON.stringify(toPublicPrecedentSummary(row));
    for (const secret of ['CONFIDENTIAL MEMBER NAME', 'PRIVATE FULL TEXT', '98765', 'private-vector', 'internal-provider', 'confidential', 'private-id', 'Private contact']) {
      expect(output).not.toContain(secret);
    }
    for (const field of ['grievor', 'fullText', 'remedy', 'panelMembers', 'cbaReferences', 'relatedDecisions', 'embedding', 'importedFrom', 'accessRestrictions', 'isPublic']) {
      expect(toPublicPrecedentSummary(row)).not.toHaveProperty(field);
    }
  });

  it('does not leak a newly added column by object spread', () => {
    const row = { id: 'decision-1', futureSensitiveField: 'never-visible' } as unknown as ArbitrationDecision;
    expect(JSON.stringify(toPublicPrecedentSummary(row))).not.toContain('never-visible');
  });
});
