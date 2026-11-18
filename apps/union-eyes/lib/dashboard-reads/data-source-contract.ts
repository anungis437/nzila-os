/** Operational sync status only. Error details, initiators, arbitrary parameters
 * and retained unprojected fields are not platform dashboard read authority. */
export const SYNC_LOG_OVERVIEW_COLUMNS = [
  'id',
  'source',
  'source_type',
  'sync_id',
  'started_at',
  'completed_at',
  'status',
  'records_processed',
  'records_inserted',
  'records_updated',
  'records_failed',
  'error_message',
  'sync_type',
] as const
