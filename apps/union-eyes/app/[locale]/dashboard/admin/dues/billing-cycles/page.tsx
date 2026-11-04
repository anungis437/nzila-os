'use client';


export const dynamic = 'force-dynamic';
/**
 * Billing Cycle Management
 *
 * Phase 3: Admin UI - Billing Cycle Management
 *
 * Features:
 * - Preview billing before execution (dry run)
 * - Generate a billing cycle (monthly, bi-weekly, weekly, quarterly, annual)
 *
 * The history of earlier cycles is not shown: GET /api/admin/billing-cycles answers HTTP 501 (billing-cycle history is not implemented), so the page
 * says so. It used to list three example cycles, a last-cycle total, a next billing date and a member count that nothing computed.
 *
 * @module app/dashboard/admin/dues/billing-cycles
 */

import { useState } from 'react';
import { useAuth } from '@nzila/platform-auth/entra/client';
import { useLocale, useTranslations } from 'next-intl';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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
import { Alert, AlertDescription } from '@/components/ui/alert';
import { PlayCircle, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { logger } from '@/lib/logger';
import { CapabilityUnavailable } from '@/components/system/capability-unavailable';
import { ApiShapeError, envelopeData, isRecord, readApiError } from '@/lib/client/api-envelope';
import { recordedDay } from '@/lib/client/day';

// =============================================================================
// TYPES
// =============================================================================

// What POST /api/admin/billing-cycles and .../preview answer inside { success, data, timestamp }.
interface BillingCycleResult {
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

function readCycle(body: unknown): BillingCycleResult {
  const data = envelopeData(body);
  if (
    typeof data.transactionsCreated !== 'number' ||
    typeof data.totalAmount !== 'number' ||
    typeof data.frequency !== 'string' ||
    typeof data.periodStart !== 'string' ||
    typeof data.periodEnd !== 'string' ||
    !isRecord(data.breakdown) ||
    !isRecord(data.members)
  ) {
    throw new ApiShapeError('no billing cycle');
  }
  return data as unknown as BillingCycleResult;
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function formatDate(date: string): string {
  return format(recordedDay(date), 'MMM dd, yyyy');
}

// =============================================================================
// GENERATE BILLING CYCLE DIALOG
// =============================================================================

function GenerateBillingCycleDialog({
  t,
  onGenerated,
}: {
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  onGenerated: (result: BillingCycleResult) => void;
}) {
  const { orgId } = useAuth();
  const [open, setOpen] = useState(false);
  const [frequency, setFrequency] = useState<string>('monthly');
  const [generating, setGenerating] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [previewResult, setPreviewResult] = useState<BillingCycleResult | null>(null);
  // What the route said when it refused (a missing mandate, an incomplete preview): shown in the dialog, not as a bare alert.
  const [failure, setFailure] = useState<string | null>(null);

  const run = async (url: string, body: Record<string, unknown>, fallback: string): Promise<BillingCycleResult> => {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    if (!response.ok) throw new Error(await readApiError(response, fallback));
    return readCycle(await response.json());
  };

  const handlePreview = async () => {
    if (!orgId) return;
    try {
      setPreviewing(true);
      setFailure(null);
      setPreviewResult(await run('/api/admin/billing-cycles/preview', { organizationId: orgId, frequency }, t('failedToPreviewBillingCycle')));
    } catch (error) {
      logger.error('Error previewing billing cycle', { error });
      setPreviewResult(null);
      setFailure(error instanceof Error ? error.message : t('failedToPreviewBillingCycle'));
    } finally {
      setPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    if (!orgId) return;
    try {
      setGenerating(true);
      setFailure(null);
      const result = await run('/api/admin/billing-cycles', { organizationId: orgId, frequency, dryRun: false }, t('failedToGenerateBillingCycle'));
      setOpen(false);
      setPreviewResult(null);
      onGenerated(result);
    } catch (error) {
      logger.error('Error generating billing cycle', { error });
      setFailure(error instanceof Error ? error.message : t('failedToGenerateBillingCycle'));
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
          {!orgId && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>No organization is selected, so a billing cycle cannot be previewed or generated.</AlertDescription>
            </Alert>
          )}

          {failure !== null && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{failure}</AlertDescription>
            </Alert>
          )}

          {/* Frequency Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('billingFrequencyLabel')}</label>
            <Select
              value={frequency}
              onValueChange={(value) => {
                setFrequency(value);
                setPreviewResult(null);
              }}
            >
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
                        ? `${Math.round((previewResult.members.success / previewResult.members.processed) * 100)}%`
                        : '—'}
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
            disabled={!orgId || generating || previewing}
          >
            <Eye className="mr-2 h-4 w-4" />
            {previewing ? t('previewingButton') : t('previewButton')}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline">
            {t('cancelButton')}
          </Button>
          <Button
            onClick={handleGenerate}
            disabled={!orgId || generating || !previewResult}
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
  const locale = useLocale();
  // What the route answered for the cycle just generated: the count and the total are the server's, not the page's.
  const [generated, setGenerated] = useState<BillingCycleResult | null>(null);

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
        <GenerateBillingCycleDialog t={t} onGenerated={setGenerated} />
      </div>

      {generated && (
        <Alert role="status">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription>
            {t('billingCycleGeneratedSuccess', { count: generated.transactionsCreated, total: formatCurrency(generated.totalAmount) })}
          </AlertDescription>
        </Alert>
      )}

      {/* Billing Cycle History */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentBillingCyclesTitle')}</CardTitle>
          <CardDescription>{t('recentBillingCyclesDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <CapabilityUnavailable locale={locale} capability="UE-FIN-DUES-BILLING-CYCLE-HISTORY" />
        </CardContent>
      </Card>
    </div>
  );
}
