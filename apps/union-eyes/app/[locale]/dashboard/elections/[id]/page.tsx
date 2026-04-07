/**
 * Election Detail Page
 * 
 * View election details, candidates, and voting interface
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { logger } from '@/lib/logger';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { api } from '@/lib/api/index';
import {
  Vote, Calendar, Users, CheckCircle, AlertCircle, Download
} from 'lucide-react';

interface ElectionDetail {
  id: string;
  title: string;
  type: string;
  status: string;
  description: string;
  startDate: string;
  endDate: string;
  eligibleVoters: number;
  votesCast: number;
  positions: Position[];
  hasVoted: boolean;
}

interface Position {
  id: string;
  title: string;
  description: string;
  seats: number;
  candidates: Candidate[];
}

interface Candidate {
  id: string;
  name: string;
  bio: string;
  voteCount?: number;
}

export default function ElectionDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [election, setElection] = useState<ElectionDetail | null>(null);
  const [selectedVotes, setSelectedVotes] = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchElectionDetail();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const fetchElectionDetail = async () => {
    try {
      const data = await api.elections.get(params.id);
      setElection(data as ElectionDetail);
    } catch (error) {
      logger.error('Error fetching election', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVote = (positionId: string, candidateId: string) => {
    const position = election?.positions.find(p => p.id === positionId);
    if (!position) return;

    setSelectedVotes(prev => {
      const currentVotes = prev[positionId] || [];
      
      if (currentVotes.includes(candidateId)) {
        // Deselect
        return {
          ...prev,
          [positionId]: currentVotes.filter(id => id !== candidateId),
        };
      } else if (currentVotes.length < position.seats) {
        // Select (if not at limit)
        return {
          ...prev,
          [positionId]: [...currentVotes, candidateId],
        };
      }
      
      return prev;
    });
  };

  const submitBallot = async () => {
    try {
      await api.elections.vote(params.id, selectedVotes);
      alert('Your vote has been submitted successfully!');
      router.push('/elections');
    } catch (error) {
      logger.error('Error submitting ballot', error);
      alert('Failed to submit vote. Please try again.');
    }
  };

  if (loading || !election) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  const turnoutPercentage = (election.votesCast / election.eligibleVoters) * 100;
  const daysRemaining = Math.ceil((new Date(election.endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  const canVote = election.status === 'active' && !election.hasVoted;

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold">{election.title}</h1>
            <p className="text-muted-foreground mt-1">{election.description}</p>
          </div>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
        </div>
      </div>

      {/* Status Banner */}
      {election.hasVoted && (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            You have already cast your ballot in this election. Thank you for participating!
          </AlertDescription>
        </Alert>
      )}

      {canVote && daysRemaining <= 3 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            This election ends in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. Make sure to cast your vote!
          </AlertDescription>
        </Alert>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Election Period</span>
          </div>
          <p className="font-medium text-sm">
            {new Date(election.startDate).toLocaleDateString()} - {' '}
            {new Date(election.endDate).toLocaleDateString()}
          </p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Eligible Voters</span>
          </div>
          <p className="text-2xl font-bold">{election.eligibleVoters}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <Vote className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Votes Cast</span>
          </div>
          <p className="text-2xl font-bold text-green-600">{election.votesCast}</p>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Turnout</span>
          </div>
          <p className="text-2xl font-bold">{turnoutPercentage.toFixed(1)}%</p>
        </Card>
      </div>

      {/* Turnout Progress */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="font-medium">Voter Turnout</span>
          <span className="text-sm text-muted-foreground">
            {election.votesCast} of {election.eligibleVoters} votes
          </span>
        </div>
        <Progress value={turnoutPercentage} className="h-2" />
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="ballot" className="space-y-4">
        <TabsList>
          <TabsTrigger value="ballot">Ballot</TabsTrigger>
          <TabsTrigger value="candidates">Candidates</TabsTrigger>
          <TabsTrigger value="results" disabled={election.status !== 'completed'}>
            Results
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ballot">
          <div className="space-y-6">
            {election.positions.map((position) => (
              <Card key={position.id} className="p-6">
                <div className="mb-4">
                  <h3 className="text-xl font-semibold">{position.title}</h3>
                  <p className="text-sm text-muted-foreground">
                    {position.description} • Vote for up to {position.seats}
                  </p>
                </div>

                <div className="space-y-3">
                  {position.candidates.map((candidate) => {
                    const isSelected = selectedVotes[position.id]?.includes(candidate.id);
                    
                    return (
                      <div
                        key={candidate.id}
                        className={`
                          p-4 border rounded-lg cursor-pointer transition-all
                          ${canVote ? 'hover:border-primary' : 'cursor-not-allowed opacity-60'}
                          ${isSelected ? 'border-primary bg-primary/5' : ''}
                        `}
                        onClick={() => canVote && handleVote(position.id, candidate.id)}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`
                            h-5 w-5 rounded border-2 flex items-center justify-center mt-0.5
                            ${isSelected ? 'border-primary bg-primary' : 'border-gray-300'}
                          `}>
                            {isSelected && <CheckCircle className="h-3 w-3 text-white" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{candidate.name}</p>
                            <p className="text-sm text-muted-foreground mt-1">
                              {candidate.bio}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Card>
            ))}

            {canVote && (
              <div className="flex justify-end">
                <Button onClick={submitBallot} size="lg">
                  <Vote className="mr-2 h-4 w-4" />
                  Submit Ballot
                </Button>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="candidates">
          <div className="space-y-4">
            {election.positions.map((position) => (
              <Card key={position.id} className="p-6">
                <h3 className="text-xl font-semibold mb-4">{position.title}</h3>
                <div className="space-y-4">
                  {position.candidates.map((candidate) => (
                    <div key={candidate.id} className="border-l-4 border-primary pl-4">
                      <h4 className="font-medium">{candidate.name}</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        {candidate.bio}
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="results">
          <Card className="p-6">
            <p className="text-center text-muted-foreground">
              Results will be available after the election closes
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
