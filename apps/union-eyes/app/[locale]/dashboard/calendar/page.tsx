/**
 * Dashboard Calendar Page
 * Wraps the standalone calendar page within the dashboard layout shell.
 */
import CalendarPage from '@/app/[locale]/calendar/page';

export const dynamic = 'force-dynamic';

export default function DashboardCalendarPage() {
  return (
    <div className="h-full overflow-hidden">
      <CalendarPage />
    </div>
  );
}
