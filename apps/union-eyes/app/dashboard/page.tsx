/**
 * Main Dashboard Page
 * 
 * Overview dashboard with key metrics and quick actions
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { api } from '@/lib/api/index';
import {
  Users, FileText, DollarSign, AlertCircle, 
  TrendingUp, Calendar, Award, ArrowRight
} from 'lucide-react';

interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  activeCases: number;
  upcomingDeadlines: number;
  duesCollected: number;
  membersInArrears: number;
  activeElections: number;
  strikeFundBalance: number;
}

interface RecentActivity {
  id: string;
  type: string;
  description: string;
  timestamp: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    activeCases: 0,
    upcomingDeadlines: 0,
    duesCollected: 0,
    membersInArrears: 0,
    activeElections: 0,
    strikeFundBalance: 0,
  });
  const [activities, setActivities] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsData, activitiesData] = await Promise.all([
        api.dashboard.stats(),
        api.dashboard.activities(10),
      ]);
      
      setStats(statsData as DashboardStats);
      setActivities(activitiesData as RecentActivity[]);
    } catch (error) {
      logger.error('Error fetching dashboard data', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          {/* eslint-disable-next-line react/no-unescaped-entities */}
          Welcome back! Here's an overview of your union management system.
        </p>
      </div>

      {/* Key Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push('/members')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Members</p>
              <p className="text-2xl font-bold">{stats.totalMembers}</p>
              <p className="text-xs text-green-600 mt-1">
                {stats.activeMembers} active
              </p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push('/cases')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Cases</p>
              <p className="text-2xl font-bold">{stats.activeCases}</p>
              <p className="text-xs text-yellow-600 mt-1">
                {stats.upcomingDeadlines} deadlines
              </p>
            </div>
            <FileText className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push('/dues')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Dues Collected (YTD)</p>
              <p className="text-2xl font-bold">${(stats.duesCollected / 1000).toFixed(0)}k</p>
              <p className="text-xs text-red-600 mt-1">
                {stats.membersInArrears} in arrears
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card
          className="p-6 cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={() => router.push('/elections')}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Elections</p>
              <p className="text-2xl font-bold">{stats.activeElections}</p>
              <p className="text-xs text-blue-600 mt-1">Vote now</p>
            </div>
            <Award className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-600" />
            Attention Required
          </h3>
          <div className="space-y-3">
            <div
              className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
              onClick={() => router.push('/dues/arrears')}
            >
              <div>
                <p className="font-medium text-sm">Members in Arrears</p>
                <p className="text-xs text-muted-foreground">Requires follow-up</p>
              </div>
              <Badge variant="destructive">{stats.membersInArrears}</Badge>
            </div>

            <div
              className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
              onClick={() => router.push('/cases')}
            >
              <div>
                <p className="font-medium text-sm">Upcoming Deadlines</p>
                <p className="text-xs text-muted-foreground">Within 7 days</p>
              </div>
              <Badge variant="destructive">{stats.upcomingDeadlines}</Badge>
            </div>

            <div
              className="flex items-center justify-between p-3 bg-muted rounded-lg cursor-pointer hover:bg-muted/70"
              onClick={() => router.push('/dues/reconcile')}
            >
              <div>
                <p className="font-medium text-sm">Pending Reconciliation</p>
                <p className="text-xs text-muted-foreground">Remittances to match</p>
              </div>
              <Badge className="bg-yellow-100 text-yellow-800">23</Badge>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-600" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push('/members/new')}
            >
              <Users className="mr-2 h-4 w-4" />
              Add New Member
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push('/cases/new')}
            >
              <FileText className="mr-2 h-4 w-4" />
              Open New Case
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push('/dues/upload')}
            >
              <DollarSign className="mr-2 h-4 w-4" />
              Upload Remittance
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start"
              onClick={() => router.push('/elections')}
            >
              <Calendar className="mr-2 h-4 w-4" />
              View Elections
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-600" />
            Recent Activity
          </h3>
          <div className="space-y-3">
            {activities.map((activity) => (
              <div key={activity.id} className="border-l-2 border-primary pl-3">
                <p className="text-sm font-medium">{activity.description}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(activity.timestamp).toLocaleString()}
                </p>
              </div>
            ))}
            <Button variant="link" className="p-0 h-auto text-sm">
              View all activity
              <ArrowRight className="ml-1 h-3 w-3" />
            </Button>
          </div>
        </Card>
      </div>

      {/* Financial Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-6">
          <h3 className="font-semibold mb-4">Financial Overview</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Dues Collected (YTD)</span>
              <span className="font-bold text-green-600">
                ${stats.duesCollected.toLocaleString()}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Strike Fund Balance</span>
              <span className="font-bold">${stats.strikeFundBalance.toLocaleString()}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Outstanding Arrears</span>
              <span className="font-bold text-red-600">$8,900</span>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push('/dues')}
            >
              View Financial Reports
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>

        <Card className="p-6">
          <h3 className="font-semibold mb-4">Member Engagement</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Active Members</span>
              <span className="font-bold">{stats.activeMembers}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Election Turnout</span>
              <span className="font-bold">69.3%</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Stewards</span>
              <span className="font-bold">45</span>
            </div>
            <Button
              variant="outline"
              className="w-full mt-4"
              onClick={() => router.push('/members')}
            >
              View Member Directory
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
