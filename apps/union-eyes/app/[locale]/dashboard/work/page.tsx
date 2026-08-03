export const dynamic = 'force-dynamic';

import type { Metadata } from 'next';
import WorkbenchConsole from '@/components/workbench/workbench-console';

export const metadata: Metadata = {
  title: 'Cases & Work | UnionEyes',
  description: 'Consolidated casework and grievance surface.',
};

/**
 * /dashboard/work — Wave 3 consolidated casework surface.
 *
 * Auth is enforced by the dashboard layout (requireUser + getUserRole).
 * WorkbenchConsole handles role-gated data access via its own API calls.
 */
export default function WorkPage() {
  return <WorkbenchConsole />;
}
