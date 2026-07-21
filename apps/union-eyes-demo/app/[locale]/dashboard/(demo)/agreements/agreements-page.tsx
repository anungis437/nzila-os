"use client";

import { BookOpen, CalendarDays, FileText, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Cupe4373SectionNav } from "@/components/demo/cupe4373-section-nav";
import { agreements } from "@/lib/demo/cupe4373-demo";

export default function AgreementsPage({ initialQuery = "" }: { initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return agreements;
    return agreements.filter((item) =>
      [item.title, item.status, item.note, ...item.references]
        .join(" ")
        .toLowerCase()
        .includes(normalized)
    );
  }, [query]);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Cupe4373SectionNav />

      <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <Badge variant="outline" className="mb-3 border-blue-200 bg-blue-50 text-blue-800">
          Agreement memory
        </Badge>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Agreements</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
          The demo keeps agreement references close to active cases so stewards can move from
          symptom to article to chronology without losing operational context.
        </p>
      </section>

      <Card className="border-slate-200 shadow-sm">
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search overtime, scheduling, accommodation, seniority..."
              className="h-10 w-full rounded-md border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4">
        {filtered.map((item) => (
          <Card key={item.title} className="border-slate-200 shadow-sm">
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-800">
                      {item.status}
                    </Badge>
                    <Badge variant="outline" className="border-slate-200 text-slate-600">
                      CUPE 4373
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </div>
                <BookOpen className="h-5 w-5 text-slate-400" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm leading-6 text-slate-600">{item.note}</p>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-md bg-slate-50 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                    <CalendarDays className="h-4 w-4 text-slate-500" />
                    Effective period
                  </div>
                  <p className="text-slate-600">{item.effective} to {item.expires}</p>
                </div>
                <div className="rounded-md bg-slate-50 p-3 text-sm">
                  <div className="mb-1 flex items-center gap-2 font-medium text-slate-800">
                    <FileText className="h-4 w-4 text-slate-500" />
                    Common case references
                  </div>
                  <p className="text-slate-600">{item.references.join(", ")}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.references.map((ref) => (
                  <span key={ref} className="rounded-md bg-blue-50 px-2.5 py-1 text-xs text-blue-900">
                    {ref}
                  </span>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
