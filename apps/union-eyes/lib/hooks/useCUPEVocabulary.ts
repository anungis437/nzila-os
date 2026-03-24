/**
 * React Hook: useCUPEVocabulary
 * 
 * Client-side hook for loading and caching CUPE vocabulary from /api/vocabulary
 * Supports filtering by category and real-time updates.
 */

'use client';

import { useEffect, useState } from 'react';
import { CUPEVocabulary, CaseType, Priority, Severity, Role, Status } from '@nzila/cupe-vocabulary';

interface UseCUPEVocabularyResult {
  vocabulary: CUPEVocabulary | null;
  isLoading: boolean;
  error: Error | null;
  getCaseType: (id: string) => CaseType | undefined;
  getPriority: (id: string) => Priority | undefined;
  getStatus: (id: string) => Status | undefined;
  getSeverity: (id: string) => Severity | undefined;
  getRole: (id: string) => Role | undefined;
  getStatusesByCategory: (category: 'open' | 'in_progress' | 'resolved' | 'closed') => Status[];
}

/**
 * Hook to load and cache CUPE vocabulary.
 * 
 * Example:
 * ```typescript
 * const { vocabulary, isLoading, getCaseType } = useCUPEVocabulary();
 * if (isLoading) return <Spinner />;
 * const caseType = getCaseType('discipline');
 * ```
 */
export function useCUPEVocabulary(): UseCUPEVocabularyResult {
  const [vocabulary, setVocabulary] = useState<CUPEVocabulary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchVocabulary = async () => {
      try {
        const response = await fetch('/api/vocabulary', {
          cache: 'force-cache',
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: Failed to fetch vocabulary`);
        }

        const data: CUPEVocabulary = await response.json();
        setVocabulary(data);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
        setVocabulary(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchVocabulary();
  }, []);

  const getCaseType = (id: string): CaseType | undefined => {
    return vocabulary?.caseTypes.find((ct) => ct.id === id);
  };

  const getPriority = (id: string): Priority | undefined => {
    return vocabulary?.priorities.find((p) => p.id === id);
  };

  const getStatus = (id: string): Status | undefined => {
    return vocabulary?.statuses.find((s) => s.id === id);
  };

  const getSeverity = (id: string): Severity | undefined => {
    return vocabulary?.severities.find((s) => s.id === id);
  };

  const getRole = (id: string): Role | undefined => {
    return vocabulary?.roles.find((r) => r.id === id);
  };

  const getStatusesByCategory = (category: 'open' | 'in_progress' | 'resolved' | 'closed'): Status[] => {
    if (!vocabulary) return [];
    return vocabulary.statuses.filter((s) => s.category === category);
  };

  return {
    vocabulary,
    isLoading,
    error,
    getCaseType,
    getPriority,
    getStatus,
    getSeverity,
    getRole,
    getStatusesByCategory,
  };
}
