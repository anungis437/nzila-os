import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays, Clock, FolderClock } from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@nzila/union-eyes-ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { Cupe4373CalendarGrid } from "@/components/demo/cupe4373-calendar-grid";
import { calendarEvents } from "@/lib/demo/cupe4373-demo";
import { requireUser, hasMinRole } from "@/lib/api-auth-guard";
import { isCupe4373DemoRuntime } from "@/lib/dashboard/role-experience";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function DashboardCalendarPage({ params }: PageProps) {
  const { locale } = await params;

  try {
    await requireUser();
  } catch {
    redirect(`/${locale}/login`);
  }

  const hasAccess = !isCupe4373DemoRuntime() ? await hasMinRole("steward") : true;
  if (!hasAccess) {
    redirect(`/${locale}/dashboard`);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
          Deadline continuity
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Calendar</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          Upcoming case deadlines and meetings are presented as operational commitments, not a
          generic scheduling layer. The calendar keeps case handoffs and meeting preparation visible.
        </p>
      </section>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            Month view
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Cupe4373CalendarGrid locale={locale} />
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4 text-slate-500" />
              Next operational commitments
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {calendarEvents.map((event) => (
              <div key={`${event.date}-${event.title}`} className="rounded-lg border border-slate-200 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-950">{event.title}</p>
                    <p className="mt-1 text-sm leading-6 text-slate-600">{event.detail}</p>
                  </div>
                  <div className="shrink-0 rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                    <p className="font-medium">{event.date}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-500">
                      <Clock className="h-3 w-3" />
                      {event.time}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-slate-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FolderClock className="h-4 w-4 text-slate-500" />
              Meeting-room demo path
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm leading-6 text-slate-700">
            <p>
              Open the overtime case before the labour-management preparation meeting to show how
              chronology, documents, agreement references, and handoff notes stay together.
            </p>
            <Link
              href={`/${locale}/dashboard/cases/UE-4373-026`}
              className="block rounded-md border border-blue-200 bg-blue-50 px-3 py-2 font-medium text-blue-900 hover:bg-blue-100"
            >
              Open UE-4373-026 chronology
            </Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
