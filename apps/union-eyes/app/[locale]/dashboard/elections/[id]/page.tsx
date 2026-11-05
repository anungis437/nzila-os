/**
 * One council election record.
 *
 * Shows the record as stored. There is no ballot and no results tab: see ElectionRecordDetail.
 */
export const dynamic = 'force-dynamic';

import { ElectionRecordDetail } from '@/components/elections/election-record-detail';

type PageProps = {
  params: Promise<{ locale: string; id: string }>;
};

export default async function ElectionDetailPage({ params }: PageProps) {
  const { id } = await params;
  return <ElectionRecordDetail key={id} electionId={id} />;
}
