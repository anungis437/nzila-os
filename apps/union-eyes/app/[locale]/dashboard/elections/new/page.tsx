/**
 * Create a council election record.
 *
 * This records an election and its candidates. It does not open voting; see ElectionRecordForm.
 */
export const dynamic = 'force-dynamic';

import { ElectionRecordForm } from '@/components/elections/election-record-form';

export default function CreateElectionPage() {
  return <ElectionRecordForm />;
}
