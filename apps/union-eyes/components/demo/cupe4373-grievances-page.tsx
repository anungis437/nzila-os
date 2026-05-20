import Link from "next/link";
import { AlertTriangle, CalendarClock, FileText, Scale, ShieldCheck, type LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { demoGrievanceCases } from "@/lib/demo/cupe4373-demo";

type Props = {
  locale: string;
};

const urgencyStyles = {
  urgent: "border-red-200 bg-red-50 text-red-800",
  watch: "border-amber-200 bg-amber-50 text-amber-800",
  steady: "border-slate-200 bg-slate-50 text-slate-700",
};

export function Cupe4373GrievancesPage({ locale }: Props) {
  const urgentCount = demoGrievanceCases.filter((item) => item.urgency === "urgent").length;
  const pendingResponseCount = demoGrievanceCases.filter((item) =>
    item.status.toLowerCase().includes("response") ||
    item.status.toLowerCase().includes("pending") ||
    item.status.toLowerCase().includes("due")
  ).length;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
          Grievance continuity
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Grievances</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Formal and near-formal dispute files are shown as steward casework with clear chronology,
              agreement references, deadlines, and handoff context. The demo keeps dispute handling
              human-accountable and evidence-led.
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <Metric label="Active" value={String(demoGrievanceCases.length)} />
            <Metric label="Urgent" value={String(urgentCount)} />
            <Metric label="Responses" value={String(pendingResponseCount)} />
          </div>
        </div>
      </section>

      <div className="grid gap-4">
        {demoGrievanceCases.map((item) => (
          <Link
            key={item.id}
            href={`/${locale}/dashboard/cases/${item.id}`}
            className="block rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors hover:bg-slate-50"
          >
            <div className="grid gap-4 xl:grid-cols-[1fr_300px]">
              <div className="min-w-0">
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <Badge variant="outline" className={urgencyStyles[item.urgency]}>
                    {item.status}
                  </Badge>
                  <span className="font-mono text-xs text-slate-500">{item.id}</span>
                  <span className="text-xs text-slate-400">/</span>
                  <span className="text-xs font-medium text-slate-600">{item.type}</span>
                </div>
                <h2 className="text-base font-semibold text-slate-950">{item.title}</h2>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{item.summary}</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.agreementRefs.map((ref) => (
                    <span key={ref} className="rounded-md bg-slate-100 px-2.5 py-1 text-xs text-slate-700">
                      {ref}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3 rounded-md bg-slate-50 p-4 text-sm">
                <InfoRow icon={ShieldCheck} label="Assigned steward" value={item.assignedSteward} />
                <InfoRow
                  icon={CalendarClock}
                  label="Next deadline"
                  value={new Date(item.deadline).toLocaleDateString("en-CA")}
                />
                <InfoRow icon={FileText} label="Continuity state" value={item.continuityState} />
                {item.flags.length > 0 && (
                  <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-amber-900">
                    <div className="mb-1 flex items-center gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4" />
                      Watch items
                    </div>
                    <p className="text-xs leading-5">{item.flags.join("; ")}</p>
                  </div>
                )}
              </div>
            </div>
          </Link>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Scale className="h-4 w-4 text-slate-500" />
            Demo boundary
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            "Chronology and evidence support steward judgment.",
            "The system records facts for accountable steward review.",
            "Sensitive files remain access-limited and human-accountable.",
          ].map((item) => (
            <div key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
      <p className="text-xl font-semibold text-slate-950">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-slate-500" />
      <div>
        <p className="font-medium text-slate-800">{value}</p>
        <p className="text-xs text-slate-500">{label}</p>
      </div>
    </div>
  );
}
