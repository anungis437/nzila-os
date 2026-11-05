// @vitest-environment jsdom
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import type { ClauseDetailWire } from '@/lib/clause-library/clause-detail';
import { ClauseViewer } from '../ClauseViewer';

afterEach(cleanup);

// A zone west of UTC is where a date written without a time is shown a day early if it is parsed as local midnight.
const zone = process.env.TZ;
beforeAll(() => {
  process.env.TZ = 'America/Toronto';
});
afterAll(() => {
  if (zone === undefined) delete process.env.TZ;
  else process.env.TZ = zone;
});

// What GET /api/clause-library/{id} answers with, as a screen receives it.
const clause = (overrides: Partial<ClauseDetailWire> = {}): ClauseDetailWire => ({
  id: 'c1',
  clauseNumber: '12.01',
  clauseTitle: 'Overtime',
  clauseText: 'The employer shall pay overtime.',
  clauseType: 'overtime',
  sharingLevel: 'public',
  sharedWithOrgIds: undefined,
  isAnonymized: false,
  originalEmployerName: 'Acme Ltd',
  anonymizedEmployerName: null,
  sector: 'private',
  province: 'ON',
  effectiveDate: '2024-01-01',
  expiryDate: '2026-12-31',
  viewCount: 7,
  comparisonCount: 3,
  version: 1,
  sourceOrganization: { id: 'o1', organizationName: 'Local 1' },
  createdBy: undefined,
  createdAt: '2026-01-01T15:00:00.000Z',
  updatedAt: '2026-01-01T15:00:00.000Z',
  tags: [{ id: 't1', tagName: 'wages' }],
  isOwner: false,
  ...overrides,
});

describe('ClauseViewer', () => {
  it('shows the day each date was recorded, whatever the reader\'s time zone', () => {
    render(<ClauseViewer clause={clause()} isOwner={false} />);
    expect(screen.getByText(/Effective: Jan 1, 2024/)).toBeInTheDocument();
    expect(screen.getByText(/Expiry: Dec 31, 2026/)).toBeInTheDocument();
  });

  it('shows how many times the clause was viewed and compared, as the route counted them', () => {
    render(<ClauseViewer clause={clause({ viewCount: 7, comparisonCount: 3 })} isOwner={false} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('shows its source organization and tags, and the employer of a clause that is not anonymized', () => {
    render(<ClauseViewer clause={clause()} isOwner={false} />);
    expect(screen.getByText('Local 1')).toBeInTheDocument();
    expect(screen.getByText('wages')).toBeInTheDocument();
    expect(screen.getByText('Acme Ltd')).toBeInTheDocument();
  });

  it('offers the owner\'s actions only to the owner', () => {
    const onEdit = vi.fn();
    const { rerender } = render(<ClauseViewer clause={clause()} isOwner={false} onEdit={onEdit} />);
    expect(screen.queryByRole('button', { name: /Edit/ })).not.toBeInTheDocument();
    rerender(<ClauseViewer clause={clause({ isOwner: true })} isOwner onEdit={onEdit} />);
    expect(screen.getByRole('button', { name: /Edit/ })).toBeInTheDocument();
  });
});
