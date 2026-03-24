'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
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

export default function APAgingReport({ organizationId }: APAgingReportProps) {
  const t = useTranslations('financial.apAging');
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
    fetchAPAging();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId]);

  const fetchAPAging = async () => {
    try {
      setLoading(true);
      
      const response = await fetch(`/api/v2/financial/reports/aged-receivables?organizationId=${organizationId}`);
      
      let data: APAgingData[] = [];
      if (response.ok) {
        const json = await response.json();
        const items = Array.isArray(json) ? json : json?.results ?? json?.data ?? [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data = items.map((v: any) => ({
          vendorId: String(v.vendorId ?? v.vendor_id ?? v.id ?? ''),
          vendorName: v.vendorName ?? v.vendor_name ?? v.name ?? '',
          current: v.current ?? 0,
          days1_30: v.days1_30 ?? v.days_1_30 ?? 0,
          days31_60: v.days31_60 ?? v.days_31_60 ?? 0,
          days61_90: v.days61_90 ?? v.days_61_90 ?? 0,
          days90Plus: v.days90Plus ?? v.days_90_plus ?? 0,
          totalDue: v.totalDue ?? v.total_due ?? v.total ?? 0,
          status: v.status ?? 'open',
        }));
      }

      setAgingData(data);

      // Calculate summary
      const calcSummary = data.reduce((acc, vendor) => ({
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

      setSummary(calcSummary);

    } catch (_error) {
      toast({
        title: t('error'),
        description: t('loadFailed'),
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
          <h2 className="text-3xl font-bold tracking-tight">{t('title')}</h2>
          <p className="text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-6">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('current')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.totalCurrent.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{t('currentPeriod')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('period1_30')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.total1_30.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground text-yellow-600">{t('period1_30Desc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('period31_60')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              ${summary.total31_60.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{t('period31_60Desc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('period61_90')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${summary.total61_90.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{t('period61_90Desc')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('period90Plus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              ${summary.total90Plus.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{t('period90PlusDesc')}</p>
          </CardContent>
        </Card>

        <Card className="border-primary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{t('totalDue')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${summary.grandTotal.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">{t('allVendors')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Detailed Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('agingDetails')}</CardTitle>
          <CardDescription>
            {t('agingDetailsDesc')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">{t('loading')}</div>
          ) : agingData.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {t('noOutstanding')}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('vendor')}</TableHead>
                  <TableHead className="text-right">{t('current')}</TableHead>
                  <TableHead className="text-right">{t('period1_30')}</TableHead>
                  <TableHead className="text-right">{t('period31_60')}</TableHead>
                  <TableHead className="text-right">{t('period61_90')}</TableHead>
                  <TableHead className="text-right">{t('period90Plus')}</TableHead>
                  <TableHead className="text-right">{t('totalDue')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
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
                  <TableCell>{t('total')}</TableCell>
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
              <CardTitle>{t('criticalOverdue')}</CardTitle>
            </div>
            <CardDescription>
              {t('criticalOverdueAmount', { amount: (summary.total61_90 + summary.total90Plus).toLocaleString() })}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm">
              {t('criticalOverdueAction')}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
