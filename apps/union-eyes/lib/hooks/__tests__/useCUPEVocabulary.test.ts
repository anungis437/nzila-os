// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock('@nzila/cupe-vocabulary', () => ({
  CUPEVocabulary: {},
  CaseType: {},
  Priority: {},
  Severity: {},
  Role: {},
  Status: {},
}));

import { useCUPEVocabulary } from '../../hooks/useCUPEVocabulary';

const mockVocabulary = {
  caseTypes: [
    { id: 'discipline', label: 'Discipline' },
    { id: 'grievance', label: 'Grievance' },
  ],
  priorities: [
    { id: 'high', label: 'High' },
    { id: 'low', label: 'Low' },
  ],
  statuses: [
    { id: 'open', label: 'Open', category: 'open' },
    { id: 'in-review', label: 'In Review', category: 'in_progress' },
    { id: 'closed', label: 'Closed', category: 'closed' },
  ],
  severities: [
    { id: 'critical', label: 'Critical' },
  ],
  roles: [
    { id: 'steward', label: 'Steward' },
  ],
};

describe('useCUPEVocabulary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockFetch.mockResolvedValue({
      ok: true,
      json: async () => mockVocabulary,
    });
    globalThis.fetch = mocks.mockFetch as any as typeof fetch;
  });

  it('fetches vocabulary on mount and returns it', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.vocabulary).toEqual(mockVocabulary);
    expect(result.current.error).toBeNull();
  });

  it('getCaseType returns matching case type', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getCaseType('discipline')?.label).toBe('Discipline');
    expect(result.current.getCaseType('nonexistent')).toBeUndefined();
  });

  it('getPriority returns matching priority', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getPriority('high')?.label).toBe('High');
  });

  it('getStatus returns matching status', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getStatus('open')?.label).toBe('Open');
  });

  it('getSeverity returns matching severity', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getSeverity('critical')?.label).toBe('Critical');
  });

  it('getRole returns matching role', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.getRole('steward')?.label).toBe('Steward');
  });

  it('getStatusesByCategory filters statuses correctly', async () => {
    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const openStatuses = result.current.getStatusesByCategory('open');
    expect(openStatuses).toHaveLength(1);
    expect(openStatuses[0].id).toBe('open');
  });

  it('sets error on fetch failure', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.vocabulary).toBeNull();
  });

  it('wraps non-Error throws into Error with Unknown message', async () => {
    mocks.mockFetch.mockRejectedValue('string-rejection');

    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('Unknown error');
    expect(result.current.vocabulary).toBeNull();
  });

  it('getStatusesByCategory returns empty array when vocabulary is null', async () => {
    mocks.mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
    });

    const { result } = renderHook(() => useCUPEVocabulary());

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    // vocabulary is null after failure
    const statuses = result.current.getStatusesByCategory('open');
    expect(statuses).toEqual([]);
  });
});
