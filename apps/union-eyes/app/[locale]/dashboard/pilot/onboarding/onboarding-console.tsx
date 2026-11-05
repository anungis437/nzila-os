/**
 * Pilot Onboarding Page
 *
 * Landing page for new pilot organizations.
 * Readiness checklist, demo data controls, support contact.
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
  apiItemIdOf,
  buildChecklistFromFlags,
  ChecklistItem,
} from '@/components/pilot/pilot-readiness-checklist';
import { DemoDataBadge, DemoDataset } from '@/components/pilot/demo-data-badge';
import { PilotSupportCard } from '@/components/pilot/pilot-support-card';
import { logger } from '@/lib/logger';

// ─── Types ────────────────────────────────────────────────────

interface DemoState {
  isActive: boolean;
  dataset?: DemoDataset;
  telemetryTag?: string;
}

interface PilotState {
  checklist: ChecklistItem[];
  demo: DemoState;
}

/** What GET /api/pilot/onboarding answers: under `data`, the steps by the API's own ids with whether each is done, and the demo-data state. */
interface OnboardingAnswer {
  data?: { items?: Record<string, boolean>; demo?: DemoState };
}

/** The reason a refused or failed answer gives (`{ code, message }`), or the fallback when it gives none. */
async function reasonOf(response: Response, fallback: string): Promise<string> {
  const failure = (await response.json().catch(() => null)) as { message?: unknown } | null;
  return typeof failure?.message === 'string' && failure.message ? failure.message : fallback;
}

// ─── Page ─────────────────────────────────────────────────────

export default function OnboardingConsole({ supportEmail }: { supportEmail: string }) {
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<PilotState | null>(null);
  /** What went wrong the last time something was asked of the server, in the server's own words where it gave them. */
  const [problem, setProblem] = useState<string | null>(null);

  const fetchPilotState = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/pilot/onboarding');
      if (!response.ok) {
        setProblem(await reasonOf(response, 'The setup status could not be loaded.'));
        return;
      }
      const result = (await response.json()) as OnboardingAnswer;
      setProblem(null);
      setState({
        checklist: buildChecklistFromFlags(result.data?.items ?? {}),
        demo: result.data?.demo ?? { isActive: false },
      });
    } catch (error) {
      logger.error('Failed to load pilot state', error);
      setProblem('The setup status could not be loaded.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPilotState();
  }, [fetchPilotState]);

  const handleSeedDemo = async () => {
    setProblem(null);
    try {
      const response = await fetch('/api/pilot/demo-data', { method: 'POST' });
      if (response.ok) await fetchPilotState();
      else setProblem(await reasonOf(response, 'Demo data could not be created.'));
    } catch (error) {
      logger.error('Failed to seed demo data', error);
      setProblem('Demo data could not be created.');
    }
  };

  const handlePurgeDemo = async () => {
    setProblem(null);
    try {
      const response = await fetch('/api/pilot/demo-data', { method: 'DELETE' });
      if (response.ok) await fetchPilotState();
      else setProblem(await reasonOf(response, 'Demo data could not be removed.'));
    } catch (error) {
      logger.error('Failed to purge demo data', error);
      setProblem('Demo data could not be removed.');
    }
  };

  /** A step is marked done only when the organization's own data shows it happened; the server says what is missing when it does not. */
  const handleChecklistVerify = async (checklistId: string) => {
    const itemId = apiItemIdOf(checklistId);
    if (!itemId) return;
    setProblem(null);
    try {
      const response = await fetch('/api/pilot/onboarding', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemId, completed: true }),
      });
      if (response.ok) await fetchPilotState();
      else setProblem(await reasonOf(response, 'The step could not be verified.'));
    } catch (error) {
      logger.error('Failed to update checklist', error);
      setProblem('The step could not be verified.');
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

      {problem && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {problem}
        </div>
      )}

      {/* Readiness checklist */}
      {state && <PilotReadinessChecklist items={state.checklist} onItemComplete={handleChecklistVerify} />}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Demo data */}
        {state && (
          <DemoDataBadge
            isActive={state.demo.isActive}
            dataset={state.demo.dataset}
            telemetryTag={state.demo.telemetryTag}
            onSeed={handleSeedDemo}
            onPurge={handlePurgeDemo}
          />
        )}

        {/* Support */}
        <PilotSupportCard supportEmail={supportEmail} />
      </div>
    </div>
  );
}
