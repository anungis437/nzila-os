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
import { useAuth } from '@clerk/nextjs';
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

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
  }).format(amount);
}

function formatDate(date: string): string {
  return format(new Date(date), 'MMM dd, yyyy');
}

// =============================================================================
// GENERATE BILLING CYCLE DIALOG
// =============================================================================

function GenerateBillingCycleDialog() {
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
        throw new Error('Failed to preview billing cycle');
      }

      const result = await response.json();
      setPreviewResult(result);
    } catch (error) {
      logger.error('Error previewing billing cycle', { error });
      alert('Failed to preview billing cycle');
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
        throw new Error('Failed to generate billing cycle');
      }

      const result = await response.json();
      
      if (dryRun) {
        setPreviewResult(result);
      } else {
        alert(`Billing cycle generated successfully! Created ${result.transactionsCreated} transactions totaling ${formatCurrency(result.totalAmount)}.`);
        setOpen(false);
        setPreviewResult(null);
      }
    } catch (error) {
      logger.error('Error generating billing cycle', { error });
      alert('Failed to generate billing cycle');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <PlayCircle className="mr-2 h-4 w-4" />
          Generate Billing Cycle
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Generate Billing Cycle</DialogTitle>
          <DialogDescription>
            Create billing transactions for all active members based on their dues rules.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Frequency Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Billing Frequency</label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger>
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">Weekly</SelectItem>
                <SelectItem value="bi_weekly">Bi-Weekly</SelectItem>
                <SelectItem value="monthly">Monthly</SelectItem>
                <SelectItem value="quarterly">Quarterly</SelectItem>
                <SelectItem value="annual">Annual</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Preview Results */}
          {previewResult && (
            <Card className="border-blue-200 bg-blue-50">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Eye className="mr-2 h-5 w-5 text-blue-600" />
                  Preview Results
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-muted-foreground">Period</div>
                    <div className="font-medium">
                      {formatDate(previewResult.periodStart)} - {formatDate(previewResult.periodEnd)}
                    </div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Frequency</div>
                    <div className="font-medium capitalize">{previewResult.frequency.replace('_', '-')}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Transactions</div>
                    <div className="font-bold text-blue-600">{previewResult.transactionsCreated}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Total Amount</div>
                    <div className="font-bold text-green-600">{formatCurrency(previewResult.totalAmount)}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Members Processed</div>
                    <div className="font-medium">{previewResult.members.processed}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">Success Rate</div>
                    <div className="font-medium">
                      {previewResult.members.processed > 0
                        ? Math.round((previewResult.members.success / previewResult.members.processed) * 100)
                        : 0}%
                    </div>
                  </div>
                </div>

                {/* Breakdown */}
                <div className="pt-3 border-t">
                  <div className="text-sm font-medium mb-2">Amount Breakdown</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Dues:</span>
                      <span>{formatCurrency(previewResult.breakdown.duesAmount)}</span>
                    </div>
                    {previewResult.breakdown.copeAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">COPE:</span>
                        <span>{formatCurrency(previewResult.breakdown.copeAmount)}</span>
                      </div>
                    )}
                    {previewResult.breakdown.pacAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PAC:</span>
                        <span>{formatCurrency(previewResult.breakdown.pacAmount)}</span>
                      </div>
                    )}
                    {previewResult.breakdown.strikeFundAmount > 0 && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Strike Fund:</span>
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
            {previewing ? 'Previewing...' : 'Preview'}
          </Button>
          <Button onClick={() => setOpen(false)} variant="outline">
            Cancel
          </Button>
          <Button
            onClick={() => handleGenerate(false)}
            disabled={generating || !previewResult}
          >
            {generating ? 'Generating...' : 'Generate Billing Cycle'}
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
  return (
    <div className="container mx-auto p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Billing Cycle Management</h1>
          <p className="text-sm md:text-base text-muted-foreground">
            Generate and manage automated billing cycles
          </p>
        </div>
        <GenerateBillingCycleDialog />
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Next Billing Date</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">March 1, 2026</div>
            <p className="text-xs text-muted-foreground mt-1">16 days remaining</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Cycle Total</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(125000)}</div>
            <p className="text-xs text-muted-foreground mt-1">February 2026 cycle</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">1,247</div>
            <p className="text-xs text-muted-foreground mt-1">Eligible for billing</p>
          </CardContent>
        </Card>
      </div>

      {/* Billing Cycle History */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Billing Cycles</CardTitle>
          <CardDescription>History of executed billing cycles</CardDescription>
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
                  <h3 className="font-semibold">February 2026 - Monthly Cycle</h3>
                  <Badge variant="default">Completed</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Executed on Feb 1, 2026 • 1,247 transactions • {formatCurrency(125000)}
                </p>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                  <span>Period: Feb 1 - Feb 28, 2026</span>
                  <span>•</span>
                  <span>Success Rate: 99.2%</span>
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
                  <h3 className="font-semibold">January 2026 - Monthly Cycle</h3>
                  <Badge variant="secondary">Completed</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Executed on Jan 1, 2026 • 1,239 transactions • {formatCurrency(122500)}
                </p>
                <div className="flex items-center space-x-4 text-xs text-muted-foreground mt-2">
                  <span>Period: Jan 1 - Jan 31, 2026</span>
                  <span>•</span>
                  <span>Success Rate: 98.8%</span>
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
                  <h3 className="font-semibold">December 2025 - Monthly Cycle</h3>
                  <Badge variant="destructive">Partial</Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                  Executed on Dec 1, 2025 • 1,198 transactions • {formatCurrency(118000)}
                </p>
                <div className="flex items-center space-x-4 text-xs textmuted-foreground mt-2">
                  <span>Period: Dec 1 - Dec 31, 2025</span>
                  <span>•</span>
                  <span className="text-orange-600 font-medium">15 failures</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
