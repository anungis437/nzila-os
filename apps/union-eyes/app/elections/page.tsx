/**
 * Elections Dashboard
 * 
 * Manage union elections, nominations, and voting
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { Progress } from '@/components/ui/progress';
import { api } from '@/lib/api/index';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Vote, Users, Calendar, CheckCircle, Plus, Download
} from 'lucide-react';

interface ElectionStats {
  activeElections: number;
  totalVoters: number;
  votesCase: number;
  upcomingElections: number;
}

interface Election {
  id: string;
  title: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  eligibleVoters: number;
  votesCast: number;
  positions: number;
}

export default function ElectionsDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<ElectionStats>({
    activeElections: 0,
    totalVoters: 0,
    votesCase: 0,
    upcomingElections: 0,
  });
  const [elections, setElections] = useState<Election[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchElectionsData();
  }, []);

  const fetchElectionsData = async () => {
    try {
      const data = await api.elections.list() as Election[];
      
      setElections(data);
      
      // Calculate stats from data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const active = data.filter((e: any) => e.status === 'active').length;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const totalVoters = data.reduce((sum: number, e: any) => sum + (e.eligibleVoters || 0), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const votesCast = data.reduce((sum: number, e: any) => sum + (e.votesCast || 0), 0);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const upcoming = data.filter((e: any) => e.status === 'upcoming').length;
      
      setStats({
        activeElections: active,
        totalVoters,
        votesCase: votesCast,
        upcomingElections: upcoming,
      });
    } catch (error) {
      logger.error('Error fetching elections data', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'nomination':
        return 'bg-blue-100 text-blue-800';
      case 'upcoming':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Elections</h1>
          <p className="text-muted-foreground">
            Manage union elections, nominations, and voting
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Results
          </Button>
          <Button onClick={() => router.push('/elections/new')}>
            <Plus className="mr-2 h-4 w-4" />
            Create Election
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Elections</p>
              <p className="text-2xl font-bold text-green-600">
                {stats.activeElections}
              </p>
            </div>
            <Vote className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Eligible Voters</p>
              <p className="text-2xl font-bold">{stats.totalVoters}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Votes Cast</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.votesCase}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Upcoming Elections</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.upcomingElections}
              </p>
            </div>
            <Calendar className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Elections List */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Elections</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Turnout</TableHead>
              <TableHead>Positions</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {elections.map((election) => {
              const turnoutPercentage = (election.votesCast / election.eligibleVoters) * 100;
              
              return (
                <TableRow
                  key={election.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => router.push(`/elections/${election.id}`)}
                >
                  <TableCell className="font-medium">{election.title}</TableCell>
                  <TableCell className="capitalize">{election.type}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(election.status)}>
                      {election.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(election.startDate).toLocaleDateString()} - {' '}
                    {new Date(election.endDate).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{election.votesCast} / {election.eligibleVoters}</span>
                        <span className="text-muted-foreground">
                          {turnoutPercentage.toFixed(1)}%
                        </span>
                      </div>
                      <Progress value={turnoutPercentage} className="h-1" />
                    </div>
                  </TableCell>
                  <TableCell>{election.positions}</TableCell>
                  <TableCell>
                    <Button variant="ghost" size="sm">View</Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
