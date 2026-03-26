/**
 * Allocation Rules & Simulation Page
 */

'use client';

export const dynamic = 'force-dynamic';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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

interface AllocationRule {
  id: string;
  name: string;
  costType: string;
  isActive: boolean;
  createdAt: string;
}

interface SimulationResult {
  simulation: boolean;
  allocationRunId: string;
  totalCostPoolCad: string;
  lines: Array<{
    localId: string;
    sharePercent: string;
    allocatedAmountCad: string;
  }>;
}

export default function AllocationPage() {
  const [rules, setRules] = useState<AllocationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [simResult, setSimResult] = useState<SimulationResult | null>(null);
  const [simRunning, setSimRunning] = useState(false);

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/finance/allocation');
      if (!res.ok) throw new Error('Failed to load allocation rules');
      const json = await res.json();
      setRules(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const runSimulation = async (ruleId: string) => {
    setSimRunning(true);
    setSimResult(null);
    try {
      const res = await fetch('/api/finance/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ruleId,
          billingPeriodId: '00000000-0000-0000-0000-000000000000', // placeholder
          localBasisData: [], // would come from real data
        }),
      });
      if (!res.ok) throw new Error('Simulation failed');
      const json = await res.json();
      setSimResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Simulation error');
    } finally {
      setSimRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-2xl font-bold">Cost Allocation</h1>
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
          <BarChart3 className="h-6 w-6" /> Cost Allocation
        </h1>
      </div>

      {error && (
        <Card className="p-4 border-destructive">
          <div className="flex items-center gap-2 text-destructive text-sm">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        </Card>
      )}

      {/* Rules */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold mb-3">Allocation Rules</h2>
        {rules.length === 0 ? (
          <p className="text-muted-foreground text-sm">No allocation rules configured</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cost Type</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.name}</TableCell>
                  <TableCell className="capitalize">{rule.costType.replace(/_/g, ' ')}</TableCell>
                  <TableCell>
                    <Badge variant={rule.isActive ? 'default' : 'secondary'}>
                      {rule.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell>{new Date(rule.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={simRunning}
                      onClick={() => runSimulation(rule.id)}
                    >
                      <Play className="h-3 w-3 mr-1" />
                      Simulate
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
            <Badge variant="outline">Simulation</Badge>
            Allocation Preview
          </h2>
          <p className="text-sm text-muted-foreground mb-3">
            Total cost pool: {formatCurrency(Number(simResult.totalCostPoolCad))} — No records written
          </p>
          {simResult.lines.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Local</TableHead>
                  <TableHead>Share %</TableHead>
                  <TableHead>Allocated (CAD)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {simResult.lines.map((line, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-mono text-xs">{line.localId}</TableCell>
                    <TableCell>{line.sharePercent}%</TableCell>
                    <TableCell>{formatCurrency(Number(line.allocatedAmountCad))}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No allocation lines in simulation</p>
          )}
        </Card>
      )}
    </div>
  );
}
