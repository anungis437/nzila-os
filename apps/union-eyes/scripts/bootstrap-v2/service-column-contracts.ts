export const SYSTEM_COLUMN_READ_CONTRACTS = [
  {
    table: 'external_data_sync_log',
    columns: ['sync_id'],
    caller: 'apps/union-eyes/lib/services/external-data/wage-enrichment-service.ts',
  },
  {
    table: 'commercial_contracts',
    columns: ['id', 'contract_number'],
    caller: 'apps/union-eyes/app/api/pilot/apply/[id]/commercial-transition/route.ts',
  },
] as const
