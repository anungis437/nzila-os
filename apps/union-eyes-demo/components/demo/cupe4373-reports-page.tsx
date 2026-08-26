"use client";

import { useState } from "react";
import { CalendarClock, FileDown, FileText, ShieldCheck } from "lucide-react";
import { Badge } from "@nzila/union-eyes-ui/badge";
import { Button } from "@nzila/union-eyes-ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@nzila/union-eyes-ui/card";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@nzila/union-eyes-ui/sheet";
import { reports, demoCases, agreements } from "@/lib/demo/cupe4373-demo";

type Report = (typeof reports)[number];

function buildSampleContent(report: Report): { sections: { heading: string; body: string }[] } {
  const openCount = demoCases.filter((c) => c.status !== "Closed").length;
  const urgent = demoCases.filter((c) => c.urgency === "urgent");
  const cba = agreements[0];

  if (report.title.toLowerCase().includes("meeting")) {
    return {
      sections: [
        {
          heading: "Cases ready for review",
          body: urgent
            .map((c) => `• ${c.id} — ${c.title} (${c.worker}, ${c.unit})`)
            .join("\n") || "No urgent cases this cycle.",
        },
        {
          heading: "Status mix",
          body: [...new Set(demoCases.map((c) => c.status))]
            .map((s) => `• ${s}: ${demoCases.filter((c) => c.status === s).length}`)
            .join("\n"),
        },
        {
          heading: "Outstanding deadlines",
          body: demoCases
            .filter((c) => c.status !== "Closed")
            .slice(0, 5)
            .map((c) => `• ${c.id}: ${c.nextStep} — due ${new Date(c.deadline).toLocaleDateString("en-CA")}`)
            .join("\n"),
        },
        {
          heading: "Agreement references",
          body: `${cba.title} (effective ${cba.effective}, expires ${cba.expires})`,
        },
      ],
    };
  }

  if (report.title.toLowerCase().includes("audit") || report.title.toLowerCase().includes("chronolog")) {
    return {
      sections: [
        {
          heading: "Chronology overview",
          body: `${demoCases.length} cases tracked. ${openCount} currently open. All entries include who, what, when, and source.`,
        },
        {
          heading: "Recent activity",
          body: demoCases
            .slice(0, 4)
            .map((c) => `• ${c.id} — ${c.title}: opened ${new Date(c.opened).toLocaleDateString("en-CA")}, status ${c.status}`)
            .join("\n"),
        },
        {
          heading: "Boundaries preserved",
          body: "No worker scoring. No productivity ranking. Every entry attributable to a steward action.",
        },
      ],
    };
  }

  // Generic
  return {
    sections: [
      {
        heading: "Purpose",
        body: report.purpose,
      },
      {
        heading: "Cadence",
        body: report.cadence,
      },
      {
        heading: "Sample contents",
        body: `Open cases: ${openCount}\nUrgent cases: ${urgent.length}\nCBA: ${cba.title}`,
      },
    ],
  };
}

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function buildMeetingPackage(): string {
  const cba = agreements[0];
  const today = new Date().toISOString().slice(0, 10);
  const lines = [
    `CUPE LOCAL 4373 — STEWARD MEETING PACKAGE`,
    `Generated: ${today}`,
    ``,
    `── AGREEMENT IN EFFECT ──`,
    `${cba.title}`,
    `Effective ${cba.effective} → ${cba.expires}`,
    ``,
    `── OPEN CASES (${demoCases.filter((c) => c.status !== "Closed").length}) ──`,
  ];
  for (const c of demoCases.filter((c) => c.status !== "Closed")) {
    lines.push(``);
    lines.push(`${c.id} — ${c.title}`);
    lines.push(`  Worker: ${c.worker} (${c.unit})`);
    lines.push(`  Urgency: ${c.urgency}    Status: ${c.status}`);
    lines.push(`  Next step: ${c.nextStep}`);
    lines.push(`  Deadline: ${new Date(c.deadline).toLocaleString("en-CA")}`);
    if (c.flags.length > 0) {
      lines.push(`  Flags: ${c.flags.join("; ")}`);
    }
  }
  lines.push(``);
  lines.push(`── BOUNDARIES PRESERVED ──`);
  lines.push(`• No worker scoring`);
  lines.push(`• No productivity ranking`);
  lines.push(`• Every entry attributable to a steward action`);
  return lines.join("\n");
}

export function Cupe4373ReportsPage() {
  const [open, setOpen] = useState<Report | null>(null);
  const content = open ? buildSampleContent(open) : null;

  return (
    <>
      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
          Governance-safe reporting
        </Badge>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Reports</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Reporting is curated for steward coordination, meeting preparation, auditability, and
              continuity. It avoids productivity scoring and worker ranking.
            </p>
          </div>
          <Button
            onClick={() =>
              downloadText(
                `cupe4373-meeting-package-${new Date().toISOString().slice(0, 10)}.txt`,
                buildMeetingPackage(),
              )
            }
          >
            <FileDown className="mr-2 h-4 w-4" />
            Export meeting package
          </Button>
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-3">
        {reports.map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setOpen(item)}
            className="text-left"
          >
            <Card className="h-full border-slate-200 shadow-sm transition hover:border-slate-300 hover:shadow-md">
              <CardHeader className="pb-3">
                <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-md bg-slate-100 text-slate-700">
                  <FileText className="h-5 w-5" />
                </div>
                <CardTitle className="text-base">{item.title}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">{item.purpose}</p>
                <div className="flex items-center gap-2 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
                  <CalendarClock className="h-4 w-4 text-slate-500" />
                  {item.cadence}
                </div>
                <p className="text-xs text-blue-700">Click to preview sample contents →</p>
              </CardContent>
            </Card>
          </button>
        ))}
      </div>

      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-slate-500" />
            Report boundaries
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          {[
            "Case chronology and agreement references are preserved.",
            "Sensitive files remain limited to appropriate steward roles.",
            "Reports support human accountability; they do not automate decisions.",
          ].map((item) => (
            <div key={item} className="rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              {item}
            </div>
          ))}
        </CardContent>
      </Card>

      <Sheet open={open !== null} onOpenChange={(o) => !o && setOpen(null)}>
        <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-xl">
          {open && content && (
            <>
              <SheetHeader>
                <SheetTitle>{open.title}</SheetTitle>
                <SheetDescription>{open.purpose}</SheetDescription>
              </SheetHeader>
              <div className="mt-6 space-y-5">
                {content.sections.map((section) => (
                  <div key={section.heading}>
                    <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      {section.heading}
                    </h3>
                    <pre className="whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6 text-slate-700">
                      {section.body}
                    </pre>
                  </div>
                ))}
              </div>
              <SheetFooter className="mt-6">
                <Button
                  onClick={() =>
                    downloadText(
                      `${open.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}-${new Date()
                        .toISOString()
                        .slice(0, 10)}.txt`,
                      `${open.title}\n${"=".repeat(open.title.length)}\n\n${content.sections
                        .map((s) => `${s.heading}\n${"-".repeat(s.heading.length)}\n${s.body}`)
                        .join("\n\n")}`,
                    )
                  }
                  variant="outline"
                >
                  <FileDown className="mr-2 h-4 w-4" />
                  Download as text
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
