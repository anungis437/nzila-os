'use client';

/**
 * Insights Panel Component
 * Displays AI-generated insights and recommendations
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  AlertCircle,
  CheckCircle,
  Info,
  TrendingUp,
  AlertTriangle,
  X,
  Check,
} from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

interface Insight {
  id: string;
  insightType: 'opportunity' | 'risk' | 'optimization' | 'alert' | 'information';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  recommendations?: any[];
  status: 'new' | 'acknowledged' | 'in_progress' | 'completed' | 'dismissed';
  actionRequired: boolean;
  createdAt: string;
}

interface InsightsPanelProps {
  insights: Insight[];
  compact?: boolean;
}

export function InsightsPanel({ insights, compact = false }: InsightsPanelProps) {
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const getInsightIcon = (type: string) => {
    switch (type) {
      case 'opportunity':
        return <TrendingUp className="h-4 w-4" />;
      case 'risk':
        return <AlertTriangle className="h-4 w-4" />;
      case 'optimization':
        return <CheckCircle className="h-4 w-4" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4" />;
      default:
        return <Info className="h-4 w-4" />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'high':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'acknowledged':
        return 'bg-purple-100 text-purple-800';
      case 'dismissed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-yellow-100 text-yellow-800';
    }
  };

  async function updateInsightStatus(
    insightId: string,
    status: string,
    dismissalReason?: string
  ) {
    try {
      const response = await fetch('/api/analytics/insights', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          insightId,
          status,
          notes: notes[insightId] || undefined,
          dismissalReason
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Insight Updated',
          description: `Insight marked as ${status.replace('_', ' ')}`
        });
        // Refresh insights
        window.location.reload();
      } else {
        throw new Error(data.error);
      }
    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to update insight',
        variant: 'destructive'
      });
    }
  }

  if (insights.length === 0) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground py-8">
            <Info className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>No insights available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (compact) {
    return (
      <div className="space-y-3">
        {insights.map((insight) => (
          <div
            key={insight.id}
            className={cn(
              'flex items-start gap-3 p-3 rounded-lg border',
              getPriorityColor(insight.priority)
            )}
          >
            <div className="mt-0.5">{getInsightIcon(insight.insightType)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{insight.title}</p>
              <p className="text-xs opacity-80 line-clamp-2">{insight.description}</p>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {insights.map((insight) => (
        <Card key={insight.id}>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <div className={cn('p-2 rounded-lg', getPriorityColor(insight.priority))}>
                  {getInsightIcon(insight.insightType)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CardTitle className="text-base">{insight.title}</CardTitle>
                    <Badge variant="outline" className={getPriorityColor(insight.priority)}>
                      {insight.priority}
                    </Badge>
                    <Badge variant="outline" className={getStatusColor(insight.status)}>
                      {insight.status.replace('_', ' ')}
                    </Badge>
                  </div>
                  <CardDescription>{insight.description}</CardDescription>
                </div>
              </div>
            </div>
          </CardHeader>

          {expandedInsight === insight.id && (
            <CardContent className="space-y-4">
              {/* Recommendations */}
              {insight.recommendations && insight.recommendations.length > 0 && (
                <div>
                  <h4 className="font-semibold text-sm mb-2">Recommendations</h4>
                  <ul className="space-y-2">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {insight.recommendations.map((rec: any, idx: number) => (
                      <li key={idx} className="flex items-start gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 mt-0.5 text-green-600" />
                        <span>{rec.description || rec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Notes */}
              {insight.status !== 'dismissed' && insight.status !== 'completed' && (
                <div>
                  <label className="text-sm font-medium mb-2 block">Add Notes</label>
                  <Textarea
                    placeholder="Add notes about this insight..."
                    value={notes[insight.id] || ''}
                    onChange={(e) =>
                      setNotes({ ...notes, [insight.id]: e.target.value })
                    }
                    rows={3}
                  />
                </div>
              )}

              {/* Actions */}
              {insight.status === 'new' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateInsightStatus(insight.id, 'acknowledged')}
                  >
                    <Check className="h-4 w-4 mr-2" />
                    Acknowledge
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      updateInsightStatus(insight.id, 'dismissed', 'Not relevant')
                    }
                  >
                    <X className="h-4 w-4 mr-2" />
                    Dismiss
                  </Button>
                </div>
              )}

              {insight.status === 'acknowledged' && (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => updateInsightStatus(insight.id, 'in_progress')}
                  >
                    Start Working
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => updateInsightStatus(insight.id, 'completed')}
                  >
                    Mark Complete
                  </Button>
                </div>
              )}

              {insight.status === 'in_progress' && (
                <Button
                  size="sm"
                  onClick={() => updateInsightStatus(insight.id, 'completed')}
                >
                  Mark Complete
                </Button>
              )}
            </CardContent>
          )}

          <CardContent className="pt-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setExpandedInsight(expandedInsight === insight.id ? null : insight.id)
              }
            >
              {expandedInsight === insight.id ? 'Show Less' : 'Show More'}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

