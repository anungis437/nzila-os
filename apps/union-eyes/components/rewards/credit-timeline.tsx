'use client';

import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { 
  TrendingUp, 
  TrendingDown, 
  Award, 
  ShoppingBag, 
  RotateCcw, 
  AlertCircle,
  DollarSign 
} from 'lucide-react';
import type { RewardWalletLedgerEntry } from '@/db/schema/recognition-rewards-schema';

interface CreditTimelineProps {
  entries: (RewardWalletLedgerEntry & {
    created_by_name?: string;
    source_description?: string;
  })[];
  showBalance?: boolean;
}

export function CreditTimeline({ entries, showBalance = true }: CreditTimelineProps) {
  // Group entries by date
  const groupedEntries = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    
    entries.forEach((entry) => {
      const date = format(new Date(entry.createdAt), 'yyyy-MM-dd');
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(entry);
    });

    return Object.entries(groups).sort((a, b) => 
      new Date(b[0]).getTime() - new Date(a[0]).getTime()
    );
  }, [entries]);

  const getEventIcon = (eventType: string) => {
    switch (eventType) {
      case 'earn':
        return <Award className="h-4 w-4 text-green-600" />;
      case 'spend':
        return <ShoppingBag className="h-4 w-4 text-blue-600" />;
      case 'expire':
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
      case 'revoke':
        return <RotateCcw className="h-4 w-4 text-red-600" />;
      case 'refund':
        return <DollarSign className="h-4 w-4 text-purple-600" />;
      case 'adjust':
        return <TrendingUp className="h-4 w-4 text-gray-600" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getEventColor = (eventType: string) => {
    switch (eventType) {
      case 'earn':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'spend':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'expire':
        return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'revoke':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'refund':
        return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'adjust':
        return 'text-gray-600 bg-gray-50 border-gray-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getAmountDisplay = (entry: RewardWalletLedgerEntry) => {
    const isPositive = ['earn', 'refund', 'adjust'].includes(entry.eventType) && entry.amountCredits > 0;
    const icon = isPositive ? TrendingUp : TrendingDown;
    const Icon = icon;

    return (
      <div className={`flex items-center gap-1 font-bold ${
        isPositive ? 'text-green-600' : 'text-red-600'
      }`}>
        <Icon className="h-4 w-4" />
        {isPositive ? '+' : ''}{entry.amountCredits}
      </div>
    );
  };

  if (entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          No transaction history yet
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {groupedEntries.map(([date, dayEntries]) => (
        <div key={date}>
          {/* Date Header */}
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-sm font-semibold text-muted-foreground">
              {format(new Date(date), 'MMMM d, yyyy')}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Timeline Entries */}
          <div className="space-y-3 ml-4 border-l-2 border-border pl-6">
            {dayEntries.map((entry) => (
              <div
                key={entry.id}
                className="relative"
              >
                {/* Timeline Dot */}
                <div className={`absolute -left-[29px] p-1.5 rounded-full border-2 bg-background ${
                  getEventColor(entry.eventType)
                }`}>
                  {getEventIcon(entry.eventType)}
                </div>

                {/* Entry Card */}
                <Card className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={getEventColor(entry.eventType)}>
                            {entry.eventType}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(entry.createdAt), 'h:mm a')}
                          </span>
                        </div>
                        
                        {entry.memo && (
                          <p className="text-sm font-medium">{entry.memo}</p>
                        )}
                        
                        {entry.source_description && (
                          <p className="text-xs text-muted-foreground">
                            {entry.source_description}
                          </p>
                        )}

                        {entry.created_by_name && (
                          <p className="text-xs text-muted-foreground">
                            By {entry.created_by_name}
                          </p>
                        )}
                      </div>

                      <div className="text-right space-y-1">
                        {getAmountDisplay(entry)}
                        {showBalance && entry.balanceAfter !== null && (
                          <p className="text-xs text-muted-foreground">
                            Balance: {entry.balanceAfter}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

