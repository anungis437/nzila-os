'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, TrendingUp } from 'lucide-react';
 
import { useToast } from '@/lib/hooks/use-toast';

interface APAgingData {
  vendorId: string;
  vendorName: string;
  current: number;
  days1_30: number;
  days31_60: number;
  days61_90: number;
  days90Plus: number;
  totalDue: number;
  status: string;
}

interface APAgingReportProps {
  organizationId: string;
}

export default function APAgingReport({ organizationId: _organizationId }: APAgingReportProps) {
  const [agingData, setAgingData] = useState<APAgingData[]>([]);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalCurrent: 0,
    total1_30: 0,
    total31_60: 0,
    total61_90: 0,
    total90Plus: 0,
    grandTotal: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    // In a real implementation, this would fetch from an API endpoint
    // For now, we&apos;ll use mock data
    fetchAPAging();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAPAging = async () => {
    try {
      setLoading(true);
      
      // Mock data - in production, this would be:
      // const response = await fetch('/api/financial/reports/ap-aging');
      // const data = await response.json();
      
      const mockData: APAgingData[] = [
        {
          vendorId: '1',
          vendorName: 'Office Depot',
          current: 1250.00,
          days1_30: 850.00,
          days31_60: 0,
          days61_90: 0,
          days90Plus: 0,
          totalDue: 2100.00,
          status: 'open',
        },
        {
          vendorId: '2',
          vendorName: 'Tech Solutions Inc.',
          current: 5000.00,
          days1_30: 2500.00,
          days31_60: 1500.00,
          days61_90: 0,
          days90Plus: 0,
          totalDue: 9000.00,
          status: 'open',
        },
        {
          vendorId: '3',
          vendorName: 'ABC Cleaning Services',
          current: 0,
          days1_30: 0,
          days31_60: 450.00,
          days61_90: 300.00,
          days90Plus: 150.00,
          totalDue: 900.00,
          status: 'overdue',
        },
      ];

      setAgingData(mockData);

      // Calculate summary
      const summary = mockData.reduce((acc, vendor) => ({
        totalCurrent: acc.totalCurrent + vendor.current,
        total1_30: acc.total1_30 + vendor.days1_30,
        total31_60: acc.total31_60 + vendor.days31_60,
        total61_90: acc.total61_90 + vendor.days61_90,
        total90Plus: acc.total90Plus + vendor.days90Plus,
        grandTotal: acc.grandTotal + vendor.totalDue,
      }), {
        totalCurrent: 0,
        total1_30: 0,
        total31_60: 0,
        total61_90: 0,
        total90Plus: 0,
        grandTotal: 0,
      });

      setSummary(summary);

    } catch (_error) {
      toast({
        title: 'Error',
        description: 'Failed to load AP aging report',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'destructive' | 'outline'> = {
      open: 'outline',
      overdue: 'destructive',
      paid: 'default',
    };
    return <Badge variant={variants[status] || 'outline'}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Accounts Payable Aging</h2>
          <p className="text-muted-foreground">
            Outstanding vendor invoices by aging period
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Current</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.totalCurrent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">0-30 days</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">1-30 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.total1_30.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground text-yellow-600">Attention needed</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">31-60 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${summary.total31_60.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Overdue</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">61-90 Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${summary.total61_90.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Critical</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">90+ Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${summary.total90Plus.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">Very critical</p>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Due</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.grandTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">All vendors</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>Aging Details by Vendor</CardTitle>
          <CardDescription>
            Breakdown of payables by vendor and aging bucket
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">Loading...</div>
          ) : agingData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No outstanding payables
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Vendor</TableHead>
                  <TableHead className="text-right">Current</TableHead>
                  <TableHead className="text-right">1-30 Days</TableHead>
                  <TableHead className="text-right">31-60 Days</TableHead>
                  <TableHead className="text-right">61-90 Days</TableHead>
                  <TableHead className="text-right">90+ Days</TableHead>
                  <TableHead className="text-right">Total Due</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {agingData.map((vendor) => (
                  <TableRow key={vendor.vendorId}>
                    <TableCell className="font-medium">{vendor.vendorName}</TableCell>
                    <TableCell className="text-right">
                      ${vendor.current.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right">
                      ${vendor.days1_30.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-orange-600">
                      ${vendor.days31_60.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-destructive">
                      ${vendor.days61_90.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right text-destructive font-bold">
                      ${vendor.days90Plus.toLocaleString()}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      ${vendor.totalDue.toLocaleString()}
                    </TableCell>
                    <TableCell>{getStatusBadge(vendor.status)}</TableCell>
                  </TableRow>
                ))}
                {/* Summary Row */}
                <TableRow className="bg-muted font-bold">
                  <TableCell>Total</TableCell>
                  <TableCell className="text-right">
                    ${summary.totalCurrent.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ${summary.total1_30.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-orange-600">
                    ${summary.total31_60.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    ${summary.total61_90.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right text-destructive">
                    ${summary.total90Plus.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    ${summary.grandTotal.toLocaleString()}
                  </TableCell>
                  <TableCell></TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Alerts */}
      {summary.total61_90 + summary.total90Plus > 0 && (
        <Card className="border-destructive">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <CardTitle>Critical Overdue Items</CardTitle>
            </div>
            <CardDescription>
              ${(summary.total61_90 + summary.total90Plus).toLocaleString()} in invoices over 60 days
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              Immediate action required to avoid late fees and maintain vendor relationships.
              Consider prioritizing payment of the oldest invoices.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
