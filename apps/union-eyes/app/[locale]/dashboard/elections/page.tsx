/**
 * Council election records.
 *
 * Lists the records staff have entered. Voting, counting and published results are not available; see ElectionRecordsList.
 */
export const dynamic = 'force-dynamic';

import { ElectionRecordsList } from '@/components/elections/election-records-list';

export default function ElectionsDashboardPage() {
  return <ElectionRecordsList />;
}
