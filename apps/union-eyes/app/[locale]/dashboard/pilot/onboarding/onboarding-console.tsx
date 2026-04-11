/**
 * Pilot Onboarding Page
 *
 * Landing page for new pilot organizations.
 * Readiness checklist, demo data controls, training resources, support info.
 *
 * @module app/dashboard/pilot/onboarding/page
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { Rocket, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { LoadingSkeletonComposer } from '@/components/ui/loading-skeleton-composer';
import {
  PilotReadinessChecklist,
  ChecklistItem,
} from '@/components/pilot/pilot-readiness-checklist';
import { DemoDataBadge, DemoDataset } from '@/components/pilot/demo-data-badge';
import { TrainingLinksPanel } from '@/components/pilot/training-links-panel';
import {
  SupportEscalationCard,
  PilotSupportInfo,
} from '@/components/pilot/support-escalation-card';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────

interface PilotState {
  checklist: ChecklistItem[];
  demo: {
    isActive: boolean;
    dataset?: DemoDataset;
  };
  support?: PilotSupportInfo;
}

// ─── Page ─────────────────────────────────────────────────────

export default function OnboardingConsole() {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PilotState | null>(null);

  const fetchPilotState = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/pilot/onboarding');
      if (response.ok) {
        const result = await response.json();
        setState(result.data ?? result);
      } else {
        // Use defaults if endpoint not yet wired
        setState({
          checklist: [],
          demo: { isActive: false },
        });
      }
    } catch (error) {
      logger.error('Failed to load pilot state', error);
      setState({
        checklist: [],
        demo: { isActive: false },
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPilotState();
  }, [fetchPilotState]);

  const handleSeedDemo = async () => {
    try {
      const response = await fetch('/api/pilot/demo-data', { method: 'POST' });
      if (response.ok) {
        await fetchPilotState();
      }
    } catch (error) {
      logger.error('Failed to seed demo data', error);
    }
  };

  const handlePurgeDemo = async () => {
    try {
      const response = await fetch('/api/pilot/demo-data', { method: 'DELETE' });
      if (response.ok) {
        await fetchPilotState();
      }
    } catch (error) {
      logger.error('Failed to purge demo data', error);
    }
  };

  const handleChecklistComplete = async (itemId: string) => {
    try {
      await fetch('/api/pilot/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, completed: true }),
      });
      await fetchPilotState();
    } catch (error) {
      logger.error('Failed to update checklist', error);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Pilot Onboarding</h1>
          <p className="text-sm text-muted-foreground">Loading setup status…</p>
        </div>
        <LoadingSkeletonComposer variant="card" rows={3} />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Rocket className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Welcome to UnionEyes</h1>
            <p className="text-sm text-muted-foreground">
              Complete the steps below to get your organization up and running.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchPilotState}>
          <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
          Refresh
        </Button>
      </div>

      {/* Readiness checklist */}
      <PilotReadinessChecklist
        items={state?.checklist.length ? state.checklist : undefined}
        onItemComplete={handleChecklistComplete}
      />

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demo data */}
        <DemoDataBadge
          isActive={state?.demo.isActive ?? false}
          dataset={state?.demo.dataset}
          onSeed={handleSeedDemo}
          onPurge={handlePurgeDemo}
        />

        {/* Support & escalation */}
        <SupportEscalationCard info={state?.support} />
      </div>

      {/* Training & guides */}
      <TrainingLinksPanel />
    </div>
  );
}
