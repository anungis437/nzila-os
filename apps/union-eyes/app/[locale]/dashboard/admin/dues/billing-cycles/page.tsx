'use client';


export const dynamic = 'force-dynamic';
/**
 * Billing Cycle Management
 * 
 * Phase 3: Admin UI - Billing Cycle Management
 * 
 * Features:
 * - View billing cycle history
 * - Generate new billing cycles (monthly, bi-weekly, weekly)
 * - Preview billing before execution (dry run)
 * - View cycle details (transactions, amounts, member count)
 * 
 * @module app/dashboard/admin/dues/billing-cycles
 */

import { useState } from 'react';
import { useAuth } from '@nzila/platform-auth/entra/client';
import { useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  PlayCircle,
  Eye,
  Calendar,
  DollarSign,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
} from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';

// =============================================================================
// TYPES
// =============================================================================

interface BillingCycleResult {
  success: boolean;
  cycleId: string;
  transactionsCreated: number;
  totalAmount: number;
  frequency: string;
  periodStart: string;
  periodEnd: string;
  breakdown: {
    duesAmount: number;
    copeAmount: number;
    pacAmount: number;
    strikeFundAmount: number;
  };
  members: {
    processed: number;
    success: number;
    failed: number;
    skipped: number;
  };
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDate(date: string): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

// =============================================================================
// GENERATE BILLING CYCLE DIALOG
// =============================================================================

function GenerateBillingCycleDialog({
  t,
}: {
  t: (key: string, values?: Record<string, string | number | Date>) => string;
}) {
  const { orgId } = useAuth();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<string>('monthly');
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<BillingCycleResult | null>(null);

  const handlePreview = async () => {
    try {
      setPreviewing(true);

      const response = await fetch('/api/admin/billing-cycles/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId ?? '',
          frequency,
        }),
      });

      if (!response.ok) {
        throw new Error(t('failedToPreviewBillingCycle'));
      }

      const result = await response.json();
      setPreviewResult(result);
    } catch (error) {
      logger.error('Error previewing billing cycle', { error });
      alert(t('failedToPreviewBillingCycle'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async (dryRun: boolean = false) => {
    try {
      setGenerating(true);

      const response = await fetch('/api/admin/billing-cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId ?? '',
          frequency,
          dryRun,
        }),
      });

      if (!response.ok) {
        throw new Error(t('failedToGenerateBillingCycle'));
      }

      const result = await response.json();
      
      if (dryRun) {
        setPreviewResult(result);
      } else {
        alert(
          t('billingCycleGeneratedSuccess', {
            count: result.transactionsCreated,
            total: formatCurrency(result.totalAmount),
          })
        );
        setOpen(false);
        setPreviewResult(null);
      }
    } catch (error) {
      logger.error('Error generating billing cycle', { error });
      alert(t('failedToGenerateBillingCycle'));
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlayCircle className="mr-2 h-4 w-4" />
          {t('generateBillingCycleButton')}
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('generateBillingCycleTitle')}</DialogTitle>
          <DialogDescription>
            {t('generateBillingCycleDescription')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Frequency Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('billingFrequencyLabel')}</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectFrequencyPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{t('frequencyWeekly')}</SelectItem>
                <SelectItem value="bi_weekly">{t('frequencyBiWeekly')}</SelectItem>
                <SelectItem value="monthly">{t('frequencyMonthly')}</SelectItem>
                <SelectItem value="quarterly">{t('frequencyQuarterly')}</SelectItem>
                <SelectItem value="annual">{t('frequencyAnnual')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview Results */}
          {previewResult && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Eye className="mr-2 h-5 w-5 text-blue-600" />
                  {t('previewResultsTitle')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">{t('periodLabel')}</div>
                    <div className="font-medium">
                      {formatDate(previewResult.periodStart)} - {formatDate(previewResult.periodEnd)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('frequencyLabel')}</div>
                    <div className="font-medium capitalize">{previewResult.frequency.replace('_', '-')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('transactionsLabel')}</div>
                    <div className="font-bold text-blue-600">{previewResult.transactionsCreated}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('totalAmountLabel')}</div>
                    <div className="font-bold text-green-600">{formatCurrency(previewResult.totalAmount)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('membersProcessedLabel')}</div>
                    <div className="font-medium">{previewResult.members.processed}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">{t('successRateLabel')}</div>
                    <div className="font-medium">
                      {previewResult.members.processed > 0
                        ? Math.round((previewResult.members.success / previewResult.members.processed) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-2">{t('amountBreakdownTitle')}</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">{t('duesLabel')}:</span>
                      <span>{formatCurrency(previewResult.breakdown.duesAmount)}</span>
                    </div>
                    {previewResult.breakdown.copeAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('copeLabel')}:</span>
                        <span>{formatCurrency(previewResult.breakdown.copeAmount)}</span>
                      </div>
                    )}
                    {previewResult.breakdown.pacAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('pacLabel')}:</span>
                        <span>{formatCurrency(previewResult.breakdown.pacAmount)}</span>
                      </div>
                    )}
                    {previewResult.breakdown.strikeFundAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t('strikeFundLabel')}:</span>
                        <span>{formatCurrency(previewResult.breakdown.strikeFundAmount)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={generating || previewing}
          >
            <Eye className="mr-2 h-4 w-4" />
            {previewing ? t('previewingButton') : t('previewButton')}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline">
            {t('cancelButton')}
          </Button>
          <Button
            onClick={() => handleGenerate(false)}
            disabled={generating || !previewResult}
          >
            {generating ? t('generatingButton') : t('generateBillingCycleButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

export default function BillingCycleManagement() {
  const t = useTranslations('adminDuesBillingCyclesPage');
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{t('title')}</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            {t('subtitle')}
          </p>
        </div>
        <GenerateBillingCycleDialog t={t} />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('nextBillingDateTitle')}</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{t('nextBillingDateValue')}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('nextBillingDateHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('lastCycleTotalTitle')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(125000)}</div>
            <p className="text-xs text-muted-foreground mt-1">{t('lastCycleTotalHint')}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('activeMembersTitle')}</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground mt-1">{t('activeMembersHint')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing Cycle History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentBillingCyclesTitle')}</CardTitle>
          <CardDescription>{t('recentBillingCyclesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Example Cycle 1 */}
            <div className="flex items-start space-x-4 p-4 border rounded-lg">
              <div className="p-2 bg-green-100 rounded-lg">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('cycle1Title')}</h3>
                  <Badge variant="default">{t('statusCompleted')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('cycle1ExecutedLine', { total: formatCurrency(125000) })}
                </p>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                  <span>{t('cycle1Period')}</span>
                  <span>•</span>
                  <span>{t('cycle1SuccessRate')}</span>
                </div>
              </div>
            </div>

            {/* Example Cycle 2 */}
            <div className="flex items-start space-x-4 p-4 border rounded-lg">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('cycle2Title')}</h3>
                  <Badge variant="secondary">{t('statusCompleted')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('cycle2ExecutedLine', { total: formatCurrency(122500) })}
                </p>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                  <span>{t('cycle2Period')}</span>
                  <span>•</span>
                  <span>{t('cycle2SuccessRate')}</span>
                </div>
              </div>
            </div>

            {/* Example Cycle 3 - with error */}
            <div className="flex items-start space-x-4 p-4 border rounded-lg border-orange-200 bg-orange-50">
              <div className="p-2 bg-orange-100 rounded-lg">
                <AlertCircle className="h-5 w-5 text-orange-600" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{t('cycle3Title')}</h3>
                  <Badge variant="destructive">{t('statusPartial')}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  {t('cycle3ExecutedLine', { total: formatCurrency(118000) })}
                </p>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                  <span>{t('cycle3Period')}</span>
                  <span>•</span>
                  <span className="text-orange-600 font-medium">{t('cycle3Failures')}</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
