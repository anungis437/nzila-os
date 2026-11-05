// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { ClauseCompareView } from '../ClauseCompareView';

vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });

afterEach(cleanup);

type Props = React.ComponentProps<typeof ClauseCompareView>;

const clause = (id: string, overrides: Partial<Props['clauses'][number]> = {}): Props['clauses'][number] => ({
  id,
  clauseTitle: `Clause ${id}`,
  clauseText: 'The employer shall pay overtime.',
  clauseType: 'overtime',
  sharingLevel: 'federation',
  sourceOrganization: { id: `org-${id}`, organizationName: `Local ${id}` },
  ...overrides,
});

// What POST /api/clause-library/compare answers with.
const analysis: NonNullable<Props['analysis']> = {
  commonKeywords: ['overtime'],
  differences: { clauseTypes: ['overtime', 'wages'], sectors: ['education', 'public'], provinces: ['ON', 'QC'], dateRanges: '2023-06-01 – 2026-12-31', sharingLevels: ['federation'] },
  statistics: { totalClauses: 2, averageTextLength: 32, uniqueTypes: 2, uniqueSectors: 2, uniqueProvinces: 2 },
};

describe('ClauseCompareView', () => {
  it('shows what the analysis says differs between the clauses, including the date range and the provinces', () => {
    render(<ClauseCompareView clauses={[clause('1'), clause('2')]} analysis={analysis} onRemoveClause={vi.fn()} />);
    expect(screen.getByText('Provinces')).toBeInTheDocument();
    expect(screen.getByText('ON, QC')).toBeInTheDocument();
    expect(screen.getByText('overtime, wages')).toBeInTheDocument();
    expect(screen.getByText('2023-06-01 – 2026-12-31')).toBeInTheDocument();
  });

  it('shows a clause whose source is not disclosed as anonymized, instead of failing on the missing source', () => {
    render(<ClauseCompareView clauses={[clause('1'), clause('2', { sourceOrganization: undefined })]} analysis={analysis} onRemoveClause={vi.fn()} />);
    expect(screen.getAllByText('Local 1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Anonymized').length).toBeGreaterThan(0);
  });

  it('has no analysis panel when the route gave none', () => {
    render(<ClauseCompareView clauses={[clause('1'), clause('2')]} onRemoveClause={vi.fn()} />);
    expect(screen.queryByText('Analysis Summary')).not.toBeInTheDocument();
    expect(screen.getByText('Clause Comparison')).toBeInTheDocument();
  });
});
