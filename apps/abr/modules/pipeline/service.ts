import { db } from '@nzila/db';
import { sql } from 'drizzle-orm';

import type { PipelineAccountRecord, PipelineSummary } from './types';

const DEMO_ACCOUNTS: PipelineAccountRecord[] = [
  {
    id: 'pipe_001',
    organizationName: 'Metro University',
    owner: 'Michel',
    stage: 'demo',
    nextAction: 'Confirm buyer demo attendees and procurement observer.',
    nextActionDueAt: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(),
    projectedValue: '$120,000 ARR',
    buyerChampion: 'VP People',
    crmStatus: 'on_track',
  },
  {
    id: 'pipe_002',
    organizationName: 'NorthCare Hospital',
    owner: 'Michel',
    stage: 'proposal',
    nextAction: 'Send board-ready executive summary and trust pack.',
    nextActionDueAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000).toISOString(),
    projectedValue: '$180,000 ARR',
    buyerChampion: 'Chief Equity Officer',
    crmStatus: 'on_track',
  },
  {
    id: 'pipe_003',
    organizationName: 'City of Lakeside',
    owner: 'Michel',
    stage: 'procurement',
    nextAction: 'Answer security questionnaire and submit implementation plan.',
    nextActionDueAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    projectedValue: '$95,000 ARR',
    buyerChampion: 'City Solicitor',
    crmStatus: 'at_risk',
  },
];

let tablesReady = false;

function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

function formatCurrency(value: number): string {
  return `$${value.toLocaleString()} ARR`;
}

function parseCurrency(value: string): number {
  const digits = value.replace(/[^\d]/g, '');
  return digits ? Number(digits) : 0;
}

async function ensureTables(): Promise<void> {
  if (!hasDatabase() || tablesReady) return;

  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS abr_pipeline_accounts (
      id text PRIMARY KEY,
      organization_name text NOT NULL,
      owner text NOT NULL,
      stage text NOT NULL,
      next_action text NOT NULL,
      next_action_due_at timestamptz NOT NULL,
      projected_value text NOT NULL,
      buyer_champion text NOT NULL,
      crm_status text NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const existing = (await db.execute(sql`
    SELECT id FROM abr_pipeline_accounts LIMIT 1
  `)) as Array<Record<string, unknown>>;

  if (existing.length === 0) {
    for (const item of DEMO_ACCOUNTS) {
      await db.execute(sql`
        INSERT INTO abr_pipeline_accounts (
          id, organization_name, owner, stage, next_action,
          next_action_due_at, projected_value, buyer_champion, crm_status
        ) VALUES (
          ${item.id}, ${item.organizationName}, ${item.owner}, ${item.stage}, ${item.nextAction},
          ${item.nextActionDueAt}::timestamptz, ${item.projectedValue}, ${item.buyerChampion}, ${item.crmStatus}
        )
      `);
    }
  }

  tablesReady = true;
}

function asAccount(row: Record<string, unknown>): PipelineAccountRecord {
  return {
    id: String(row.id),
    organizationName: String(row.organization_name),
    owner: String(row.owner),
    stage: row.stage as PipelineAccountRecord['stage'],
    nextAction: String(row.next_action),
    nextActionDueAt: String(row.next_action_due_at),
    projectedValue: String(row.projected_value),
    buyerChampion: String(row.buyer_champion),
    crmStatus: row.crm_status as PipelineAccountRecord['crmStatus'],
  };
}

export async function listPipelineAccounts(): Promise<PipelineAccountRecord[]> {
  if (!hasDatabase()) return DEMO_ACCOUNTS;
  await ensureTables();
  const rows = (await db.execute(sql`
    SELECT * FROM abr_pipeline_accounts
    ORDER BY next_action_due_at ASC
  `)) as Array<Record<string, unknown>>;
  return rows.map(asAccount);
}

export async function getPipelineSummary(): Promise<PipelineSummary> {
  const accounts = await listPipelineAccounts();
  const now = Date.now();
  return {
    totalAccounts: accounts.length,
    activeDemos: accounts.filter((item) => item.stage === 'demo').length,
    procurementActive: accounts.filter((item) => item.stage === 'procurement').length,
    projectedPipelineValue: formatCurrency(
      accounts.reduce((sum, item) => sum + parseCurrency(item.projectedValue), 0),
    ),
    overdueFollowUps: accounts.filter((item) => new Date(item.nextActionDueAt).getTime() < now).length,
  };
}
