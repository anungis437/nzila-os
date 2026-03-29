// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';

const mocks = vi.hoisted(() => ({
  mockGetUEPriorityScores: vi.fn(),
  mockGetUESlaRiskScores: vi.fn(),
}));

vi.mock('@/lib/ml-client', () => ({
  makeMlClient: vi.fn(() => ({
    getUEPriorityScores: mocks.mockGetUEPriorityScores,
    getUESlaRiskScores: mocks.mockGetUESlaRiskScores,
  })),
}));

import {
  useCasePrioritySignal,
  useCaseSlaRiskSignal,
  useCaseListSignals,
} from '../useUEMlSignals';

describe('useUEMlSignals', () => {
  const getToken = vi.fn().mockResolvedValue('test-token');

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockGetUEPriorityScores.mockResolvedValue({ items: [] });
    mocks.mockGetUESlaRiskScores.mockResolvedValue({ items: [] });
  });

  describe('useCasePrioritySignal', () => {
    it('returns null score when no items match caseId', async () => {
      mocks.mockGetUEPriorityScores.mockResolvedValue({ items: [] });

      const { result } = renderHook(() =>
        useCasePrioritySignal('org-1', 'case-1', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.score).toBeNull();
      expect(result.current.error).toBeNull();
    });

    it('returns matching score when item exists for caseId', async () => {
      const scoreItem = { caseId: 'case-1', score: 0.85, label: 'HIGH' };
      mocks.mockGetUEPriorityScores.mockResolvedValue({
        items: [scoreItem, { caseId: 'case-2', score: 0.2 }],
      });

      const { result } = renderHook(() =>
        useCasePrioritySignal('org-1', 'case-1', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.score).toEqual(scoreItem);
    });

    it('sets error on API failure', async () => {
      mocks.mockGetUEPriorityScores.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() =>
        useCasePrioritySignal('org-1', 'case-1', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe('Network error');
      expect(result.current.score).toBeNull();
    });

    it('does not fetch when orgId is empty', async () => {
      const { result } = renderHook(() =>
        useCasePrioritySignal('', 'case-1', getToken),
      );

      // Should stay loading true because the effect bails out without calling finally
      // but the API should not be called
      expect(mocks.mockGetUEPriorityScores).not.toHaveBeenCalled();
    });
  });

  describe('useCaseSlaRiskSignal', () => {
    it('returns matching SLA risk score', async () => {
      const riskItem = { caseId: 'case-1', riskScore: 0.9 };
      mocks.mockGetUESlaRiskScores.mockResolvedValue({
        items: [riskItem],
      });

      const { result } = renderHook(() =>
        useCaseSlaRiskSignal('org-1', 'case-1', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.score).toEqual(riskItem);
    });

    it('returns null when no SLA risk matches', async () => {
      mocks.mockGetUESlaRiskScores.mockResolvedValue({ items: [] });

      const { result } = renderHook(() =>
        useCaseSlaRiskSignal('org-1', 'case-1', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.score).toBeNull();
    });
  });

  describe('useCaseListSignals', () => {
    it('returns priority and slaRisk maps keyed by caseId', async () => {
      mocks.mockGetUEPriorityScores.mockResolvedValue({
        items: [{ caseId: 'c1', score: 0.5 }, { caseId: 'c2', score: 0.8 }],
      });
      mocks.mockGetUESlaRiskScores.mockResolvedValue({
        items: [{ caseId: 'c1', riskScore: 0.3 }],
      });

      const { result } = renderHook(() =>
        useCaseListSignals('org-1', '2026-01-01', '2026-03-28', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.priority.size).toBe(2);
      expect(result.current.priority.get('c1')?.score).toBe(0.5);
      expect(result.current.slaRisk.size).toBe(1);
      expect(result.current.error).toBeNull();
    });

    it('sets error when batch fetch fails', async () => {
      mocks.mockGetUEPriorityScores.mockRejectedValue(new Error('timeout'));

      const { result } = renderHook(() =>
        useCaseListSignals('org-1', '2026-01-01', '2026-03-28', getToken),
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      expect(result.current.error).toBe('timeout');
    });
  });
});
