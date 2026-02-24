/**
 * Strike Fund Dashboard
 * 
 * Manage strike fund applications, disbursements, and balances
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
  DollarSign, Users, TrendingDown, AlertCircle, Plus, Download
} from 'lucide-react';

interface StrikeFundStats {
  totalBalance: number;
  weeklyDisbursements: number;
  activeRecipients: number;
  pendingApplications: number;
}

interface Application {
  id: string;
  memberName: string;
  weeklyAmount: number;
  status: string;
  appliedAt: string;
  approvedAt: string | null;
  dependents: number;
}

export default function StrikeFundDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<StrikeFundStats>({
    totalBalance: 0,
    weeklyDisbursements: 0,
    activeRecipients: 0,
    pendingApplications: 0,
  });
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStrikeFundData();
  }, []);

  const fetchStrikeFundData = async () => {
    try {
      const [dashboardData, applicationsData] = await Promise.all([
        api.strikeFund.dashboard(),
        api.strikeFund.applications.list(),
      ]);
      
      setStats(dashboardData as StrikeFundStats);
      setApplications(applicationsData as Application[]);
    } catch (error) {
      logger.error('Error fetching strike fund data', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const weeksRemaining = Math.floor(stats.totalBalance / stats.weeklyDisbursements);
  const fundHealthPercentage = (stats.totalBalance / 1000000) * 100; // Assuming $1M target

  if (loading) {
    return <div className="container mx-auto py-6">Loading...</div>;
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Strike Fund Management</h1>
          <p className="text-muted-foreground">
            Manage applications, disbursements, and fund balance
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={() => router.push('/strike-fund/applications/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Application
          </Button>
        </div>
      </div>

      {/* Fund Health Alert */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-lg">Fund Health</h3>
            <p className="text-sm text-muted-foreground">
              Current balance can sustain {weeksRemaining} weeks at current disbursement rate
            </p>
          </div>
          <DollarSign className="h-8 w-8 text-green-600" />
        </div>
        <Progress value={fundHealthPercentage} className="h-2" />
        <div className="flex justify-between text-sm mt-2 text-muted-foreground">
          <span>${stats.totalBalance.toLocaleString()}</span>
          <span>Target: $1,000,000</span>
        </div>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Balance</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalBalance.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Weekly Disbursements</p>
              <p className="text-2xl font-bold text-blue-600">
                ${stats.weeklyDisbursements.toLocaleString()}
              </p>
            </div>
            <TrendingDown className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Active Recipients</p>
              <p className="text-2xl font-bold">{stats.activeRecipients}</p>
            </div>
            <Users className="h-8 w-8 text-purple-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Applications</p>
              <p className="text-2xl font-bold text-yellow-600">
                {stats.pendingApplications}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>
      </div>

      {/* Recent Applications */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Applications</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Weekly Amount</TableHead>
              <TableHead>Dependents</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Applied</TableHead>
              <TableHead>Approved</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {applications.map((app) => (
              <TableRow
                key={app.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/strike-fund/applications/${app.id}`)}
              >
                <TableCell className="font-medium">{app.memberName}</TableCell>
                <TableCell>${app.weeklyAmount}</TableCell>
                <TableCell>{app.dependents}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(app.status)}>
                    {app.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(app.appliedAt).toLocaleDateString()}
                </TableCell>
                <TableCell>
                  {app.approvedAt ? (
                    new Date(app.approvedAt).toLocaleDateString()
                  ) : (
                    <span className="text-muted-foreground">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <Button variant="ghost" size="sm">View</Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Card>
    </div>
  );
}
