/**
 * Quick Poll Widget Component (Phase 5 - Week 2)
 * Single-question poll with real-time voting
 * 
 * Features:
 * - Single question with multiple options
 * - Real-time vote display
 * - Percentage bars
 * - Vote submission
 * - Results before/after voting (configurable)
 * - Embed code generation
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useToast } from '@/components/ui/use-toast';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { CheckCircle, Users, BarChart3, Loader2 } from 'lucide-react';

interface QuickPollWidgetProps {
  pollId: string;
  showResultsBeforeVote?: boolean;
  compact?: boolean;
}

interface PollOption {
  id: string;
  text: string;
  votes: number;
  percentage: number;
}

interface Poll {
  id: string;
  question: string;
  description?: string;
  status: string;
  totalVotes: number;
  uniqueVoters: number;
  options: PollOption[];
  userVote?: string | null;
  allowMultipleVotes: boolean;
  requireAuthentication: boolean;
  showResultsBeforeVote: boolean;
}

export function QuickPollWidget({
  pollId,
  showResultsBeforeVote = false,
  compact = false,
}: QuickPollWidgetProps) {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [isVoting, setIsVoting] = useState(false);
  const [poll, setPoll] = useState<Poll | null>(null);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const loadPoll = useCallback(async () => {
    try {
      const response = await fetch(`/api/communications/polls/${pollId}`);
      if (!response.ok) throw new Error('Failed to load poll');

      const data = await response.json();
      setPoll(data);
      
      if (data.userVote) {
        setSelectedOption(data.userVote);
        setHasVoted(true);
      }
      
      setIsLoading(false);
    } catch (_error) {
toast({
        title: 'Error',
        description: 'Failed to load poll',
        variant: 'destructive',
      });
      setIsLoading(false);
    }
  }, [pollId, toast]);

  useEffect(() => {
    loadPoll();
    
    // Auto-refresh every 10 seconds
    const interval = setInterval(loadPoll, 10000);
    return () => clearInterval(interval);
  }, [pollId, loadPoll]);

  const handleVote = async () => {
    if (!selectedOption) {
      toast({
        title: 'Error',
        description: 'Please select an option',
        variant: 'destructive',
      });
      return;
    }

    setIsVoting(true);

    try {
      const response = await fetch(`/api/communications/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId: selectedOption }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to submit vote');
      }

      const data = await response.json();
      setPoll(data.poll);
      setHasVoted(true);

      toast({
        title: 'Success',
        description: 'Your vote has been recorded',
      });
    } catch (error) {
toast({
        title: 'Error',
        description: error.message || 'Failed to submit vote',
        variant: 'destructive',
      });
    } finally {
      setIsVoting(false);
    }
  };

  if (isLoading) {
    return (
      <Card className={compact ? 'shadow-none border-0' : ''}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!poll) {
    return (
      <Card className={compact ? 'shadow-none border-0' : ''}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">Poll not found</p>
        </CardContent>
      </Card>
    );
  }

  if (poll.status !== 'active') {
    return (
      <Card className={compact ? 'shadow-none border-0' : ''}>
        <CardContent className="py-8 text-center">
          <p className="text-muted-foreground">This poll is no longer active</p>
        </CardContent>
      </Card>
    );
  }

  const showResults = hasVoted || poll.showResultsBeforeVote || showResultsBeforeVote;

  return (
    <Card className={compact ? 'shadow-none border-0' : ''}>
      <CardHeader className={compact ? 'pb-3' : ''}>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className={compact ? 'text-lg' : 'text-xl'}>{poll.question}</CardTitle>
            {poll.description && !compact && (
              <CardDescription className="mt-1">{poll.description}</CardDescription>
            )}
          </div>
          {hasVoted && (
            <Badge variant="default" className="ml-2">
              <CheckCircle className="h-3 w-3 mr-1" />
              Voted
            </Badge>
          )}
        </div>
        {!compact && (
          <div className="flex items-center gap-4 text-sm text-muted-foreground mt-2">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{poll.totalVotes} votes</span>
            </div>
            <div className="flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span>{poll.uniqueVoters} voters</span>
            </div>
          </div>
        )}
      </CardHeader>
      <CardContent>
        {!showResults ? (
          // Voting UI
          <div className="space-y-4">
            <RadioGroup value={selectedOption || ''} onValueChange={setSelectedOption}>
              <div className="space-y-2">
                {poll.options.map((option) => (
                  <div
                    key={option.id}
                    className="flex items-center space-x-2 p-3 rounded-lg border hover:bg-accent transition-colors"
                  >
                    <RadioGroupItem value={option.id} id={`option-${option.id}`} />
                    <Label
                      htmlFor={`option-${option.id}`}
                      className="flex-1 cursor-pointer font-normal"
                    >
                      {option.text}
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
            <Button
              onClick={handleVote}
              disabled={isVoting || !selectedOption}
              className="w-full"
            >
              {isVoting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Voting...
                </>
              ) : (
                'Submit Vote'
              )}
            </Button>
          </div>
        ) : (
          // Results UI
          <div className="space-y-3">
            {poll.options.map((option) => {
              const isUserVote = hasVoted && option.id === selectedOption;
              
              return (
                <div key={option.id} className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <span className={isUserVote ? 'font-semibold' : ''}>
                        {option.text}
                      </span>
                      {isUserVote && (
                        <Badge variant="default" className="text-xs">
                          Your vote
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground">{option.votes}</span>
                      <span className="font-semibold min-w-[45px] text-right">
                        {option.percentage.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <Progress
                    value={option.percentage}
                    className={cn("h-2", isUserVote && "[&>div]:bg-primary")}
                  />
                </div>
              );
            })}
            
            {!compact && (
              <div className="pt-4 border-t mt-4">
                <div className="flex items-center justify-between text-sm text-muted-foreground">
                  <span>Total votes</span>
                  <span className="font-semibold">{poll.totalVotes}</span>
                </div>
              </div>
            )}

            {!hasVoted && poll.allowMultipleVotes && (
              <Button
                onClick={() => {
                  setHasVoted(false);
                  setSelectedOption(null);
                }}
                variant="outline"
                size="sm"
                className="w-full"
              >
                Vote Again
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

