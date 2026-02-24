'use client';

import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Heart, MessageCircle, Award, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { RecognitionAward } from '@/db/schema/recognition-rewards-schema';

interface AwardCardProps {
  award: RecognitionAward & {
    issuer_name?: string;
    issuer_avatar?: string;
    recipient_name?: string;
    recipient_avatar?: string;
    award_type_name?: string;
    award_type_icon?: string;
    reactions?: { type: string; count: number; userReacted?: boolean }[];
  };
  onReact?: (awardId: string, reactionType: string) => void;
  onComment?: (awardId: string) => void;
  showActions?: boolean;
}

export function AwardCard({ award, onReact, onComment, showActions = true }: AwardCardProps) {
  const getInitials = (name?: string) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'issued':
        return 'bg-green-500/10 text-green-600';
      case 'approved':
        return 'bg-blue-500/10 text-blue-600';
      case 'pending':
        return 'bg-yellow-500/10 text-yellow-600';
      case 'rejected':
        return 'bg-red-500/10 text-red-600';
      case 'revoked':
        return 'bg-gray-500/10 text-gray-600';
      default:
        return 'bg-gray-500/10 text-gray-600';
    }
  };

  return (
    <Card className="mb-4 transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10">
              <AvatarImage src={award.issuer_avatar} />
              <AvatarFallback>{getInitials(award.issuer_name)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm">
                {award.issuer_name || 'Unknown'}
              </p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {formatDistanceToNow(new Date(award.createdAt), { addSuffix: true })}
              </p>
            </div>
          </div>
          <Badge className={getStatusColor(award.status)} variant="secondary">
            {award.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Recognition Message */}
        <div className="flex items-start gap-3 bg-muted/30 p-4 rounded-lg">
          <div className="shrink-0">
            {award.award_type_icon ? (
              <div className="text-2xl">{award.award_type_icon}</div>
            ) : (
              <Award className="h-6 w-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm mb-1">
              {award.award_type_name || 'Recognition'}
            </p>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs text-muted-foreground">to</span>
              <Avatar className="h-6 w-6">
                <AvatarImage src={award.recipient_avatar} />
                <AvatarFallback className="text-xs">
                  {getInitials(award.recipient_name)}
                </AvatarFallback>
              </Avatar>
              <span className="font-medium text-sm">{award.recipient_name || 'Unknown'}</span>
            </div>
            {award.reason && (
              <p className="text-sm text-foreground mt-2">{award.reason}</p>
            )}
          </div>
        </div>

        {/* Credit Amount - Removed as not available in base schema */}

        {/* Reactions & Actions */}
        {showActions && (
          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-4">
              {award.reactions?.map((reaction) => (
                <Button
                  key={reaction.type}
                  variant="ghost"
                  size="sm"
                  className="gap-1 h-8"
                  onClick={() => onReact?.(award.id, reaction.type)}
                >
                  {reaction.type === 'heart' && <Heart className={`h-4 w-4 ${reaction.userReacted ? 'fill-red-500 text-red-500' : ''}`} />}
                  {reaction.type === 'celebrate' && <span className="text-base">🎉</span>}
                  {reaction.type === 'clap' && <span className="text-base">👏</span>}
                  <span className="text-xs">{reaction.count}</span>
                </Button>
              ))}
              {!award.reactions?.length && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-8"
                    onClick={() => onReact?.(award.id, 'heart')}
                  >
                    <Heart className="h-4 w-4" />
                    <span className="text-xs">Like</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1 h-8"
                    onClick={() => onReact?.(award.id, 'celebrate')}
                  >
                    <span className="text-base">🎉</span>
                    <span className="text-xs">Celebrate</span>
                  </Button>
                </>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="gap-1 h-8"
              onClick={() => onComment?.(award.id)}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">Comment</span>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

