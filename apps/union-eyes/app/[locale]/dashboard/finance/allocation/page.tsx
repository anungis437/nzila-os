/**
 * Allocation Rules & Simulation Page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { BarChart3, Play, AlertCircle } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { ApiShapeError, envelopeData, isRecord, readApiError } from '@/lib/client/api-envelope';

// The allocation_rules columns GET /api/finance/allocation sends: { success, data: [rule, ...], timestamp }.
interface AllocationRule {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: string;
}

// What POST /api/finance/simulation sends: { simulation: true, runId, isSimulation, totalAmount, lines } inside { success, data }. The total is the
// organization's unallocated platform cost for the period, as decimal text; the lines hold one entry per local named in the request.
interface SimulationResult {
  runId: string;
  totalAmount: string;
  lines: Array<{
    localId: string;
    weight: string;
    allocatedAmount: string;
  }>;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function readSimulation(body: unknown): SimulationResult {
  const data = envelopeData(body);
  if (typeof data.runId !== 'string' || typeof data.totalAmount !== 'string' || !Array.isArray(data.lines)) {
    throw new ApiShapeError('no simulation result');
  }
  return data as unknown as SimulationResult;
}

export default function AllocationPage() {
  const t = useTranslations('financeAllocationPage');
  const tCommon = useTranslations('common');
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [loading, setLoading] = useState(true);
  // A failure to read the rules is not "no rules": it is stated, with a retry, in place of the list.
  const [rulesError, setRulesError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simRunning, setSimRunning] = useState(false);
  const [simPeriodId, setSimPeriodId] = useState('');

  const fetchRules = useCallback(async () => {
    setLoading(true);
    setRulesError(null);
    try {
      const res = await fetch('/api/finance/allocation');
      if (!res.ok) throw new Error(await readApiError(res, t('errors.failedToLoadRules')));
      const body: unknown = await res.json();
      if (!isRecord(body) || !Array.isArray(body.data)) throw new ApiShapeError('no rule list');
      setRules(body.data as AllocationRule[]);
    } catch (err) {
      setRules([]);
      setRulesError(err instanceof Error ? err.message : t('errors.generic'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const runSimulation = async (ruleId: string) => {
    setSimRunning(true);
    setSimResult(null);
    setError(null);
    try {
      const res = await fetch('/api/finance/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId,
          billingPeriodId: simPeriodId,
          localBasisData: [],
        }),
      });
      if (!res.ok) throw new Error(await readApiError(res, t('errors.simulationFailed')));
      setSimResult(readSimulation(await res.json()));
    } catch (err) {
      setError(err instanceof Error ? err.message : t('errors.simulationError'));
    } finally {
      setSimRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">{t('title')}</h1>
        <Card className="p-6">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <BarChart3 className="h-6 w-6" /> {t('title')}
        </h1>
      </div>

      {error && (
        <Card className="p-4 border-destructive">
          <div role="alert" className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </Card>
      )}

      {/* Rules */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">{t('rules.title')}</h2>
        <div className="mb-4 max-w-sm">
          <Label htmlFor="sim-period" className="text-sm font-medium mb-1 block">
            {t('rules.billingPeriodId')}
          </Label>
          <Input
            id="sim-period"
            placeholder={t('rules.billingPeriodPlaceholder')}
            value={simPeriodId}
            onChange={(e) => setSimPeriodId(e.target.value.trim())}
          />
          <p className="text-xs text-muted-foreground mt-1">
            {t('rules.simulationNotice')}
          </p>
        </div>
        {rulesError !== null ? (
          <div className="space-y-3">
            <p role="alert" className="text-sm text-destructive flex items-center gap-2">
              <AlertCircle className="h-4 w-4" /> {rulesError}
            </p>
            <Button variant="outline" size="sm" onClick={() => void fetchRules()}>
              {tCommon('retry')}
            </Button>
          </div>
        ) : rules.length === 0 ? (
          <p className="text-muted-foreground text-sm">{t('rules.empty')}</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('rules.columns.name')}</TableHead>
                <TableHead>{t('rules.columns.status')}</TableHead>
                <TableHead>{t('rules.columns.created')}</TableHead>
                <TableHead>{t('rules.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                      {rule.isActive ? t('rules.status.active') : t('rules.status.inactive')}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(rule.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={simRunning || !UUID.test(simPeriodId)}
                      onClick={() => runSimulation(rule.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      {t('rules.simulate')}
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Simulation Results */}
      {simResult && (
        <Card className="p-4 border-blue-500/30">
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Badge variant="outline">{t('results.simulationBadge')}</Badge>
            {t('results.title')}
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            {t('results.totalCostPool', {
              amount: formatCurrency(Number(simResult.totalAmount)),
            })}
          </p>
          {simResult.lines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('results.columns.local')}</TableHead>
                  <TableHead>{t('results.columns.sharePercent')}</TableHead>
                  <TableHead>{t('results.columns.allocatedCad')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simResult.lines.map((line) => (
                  <TableRow key={line.localId}>
                    <TableCell className="font-mono text-xs">{line.localId}</TableCell>
                    <TableCell>{line.weight}%</TableCell>
                    <TableCell>{formatCurrency(Number(line.allocatedAmount))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">{t('results.empty')}</p>
          )}
        </Card>
      )}
    </div>
  );
}
