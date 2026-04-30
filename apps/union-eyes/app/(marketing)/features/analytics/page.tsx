export const dynamic = 'force-dynamic';

import { redirect } from 'next/navigation';

export default function AnalyticsPage() {
  redirect('/en-CA/features/analytics');
}
