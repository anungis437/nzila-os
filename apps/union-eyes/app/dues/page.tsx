/**
 * Dues Dashboard Page
 * 
 * Overview of dues collection, remittances, and financial status
 */

'use client';


export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { logger } from '@/lib/logger';
import { 
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { 
  DollarSign, TrendingUp, AlertCircle, FileText, 
  Download, Upload, RefreshCw 
} from 'lucide-react';
import { api } from '@/lib/api/index';

interface DuesStats {
  totalCollected: number;
  pendingRemittances: number;
  inArrears: number;
  reconciliationQueue: number;
}

interface Remittance {
  id: string;
  employer: string;
  periodStart: string;
  periodEnd: string;
  amount: number;
  memberCount: number;
  status: string;
  uploadedAt: string;
}

export default function DuesDashboardPage() {
  const router = useRouter();
  const [stats, setStats] = useState<DuesStats>({
    totalCollected: 0,
    pendingRemittances: 0,
    inArrears: 0,
    reconciliationQueue: 0,
  });
  const [remittances, setRemittances] = useState<Remittance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      const [statsData, remittancesData] = await Promise.all([
        api.dues.dashboard(),
        api.dues.remittances.list({ limit: 10 }),
      ]);
      
      setStats(statsData as DuesStats);
      setRemittances((remittancesData as unknown as { remittances: Remittance[] }).remittances || []);
    } catch (error) {
      logger.error('Error fetching dues dashboard', error);
      alert('Error loading dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'reconciled':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
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
          <h1 className="text-3xl font-bold">Dues Management</h1>
          <p className="text-muted-foreground">
            Track remittances, reconciliation, and arrears
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline">
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
          <Button onClick={() => router.push('/dues/upload')}>
            <Upload className="mr-2 h-4 w-4" />
            Upload Remittance
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Collected (YTD)</p>
              <p className="text-2xl font-bold text-green-600">
                ${stats.totalCollected.toLocaleString()}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-green-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Pending Remittances</p>
              <p className="text-2xl font-bold text-yellow-600">
                ${stats.pendingRemittances.toLocaleString()}
              </p>
            </div>
            <TrendingUp className="h-8 w-8 text-yellow-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Total Arrears</p>
              <p className="text-2xl font-bold text-red-600">
                ${stats.inArrears.toLocaleString()}
              </p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Reconciliation Queue</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.reconciliationQueue}
              </p>
            </div>
            <RefreshCw className="h-8 w-8 text-blue-600" />
          </div>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-6 cursor-pointer hover:bg-muted/50"
          onClick={() => router.push('/dues/reconcile')}>
          <div className="flex items-center gap-4">
            <RefreshCw className="h-8 w-8 text-primary" />
            <div>
              <h3 className="font-semibold">Reconcile Remittances</h3>
              <p className="text-sm text-muted-foreground">
                Match employer remittances to member dues
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 cursor-pointer hover:bg-muted/50"
          onClick={() => router.push('/dues/arrears')}>
          <div className="flex items-center gap-4">
            <AlertCircle className="h-8 w-8 text-red-600" />
            <div>
              <h3 className="font-semibold">Manage Arrears</h3>
              <p className="text-sm text-muted-foreground">
                View and manage members with outstanding dues
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6 cursor-pointer hover:bg-muted/50"
          onClick={() => router.push('/dues/payment-plans')}>
          <div className="flex items-center gap-4">
            <FileText className="h-8 w-8 text-blue-600" />
            <div>
              <h3 className="font-semibold">Payment Plans</h3>
              <p className="text-sm text-muted-foreground">
                Set up and track payment plans
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Recent Remittances */}
      <Card>
        <div className="p-6 border-b">
          <h2 className="text-xl font-semibold">Recent Remittances</h2>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employer</TableHead>
              <TableHead>Period</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Members</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Uploaded</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {remittances.map((remittance) => (
              <TableRow 
                key={remittance.id}
                className="cursor-pointer hover:bg-muted/50"
                onClick={() => router.push(`/dues/remittances/${remittance.id}`)}
              >
                <TableCell className="font-medium">{remittance.employer}</TableCell>
                <TableCell>
                  {new Date(remittance.periodStart).toLocaleDateString()} - {' '}
                  {new Date(remittance.periodEnd).toLocaleDateString()}
                </TableCell>
                <TableCell>${remittance.amount.toLocaleString()}</TableCell>
                <TableCell>{remittance.memberCount}</TableCell>
                <TableCell>
                  <Badge className={getStatusColor(remittance.status)}>
                    {remittance.status}
                  </Badge>
                </TableCell>
                <TableCell>
                  {new Date(remittance.uploadedAt).toLocaleDateString()}
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
