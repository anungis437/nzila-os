/**
 * Control Plane — Workflow Data Layer
 *
 * Server-side functions for the governance page's workflow section.
 * Uses @nzila/governed-workflow registry for live workflow state,
 * with deterministic seed fallback.
 */
import 'server-only'

import { listWorkflows } from '@nzila/governed-workflow'
import type { GovernedWorkflowDef } from '@nzila/governed-workflow'

// ── Types ────────────────────────────────────────────────────────────────

export interface WorkflowOverviewRow {
  name: string
  version: string
  hasIngestion: boolean
  hasFsm: boolean
  hasEvidence: boolean
}

export interface WorkflowSummary {
  totalRegistered: number
  withIngestion: number
  withFsm: number
  withEvidence: number
  workflows: WorkflowOverviewRow[]
}

// ── Seed data ────────────────────────────────────────────────────────────

function seedWorkflowSummary(): WorkflowSummary {
  const workflows: WorkflowOverviewRow[] = [
    { name: 'onboard-member', version: '1.0.0', hasIngestion: true, hasFsm: true, hasEvidence: true },
    { name: 'process-claim', version: '1.0.0', hasIngestion: true, hasFsm: true, hasEvidence: true },
    { name: 'escalate-grievance', version: '1.0.0', hasIngestion: false, hasFsm: true, hasEvidence: true },
    { name: 'sync-payroll', version: '1.0.0', hasIngestion: true, hasFsm: false, hasEvidence: false },
  ]
  return {
    totalRegistered: workflows.length,
    withIngestion: workflows.filter((w) => w.hasIngestion).length,
    withFsm: workflows.filter((w) => w.hasFsm).length,
    withEvidence: workflows.filter((w) => w.hasEvidence).length,
    workflows,
  }
}

// ── Live data accessors ──────────────────────────────────────────────────

function defToRow(def: GovernedWorkflowDef): WorkflowOverviewRow {
  return {
    name: def.name,
    version: def.version,
    hasIngestion: !!def.ingestion,
    hasFsm: !!def.fsm,
    hasEvidence: !!def.evidence,
  }
}

/**
 * Get all registered governed workflows.
 * Falls back to seed data when registry is empty (first boot / dev).
 */
export async function getWorkflowSummary(): Promise<WorkflowSummary> {
  try {
    const defs = listWorkflows()
    if (defs.length > 0) {
      const workflows = defs.map(defToRow)
      return {
        totalRegistered: workflows.length,
        withIngestion: workflows.filter((w) => w.hasIngestion).length,
        withFsm: workflows.filter((w) => w.hasFsm).length,
        withEvidence: workflows.filter((w) => w.hasEvidence).length,
        workflows,
      }
    }
  } catch {
    /* fall through to seed */
  }
  return seedWorkflowSummary()
}
