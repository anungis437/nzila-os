/**
 * React Hook: useCUPEVocabulary
 * 
 * Client-side hook for loading and caching CUPE vocabulary from /api/vocabulary
 * Supports filtering by category and real-time updates.
 */

'use client';

import { useEffect, useState } from 'react';
import type { PublicVocabulary } from '@/lib/vocabulary/public-vocabulary';

type CaseType = PublicVocabulary['caseTypes'][number];
type Priority = PublicVocabulary['priorities'][number];
type Severity = PublicVocabulary['severities'][number];
type Role = PublicVocabulary['roles'][number];
type Status = PublicVocabulary['statuses'][number];

/** The vocabulary as the API serves it: identifiers, labels and descriptions, without service-level hours, role flags or status transitions (lib/vocabulary/public-vocabulary.ts). */
interface UseCUPEVocabularyResult {
  vocabulary: PublicVocabulary | null;
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
  const [vocabulary, setVocabulary] = useState<PublicVocabulary | null>(null);
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

        const data: PublicVocabulary = await response.json();
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
