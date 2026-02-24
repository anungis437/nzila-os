'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AwardCard } from './award-card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';
 
import { Skeleton } from '@/components/ui/skeleton';

interface RecognitionFeedProps {
  orgId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  initialAwards?: any[];
  showFilters?: boolean;
}

export function RecognitionFeed({ 
  orgId: _orgId, 
  initialAwards = [],
  showFilters = true 
}: RecognitionFeedProps) {
  const t = useTranslations('rewards.feed');
  const [awards, setAwards] = useState(initialAwards);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<'all' | 'team' | 'mine'>('all');
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const fetchAwards = async (reset = false) => {
    setLoading(true);
    try {
      const response = await fetch(
        `/api/rewards/feed?filter=${filter}&page=${reset ? 1 : page}&limit=10`
      );
      
      if (!response.ok) throw new Error('Failed to fetch awards');
      
      const data = await response.json();
      
      if (reset) {
        setAwards(data.awards);
        setPage(1);
      } else {
        setAwards((prev) => [...prev, ...data.awards]);
      }
      
      setHasMore(data.hasMore);
    } catch (_error) {
} finally {
      setLoading(false);
    }
  };

  const handleReact = async (awardId: string, reactionType: string) => {
    try {
      const response = await fetch(`/api/rewards/awards/${awardId}/react`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reactionType }),
      });

      if (!response.ok) throw new Error('Failed to react');

      // Update local state optimistically
      setAwards((prev) =>
        prev.map((award) => {
          if (award.id === awardId) {
            const reactions = award.reactions || [];
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const existingReaction = reactions.find((r: any) => r.type === reactionType);
            
            if (existingReaction) {
              if (existingReaction.userReacted) {
                // Remove reaction
                return {
                  ...award,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  reactions: reactions.map((r: any) =>
                    r.type === reactionType
                      ? { ...r, count: r.count - 1, userReacted: false }
                      : r
                  ),
                };
              } else {
                // Add reaction
                return {
                  ...award,
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  reactions: reactions.map((r: any) =>
                    r.type === reactionType
                      ? { ...r, count: r.count + 1, userReacted: true }
                      : r
                  ),
                };
              }
            } else {
              // New reaction type
              return {
                ...award,
                reactions: [...reactions, { type: reactionType, count: 1, userReacted: true }],
              };
            }
          }
          return award;
        })
      );
    } catch (_error) {
}
  };

  const handleComment = (_awardId: string) => {
    // Open comment dialog (to be implemented)
};

  const handleRefresh = () => {
    fetchAwards(true);
  };

  const loadMore = () => {
    setPage((prev) => prev + 1);
  };

  useEffect(() => {
    if (page > 1) {
      fetchAwards();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  useEffect(() => {
    if (initialAwards.length === 0) {
      fetchAwards(true);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">{t('title')}</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={loading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          {t('refresh')}
        </Button>
      </div>

      {/* Filters */}
      {showFilters && (
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList>
            <TabsTrigger value="all">{t('filters.all')}</TabsTrigger>
            <TabsTrigger value="team">{t('filters.team')}</TabsTrigger>
            <TabsTrigger value="mine">{t('filters.mine')}</TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {/* Feed */}
      <div className="space-y-4">
        {loading && awards.length === 0 ? (
          // Loading skeletons
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <Skeleton className="h-24 w-full" />
            </div>
          ))
        ) : awards.length === 0 ? (
          // Empty state
          <div className="text-center py-12 border rounded-lg">
            <p className="text-muted-foreground">{t('empty')}</p>
          </div>
        ) : (
          // Awards feed
          <>
            {awards.map((award) => (
              <AwardCard
                key={award.id}
                award={award}
                onReact={handleReact}
                onComment={handleComment}
              />
            ))}

            {/* Load More */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  variant="outline"
                  onClick={loadMore}
                  disabled={loading}
                >
                  {loading ? t('loading') : t('loadMore')}
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

