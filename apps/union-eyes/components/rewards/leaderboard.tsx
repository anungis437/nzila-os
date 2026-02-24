'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
 
import { Trophy, TrendingUp, Award, Zap } from 'lucide-react';

interface LeaderboardEntry {
  userId: string;
  name: string;
  avatar?: string;
  totalCredits: number;
  awardsReceived: number;
  awardsGiven?: number;
  rank: number;
  change?: number; // Position change from previous period
}

interface LeaderboardProps {
  orgId: string;
  period?: 'all-time' | 'monthly' | 'weekly';
  topReceivers: LeaderboardEntry[];
  topGivers?: LeaderboardEntry[];
  currentUserId?: string;
}

export function Leaderboard({
  orgId: _orgId,
  period = 'monthly',
  topReceivers,
  topGivers,
  currentUserId,
}: LeaderboardProps) {
  const t = useTranslations('rewards.leaderboard');
  const [_selectedPeriod, _setSelectedPeriod] = useState(period);

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getMedalEmoji = (rank: number) => {
    switch (rank) {
      case 1:
        return '🥇';
      case 2:
        return '🥈';
      case 3:
        return '🥉';
      default:
        return null;
    }
  };

  const renderLeaderboardList = (entries: LeaderboardEntry[], type: 'receivers' | 'givers') => {
    if (!entries || entries.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          {t('empty')}
        </div>
      );
    }

    return (
      <div className="space-y-2">
        {entries.map((entry, _index) => {
          const isCurrentUser = entry.userId === currentUserId;
          const medal = getMedalEmoji(entry.rank);

          return (
            <div
              key={entry.userId}
              className={`flex items-center gap-4 p-4 rounded-lg transition-colors ${
                isCurrentUser
                  ? 'bg-primary/10 border-2 border-primary'
                  : 'bg-muted/30 hover:bg-muted/50'
              }`}
            >
              {/* Rank */}
              <div className="shrink-0 w-12 text-center">
                {medal ? (
                  <span className="text-3xl">{medal}</span>
                ) : (
                  <span className="text-2xl font-bold text-muted-foreground">
                    #{entry.rank}
                  </span>
                )}
              </div>

              {/* Avatar & Name */}
              <Avatar className="h-12 w-12">
                <AvatarImage src={entry.avatar} />
                <AvatarFallback>{getInitials(entry.name)}</AvatarFallback>
              </Avatar>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="font-semibold truncate">
                    {entry.name}
                    {isCurrentUser && (
                      <Badge variant="default" className="ml-2">
                        {t('you')}
                      </Badge>
                    )}
                  </p>
                  {entry.change !== undefined && entry.change !== 0 && (
                    <Badge
                      variant={entry.change > 0 ? 'default' : 'secondary'}
                      className="gap-1"
                    >
                      <TrendingUp
                        className={`h-3 w-3 ${
                          entry.change < 0 ? 'rotate-180' : ''
                        }`}
                      />
                      {Math.abs(entry.change)}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-4 mt-1">
                  <span className="text-sm text-muted-foreground flex items-center gap-1">
                    <Award className="h-3 w-3" />
                    {type === 'receivers'
                      ? t('awardsReceived', { count: entry.awardsReceived })
                      : t('awardsGiven', { count: entry.awardsGiven || 0 })}
                  </span>
                </div>
              </div>

              {/* Credits */}
              <div className="shrink-0 text-right">
                <div className="flex items-center gap-1 text-primary font-bold text-lg">
                  <Zap className="h-5 w-5" />
                  {entry.totalCredits.toLocaleString()}
                </div>
                <span className="text-xs text-muted-foreground">{t('credits')}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-yellow-500" />
            {t('title')}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="receivers" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="receivers" className="gap-2">
              <Award className="h-4 w-4" />
              {t('tabs.receivers')}
            </TabsTrigger>
            {topGivers && (
              <TabsTrigger value="givers" className="gap-2">
                <Zap className="h-4 w-4" />
                {t('tabs.givers')}
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="receivers" className="mt-4">
            {renderLeaderboardList(topReceivers, 'receivers')}
          </TabsContent>

          {topGivers && (
            <TabsContent value="givers" className="mt-4">
              {renderLeaderboardList(topGivers, 'givers')}
            </TabsContent>
          )}
        </Tabs>
      </CardContent>
    </Card>
  );
}

